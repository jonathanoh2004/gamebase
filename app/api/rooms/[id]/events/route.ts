import { z } from 'zod';
import { route } from '@/lib/http/route';
import { minute, roomParams } from '@/lib/http/schemas';
import { localHub } from '@/lib/realtime/local-hub';
import { fxMessage } from '@/lib/realtime/messages';
import { channelIdentity } from '@/lib/server/rooms';

// LOCAL BACKEND ONLY: the stand-in for a room's Supabase Realtime channel.
// GET streams doorbells, presence and fx as server-sent events; POST relays an
// fx message with the sender's seat stamped by the server.

export const GET = route(
  {
    auth: 'member',
    localOnly: true,
    params: roomParams,
    rateLimit: { bucket: 'events', limit: 60, windowSec: minute },
  },
  async ({ viewer, params, request }) => {
    const me = await channelIdentity(viewer, params.id);
    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch {
            cleanup();
          }
        };
        const unsubscribe = localHub().subscribe(`room:${params.id}`, {
          seat: me.seat,
          name: me.name,
          send: (msg) => send(msg.event, msg.payload),
        });
        const heartbeat = setInterval(() => send('ping', {}), 15_000);
        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        request.signal.addEventListener('abort', () => cleanup());
        send('ready', { seat: me.seat });
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      },
    });
  },
);

const body = z.strictObject({ fx: fxMessage });

export const POST = route(
  {
    auth: 'member',
    localOnly: true,
    params: roomParams,
    body,
    maxBodyBytes: 1024,
    rateLimit: { bucket: 'fx', limit: 240, windowSec: minute },
  },
  async ({ viewer, params, body }) => {
    const me = await channelIdentity(viewer, params.id);
    if (me.seat === null) return { ok: true };
    localHub().publish(`room:${params.id}`, {
      event: 'fx',
      payload: { ...body.fx, seat: me.seat },
    });
    return { ok: true };
  },
);
