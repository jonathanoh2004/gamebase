import { createRng } from '@/lib/engine/rng';
import type { Seat } from '@/lib/engine/types';
import { camelUp } from '../engine';
import {
  type CamelId,
  type CamelUpAction,
  type CamelUpEvent,
  type CamelUpState,
  RACING,
  type RacingColor,
  TICKET_VALUES,
} from '../engine/types';

/** A hand-built state: `camels` maps a space to its stack, bottom first. */
export function state(opts: {
  players?: number;
  camels?: Record<number, CamelId[]>;
  turn?: Seat;
  coins?: number[];
  hideMoney?: boolean;
}): CamelUpState {
  const n = opts.players ?? 3;
  const track: CamelId[][] = Array.from({ length: 16 }, () => []);
  for (const [space, stack] of Object.entries(opts.camels ?? {}))
    track[Number(space) - 1] = [...stack];
  return {
    options: { hideMoney: opts.hideMoney ?? false },
    players: Array.from({ length: n }, (_, i) => ({
      name: `P${i}`,
      coins: opts.coins?.[i] ?? 3,
      legTickets: [],
      pyramidTickets: 0,
      hand: [...RACING],
      spectator: null,
      partner: null,
    })),
    track,
    crossed: null,
    pyramid: [...RACING, 'grey'],
    rolled: [],
    legStacks: Object.fromEntries(RACING.map((c) => [c, [...TICKET_VALUES]])) as Record<
      RacingColor,
      number[]
    >,
    pyramidTicketsLeft: 5,
    winnerPile: [],
    loserPile: [],
    revealed: { winner: 0, loser: 0 },
    turn: opts.turn ?? 0,
    startingSeat: 0,
    leg: 1,
    phase: 'playing',
    final: null,
  };
}

/** Applies a list of events. */
export function apply(s: CamelUpState, events: CamelUpEvent[]): CamelUpState {
  return events.reduce(camelUp.evolve, s);
}

/** Runs one action with a given rng stream; returns events and the new state. */
export function act(s: CamelUpState, action: CamelUpAction, seat: Seat = s.turn, seed = 'fx') {
  const events = camelUp.decide(s, action, { seat, rng: createRng(seed, 1) });
  return { events, after: apply(s, events) };
}

/** Finds a seed whose roll draws `die` and `value` (and `face` for grey). */
export function seedFor(
  s: CamelUpState,
  want: { die: string; value: number; face?: 'white' | 'black' },
): string {
  for (let i = 0; i < 20_000; i++) {
    const seed = `seek-${i}`;
    const rng = createRng(seed, 1);
    const die = rng.pick(s.pyramid);
    const value = rng.int(1, 3);
    const face = die === 'grey' ? rng.pick(['white', 'black'] as const) : undefined;
    if (die === want.die && value === want.value && (!want.face || face === want.face)) return seed;
  }
  throw new Error(`no seed found for ${JSON.stringify(want)}`);
}

/** Rolls a specific die result for the current player. */
export function roll(
  s: CamelUpState,
  die: string,
  value: number,
  face?: 'white' | 'black',
): { events: CamelUpEvent[]; after: CamelUpState } {
  return act(s, { type: 'roll' }, s.turn, seedFor(s, { die, value, face }));
}

export const stackAt = (s: CamelUpState, space: number) => s.track[space - 1] ?? [];
