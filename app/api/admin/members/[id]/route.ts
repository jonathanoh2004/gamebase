import { z } from 'zod';
import { route } from '@/lib/http/route';
import { hour, idParams } from '@/lib/http/schemas';
import { restoreMember, revokeMember } from '@/lib/server/members';

const body = z.strictObject({ action: z.enum(['revoke', 'restore']) });

export const POST = route(
  {
    auth: 'owner',
    params: idParams,
    body,
    rateLimit: { bucket: 'admin', limit: 120, windowSec: hour },
  },
  async ({ viewer, params, body }) => {
    if (body.action === 'revoke') await revokeMember(viewer, params.id);
    else await restoreMember(params.id);
    return { ok: true };
  },
);
