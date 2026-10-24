import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttled } from './throttle';

describe('throttled', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the first call at once', () => {
    const fn = vi.fn();
    throttled(fn, 500).call();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('collapses a flood into one trailing run per gap', () => {
    const fn = vi.fn();
    const t = throttled(fn, 500);
    for (let i = 0; i < 1000; i++) {
      t.call();
      vi.advanceTimersByTime(1);
    }
    // 1 s of calls every millisecond: the leading run plus one per 500 ms.
    expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
    vi.advanceTimersByTime(500);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('cancel drops a pending trailing run', () => {
    const fn = vi.fn();
    const t = throttled(fn, 500);
    t.call();
    t.call();
    t.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
