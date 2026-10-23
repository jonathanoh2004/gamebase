import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/engine/rng';
import { IllegalAction } from '@/lib/engine/types';
import { camelUp } from '../engine';
import { canPlaceSpectator, crazyToMove, ranking } from '../engine/track';
import { type CamelUpState, RACING } from '../engine/types';
import { act, apply, roll, stackAt, state } from './fixtures';

// One test (at least) per rule in games/camel-up/rules.md.

const setup = (players: number, seed = 'setup') =>
  camelUp.setup({
    seats: Array.from({ length: players }, (_, seat) => ({ seat, name: `P${seat}` })),
    options: { hideMoney: false },
    rng: createRng(seed, 0),
  });

describe('setup', () => {
  it('R1: 3 coins, all 5 finish cards, tile in hand, no partner', () => {
    const s = setup(4);
    for (const p of s.players) {
      expect(p.coins).toBe(3);
      expect([...p.hand].sort()).toEqual([...RACING].sort());
      expect(p.spectator).toBeNull();
      expect(p.partner).toBeNull();
    }
  });

  it('R2: each ticket stack is 5, 3, 2, 2 from the top', () => {
    const s = setup(3);
    for (const color of RACING) expect(s.legStacks[color]).toEqual([5, 3, 2, 2]);
  });

  it('R3: 5 pyramid tickets and all 6 dice in the pyramid', () => {
    const s = setup(3);
    expect(s.pyramidTicketsLeft).toBe(5);
    expect([...s.pyramid].sort()).toEqual(['blue', 'green', 'grey', 'purple', 'red', 'yellow']);
    expect(s.rolled).toEqual([]);
  });

  it('R4: racing camels start on spaces 1–3, all of them, each once', () => {
    const spaces = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const s = setup(3, `r4-${i}`);
      const racing = s.track.flatMap((stack, idx) =>
        stack.filter((c) => RACING.includes(c as never)).map(() => idx + 1),
      );
      expect(racing).toHaveLength(5);
      for (const space of racing) {
        expect(space).toBeGreaterThanOrEqual(1);
        expect(space).toBeLessThanOrEqual(3);
        spaces.add(space);
      }
    }
    expect([...spaces].sort()).toEqual([1, 2, 3]);
  });

  it('R5: crazy camels start on 14–16, stacking when they share a space', () => {
    let sawShared = false;
    for (let i = 0; i < 200; i++) {
      const s = setup(3, `r5-${i}`);
      const at = (c: string) => s.track.findIndex((stack) => stack.includes(c as never)) + 1;
      for (const c of ['white', 'black']) expect([14, 15, 16]).toContain(at(c));
      if (at('white') === at('black')) {
        sawShared = true;
        expect(stackAt(s, at('white'))).toHaveLength(2);
      }
    }
    expect(sawShared).toBe(true);
  });

  it('R7: the starting player varies with the seed', () => {
    const seats = new Set(Array.from({ length: 60 }, (_, i) => setup(4, `r7-${i}`).turn));
    expect(seats.size).toBe(4);
  });
});

