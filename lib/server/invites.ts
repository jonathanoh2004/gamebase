import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql as raw } from 'drizzle-orm';
import { isMemberRole, type Viewer } from '@/lib/auth/viewer';
import { db } from '@/lib/db/client';
import { invites, profiles, roomSeats, rooms } from '@/lib/db/schema';
import { conflict, forbidden, notFound } from '@/lib/http/errors';
import { trySeat } from './rooms';

// One-time invite links (docs/DESIGN.md §8.2). The link carries 256 bits of
// randomness; the database keeps only its SHA-256, so a leaked table holds no
// working links. Unused links expire after 48 hours.

const TTL_MS = 48 * 60 * 60 * 1000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const isInviteToken = (token: string) => TOKEN.test(token);

export async function createInvite(viewer: Viewer, roomId: string | null) {
  if (roomId) {
    // You can only invite people into a room you're sitting in.
    const [seat] = await db()
      .select({ seat: roomSeats.seat })
      .from(roomSeats)
      .where(and(eq(roomSeats.roomId, roomId), eq(roomSeats.userId, viewer.id)))
      .limit(1);
    if (!seat) throw forbidden('Take a seat in the room first.');
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db()
    .insert(invites)
    .values({
      tokenHash: hashToken(token),
      createdBy: viewer.id,
      roomId,
      expiresAt,
    });
  return { token, expiresAt: expiresAt.toISOString() };
}

const usable = (tokenHash: string) =>
  and(
    eq(invites.tokenHash, tokenHash),
    isNull(invites.usedAt),
    isNull(invites.revokedAt),
    gt(invites.expiresAt, raw`now()`),
  );

/**
 * What the invite page may show before sign-in: only that the link works and
 * the inviter's display name.
 */
export async function peekInvite(token: string) {
  if (!isInviteToken(token)) return null;
  const [row] = await db()
    .select({ inviter: profiles.displayName, roomId: invites.roomId })
    .from(invites)
    .innerJoin(profiles, eq(profiles.id, invites.createdBy))
    .where(and(usable(hashToken(token)), raw`${profiles.role} in ('member', 'owner')`))
    .limit(1);
  return row ? { inviter: row.inviter || 'A friend', hasRoom: row.roomId !== null } : null;
}

/**
 * Accepts an invite. A pending account becomes a member (consuming the link);
 * an existing member just gets taken to the room, leaving the link unused.
 */
export async function redeemInvite(
  viewer: Viewer,
  token: string,
): Promise<{ roomId: string | null }> {
  if (!isInviteToken(token)) throw notFound('That invite link isn’t valid.');
  if (viewer.profile.role === 'revoked') throw forbidden('Your access was revoked.');
  return db().transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(invites)
      .where(usable(hashToken(token)))
      .for('update');
    if (!invite) throw notFound('That invite link has expired or was already used.');
    const [inviter] = await tx
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, invite.createdBy))
      .limit(1);
    if (!inviter || !isMemberRole(inviter.role)) {
      throw notFound('That invite link has expired or was already used.');
    }

    if (viewer.profile.role === 'pending') {
      await tx
        .update(profiles)
        .set({ role: 'member', invitedBy: invite.createdBy, updatedAt: raw`now()` })
        .where(and(eq(profiles.id, viewer.id), eq(profiles.role, 'pending')));
      await tx
        .update(invites)
        .set({ usedBy: viewer.id, usedAt: raw`now()` })
        .where(eq(invites.id, invite.id));
    }

    if (!invite.roomId) return { roomId: null };
    const [room] = await tx.select().from(rooms).where(eq(rooms.id, invite.roomId)).for('update');
    if (!room || room.status === 'abandoned') return { roomId: null };
    // The account may have just become a member; seat it with its fresh role.
    await trySeat(tx, room, { ...viewer, profile: { ...viewer.profile, role: 'member' } });
    return { roomId: room.id };
  });
}

// Owner tools ---------------------------------------------------------------

export async function listOpenInvites() {
  return db()
    .select({
      id: invites.id,
      createdBy: profiles.displayName,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .innerJoin(profiles, eq(profiles.id, invites.createdBy))
    .where(
      and(isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, raw`now()`)),
    )
    .orderBy(desc(invites.createdAt))
    .limit(100);
}

export async function revokeInvite(inviteId: string) {
  const result = await db()
    .update(invites)
    .set({ revokedAt: raw`now()` })
    .where(and(eq(invites.id, inviteId), isNull(invites.usedAt), isNull(invites.revokedAt)))
    .returning({ id: invites.id });
  if (result.length === 0) throw conflict('not_open', 'That invite is no longer open.');
}
