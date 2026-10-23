import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { inject } from 'vitest';
import type { Viewer } from '@/lib/auth/viewer';
import { db } from '@/lib/db/client';
import { type PlayerColor, profiles, type Role } from '@/lib/db/schema';

let ownerSql: postgres.Sql | null = null;

/** Owner-role connection for test setup only (the app itself never has one). */
export function owner(): postgres.Sql {
  ownerSql ??= postgres(inject('ownerDatabaseUrl'), { max: 1, onnotice: () => {} });
  return ownerSql;
}

export async function closeOwner() {
  await ownerSql?.end();
  ownerSql = null;
}

export async function makeUser(
  name: string,
  role: Role = 'member',
  color: PlayerColor = 'red',
): Promise<Viewer> {
  const id = randomUUID();
  await owner()`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})`;
  await owner()`
    insert into app.profiles (id, display_name, avatar_seed, color, role)
    values (${id}, ${name}, ${`seed${id.slice(0, 8)}`}, ${color}, ${role})
  `;
  return refresh({ id } as Viewer);
}

/** Re-reads the profile (roles change during tests). */
export async function refresh(viewer: Pick<Viewer, 'id'>): Promise<Viewer> {
  const [profile] = await db().select().from(profiles).where(eq(profiles.id, viewer.id));
  if (!profile) throw new Error('no profile');
  return { id: viewer.id, email: null, suggestedName: null, profile };
}