describe('turns', () => {
  it('R8: only the current player may act, then the turn passes on', () => {
    const s = state({ camels: { 1: ['blue'] }, turn: 1 });
    expect(() => act(s, { type: 'takeTicket', color: 'blue' }, 0)).toThrow(IllegalAction);
    const { after, events } = act(s, { type: 'takeTicket', color: 'blue' }, 1);
    expect(after.turn).toBe(2);
    expect(events.at(-1)).toEqual({ type: 'turnPassed', seat: 2 });
    expect(camelUp.legalActions(after, 1)).toEqual([]);
  });

  it('R9: takes the top ticket; repeat colors allowed; empty stacks refused', () => {
    let s = state({ camels: { 1: ['blue'] } });
    const values: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = { ...s, turn: 0 };
      const { after } = act(s, { type: 'takeTicket', color: 'red' });
      values.push(after.players[0]?.legTickets.at(-1)?.value ?? -1);
      s = after;
    }
    expect(values).toEqual([5, 3, 2, 2]);
    expect(s.players[0]?.legTickets).toHaveLength(4);
    expect(() => act({ ...s, turn: 0 }, { type: 'takeTicket', color: 'red' })).toThrow(/No red/);
  });

  it('R10: tile only on empty spaces, never space 1, never next to another tile', () => {
    let s = state({ camels: { 1: ['blue'], 5: ['red'] } });
    expect(canPlaceSpectator(s, 0, 1)).toBe(false);
    expect(canPlaceSpectator(s, 0, 5)).toBe(false); // camels there
    expect(canPlaceSpectator(s, 0, 8)).toBe(true);
    s = act(s, { type: 'placeSpectator', space: 8, side: 'cheer' }).after;
    for (const [space, ok] of [
      [7, false],
      [8, false],
      [9, false],
      [10, true],
    ] as const) {
      expect(canPlaceSpectator(s, 1, space)).toBe(ok);
    }
  });

  it('R10: moving your own tile: a different space, its neighbors allowed (ruling 1)', () => {
    let s = state({ camels: { 1: ['blue'] } });
    s = act(s, { type: 'placeSpectator', space: 8, side: 'cheer' }).after;
    s = { ...s, turn: 0 };
    expect(() => act(s, { type: 'placeSpectator', space: 8, side: 'boo' })).toThrow(IllegalAction);
    const moved = act(s, { type: 'placeSpectator', space: 9, side: 'boo' });
    expect(moved.after.players[0]?.spectator).toEqual({ space: 9, side: 'boo' });
    expect(moved.events[0]).toMatchObject({ type: 'spectatorPlaced', from: 8 });
  });

  it('R11/R12/R20: a roll takes a ticket, uses a die from the pyramid, and keeps it out', () => {
    const s = state({ camels: { 1: ['blue'], 2: ['green'] } });
    const { after, events } = roll(s, 'blue', 2);
    expect(after.pyramidTicketsLeft).toBe(4);
    expect(after.players[0]?.pyramidTickets).toBe(1);
    expect(after.pyramid).not.toContain('blue');
    expect(after.rolled).toEqual([{ die: 'blue', value: 2, face: null }]);
    expect(events.map((e) => e.type)).toEqual([
      'pyramidTicketTaken',
      'dieRolled',
      'camelsMoved',
      'turnPassed',
    ]);
  });

  it('R13: bets place a hand card on a pile in order; each color only once', () => {
    let s = state({ camels: { 1: ['blue'] } });
    s = act(s, { type: 'bet', pile: 'winner', color: 'blue' }).after;
    s = act(s, { type: 'bet', pile: 'winner', color: 'red' }).after;
    expect(s.winnerPile.map((c) => c.seat)).toEqual([0, 1]);
    expect(s.players[0]?.hand).not.toContain('blue');
    s = { ...s, turn: 0 };
    expect(() => act(s, { type: 'bet', pile: 'loser', color: 'blue' })).toThrow(/already played/);
    expect(act(s, { type: 'bet', pile: 'loser', color: 'green' }).after.loserPile).toHaveLength(1);
  });

  it('R14: partnerships need 6+ players and two available cards', () => {
    const small = state({ players: 5, camels: { 1: ['blue'] } });
    expect(() => act(small, { type: 'partner', with: 1 })).toThrow(/six or more/);
    let s = state({ players: 6, camels: { 1: ['blue'] } });
    s = act(s, { type: 'partner', with: 3 }).after;
    expect(s.players[0]?.partner).toBe(3);
    expect(s.players[3]?.partner).toBe(0);
    s = { ...s, turn: 1 };
    expect(() => act(s, { type: 'partner', with: 3 })).toThrow(/already have a partner/);
    expect(() => act(s, { type: 'partner', with: 1 })).toThrow(/another player/);
  });
});

