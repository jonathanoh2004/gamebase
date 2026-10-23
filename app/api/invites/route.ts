import { z } from 'zod';
import { route } from '@/lib/http/route';
import { day } from '@/lib/http/schemas';
import { createInvite } from '@/lib/server/invites';

const body = z.strictObject({ roomId: z.uuid().nullable().default(null) });

export const POST = route(
  { auth: 'member', body, rateLimit: { bucket: 'invite-create', limit: 30, windowSec: day } },
  async ({ viewer, body }) => {
    const { token, expiresAt } = await createInvite(viewer, body.roomId);
    return { path: `/invite/${token}`, expiresAt };
  },
);
