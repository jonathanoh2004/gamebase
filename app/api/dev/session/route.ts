import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  createDevSessionToken,
  DEV_SESSION_COOKIE,
  devSessionCookieOptions,
} from '@/lib/auth/dev-session';
import { DEV_USER_KEY, DEV_USERS, devUserId } from '@/lib/auth/dev-users';
import { newAvatarSeed } from '@/lib/auth/viewer';
import { sql } from '@/lib/db/client';
import { route } from '@/lib/http/route';

// LOCAL BACKEND ONLY (route() answers 404 otherwise): signs in as a dev user.

const body = z.strictObject({ user: z.string().regex(DEV_USER_KEY) });

export const POST = route({ auth: 'none', localOnly: true, body }, async ({ body }) => {
  const preset = DEV_USERS.find((u) => u.key === body.user);
  const id = devUserId(body.user);
  const db = sql();
  await db`
    insert into auth.users (id, email) values (${id}, ${`${body.user}@dev.local`})
    on conflict (id) do nothing
  `;
  await db`
    insert into app.profiles (id, display_name, avatar_seed, color, role)
    values (
      ${id},
      ${preset?.name ?? ''},
      ${newAvatarSeed()},
      ${preset?.color ?? 'yellow'},
      ${preset?.role ?? 'pending'}
    )
    on conflict (id) do nothing
  `;
  const store = await cookies();
  store.set(DEV_SESSION_COOKIE, createDevSessionToken(id), devSessionCookieOptions);
  return { userId: id };
});
