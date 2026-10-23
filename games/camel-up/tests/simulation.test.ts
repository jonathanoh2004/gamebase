import { describe, expect, it } from 'vitest';
import { assertPlainJson, deterministic, replay, simulate } from '@/lib/engine/harness';
import { createRng } from '@/lib/engine/rng';
import { camelUp } from '../engine';
import { canPlaceSpectator } from '../engine/track';
import { type CamelUpAction, type CamelUpEvent, type CamelUpState, RACING } from '../engine/types';

/** Rolls about 40% of the time, like a real table; otherwise any legal move. */
const tableLike = (
  legal: unknown[],
  _seat: number,
  _state: unknown,
  rng: { next(): number; pick<T>(x: readonly T[]): T },
) => {
  const roll = (legal as CamelUpAction[]).find((a) => a.type === 'roll');
  return roll && rng.next() < 0.4 ? roll : rng.pick(legal);
};

function checkInvariants(s: CamelUpState) {
  // Every camel exactly once.
  const camels = [...s.track.flat(), ...(s.crossed?.camels ?? [])];
  expect(camels.sort()).toEqual(['black', 'blue', 'green', 'purple', 'red', 'white', 'yellow']);
  // Tickets, dice and pyramid tickets are all accounted for (mid-leg).
  for (const color of RACING) {
    const held = s.players.flatMap((p) => p.legTickets).filter((t) => t.color === color).length;
    expect(s.legStacks[color].length + held).toBe(4);
  }
  expect(s.pyramid.length + s.rolled.length).toBe(6);
  expect(s.pyramidTicketsLeft + s.players.reduce((n, p) => n + p.pyramidTickets, 0)).toBe(5);
  // Each finish card is either in hand or on a pile, never both, never lost.
  s.players.forEach((p, seat) => {
    const played = [...s.winnerPile, ...s.loserPile]
      .filter((c) => c.seat === seat)
      .map((c) => c.color);
    expect([...p.hand, ...played].sort()).toEqual([...RACING].sort());
  });
  for (const p of s.players) expect(p.coins).toBeGreaterThanOrEqual(0);
  // Tiles: legal spots, and no camel ever rests on one.
  s.players.forEach((p, seat) => {
    if (!p.spectator) return;
    expect(p.spectator.space).toBeGreaterThanOrEqual(2);
    expect(s.track[p.spectator.space - 1]).toEqual([]);
    const others = s.players.filter((q, i) => i !== seat && q.spectator);
    for (const q of others)
      expect(Math.abs((q.spectator?.space ?? 0) - p.spectator.space)).toBeGreaterThan(1);
    expect(canPlaceSpectator(s, (seat + 1) % s.players.length, p.spectator.space)).toBe(false);
  });
}

function checkNoLeaks(s: CamelUpState, events: CamelUpEvent[], players: number) {
  const over = s.phase === 'finished';
  for (let viewer = 0; viewer < players; viewer++) {
    const view = camelUp.viewFor(s, viewer);
    view.players.forEach((p, seat) => {
      if (seat !== viewer) expect(p.hand).toBeNull();
    });
    const piles = [
      ...view.winnerPile.map((c, i) => [c, i < s.revealed.winner] as const),
      ...view.loserPile.map((c, i) => [c, i < s.revealed.loser] as const),
    ];
    for (const [card, revealed] of piles) {
      if (card.seat !== viewer && !revealed && !over) expect(card.color).toBeNull();
    }
    for (const e of events) {
      const red = camelUp.redactEvent(e, viewer, s);
      if (red?.type === 'betPlaced' && red.seat !== viewer) expect(red.color).toBeNull();
    }
  }
}

describe('simulated games', () => {
  for (let players = 2; players <= 8; players++) {
    it(`${players} players: 20 games end cleanly with all invariants holding`, {
      timeout: 30_000,
    }, () => {
      let totalMoves = 0;
      for (let g = 0; g < 20; g++) {
        const result = simulate(camelUp, {
          players,
          seed: `sim-${players}-${g}`,
          options: { hideMoney: g % 3 === 0 },
          // One fully random (long) game per player count, the rest table-like.
          choose: g === 0 ? undefined : tableLike,
          onStep: (step) => {
            const s = step.after as CamelUpState;
            if (s.phase === 'playing') checkInvariants(s);
            checkNoLeaks(s, step.events as CamelUpEvent[], players);
          },
        });
        totalMoves += result.steps.length;
        const final = result.final as CamelUpState;
        expect(final.phase).toBe('finished');
        expect(final.final).not.toBeNull();
        expect(result.outcome?.standings).toHaveLength(players);
        deterministic(() => assertPlainJson(final, 'final state'));
      }
      expect(totalMoves / 20).toBeGreaterThan(5);
    });
  }

  it('every legal action is accepted, and views stay plain JSON', () => {
    simulate(camelUp, {
      players: 6,
      seed: 'legal-actions',
      onStep: (step) => {
        const s = step.after as CamelUpState;
        if (s.phase !== 'playing') return;
        const legal = camelUp.legalActions(s, s.turn);
        expect(legal.length).toBeGreaterThan(0);
        for (const action of legal.filter((_, i) => i % 5 === 0)) {
          expect(() =>
            camelUp.decide(s, action, { seat: s.turn, rng: createRng('x', 1) }),
          ).not.toThrow();
        }
        for (let v = 0; v < 6; v++) assertPlainJson(camelUp.viewFor(s, v), 'view');
      },
    });
  });

  it('a recorded game replays to the same result (golden replay)', async () => {
    const result = simulate(camelUp, { players: 4, seed: 'golden-replay' });
    const final = replay(camelUp, 'golden-replay', 4, result.actions) as CamelUpState;
    expect(final).toEqual(result.final);
    await expect({
      moves: result.actions.length,
      coins: final.players.map((p) => p.coins),
      final: final.final,
      legs: final.leg,
    }).toMatchFileSnapshot('./__snapshots__/golden-4p.snap');
  });
});
