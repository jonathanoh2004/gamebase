'use client';

/** An error from our API: a status, a stable code and a human message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly data: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Same-origin JSON fetch. The browser adds the Origin header our API checks. */
export async function api<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(path, {
    method: init.method ?? (hasBody ? 'POST' : 'GET'),
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: init.signal,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      typeof data.error === 'string' ? data.error : 'error',
      typeof data.message === 'string' ? data.message : 'Something went wrong.',
      data,
    );
  }
  return data as T;
}
