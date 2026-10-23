import { route } from '@/lib/http/route';
import { minute, roomParams } from '@/lib/http/schemas';
import { getRoomView } from '@/lib/server/rooms';

export const GET = route(
  {
    auth: 'member',
    params: roomParams,
    rateLimit: { bucket: 'room-read', limit: 300, windowSec: minute },
  },
  async ({ viewer, params }) => getRoomView(viewer, params.id),
);
