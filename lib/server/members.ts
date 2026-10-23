import 'server-only';
import { and, asc, eq, inArray, isNull, ne, sql as raw } from 'drizzle-orm';
import { z } from 'zod';
import type { Viewer } from '@/lib/auth/viewer';
import { db, type Tx } from '@/lib/db/client';
import { invites, matches, PLAYER_COLORS, profiles, roomSeats, rooms } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { badRequest, conflict, notFound } from '@/lib/http/errors';
import { supabaseAdmin } from '@/lib/supabase/server';

// Profiles, the owner's member tools, and account deletion.

/** Display names: letters, numbers, spaces and a little punctuation; never markup. */
export const displayName = z
  .string()
  .transform((s) => s.normalize('NFC').replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(1, 'Pick a name.')
      .max(24, 'Keep it under 24 characters.')
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u, "Letters, numbers, spaces and . _ ' - only."),
  );

export const profilePatch = z.strictObject({
  displayName: displayName.optional(),
  color: z.enum(PLAYER_COLORS).optional(),
});

export async function updateProfile(viewer: Viewer, patch: z.infer<typeof profilePatch>) {
  if (patch.displayName === undefined && patch.color === undefined) return;
  await db()
    .update(profiles)
    .set({ ...patch, updatedAt: raw`now()` })
    .where(eq(profiles.id, viewer.id));
}

export async function listMembers() {
  return db()
    .select({
      id: profiles.id,
      name: profiles.displayName,
      avatarSeed: profiles.avatarSeed,
      color: profiles.color,
      role: profiles.role,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(ne(profiles.role, 'pending'))
    .orderBy(asc(profiles.createdAt))
    .limit(500);
}

/** Leaves every open lobby and hands hosted rooms to someone else. */
async function leaveLobbies(tx: Tx, userId: string) {
  const seated = await tx
    .select({ roomId: roomSeats.roomId })
    .from(roomSeats)
    .innerJoin(rooms, eq(rooms.id, roomSeats.roomId))
    .where(and(eq(roomSeats.userId, userId), eq(rooms.status, 'lobby')));
  const roomIds = seated.map((s) => s.roomId);
  if (roomIds.length === 0) return;
  await tx
    .delete(roomSeats)
    .where(and(eq(roomSeats.userId, userId), inArray(roomSeats.roomId, roomIds)));
  for (const roomId of roomIds) {
    const [next] = await tx
      .select({ userId: roomSeats.userId })
      .from(roomSeats)
      .where(eq(roomSeats.roomId, roomId))
      .orderBy(asc(roomSeats.seat))
      .limit(1);
    await tx
      .update(rooms)
      .set({
        hostId: raw`case when ${rooms.hostId} = ${userId} then ${next?.userId ?? null}::uuid else ${rooms.hostId} end`,
        status: next ? raw`${rooms.status}` : 'abandoned',
        lobbyVersion: raw`${rooms.lobbyVersion} + 1`,
        updatedAt: raw`now()`,
      })
      .where(eq(rooms.id, roomId));
  }
}

/** Owner only. Locks the member out on their next request and ends their sessions. */
export async function revokeMember(owner: Viewer, userId: string) {
  if (userId === owner.id) throw badRequest('You can’t revoke yourself.');
  await db().transaction(async (tx) => {
    const [target] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for('update');
    if (!target) throw notFound('No such member.');
    if (target.role === 'owner') throw badRequest('The owner can’t be revoked.');
    if (target.role === 'revoked') return;
    await tx
      .update(profiles)
      .set({ role: 'revoked', updatedAt: raw`now()` })
      .where(eq(profiles.id, userId));
    await tx
      .update(invites)
      .set({ revokedAt: raw`now()` })
      .where(and(eq(invites.createdBy, userId), isNull(invites.usedAt), isNull(invites.revokedAt)));
    await leaveLobbies(tx, userId);
  });
  if (env().GAMEBASE_BACKEND === 'supabase') {
    // A ban stops refresh tokens, so every device is signed out within the
    // access token's lifetime; our role check already refuses them now.
    const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (error) throw new Error(`could not ban user: ${error.message}`);
  }
}

export async function restoreMember(userId: string) {
  const updated = await db()
    .update(profiles)
    .set({ role: 'member', updatedAt: raw`now()` })
    .where(and(eq(profiles.id, userId), eq(profiles.role, 'revoked')))
    .returning({ id: profiles.id });
  if (updated.length === 0) throw conflict('not_revoked', 'That account isn’t revoked.');
  if (env().GAMEBASE_BACKEND === 'supabase') {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });
    if (error) throw new Error(`could not unban user: ${error.message}`);
  }
}

/**
 * Deletes the caller's account. Past games keep a "Former player" in their
 * seat; everything else tied to the account is removed.
 */
export async function deleteAccount(viewer: Viewer) {
  if (viewer.profile.role === 'owner') {
    throw badRequest('Hand ownership to someone else before deleting the owner account.');
  }
  await db().transaction(async (tx) => {
    await leaveLobbies(tx, viewer.id);
    const played = await tx
      .select({ id: matches.id, seats: matches.seats })
      .from(matches)
      .where(raw`${matches.seats} @> ${JSON.stringify([{ userId: viewer.id }])}::jsonb`);
    for (const m of played) {
      const seats = m.seats.map((s) =>
        s.userId === viewer.id ? { ...s, userId: null, name: 'Former player' } : s,
      );
      await tx.update(matches).set({ seats }).where(eq(matches.id, m.id));
    }
    await tx.update(rooms).set({ hostId: null }).where(eq(rooms.hostId, viewer.id));
  });
  if (env().GAMEBASE_BACKEND === 'supabase') {
    const { error } = await supabaseAdmin().auth.admin.deleteUser(viewer.id);
    if (error) throw new Error(`could not delete user: ${error.message}`);
  } else {
    // Local stand-in for Supabase Auth; deleting the user cascades to the profile.
    await db().execute(raw`delete from auth.users where id = ${viewer.id}`);
  }
}
