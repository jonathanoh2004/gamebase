import { z } from 'zod';
import { route } from '@/lib/http/route';
import { minute, roomParams } from '@/lib/http/schemas';
import { applyAction } from '@/lib/runtime/match-service';

// The action itself is validated by the game's own strict schema inside
// applyAction; here we only bound its size and shape.
const body = z.strictObject({
  expectedVersion: z.number().int().min(0),
  action: z.looseObject({ type: z.string().min(1).max(40) }),
});

export const POST = route(
  {
    auth: 'member',
    params: roomParams,
    body,
    maxBodyBytes: 4 * 1024,
    rateLimit: { bucket: 'actions', limit: 120, windowSec: minute },
  },
  async ({ viewer, params, body }) => applyAction(viewer, params.id, body),
);