describe('movement', () => {
  it('R15: a camel carries everything above it and leaves what is below', () => {
    const s = state({ camels: { 3: ['red', 'blue', 'green'] } });
    const { after } = roll(s, 'blue', 2);
    expect(stackAt(after, 3)).toEqual(['red']);
    expect(stackAt(after, 5)).toEqual(['blue', 'green']);
  });

  it('R16: a unit landing on camels goes on top', () => {
    const s = state({ camels: { 2: ['purple', 'green'], 4: ['yellow'] } });
    const { after } = roll(s, 'purple', 2);
    expect(stackAt(after, 4)).toEqual(['yellow', 'purple', 'green']);
  });

  it('R17: the grey die moves the camel of its color, backward', () => {
    const s = state({ camels: { 10: ['white'], 12: ['black'] } });
    expect(stackAt(roll(s, 'grey', 2, 'white').after, 8)).toEqual(['white']);
    expect(stackAt(roll(s, 'grey', 3, 'black').after, 9)).toEqual(['black']);
  });

  it('R17 exception 1: the only crazy camel carrying racing camels moves, whatever the color', () => {
    const track = state({ camels: { 10: ['white', 'blue'], 12: ['black'] } }).track;
    expect(crazyToMove(track, 'black')).toBe('white');
    const s = state({ camels: { 10: ['white', 'blue'], 12: ['black'] } });
    expect(stackAt(roll(s, 'grey', 1, 'black').after, 9)).toEqual(['white', 'blue']);
  });

  it('R17 exception 2: one crazy camel directly on the other: the top one moves', () => {
    expect(crazyToMove(state({ camels: { 10: ['black', 'white'] } }).track, 'black')).toBe('white');
    // A racing camel between them: neither exception applies, the color decides.
    expect(crazyToMove(state({ camels: { 10: ['black', 'red', 'white'] } }).track, 'black')).toBe(
      'black',
    );
    // Both carry racing camels and one sits right on the other: the top one (ruling 2).
    expect(crazyToMove(state({ camels: { 10: ['black', 'white', 'red'] } }).track, 'black')).toBe(
      'white',
    );
  });

  it('R18: landing on a cheering tile pays its owner and moves on top one further', () => {
    let s = state({ camels: { 2: ['blue'], 6: ['red'] } });
    s = act(s, { type: 'placeSpectator', space: 5, side: 'cheer' }, 0).after; // seat 0
    s = { ...s, turn: 1 };
    const { after, events } = roll(s, 'blue', 3);
    expect(after.players[0]?.coins).toBe(4);
    expect(stackAt(after, 6)).toEqual(['red', 'blue']);
    expect(events.filter((e) => e.type === 'camelsMoved').map((e) => e.cause)).toEqual([
      'die',
      'cheer',
    ]);
  });

  it('R18: a booing tile sends the unit one back, underneath', () => {
    let s = state({ camels: { 2: ['blue'], 4: ['red'] } });
    s = act(s, { type: 'placeSpectator', space: 5, side: 'boo' }, 0).after;
    s = { ...s, turn: 1 };
    const { after } = roll(s, 'blue', 3);
    expect(stackAt(after, 4)).toEqual(['blue', 'red']);
    expect(after.players[0]?.coins).toBe(4);
  });

  it('R18: tiles push crazy camels the opposite way (ruling 3)', () => {
    let s = state({ camels: { 12: ['black'], 10: ['green'], 8: ['red'] } });
    s = act(s, { type: 'placeSpectator', space: 9, side: 'cheer' }, 0).after;
    s = { ...s, turn: 1 };
    const cheer = roll(s, 'grey', 3, 'black').after; // 12 → 9 (tile) → 8 on top
    expect(stackAt(cheer, 8)).toEqual(['red', 'black']);

    let b = state({ camels: { 12: ['black'], 10: ['green'] } });
    b = act(b, { type: 'placeSpectator', space: 9, side: 'boo' }, 0).after;
    b = { ...b, turn: 1 };
    const boo = roll(b, 'grey', 3, 'black').after; // 12 → 9 (tile) → 10 underneath
    expect(stackAt(boo, 10)).toEqual(['black', 'green']);
  });

  it('R19: camels keep their facing (crazy ones still run backward when carried)', () => {
    // Facing is a UI concern; the engine's contract is direction by camel type.
    const s = state({ camels: { 5: ['red', 'white'] } });
    const { after } = roll(s, 'red', 1);
    expect(stackAt(after, 6)).toEqual(['red', 'white']);
  });
});

