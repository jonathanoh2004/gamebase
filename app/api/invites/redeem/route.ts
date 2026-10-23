import { z } from 'zod';
import { route } from '@/lib/http/route';
import { hour } from '@/lib/http/schemas';
import { redeemInvite } from '@/lib/server/invites';

const body = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

// Signed in but not necessarily a member yet: this is how you become one.
export const POST = route(
  { auth: 'user', body, rateLimit: { bucket: 'invite-redeem', limit: 20, windowSec: hour } },
  async ({ viewer, body }) => redeemInvite(viewer, body.token),
);
