import { z } from 'zod';
import { route } from '@/lib/http/route';
import { minute, roomParams } from '@/lib/http/schemas';
import { getRoomView, lobbyCommand, runLobbyCommand } from '@/lib/server/rooms';

const body = z.strictObject({ command: lobbyCommand });

export const POST = route(
  {
    auth: 'member',
    params: roomParams,
    body,
    rateLimit: { bucket: 'lobby', limit: 120, windowSec: minute },
  },
  async ({ viewer, params, body }) => {
    await runLobbyCommand(viewer, params.id, body.command);
    if (body.command.type === 'close') return { closed: true };
    if (body.command.type === 'leave') return { left: true };
    return getRoomView(viewer, params.id);
  },
);
