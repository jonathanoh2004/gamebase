/**
 * Only same-site, path-only redirect targets are allowed, so `?next=` can never
 * bounce someone (or their auth code) to another origin.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || next.length > 512) return fallback;
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  // Backslashes and control characters can be normalized into //host by browsers.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, 'https://gamebase.invalid');
    if (url.origin !== 'https://gamebase.invalid') return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
