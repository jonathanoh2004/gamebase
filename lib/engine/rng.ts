import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Deterministic randomness for engines. The server derives one stream per
 * move from a secret 128-bit match seed: SHA-256(seed:version) seeds an
 * sfc32 generator. Clients never see the seed, so rolls can't be predicted,
 * and the same seed + actions always replay the same game.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string, stream: number | string): Rng {
  const digest = sha256(utf8ToBytes(`${seed}:${stream}`));
  const view = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);
  const raw = sfc32(view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12));
  // Discard the first outputs, as recommended for sfc32.
  for (let i = 0; i < 12; i++) raw();

  const int = (min: number, max: number) => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`bad range ${min}..${max}`);
    }
    return min + Math.floor(raw() * (max - min + 1));
  };

  return {
    next: raw,
    int,
    pick: <T>(items: readonly T[]) => {
      if (items.length === 0) throw new RangeError('pick from empty list');
      return items[int(0, items.length - 1)] as T;
    },
    shuffle: <T>(items: readonly T[]) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    },
  };
}