describe('ranking', () => {
  it('R21: further along leads; higher in a stack leads; crazy camels never count', () => {
    const s = state({
      camels: { 3: ['red', 'white', 'blue'], 7: ['green', 'black'], 2: ['yellow', 'purple'] },
    });
    expect(ranking(s)).toEqual(['green', 'blue', 'red', 'purple', 'yellow']);
  });

  it('R22: forward crossers lead; camels carried backward over the line come last', () => {
    const fwd = state({ camels: { 15: ['red', 'blue'], 10: ['green'] } });
    const crossed = roll(fwd, 'red', 3).after;
    expect(crossed.crossed?.direction).toBe('forward');
    expect(ranking(crossed).slice(0, 2)).toEqual(['blue', 'red']);

    const back = state({
      camels: { 2: ['white', 'yellow', 'purple'], 9: ['green'], 12: ['black'] },
    });
    const done = roll(back, 'grey', 3, 'white').after;
    expect(done.crossed?.direction).toBe('backward');
    expect(ranking(done).slice(-2)).toEqual(['purple', 'yellow']);
  });
});

describe('legs', () => {
  function legEndingState(): CamelUpState {
    const s = state({
      players: 3,
      camels: {
        9: ['red'],
        7: ['blue'],
        5: ['green'],
        4: ['yellow'],
        3: ['purple'],
        12: ['white'],
        14: ['black'],
      },
    });
    return {
      ...s,
      pyramid: ['green' as const, 'grey' as const],
      rolled: [],
      pyramidTicketsLeft: 1,
    };
  }

  it('R23: the leg ends after the roll that takes the 5th pyramid ticket', () => {
    const { events, after } = roll(legEndingState(), 'green', 1);
    const types = events.map((e) => e.type);
    expect(types.slice(-3)).toEqual(['legScored', 'legReset', 'turnPassed']);
    expect(after.leg).toBe(2);
  });

  it('R24: leader pays face value, second pays 1, the rest cost 1, pyramid tickets pay 1', () => {
    let s = legEndingState();
    s = apply(s, [
      { type: 'ticketTaken', seat: 1, color: 'red', value: 5 },
      { type: 'ticketTaken', seat: 1, color: 'blue', value: 5 },
      { type: 'ticketTaken', seat: 1, color: 'green', value: 5 },
      { type: 'pyramidTicketTaken', seat: 1 },
    ]);
    s = { ...s, pyramidTicketsLeft: 1, turn: 0 };
    const { events } = roll(s, 'green', 1); // green 5→6: still third
    const scored = events.find((e) => e.type === 'legScored');
    if (scored?.type !== 'legScored') throw new Error('no legScored');
    expect(scored.ranking.slice(0, 2)).toEqual(['red', 'blue']);
    const p1 = scored.scores.find((x) => x.seat === 1);
    expect(p1?.lines.map((l) => l.reward)).toEqual([5, 1, -1, 1]);
    expect(p1?.total).toBe(6);
    const p0 = scored.scores.find((x) => x.seat === 0);
    expect(p0?.total).toBe(1); // the roller's pyramid ticket
  });

  it('R24: nobody goes below zero', () => {
    let s = legEndingState();
    s = apply(s, [
      { type: 'ticketTaken', seat: 2, color: 'purple', value: 5 },
      { type: 'ticketTaken', seat: 2, color: 'purple', value: 3 },
      { type: 'ticketTaken', seat: 2, color: 'yellow', value: 5 },
      { type: 'ticketTaken', seat: 2, color: 'yellow', value: 3 },
    ]);
    s = { ...s, pyramidTicketsLeft: 1, turn: 0 };
    s = { ...s, players: s.players.map((p, i) => (i === 2 ? { ...p, coins: 1 } : p)) };
    const { after, events } = roll(s, 'green', 1);
    const scored = events.find((e) => e.type === 'legScored');
    if (scored?.type !== 'legScored') throw new Error('no legScored');
    expect(scored.scores.find((x) => x.seat === 2)).toMatchObject({ total: -4, delta: -1 });
    expect(after.players[2]?.coins).toBe(0);
  });

  it('R25: a partner adds the partner’s best ticket, or nothing (ruling 5)', () => {
    let s = { ...legEndingState(), players: state({ players: 6 }).players };
    s = apply(s, [
      { type: 'partnered', a: 1, b: 2 },
      { type: 'ticketTaken', seat: 2, color: 'red', value: 5 },
      { type: 'ticketTaken', seat: 2, color: 'purple', value: 5 },
      { type: 'ticketTaken', seat: 1, color: 'yellow', value: 5 },
    ]);
    s = { ...s, pyramidTicketsLeft: 1, turn: 0 };
    const { events } = roll(s, 'green', 1);
    const scored = events.find((e) => e.type === 'legScored');
    if (scored?.type !== 'legScored') throw new Error('no legScored');
    const one = scored.scores.find((x) => x.seat === 1);
    expect(one?.lines.at(-1)).toMatchObject({ kind: 'partner', color: 'red', reward: 5 });
    expect(one?.total).toBe(4); // yellow −1 + partner's red +5
    const two = scored.scores.find((x) => x.seat === 2);
    expect(two?.lines.filter((l) => l.kind === 'partner')).toEqual([]); // yellow would cost
  });

  it('R26: cleanup returns tickets, dice, tiles and partnerships', () => {
    let s = legEndingState();
    s = apply(s, [
      { type: 'ticketTaken', seat: 1, color: 'red', value: 5 },
      { type: 'spectatorPlaced', seat: 2, space: 11, side: 'boo', from: null },
    ]);
    s = { ...s, pyramidTicketsLeft: 1, turn: 0 };
    const { after } = roll(s, 'green', 1);
    expect(after.legStacks.red).toEqual([5, 3, 2, 2]);
    expect(after.pyramid).toHaveLength(6);
    expect(after.rolled).toEqual([]);
    expect(after.pyramidTicketsLeft).toBe(5);
    expect(after.players.every((p) => p.spectator === null && p.legTickets.length === 0)).toBe(
      true,
    );
    expect(after.players.every((p) => p.pyramidTickets === 0)).toBe(true);
  });

  it('R27: the next leg starts with the player after the last roller', () => {
    const s = { ...legEndingState(), turn: 2 };
    const { after } = roll(s, 'green', 1);
    expect(after.startingSeat).toBe(0);
    expect(after.turn).toBe(0);
  });
});

