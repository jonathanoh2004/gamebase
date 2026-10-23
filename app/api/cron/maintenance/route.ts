import { timingSafeEqual } from 'node:crypto';
import { and, eq, lt, sql as raw } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { rateLimits, rooms } from '@/lib/db/schema';
import { env } from '@/lib/env';

// Daily (vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
// Clears old rate-limit windows and abandons long-idle lobbies; running any
// query also keeps a free Supabase project from pausing.
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const given = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret ?? ''}`;
  const ok =
    Boolean(secret) &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response(null, { status: 404 });

  const cleared = await db()
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, raw`now() - interval '1 day'`))
    .returning({ key: rateLimits.key });
  const abandoned = await db()
    .update(rooms)
    .set({ status: 'abandoned', updatedAt: raw`now()` })
    .where(and(eq(rooms.status, 'lobby'), lt(rooms.updatedAt, raw`now() - interval '14 days'`)))
    .returning({ id: rooms.id });
  return Response.json(
    { clearedRateLimits: cleared.length, abandonedRooms: abandoned.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
