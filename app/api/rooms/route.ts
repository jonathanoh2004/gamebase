import { z } from 'zod';
import { route } from '@/lib/http/route';
import { hour } from '@/lib/http/schemas';
import { createRoom, listMyRooms } from '@/lib/server/rooms';

const body = z.strictObject({
  gameId: z.string().regex(/^[a-z0-9-]{1,40}$/),
  options: z.record(z.string(), z.unknown()).default({}),
});

export const POST = route(
  { auth: 'member', body, rateLimit: { bucket: 'room-create', limit: 30, windowSec: hour } },
  async ({ viewer, body }) => ({ roomId: await createRoom(viewer, body.gameId, body.options) }),
);

export const GET = route({ auth: 'member' }, async ({ viewer }) => ({
  rooms: await listMyRooms(viewer),
}));