describe('end of game', () => {
  it('R28: the race ends the moment a unit crosses the line, final scoring follows', () => {
    const s = state({
      camels: { 15: ['red'], 3: ['blue', 'green', 'yellow', 'purple'], 10: ['white', 'black'] },
    });
    const { events, after } = roll(s, 'red', 2);
    const types = events.map((e) => e.type);
    expect(types).toContain('raceFinished');
    expect(types.slice(types.indexOf('raceFinished'))).toEqual([
      'raceFinished',
      'legScored',
      'gameEnded',
    ]);
    expect(after.phase).toBe('finished');
    expect(camelUp.activeSeats(after)).toEqual([]);
    expect(camelUp.outcome(after)).not.toBeNull();
  });

  it('R28: a crazy camel crossing backward also ends the race', () => {
    const s = state({
      camels: { 2: ['black'], 9: ['red', 'blue', 'green', 'yellow', 'purple'], 12: ['white'] },
    });
    const { after } = roll(s, 'grey', 3, 'black');
    expect(after.crossed?.direction).toBe('backward');
    expect(after.phase).toBe('finished');
  });

  it('R28: a cheering tile on 16 can carry a unit over the line', () => {
    let s = state({
      camels: { 14: ['red'], 3: ['blue', 'green', 'yellow', 'purple'], 10: ['white', 'black'] },
    });
    s = act(s, { type: 'placeSpectator', space: 16, side: 'cheer' }, 0).after;
    s = { ...s, turn: 1 };
    const { after } = roll(s, 'red', 2);
    expect(after.players[0]?.coins).toBe(4);
    expect(after.crossed).toMatchObject({ direction: 'forward', space: 17 });
  });

  it('R29: overall bets pay 8, 5, 3, 2, then 1 in placement order; wrong cards cost 1', () => {
    let s = state({
      players: 6,
      camels: { 15: ['red'], 3: ['blue', 'green', 'yellow', 'purple'], 10: ['white', 'black'] },
      coins: [3, 3, 3, 3, 3, 0],
    });
    s = apply(s, [
      { type: 'betPlaced', seat: 5, pile: 'winner', color: 'blue' }, // wrong, but has 0 coins
      { type: 'betPlaced', seat: 0, pile: 'winner', color: 'red' },
      { type: 'betPlaced', seat: 1, pile: 'winner', color: 'red' },
      { type: 'betPlaced', seat: 2, pile: 'winner', color: 'red' },
      { type: 'betPlaced', seat: 3, pile: 'winner', color: 'red' },
      { type: 'betPlaced', seat: 4, pile: 'winner', color: 'red' },
      { type: 'betPlaced', seat: 0, pile: 'loser', color: 'blue' }, // blue is at the bottom: loser
      { type: 'betPlaced', seat: 1, pile: 'loser', color: 'purple' },
    ]);
    const { events, after } = roll({ ...s, turn: 0 }, 'red', 2);
    const cards = events.filter((e) => e.type === 'overallCard');
    expect(
      cards.map((c) => (c.type === 'overallCard' ? [c.pile, c.seat, c.payout, c.delta] : [])),
    ).toEqual([
      ['winner', 5, -1, 0],
      ['winner', 0, 8, 8],
      ['winner', 1, 5, 5],
      ['winner', 2, 3, 3],
      ['winner', 3, 2, 2],
      ['winner', 4, 1, 1],
      ['loser', 0, 8, 8],
      ['loser', 1, -1, -1],
    ]);
    expect(after.final).toEqual({ winner: 'red', loser: 'blue' });
    expect(after.revealed).toEqual({ winner: 6, loser: 2 });
  });

  it('R30: most coins wins; ties share first place', () => {
    const s = state({
      camels: { 15: ['red'], 3: ['blue', 'green', 'yellow', 'purple'], 10: ['white', 'black'] },
      coins: [5, 9, 9],
    });
    const { after } = roll({ ...s, turn: 0 }, 'red', 2);
    const outcome = camelUp.outcome(after);
    // Seat 0 also earned 1 for the pyramid ticket.
    expect(outcome?.standings.map((x) => [x.seat, x.score, x.rank])).toEqual([
      [0, 6, 2],
      [1, 9, 1],
      [2, 9, 1],
    ]);
  });
});

