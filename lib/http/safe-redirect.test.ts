import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-redirect';

describe('safeNextPath', () => {
  it('keeps same-site paths', () => {
    expect(safeNextPath('/r/abc?x=1#y')).toBe('/r/abc?x=1#y');
    expect(safeNextPath('/invite/tok')).toBe('/invite/tok');
  });

  it.each([
    'https://evil.example/',
    '//evil.example/x',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    '/\tfoo',
    '/\r\nLocation: https://evil.example',
    '',
    null,
    undefined,
    `/${'a'.repeat(600)}`,
  ])('rejects %s', (input) => {
    expect(safeNextPath(input as string | null | undefined)).toBe('/');
  });

  it('decoded control characters stay encoded in the path', () => {
    expect(safeNextPath('/%0d%0a')).toBe('/%0d%0a');
  });
});
