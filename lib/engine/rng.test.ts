import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic per seed and stream', () => {
    const a = createRng('seed', 3);
    const b = createRng('seed', 3);
    const xs = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(xs);
  });

  it('gives independent streams per version', () => {
    const a = Array.from({ length: 8 }, () => createRng('seed', 1).int(1, 1000));
    const b = Array.from({ length: 8 }, () => createRng('seed', 2).int(1, 1000));
    expect(a).not.toEqual(b);
  });

  it('draws uniformly enough for dice', () => {
    const rng = createRng('dice', 'uniformity');
    const counts = [0, 0, 0];
    const n = 30_000;
    for (let i = 0; i < n; i++) {
      const v = rng.int(1, 3);
      counts[v - 1] = (counts[v - 1] ?? 0) + 1;
    }
    for (const c of counts) expect(Math.abs(c / n - 1 / 3)).toBeLessThan(0.015);
  });

  it('shuffles without losing items', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const shuffled = createRng('s', 0).shuffle(items);
    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('rejects bad ranges and empty picks', () => {
    const rng = createRng('s', 0);
    expect(() => rng.int(3, 1)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
