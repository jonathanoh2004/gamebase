import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, gte, lte, sql as raw } from 'drizzle-orm';
import { engineFor } from '@/games/engines';
import type { Viewer } from '@/lib/auth/viewer';
import { db, type Tx } from '@/lib/db/client';
import { type MatchSeat, matchActions, matches, roomSeats, rooms } from '@/lib/db/schema';
import { createRng } from '@/lib/engine/rng';
import type { AnyEngine, Frame, Outcome, Viewer as Seatish } from '@/lib/engine/types';
import { conflict, forbidden, notFound } from '@/lib/http/errors';
import { buildFrames } from './frames';

// The authoritative game loop (docs/DESIGN.md §4.2). Only this module reads a
// match's full state or seed; everything it returns is a per-viewer view.

/** Beyond this many versions behind, a client gets a fresh snapshot instead of frames. */
const MAX_REPLAY = 80;

export async function startMatch(
  tx: Tx,
  input: { roomId: string; engine: AnyEngine; seats: MatchSeat[]; options: unknown },
): Promise<string> {
  const { engine } = input;
  const seed = randomBytes(16).toString('hex');
  const options = engine.optionsSchema.parse(input.options ?? {});
  const state = engine.setup({
    seats: input.seats.map((s) => ({ seat: s.seat, name: s.name })),
    options,
    rng: createRng(seed, 0),
  });
  const [match] = await tx
    .insert(matches)
    .values({
      roomId: input.roomId,
      gameId: engine.id,
      engineVersion: engine.version,
      seed,
      seats: input.seats,
      state,
      version: 0,
    })
    .returning({ id: matches.id });
  if (!match) throw new Error('match insert failed');
  await tx.insert(matchActions).values({
    matchId: match.id,
    version: 0,
    seat: null,
    action: { type: '@setup' },
    events: [],
    stateAfter: state,
  });
  return match.id;
}

interface Access {
  roomId: string;
  matchId: string;
  engine: AnyEngine;
  seat: number | null;
}

/** Who is asking, and may they see this match? Seated players, or members when spectators are allowed. */
async function access(
  tx: Tx | ReturnType<typeof db>,
  viewer: Viewer,
  roomId: string,
  lock: boolean,
) {
  const q = tx.select().from(rooms).where(eq(rooms.id, roomId));
  const [room] = lock ? await q.for('update') : await q.limit(1);
  if (!room || room.status === 'abandoned' || !room.currentMatchId) {
    throw notFound('There’s no game in this room.');
  }
  const mq = tx.select().from(matches).where(eq(matches.id, room.currentMatchId));
  const [match] = lock ? await mq.for('update') : await mq.limit(1);
  if (!match) throw notFound('There’s no game in this room.');
  const engine = engineFor(match.gameId);
  if (!engine) throw notFound('That game doesn’t exist anymore.');
  if (engine.version !== match.engineVersion) {
    throw conflict('engine_updated', 'This game was updated since it started. Start a rematch.');
  }
  const seat = match.seats.find((s) => s.userId === viewer.id)?.seat ?? null;
  if (seat === null && !room.allowSpectators) {
    const [seated] = await tx
      .select({ seat: roomSeats.seat })
      .from(roomSeats)
      .where(and(eq(roomSeats.roomId, room.id), eq(roomSeats.userId, viewer.id)))
      .limit(1);
    if (!seated) throw forbidden('This room doesn’t allow spectators.');
  }
  return { room, match, engine, seat } as const;
}

export interface ActionResult {
  version: number;
  frames: Frame[];
  outcome: Outcome | null;
}

/** Validates and applies one move inside a row-locked transaction. */
export async function applyAction(
  viewer: Viewer,
  roomId: string,
  input: { expectedVersion: number; action: unknown },
): Promise<ActionResult> {
  return db().transaction(async (tx) => {
    const { room, match, engine, seat } = await access(tx, viewer, roomId, true);
    if (room.status !== 'playing' || match.finishedAt) {
      throw conflict('not_playing', 'This game is over.');
    }
    if (seat === null) throw forbidden('You’re watching this game, not playing it.');
    if (input.expectedVersion !== match.version) {
      throw conflict('stale', 'The game moved on. Catching up…', { version: match.version });
    }
    const state = match.state;
    if (!engine.activeSeats(state).includes(seat)) {
      throw conflict('not_your_turn', 'It’s not your turn.');
    }
    const action = engine.actionSchema.parse(input.action);
    const version = match.version + 1;
    const events = engine.decide(state, action, { seat, rng: createRng(match.seed, version) });
    let next = state;
    for (const event of events) next = engine.evolve(next, event);
    const outcome = engine.outcome(next);

    await tx.insert(matchActions).values({
      matchId: match.id,
      version,
      seat,
      action,
      events,
      stateAfter: next,
    });
    await tx
      .update(matches)
      .set({ state: next, version, outcome, finishedAt: outcome ? raw`now()` : null })
      .where(eq(matches.id, match.id));
    if (outcome) {
      await tx
        .update(rooms)
        .set({
          status: 'finished',
          lobbyVersion: raw`${rooms.lobbyVersion} + 1`,
          updatedAt: raw`now()`,
        })
        .where(eq(rooms.id, room.id));
    }
    return {
      version,
      frames: buildFrames(engine, state, [{ version, events }], seat),
      outcome,
    };
  });
}

export interface SyncResult {
  matchId: string;
  version: number;
  /** Your seat, or null when watching. */
  seat: number | null;
  /** Set when the client was too far behind (or new): render this directly. */
  snapshot: unknown | null;
  frames: Frame[];
  outcome: Outcome | null;
}

/** Everything that happened after `after`, as this viewer is allowed to see it. */
export async function syncMatch(
  viewer: Viewer,
  roomId: string,
  after: number | null,
): Promise<SyncResult> {
  const { match, engine, seat } = await access(db(), viewer, roomId, false);
  const viewerSeat: Seatish = seat ?? 'spectator';
  const base = {
    matchId: match.id,
    version: match.version,
    seat,
    outcome: (match.outcome as Outcome | null) ?? null,
  };
  if (after === null || after < 0 || after > match.version || match.version - after > MAX_REPLAY) {
    return { ...base, snapshot: engine.viewFor(match.state, viewerSeat), frames: [] };
  }
  if (after === match.version) return { ...base, snapshot: null, frames: [] };

  const rows = await db()
    .select({
      version: matchActions.version,
      events: matchActions.events,
      stateAfter: matchActions.stateAfter,
    })
    .from(matchActions)
    .where(
      and(
        eq(matchActions.matchId, match.id),
        gte(matchActions.version, after),
        lte(matchActions.version, match.version),
      ),
    )
    .orderBy(asc(matchActions.version));
  const [start, ...rest] = rows;
  if (!start || start.version !== after) {
    return { ...base, snapshot: engine.viewFor(match.state, viewerSeat), frames: [] };
  }
  return {
    ...base,
    snapshot: null,
    frames: buildFrames(
      engine,
      start.stateAfter,
      rest.map((r) => ({ version: r.version, events: r.events })),
      viewerSeat,
    ),
  };
}
