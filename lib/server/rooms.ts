import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql as raw } from 'drizzle-orm';
import { z } from 'zod';
import { engineFor } from '@/games/engines';
import { manifestFor } from '@/games/manifests';
import type { Viewer } from '@/lib/auth/viewer';
import { db, type Tx } from '@/lib/db/client';
import {
  matches,
  PLAYER_COLORS,
  type PlayerColor,
  profiles,
  type RoomStatus,
  roomSeats,
  rooms,
} from '@/lib/db/schema';
import type { Outcome } from '@/lib/engine/types';
import { badRequest, conflict, forbidden, notFound } from '@/lib/http/errors';
import { startMatch } from '@/lib/runtime/match-service';

export type Room = typeof rooms.$inferSelect;

export interface SeatView {
  seat: number;
  name: string;
  avatarSeed: string;
  color: PlayerColor;
  ready: boolean;
  isHost: boolean;
  isYou: boolean;
}

export interface MatchPlayer {
  seat: number;
  name: string;
  avatarSeed: string;
  color: PlayerColor;
  isYou: boolean;
}

/** Everything a member may see about a room. Never includes user IDs or emails. */
export interface RoomView {
  id: string;
  code: string;
  gameId: string;
  status: RoomStatus;
  locked: boolean;
  allowSpectators: boolean;
  options: Record<string, unknown>;
  lobbyVersion: number;
  players: { min: number; max: number };
  seats: SeatView[];
  you: { seat: number | null; isHost: boolean; canJoin: boolean; matchSeat: number | null };
  match: {
    id: string;
    version: number;
    players: MatchPlayer[];
    finished: boolean;
    outcome: Outcome | null;
  } | null;
}

// No 0/O or 1/I lookalikes. A display label, not a key.
// biome-ignore lint/security/noSecrets: an alphabet, not a secret
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRoomCode = () =>
  Array.from(randomBytes(4), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

function gameOrThrow(gameId: string) {
  const manifest = manifestFor(gameId);
  const engine = engineFor(gameId);
  if (!manifest || !engine) throw badRequest('That game doesn’t exist.');
  if (manifest.devOnly && process.env.VERCEL_ENV === 'production') {
    throw badRequest('That game doesn’t exist.');
  }
  return { manifest, engine };
}

async function lockRoom(tx: Tx, roomId: string): Promise<Room> {
  const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId)).for('update');
  if (!room) throw notFound('That room doesn’t exist.');
  return room;
}

const bump = { lobbyVersion: raw`${rooms.lobbyVersion} + 1`, updatedAt: raw`now()` };

// ---------------------------------------------------------------------------

export async function createRoom(viewer: Viewer, gameId: string, options: unknown) {
  const { engine } = gameOrThrow(gameId);
  const parsedOptions = engine.optionsSchema.parse(options ?? {}) as Record<string, unknown>;
  return db().transaction(async (tx) => {
    const [room] = await tx
      .insert(rooms)
      .values({ code: newRoomCode(), gameId, hostId: viewer.id, options: parsedOptions })
      .returning();
    if (!room) throw new Error('room insert failed');
    await tx.insert(roomSeats).values({
      roomId: room.id,
      seat: 0,
      userId: viewer.id,
      color: viewer.profile.color,
      ready: true,
    });
    return room.id;
  });
}

export async function listMyRooms(viewer: Viewer) {
  return db()
    .select({
      id: rooms.id,
      code: rooms.code,
      gameId: rooms.gameId,
      status: rooms.status,
      updatedAt: rooms.updatedAt,
    })
    .from(roomSeats)
    .innerJoin(rooms, eq(rooms.id, roomSeats.roomId))
    .where(
      and(eq(roomSeats.userId, viewer.id), inArray(rooms.status, ['lobby', 'playing', 'finished'])),
    )
    .orderBy(desc(rooms.updatedAt))
    .limit(12);
}

