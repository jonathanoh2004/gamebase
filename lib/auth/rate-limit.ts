import 'server-only';
import { sql as raw } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { rateLimits } from '@/lib/db/schema';
import { HttpError } from '@/lib/http/errors';

export interface Limit {
  /** Bucket name, e.g. "actions". */
  bucket: string;
  limit: number;
  windowSec: number;
}

/**
 * Fixed-window counter in Postgres: one upsert per request. Throws a 429 once
 * `key` has used up its window. `key` is a user ID or an IP, never a secret.
 */
export async function consume(limit: Limit, key: string, now = Date.now()): Promise<void> {
  const windowMs = limit.windowSec * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const [row] = await db()
    .insert(rateLimits)
    .values({ key: `${limit.bucket}:${key}`.slice(0, 200), windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: raw`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  if ((row?.count ?? 0) > limit.limit) {
    const retryAfter = Math.ceil((windowStart.getTime() + windowMs - now) / 1000);
    throw new HttpError(429, 'rate_limited', 'Slow down a little and try again.', { retryAfter });
  }
}
