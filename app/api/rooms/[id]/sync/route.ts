import { z } from 'zod';
import { route } from '@/lib/http/route';
import { minute, roomParams } from '@/lib/http/schemas';
import { syncMatch } from '@/lib/runtime/match-service';

const query = z.strictObject({
  after: z.coerce.number().int().min(-1).max(1_000_000).optional(),
});

export const GET = route(
  {
    auth: 'member',
    params: roomParams,
    query,
    rateLimit: { bucket: 'sync', limit: 600, windowSec: minute },
  },
  async ({ viewer, params, query }) => syncMatch(viewer, params.id, query.after ?? null),
);
