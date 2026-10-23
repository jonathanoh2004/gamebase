import { describe, expect, it } from 'vitest';
import { assertPlainJson, deterministic, simulate } from '@/lib/engine/harness';
import { createRng } from '@/lib/engine/rng';
import { IllegalAction } from '@/lib/engine/types';
import { guessRoll } from './index';

const setup = (n: number) =>
  guessRoll.setup({
    seats: Array.from({ length: n }, (_, seat) => ({ seat, name: `P${seat}` })),
    options: { target: 3 },
    rng: createRng('t', 0),
  });

describe('guess-roll (runtime test game)', () => {
  it('lets everyone call at once and hides calls until the roll', () => {
    let s = setup(3);
    expect(guessRoll.activeSeats(s)).toEqual([0, 1, 2]);
    const events = guessRoll.decide(
      s,
      { type: 'pick', guess: 'low' },
      { seat: 1, rng: createRng('t', 1) },
    );
    for (const e of events) s = guessRoll.evolve(s, e);
    expect(guessRoll.activeSeats(s)).toEqual([0, 2]);
    expect(guessRoll.viewFor(s, 0).myPick).toBeNull();
    expect(guessRoll.viewFor(s, 0).called).toEqual([false, true, false]);
    expect(guessRoll.viewFor(s, 1).myPick).toBe('low');
    expect(guessRoll.redactEvent(events[0] as never, 0, s)).toEqual({
      type: 'picked',
      seat: 1,
      guess: null,
    });
    expect(guessRoll.redactEvent(events[0] as never, 1, s)).toEqual(events[0]);
    expect(JSON.stringify(guessRoll.viewFor(s, 'spectator'))).not.toContain('low');
  });

  it('refuses a second call in the same round', () => {
    let s = setup(2);
    for (const e of guessRoll.decide(
      s,
      { type: 'pick', guess: 'high' },
      { seat: 0, rng: createRng('t', 1) },
    )) {
      s = guessRoll.evolve(s, e);
    }
    expect(() =>
      guessRoll.decide(s, { type: 'pick', guess: 'low' }, { seat: 0, rng: createRng('t', 2) }),
    ).toThrow(IllegalAction);
  });

  it('plays to completion deterministically at every player count', () => {
    for (let players = 1; players <= 6; players++) {
      const a = simulate(guessRoll, { players, seed: `sim-${players}` });
      const b = simulate(guessRoll, { players, seed: `sim-${players}` });
      expect(a.outcome).not.toBeNull();
      expect(b.final).toEqual(a.final);
      deterministic(() => {
        for (const step of a.steps) {
          assertPlainJson(step.after, 'state');
          for (let v = 0; v < players; v++)
            assertPlainJson(guessRoll.viewFor(step.after as never, v), 'view');
        }
      });
    }
  });
});
