// Content Security Policy (docs/DESIGN.md §8.3). Pure and dependency-free so
// proxy.ts can use it. Scripts need this request's nonce; 'strict-dynamic'
// lets those scripts load their own chunks and nothing else.

export interface CspInput {
  nonce: string;
  dev: boolean;
  /** https://<ref>.supabase.co, for auth calls and the realtime websocket. */
  supabaseUrl?: string | null;
  /** Cloudflare Turnstile on the sign-in page. */
  turnstile?: boolean;
}

const TURNSTILE = 'https://challenges.cloudflare.com';

export function buildCsp({ nonce, dev, supabaseUrl, turnstile }: CspInput): string {
  const connect = ["'self'"];
  if (supabaseUrl) {
    const url = new URL(supabaseUrl);
    connect.push(url.origin, `wss://${url.host}`);
  }
  if (turnstile) connect.push(TURNSTILE);

  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (dev) script.push("'unsafe-eval'"); // React's dev tooling only
  if (turnstile) script.push(TURNSTILE);

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': script,
    // <style> elements need the nonce in production. Inline style attributes
    // (piece positions, CSS variables) are allowed; they can't run code.
    'style-src': dev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`],
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': connect,
    'frame-src': turnstile ? [TURNSTILE] : ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!dev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
