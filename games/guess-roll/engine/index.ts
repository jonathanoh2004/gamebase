import { z } from 'zod';
import {
  type GameEngine,
  IllegalAction,
  type Outcome,
  type Seat,
  type Viewer,
} from '@/lib/engine/types';

// DEV-ONLY TEST GAME. Never listed in the library. It exists to exercise the
// runtime end to end: simultaneous secret choices, randomness, redaction.
//
// Each round every player secretly calls LOW (1-3) or HIGH (4-6). Once all have
// called, a die is rolled; correct calls score 1. First to `target` wins.

export type Guess = 'low' | 'high';

export interface GuessRollState {
  round: number;
  target: number;
  scores: number[];
  /** Secret until the roll. */
  picks: (Guess | null)[];
  lastRoll: number | null;
  lastPicks: Guess[] | null;
  winners: Seat[] | null;
}

export type GuessRollAction = { type: 'pick'; guess: Guess };

export type GuessRollEvent =
  | { type: 'picked'; seat: Seat; guess: Guess | null }
  | { type: 'rolled'; value: number; picks: Guess[] }
  | { type: 'scored'; seats: Seat[] }
  | { type: 'roundStarted'; round: number }
  | { type: 'gameWon'; seats: Seat[] };

export interface GuessRollView {
  round: number;
  target: number;
  scores: number[];
  /** Your own call, if you've made it. */
  myPick: Guess | null;
  /** Who has called this round (not what). */
  called: boolean[];
  lastRoll: number | null;
  lastPicks: Guess[] | null;
  winners: Seat[] | null;
}

const options = z.strictObject({ target: z.number().int().min(1).max(9).default(3) });

export const guessRoll: GameEngine<
  GuessRollState,
  GuessRollAction,
  GuessRollEvent,
  GuessRollView,
  z.infer<typeof options>
> = {
  id: 'guess-roll',
  version: 1,
  players: { min: 1, max: 6 },
  actionSchema: z.strictObject({ type: z.literal('pick'), guess: z.enum(['low', 'high']) }),
  optionsSchema: options,

  setup({ seats, options }) {
    return {
      round: 1,
      target: options.target,
      scores: seats.map(() => 0),
      picks: seats.map(() => null),
      lastRoll: null,
      lastPicks: null,
      winners: null,
    };
  },

  activeSeats(state) {
    if (state.winners) return [];
    return state.picks.flatMap((p, seat) => (p === null ? [seat] : []));
  },

  legalActions(state, seat) {
    if (state.winners || state.picks[seat] !== null) return [];
    return [
      { type: 'pick', guess: 'low' },
      { type: 'pick', guess: 'high' },
    ];
  },

  decide(state, action, { seat, rng }) {
    if (state.winners) throw new IllegalAction('The game is over.');
    if (state.picks[seat] === undefined) throw new IllegalAction('You’re not in this game.');
    if (state.picks[seat] !== null) throw new IllegalAction('You already called this round.');
    const events: GuessRollEvent[] = [{ type: 'picked', seat, guess: action.guess }];
    const picks = state.picks.map((p, s) => (s === seat ? action.guess : p));
    if (picks.every((p) => p !== null)) {
      const value = rng.int(1, 6);
      const all = picks as Guess[];
      events.push({ type: 'rolled', value, picks: all });
      const correct = value <= 3 ? 'low' : 'high';
      const scorers = all.flatMap((g, s) => (g === correct ? [s] : []));
      events.push({ type: 'scored', seats: scorers });
      const scores = state.scores.map((sc, s) => sc + (scorers.includes(s) ? 1 : 0));
      const top = Math.max(...scores);
      if (top >= state.target) {
        events.push({
          type: 'gameWon',
          seats: scores.flatMap((sc, s) => (sc === top ? [s] : [])),
        });
      } else {
        events.push({ type: 'roundStarted', round: state.round + 1 });
      }
    }
    return events;
  },

  evolve(state, event) {
    switch (event.type) {
      case 'picked':
        return { ...state, picks: state.picks.map((p, s) => (s === event.seat ? event.guess : p)) };
      case 'rolled':
        return { ...state, lastRoll: event.value, lastPicks: event.picks };
      case 'scored':
        return {
          ...state,
          scores: state.scores.map((sc, s) => sc + (event.seats.includes(s) ? 1 : 0)),
        };
      case 'roundStarted':
        return { ...state, round: event.round, picks: state.picks.map(() => null) };
      case 'gameWon':
        return { ...state, winners: event.seats };
    }
  },

  viewFor(state, viewer: Viewer) {
    return {
      round: state.round,
      target: state.target,
      scores: state.scores,
      myPick: viewer === 'spectator' ? null : (state.picks[viewer] ?? null),
      called: state.picks.map((p) => p !== null),
      lastRoll: state.lastRoll,
      lastPicks: state.lastPicks,
      winners: state.winners,
    };
  },

  redactEvent(event, viewer) {
    if (event.type === 'picked' && event.seat !== viewer) return { ...event, guess: null };
    return event;
  },

  outcome(state): Outcome | null {
    if (!state.winners) return null;
    const sorted = [...new Set(state.scores)].sort((a, b) => b - a);
    return {
      standings: state.scores.map((score, seat) => ({
        seat,
        score,
        rank: sorted.indexOf(score) + 1,
      })),
      summary: `First to ${state.target}`,
    };
  },
};
