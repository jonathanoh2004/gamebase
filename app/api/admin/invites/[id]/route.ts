import { route } from '@/lib/http/route';
import { hour, idParams } from '@/lib/http/schemas';
import { revokeInvite } from '@/lib/server/invites';

export const DELETE = route(
  { auth: 'owner', params: idParams, rateLimit: { bucket: 'admin', limit: 120, windowSec: hour } },
  async ({ params }) => {
    await revokeInvite(params.id);
    return { ok: true };
  },
);
