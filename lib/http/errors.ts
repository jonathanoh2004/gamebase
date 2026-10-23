/**
 * An error that is safe to show the client: a status, a stable code, and a
 * short human message. Anything else that escapes a handler becomes a generic
 * 500 with no internals.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string = code,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, 'unauthorized', 'Sign in first.');
export const forbidden = (message = 'You don’t have access to this.') =>
  new HttpError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);
export const conflict = (code: string, message: string, extra?: Record<string, unknown>) =>
  new HttpError(409, code, message, extra);
export const badRequest = (message = 'That request isn’t valid.') =>
  new HttpError(400, 'invalid_request', message);