describe('hidden information', () => {
  it('H1: only you see your hand; others see a count', () => {
    const s = state({ camels: { 1: ['blue'] } });
    expect(camelUp.viewFor(s, 0).players[0]?.hand).toHaveLength(5);
    expect(camelUp.viewFor(s, 0).players[1]?.hand).toBeNull();
    expect(camelUp.viewFor(s, 0).players[1]?.handCount).toBe(5);
    expect(camelUp.viewFor(s, 'spectator').players.every((p) => p.hand === null)).toBe(true);
  });

  it('H2: bet colors stay hidden from others until revealed at the end', () => {
    const s = state({ camels: { 1: ['blue'] } });
    const { events, after } = act(s, { type: 'bet', pile: 'winner', color: 'purple' });
    const bet = events[0];
    if (!bet) throw new Error('no event');
    expect(camelUp.redactEvent(bet, 1, after)).toMatchObject({ type: 'betPlaced', color: null });
    expect(camelUp.redactEvent(bet, 0, after)).toMatchObject({ color: 'purple' });
    expect(camelUp.viewFor(after, 1).winnerPile).toEqual([{ seat: 0, color: null }]);
    expect(camelUp.viewFor(after, 0).winnerPile).toEqual([{ seat: 0, color: 'purple' }]);
    expect(JSON.stringify(camelUp.viewFor(after, 'spectator'))).not.toMatch(/"color":"purple"/);
  });

  it('H3: hide money shows only your own total until the end', () => {
    const s = state({ camels: { 1: ['blue'] }, hideMoney: true });
    const v = camelUp.viewFor(s, 1);
    expect(v.players.map((p) => p.coins)).toEqual([null, 3, null]);
  });
});