export async function getRoomView(viewer: Viewer, roomId: string): Promise<RoomView> {
  const [room] = await db().select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room || room.status === 'abandoned') throw notFound('That room doesn’t exist.');
  const { manifest } = gameOrThrow(room.gameId);

  const seatRows = await db()
    .select({
      seat: roomSeats.seat,
      userId: roomSeats.userId,
      color: roomSeats.color,
      ready: roomSeats.ready,
      name: profiles.displayName,
      avatarSeed: profiles.avatarSeed,
    })
    .from(roomSeats)
    .innerJoin(profiles, eq(profiles.id, roomSeats.userId))
    .where(eq(roomSeats.roomId, room.id))
    .orderBy(asc(roomSeats.seat));

  const mine = seatRows.find((s) => s.userId === viewer.id);
  let match: RoomView['match'] = null;
  let matchSeat: number | null = null;
  if (room.currentMatchId) {
    const [m] = await db()
      .select({
        id: matches.id,
        version: matches.version,
        seats: matches.seats,
        outcome: matches.outcome,
        finishedAt: matches.finishedAt,
      })
      .from(matches)
      .where(eq(matches.id, room.currentMatchId))
      .limit(1);
    if (m) {
      matchSeat = m.seats.find((s) => s.userId === viewer.id)?.seat ?? null;
      match = {
        id: m.id,
        version: m.version,
        finished: m.finishedAt !== null,
        outcome: (m.outcome as Outcome | null) ?? null,
        players: m.seats.map((s) => ({
          seat: s.seat,
          name: s.name,
          avatarSeed: s.avatarSeed,
          color: s.color,
          isYou: s.userId === viewer.id,
        })),
      };
    }
  }

  return {
    id: room.id,
    code: room.code,
    gameId: room.gameId,
    status: room.status,
    locked: room.locked,
    allowSpectators: room.allowSpectators,
    options: room.options,
    lobbyVersion: room.lobbyVersion,
    players: { min: manifest.players.min, max: manifest.players.max },
    seats: seatRows.map((s) => ({
      seat: s.seat,
      name: s.name || 'Player',
      avatarSeed: s.avatarSeed,
      color: s.color,
      ready: s.ready,
      isHost: s.userId === room.hostId,
      isYou: s.userId === viewer.id,
    })),
    you: {
      seat: mine?.seat ?? null,
      isHost: room.hostId === viewer.id,
      canJoin:
        !mine && room.status === 'lobby' && !room.locked && seatRows.length < manifest.players.max,
      matchSeat,
    },
    match,
  };
}

// Lobby commands -------------------------------------------------------------

export const lobbyCommand = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('join') }),
  z.strictObject({ type: z.literal('leave') }),
  z.strictObject({ type: z.literal('color'), color: z.enum(PLAYER_COLORS) }),
  z.strictObject({ type: z.literal('ready'), ready: z.boolean() }),
  z.strictObject({ type: z.literal('kick'), seat: z.number().int().min(0).max(15) }),
  z.strictObject({ type: z.literal('lock'), locked: z.boolean() }),
  z.strictObject({ type: z.literal('spectators'), allow: z.boolean() }),
  z.strictObject({ type: z.literal('options'), options: z.record(z.string(), z.unknown()) }),
  z.strictObject({ type: z.literal('start') }),
  z.strictObject({ type: z.literal('rematch') }),
  z.strictObject({ type: z.literal('close') }),
]);
export type LobbyCommand = z.infer<typeof lobbyCommand>;

async function seatsOf(tx: Tx, roomId: string) {
  return tx
    .select()
    .from(roomSeats)
    .where(eq(roomSeats.roomId, roomId))
    .orderBy(asc(roomSeats.seat));
}

function firstFreeColor(taken: Set<string>, preferred: PlayerColor): PlayerColor {
  if (!taken.has(preferred)) return preferred;
  const free = PLAYER_COLORS.find((c) => !taken.has(c));
  if (!free) throw conflict('room_full', 'This room is full.');
  return free;
}

async function insertSeat(
  tx: Tx,
  roomId: string,
  seats: (typeof roomSeats.$inferSelect)[],
  viewer: Viewer,
) {
  const taken = new Set(seats.map((s) => s.seat));
  const seat = Array.from({ length: 16 }, (_, i) => i).find((i) => !taken.has(i)) ?? 0;
  const color = firstFreeColor(new Set(seats.map((s) => s.color)), viewer.profile.color);
  await tx.insert(roomSeats).values({ roomId, seat, userId: viewer.id, color });
}

/**
 * Seats `viewer` in a locked room row if there's space (used by invite
 * links). Returns false instead of throwing when they can't sit.
 */
export async function trySeat(tx: Tx, room: Room, viewer: Viewer): Promise<boolean> {
  const { manifest } = gameOrThrow(room.gameId);
  const seats = await seatsOf(tx, room.id);
  if (seats.some((s) => s.userId === viewer.id)) return true;
  if (room.status !== 'lobby' || room.locked || seats.length >= manifest.players.max) return false;
  await insertSeat(tx, room.id, seats, viewer);
  await tx.update(rooms).set(bump).where(eq(rooms.id, room.id));
  return true;
}

