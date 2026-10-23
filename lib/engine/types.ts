import type { z } from 'zod';
import type { Rng } from './rng';

// The contract every game implements (docs/DESIGN.md §5). Engines are pure:
// plain JSON in, plain JSON out, no clock, no network, no Math.random.

export type Seat = number;
export type Viewer = Seat | 'spectator';

/** Thrown by `decide` when a move breaks the rules. The message is shown to the player. */
export class IllegalAction extends Error {
  override name = 'IllegalAction';
}

export interface SeatInfo {
  seat: Seat;
  name: string;
}

export interface SetupContext<Options> {
  seats: SeatInfo[];
  options: Options;
  rng: Rng;
}

export interface DecideContext {
  seat: Seat;
  rng: Rng;
}

export interface Standing {
  seat: Seat;
  score: number;
  /** 1 = winner. Ties share a rank. */
  rank: number;
}

export interface Outcome {
  standings: Standing[];
  /** One line for the results screen. */
  summary: string;
}

export interface GameEngine<
  State,
  Action extends { type: string },
  Event extends { type: string },
  View,
  Options = Record<string, never>,
> {
  id: string;
  /** Bump whenever State changes shape; old matches then refuse to load. */
  version: number;
  players: { min: number; max: number };
  actionSchema: z.ZodType<Action>;
  optionsSchema: z.ZodType<Options>;

  setup(ctx: SetupContext<Options>): State;
  /** Seats that may act right now (several = simultaneous choices). Empty once over. */
  activeSeats(state: State): Seat[];
  legalActions(state: State, seat: Seat): Action[];
  /** Validates and resolves a move into events. Throws IllegalAction. */
  decide(state: State, action: Action, ctx: DecideContext): Event[];
  /** Applies one event. Pure; randomness is already baked into the event. */
  evolve(state: State, event: Event): State;
  viewFor(state: State, viewer: Viewer): View;
  /**
   * Hides secret details of an event, or drops it entirely, for this viewer.
   * `after` is the full state right after the event (never sent anywhere).
   */
  redactEvent(event: Event, viewer: Viewer, after: State): Event | null;
  outcome(state: State): Outcome | null;
}

// biome-ignore lint/suspicious/noExplicitAny: registry-level erasure of game-specific types
export type AnyEngine = GameEngine<any, any, any, any, any>;

/** One step the client animates: a (redacted) event and the view right after it. */
export interface Frame<View = unknown, Event = unknown> {
  version: number;
  /** Index of the event within its version (0-based). */
  index: number;
  event: Event | null;
  view: View;
}
