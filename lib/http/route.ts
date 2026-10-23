import 'server-only';
import { randomUUID } from 'node:crypto';
import { ZodError, type z } from 'zod';
import { consume, type Limit } from '@/lib/auth/rate-limit';
import { requireMember, requireOwner, requireUser, type Viewer } from '@/lib/auth/viewer';
import { IllegalAction } from '@/lib/engine/types';
import { env } from '@/lib/env';
import { badRequest, forbidden, HttpError, notFound } from './errors';

type AuthLevel = 'none' | 'user' | 'member' | 'owner';

interface Options<B, Q, P> {
  auth: AuthLevel;
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
  params?: z.ZodType<P>;
  /** Applied per signed-in user, and per IP for everyone. */
  rateLimit?: Limit;
  /** Default 16 KiB. */
  maxBodyBytes?: number;
  /** Dev-only endpoints answer 404 unless the local backend is running. */
  localOnly?: boolean;
}

export interface RouteCtx<B, Q, P, V> {
  request: Request;
  body: B;
  query: Q;
  params: P;
  viewer: V;
  ip: string;
  requestId: string;
}

type ViewerFor<A extends AuthLevel> = A extends 'none' ? null : Viewer;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function clientIp(request: Request): string {
  // Vercel sets x-forwarded-for; the first hop is the client.
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('x-real-ip') || 'local').slice(0, 64);
}

/** Rejects cross-site writes: browsers always send Origin on fetch POSTs. */
export function assertSameOrigin(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') throw forbidden('Cross-site requests are refused.');
  const origin = request.headers.get('origin');
  if (!origin) throw forbidden('Missing Origin header.');
  const allowed = new Set([new URL(request.url).origin]);
  const configured = env().NEXT_PUBLIC_SITE_URL;
  if (configured) allowed.add(new URL(configured).origin);
  if (!allowed.has(origin)) throw forbidden('Cross-site requests are refused.');
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, 'too_large', 'That request is too large.');
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes) {
    throw new HttpError(413, 'too_large', 'That request is too large.');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('That isn’t valid JSON.');
  }
}

function errorResponse(error: unknown, requestId: string, path: string): Response {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (error instanceof HttpError) {
    if (error.status === 429 && typeof error.extra.retryAfter === 'number') {
      headers['Retry-After'] = String(error.extra.retryAfter);
    }
    return Response.json(
      { error: error.code, message: error.message, ...error.extra },
      { status: error.status, headers },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: 'invalid_request', message: 'That request isn’t valid.' },
      { status: 400, headers },
    );
  }
  if (error instanceof IllegalAction) {
    return Response.json(
      { error: 'illegal_action', message: error.message },
      { status: 409, headers },
    );
  }
  // Unknown: log for us (no request data, which may hold personal info) and
  // tell the client nothing beyond an ID to quote.
  console.error(`[${requestId}] ${path}`, error);
  return Response.json(
    { error: 'internal', message: 'Something went wrong.', requestId },
    { status: 500, headers },
  );
}

/**
 * The only way API routes are written. Every handler gets: same-origin checks
 * on writes, size-capped JSON parsing, strict schema validation of params,
 * query and body, authentication at the declared level, rate limits, and
 * uniform errors that never leak internals.
 */
export function route<A extends AuthLevel, B = undefined, Q = undefined, P = undefined>(
  options: Options<B, Q, P> & { auth: A },
  handler: (ctx: RouteCtx<B, Q, P, ViewerFor<A>>) => Promise<unknown>,
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string | string[] | undefined>> },
  ): Promise<Response> => {
    const requestId = randomUUID();
    const path = new URL(request.url).pathname;
    try {
      if (options.localOnly && env().GAMEBASE_BACKEND !== 'local') throw notFound();
      if (MUTATING.has(request.method)) assertSameOrigin(request);

      const ip = clientIp(request);
      const rawParams = await context.params;
      const params = (options.params ? options.params.parse(rawParams) : undefined) as P;
      const url = new URL(request.url);
      const query = (
        options.query ? options.query.parse(Object.fromEntries(url.searchParams)) : undefined
      ) as Q;
      const body = (
        options.body
          ? options.body.parse(await readJson(request, options.maxBodyBytes ?? 16 * 1024))
          : undefined
      ) as B;

      let viewer: Viewer | null = null;
      if (options.auth === 'user') viewer = await requireUser();
      else if (options.auth === 'member') viewer = await requireMember();
      else if (options.auth === 'owner') viewer = await requireOwner();

      if (options.rateLimit) {
        await consume(options.rateLimit, `ip:${ip}`);
        if (viewer) await consume(options.rateLimit, `u:${viewer.id}`);
      }

      const result = await handler({
        request,
        body,
        query,
        params,
        viewer: viewer as ViewerFor<A>,
        ip,
        requestId,
      });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error, requestId, path);
    }
  };
}
