import { route } from '@/lib/http/route';
import { hour } from '@/lib/http/schemas';
import { deleteAccount, profilePatch, updateProfile } from '@/lib/server/members';

export const PATCH = route(
  {
    auth: 'member',
    body: profilePatch,
    rateLimit: { bucket: 'profile', limit: 60, windowSec: hour },
  },
  async ({ viewer, body }) => {
    await updateProfile(viewer, body);
    return { ok: true };
  },
);

// Any signed-in account (even pending or revoked) may delete itself.
export const DELETE = route(
  { auth: 'user', rateLimit: { bucket: 'delete-account', limit: 5, windowSec: hour } },
  async ({ viewer }) => {
    await deleteAccount(viewer);
    return { ok: true };
  },
);