/** Applies one lobby command for `viewer`. Host-only commands are checked here. */
export async function runLobbyCommand(viewer: Viewer, roomId: string, cmd: LobbyCommand) {
  await db().transaction(async (tx) => {
    const room = await lockRoom(tx, roomId);
    if (room.status === 'abandoned') throw notFound('That room doesn’t exist.');
    const { manifest, engine } = gameOrThrow(room.gameId);
    const seats = await seatsOf(tx, room.id);
    const mine = seats.find((s) => s.userId === viewer.id);
    const isHost = room.hostId === viewer.id;
    const hostOnly = () => {
      if (!isHost) throw forbidden('Only the host can do that.');
    };
    const inLobby = () => {
      if (room.status !== 'lobby') throw conflict('not_in_lobby', 'The game has already started.');
    };

    switch (cmd.type) {
      case 'join': {
        inLobby();
        if (mine) return;
        if (room.locked) throw conflict('locked', 'The host locked this room.');
        if (seats.length >= manifest.players.max) throw conflict('room_full', 'This room is full.');
        await insertSeat(tx, room.id, seats, viewer);
        break;
      }
      case 'leave': {
        inLobby();
        if (!mine) return;
        await tx
          .delete(roomSeats)
          .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.userId, viewer.id)));
        if (isHost) {
          const next = seats.find((s) => s.userId !== viewer.id);
          if (next) {
            await tx.update(rooms).set({ hostId: next.userId }).where(eq(rooms.id, room.id));
          } else {
            await tx.update(rooms).set({ status: 'abandoned' }).where(eq(rooms.id, room.id));
          }
        }
        break;
      }
      case 'color': {
        inLobby();
        if (!mine) throw forbidden('Take a seat first.');
        if (seats.some((s) => s.color === cmd.color && s.userId !== viewer.id)) {
          throw conflict('color_taken', 'Someone already has that color.');
        }
        await tx
          .update(roomSeats)
          .set({ color: cmd.color })
          .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.userId, viewer.id)));
        break;
      }
      case 'ready': {
        inLobby();
        if (!mine) throw forbidden('Take a seat first.');
        await tx
          .update(roomSeats)
          .set({ ready: cmd.ready })
          .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.userId, viewer.id)));
        break;
      }
      case 'kick': {
        hostOnly();
        inLobby();
        const target = seats.find((s) => s.seat === cmd.seat);
        if (!target) return;
        if (target.userId === viewer.id) throw badRequest('You can’t kick yourself.');
        await tx
          .delete(roomSeats)
          .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.seat, cmd.seat)));
        break;
      }
      case 'lock': {
        hostOnly();
        await tx.update(rooms).set({ locked: cmd.locked }).where(eq(rooms.id, room.id));
        break;
      }
      case 'spectators': {
        hostOnly();
        await tx.update(rooms).set({ allowSpectators: cmd.allow }).where(eq(rooms.id, room.id));
        break;
      }
      case 'options': {
        hostOnly();
        inLobby();
        const options = engine.optionsSchema.parse(cmd.options) as Record<string, unknown>;
        await tx.update(rooms).set({ options }).where(eq(rooms.id, room.id));
        break;
      }
      case 'start': {
        hostOnly();
        inLobby();
        if (seats.length < manifest.players.min) {
          throw conflict('too_few', `${manifest.name} needs at least ${manifest.players.min}.`);
        }
        if (seats.some((s) => !s.ready && s.userId !== viewer.id)) {
          throw conflict('not_ready', 'Everyone needs to be ready.');
        }
        const people = await tx
          .select({ id: profiles.id, name: profiles.displayName, avatarSeed: profiles.avatarSeed })
          .from(profiles)
          .where(
            inArray(
              profiles.id,
              seats.map((s) => s.userId),
            ),
          );
        const byId = new Map(people.map((p) => [p.id, p]));
        const matchSeats = seats.map((s, i) => ({
          seat: i,
          userId: s.userId,
          name: byId.get(s.userId)?.name || `Player ${i + 1}`,
          color: s.color,
          avatarSeed: byId.get(s.userId)?.avatarSeed ?? 'seed0000',
        }));
        const matchId = await startMatch(tx, {
          roomId: room.id,
          engine,
          seats: matchSeats,
          options: room.options,
        });
        await tx
          .update(rooms)
          .set({ status: 'playing', currentMatchId: matchId, locked: true })
          .where(eq(rooms.id, room.id));
        break;
      }
      case 'rematch': {
        hostOnly();
        if (room.status !== 'finished') throw conflict('not_finished', 'The game isn’t over yet.');
        await tx
          .update(roomSeats)
          .set({ ready: room.hostId ? raw`${roomSeats.userId} = ${room.hostId}` : false })
          .where(eq(roomSeats.roomId, room.id));
        await tx.update(rooms).set({ status: 'lobby', locked: false }).where(eq(rooms.id, room.id));
        break;
      }
      case 'close': {
        hostOnly();
        await tx.update(rooms).set({ status: 'abandoned' }).where(eq(rooms.id, room.id));
        break;
      }
    }
    await tx.update(rooms).set(bump).where(eq(rooms.id, room.id));
  });
}

/**
 * Mirrors app_realtime.can_join_room_topic(): seated players, or any member
 * when the room allows spectators. Returns how this viewer appears on the
 * room's channel (local backend; Supabase evaluates the SQL policy itself).
 */
export async function channelIdentity(viewer: Viewer, roomId: string) {
  const view = await getRoomView(viewer, roomId);
  const seat = view.you.matchSeat ?? view.you.seat;
  if (seat === null && !view.allowSpectators)
    throw forbidden('This room doesn’t allow spectators.');
  return { seat, name: viewer.profile.displayName || 'Player' };
}
