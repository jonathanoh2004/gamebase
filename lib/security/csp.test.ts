import { describe, expect, it } from 'vitest';
import { buildCsp, newNonce } from './csp';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(' ') ?? [];

describe('buildCsp', () => {
  it('locks scripts to this request’s nonce in production', () => {
    const csp = buildCsp({ nonce: 'abc', dev: false });
    expect(directive(csp, 'script-src')).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
    expect(csp).not.toContain('unsafe-eval');
    expect(directive(csp, 'style-src')).toContain("'nonce-abc'");
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('allows the Supabase project for API calls and the websocket only', () => {
    const csp = buildCsp({ nonce: 'n', dev: false, supabaseUrl: 'https://abcd.supabase.co' });
    expect(directive(csp, 'connect-src')).toEqual([
      "'self'",
      'https://abcd.supabase.co',
      'wss://abcd.supabase.co',
    ]);
    expect(directive(csp, 'script-src')).not.toContain('https://abcd.supabase.co');
  });

  it('opens exactly Turnstile’s origin when enabled', () => {
    const csp = buildCsp({ nonce: 'n', dev: false, turnstile: true });
    expect(directive(csp, 'frame-src')).toEqual(['https://challenges.cloudflare.com']);
    expect(directive(csp, 'script-src')).toContain('https://challenges.cloudflare.com');
  });

  it('makes fresh, unguessable nonces', () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });
});
