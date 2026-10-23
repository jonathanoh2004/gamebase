import 'server-only';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/lib/db/client';
import { profiles, type Role } from '@/lib/db/schema';
import { forbidden, unauthorized } from '@/lib/http/errors';
import { getSessionUser, type SessionUser } from './session';

export type Profile = typeof profiles.$inferSelect;

export interface Viewer extends SessionUser {
  profile: Profile;
}

export const isMemberRole = (role: Role) => role === 'member' || role === 'owner';

/** Seeds the generated geometric avatar; carries no meaning. */
export function newAvatarSeed(): string {
  return randomBytes(10).toString('hex');
}

/** Loads the caller's profile, creating a `pending` one on first sight. */
export async function ensureProfile(userId: string): Promise<Profile> {
  const existing = await db().select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (existing[0]) return existing[0];
  await db()
    .insert(profiles)
    .values({ id: userId, avatarSeed: newAvatarSeed(), role: 'pending' })
    .onConflictDoNothing();
  const created = await db().select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!created[0]) throw new Error('profile could not be created');
  return created[0];
}

/** The signed-in user with their profile, or null. Memoized per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  return { ...user, profile: await ensureProfile(user.id) };
});

export async function requireUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw unauthorized();
  return viewer;
}

/** Members and the owner. Pending and revoked accounts get nothing. */
export async function requireMember(): Promise<Viewer> {
  const viewer = await requireUser();
  if (!isMemberRole(viewer.profile.role)) {
    throw forbidden(
      viewer.profile.role === 'revoked' ? 'Your access was revoked.' : 'You need an invite first.',
    );
  }
  return viewer;
}

export async function requireOwner(): Promise<Viewer> {
  const viewer = await requireMember();
  if (viewer.profile.role !== 'owner') throw forbidden();
  return viewer;
}
