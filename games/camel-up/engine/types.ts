import type { Seat } from '@/lib/engine/types';

// Camel Up, 2nd edition. Rule IDs (R1…) refer to games/camel-up/rules.md.

export const RACING = ['blue', 'green', 'red', 'yellow', 'purple'] as const;
export const CRAZY = ['white', 'black'] as const;
export type RacingColor = (typeof RACING)[number];
export type CrazyColor = (typeof CRAZY)[number];
export type CamelId = RacingColor | CrazyColor;
export type DieId = RacingColor | 'grey';

export const TRACK_LENGTH = 16;
export const PYRAMID_TICKETS = 5;
/** R2: top of the stack first. */
export const TICKET_VALUES = [5, 3, 2, 2] as const;
/** R29: payouts for correct overall bets, in reveal order; 1 after these. */
export const OVERALL_PAYOUTS = [8, 5, 3, 2] as const;
export const STARTING_COINS = 3;
export const PARTNERSHIP_MIN_PLAYERS = 6;

export const isRacing = (c: CamelId): c is RacingColor => (RACING as readonly string[]).includes(c);
export const isCrazy = (c: CamelId): c is CrazyColor => (CRAZY as readonly string[]).includes(c);

export type Side = 'cheer' | 'boo';
export type Pile = 'winner' | 'loser';

export interface LegTicket {
  color: RacingColor;
  value: number;
}

export interface Spectator {
  space: number;
  side: Side;
}

export interface PlayerState {
  name: string;
  coins: number;
  legTickets: LegTicket[];
  pyramidTickets: number;
  /** Finish cards still in hand. Secret (H1). */
  hand: RacingColor[];
  /** Null while in hand. */
  spectator: Spectator | null;
  /** This leg's partner (6+ players). */
  partner: Seat | null;
}

export interface RolledDie {
  die: DieId;
  value: number;
  /** Grey die only: the color of its number. */
  face: CrazyColor | null;
}

export interface OverallCard {
  seat: Seat;
  /** Secret until the end of the game (H2). */
  color: RacingColor;
}

/** A unit that crossed the finish line; the race is over once this is set. */
export interface Crossed {
  camels: CamelId[];
  /** Off-board position: 17+ forward, 0 or below backward. */
  space: number;
  direction: 'forward' | 'backward';
}

export interface FinalResult {
  winner: RacingColor;
  loser: RacingColor;
}

export interface CamelUpOptions {
  hideMoney: boolean;
}

export interface CamelUpState {
  options: CamelUpOptions;
  players: PlayerState[];
  /** track[i] is space i + 1, bottom of the stack first. */
  track: CamelId[][];
  crossed: Crossed | null;
  pyramid: DieId[];
  rolled: RolledDie[];
  legStacks: Record<RacingColor, number[]>;
  pyramidTicketsLeft: number;
  winnerPile: OverallCard[];
  loserPile: OverallCard[];
  /** How many cards of each pile have been turned face up (end of game, R29). */
  revealed: Record<Pile, number>;
  turn: Seat;
  startingSeat: Seat;
  leg: number;
  phase: 'playing' | 'finished';
  final: FinalResult | null;
}

// Actions ---------------------------------------------------------------------

export type CamelUpAction =
  | { type: 'takeTicket'; color: RacingColor }
  | { type: 'placeSpectator'; space: number; side: Side }
  | { type: 'roll' }
  | { type: 'bet'; pile: Pile; color: RacingColor }
  | { type: 'partner'; with: Seat };

// Events (each one is animated) ---------------------------------------------

export interface LegScoreLine {
  kind: 'ticket' | 'pyramid' | 'partner';
  color: RacingColor | null;
  value: number;
  reward: number;
}

export interface LegScore {
  seat: Seat;
  lines: LegScoreLine[];
  total: number;
  /** What actually changed hands after the never-below-zero rule (R24). */
  delta: number | null;
}

export type CamelUpEvent =
  | { type: 'ticketTaken'; seat: Seat; color: RacingColor; value: number }
  | { type: 'spectatorPlaced'; seat: Seat; space: number; side: Side; from: number | null }
  | { type: 'betPlaced'; seat: Seat; pile: Pile; color: RacingColor | null }
  | { type: 'partnered'; a: Seat; b: Seat }
  | { type: 'pyramidTicketTaken'; seat: Seat }
  | { type: 'dieRolled'; die: DieId; value: number; face: CrazyColor | null; camel: CamelId }
  | {
      type: 'camelsMoved';
      /** Bottom to top. */
      camels: CamelId[];
      from: number;
      to: number;
      /** R18 booing: the unit slides under whatever is there. */
      under: boolean;
      cause: 'die' | 'cheer' | 'boo';
    }
  | { type: 'spectatorPaid'; owner: Seat; space: number }
  | { type: 'raceFinished'; direction: 'forward' | 'backward'; camels: CamelId[] }
  | { type: 'legScored'; leg: number; ranking: RacingColor[]; scores: LegScore[] }
  | { type: 'legReset'; leg: number; startingSeat: Seat }
  | {
      type: 'overallCard';
      pile: Pile;
      index: number;
      seat: Seat;
      color: RacingColor;
      correct: boolean;
      payout: number;
      /** After the never-below-zero rule; null when hidden from this viewer. */
      delta: number | null;
    }
  | { type: 'gameEnded'; winner: RacingColor; loser: RacingColor }
  | { type: 'turnPassed'; seat: Seat };

// What each viewer receives -------------------------------------------------

export interface PlayerView {
  name: string;
  /** Null when hidden by the hide-money option (H3). */
  coins: number | null;
  legTickets: LegTicket[];
  pyramidTickets: number;
  handCount: number;
  /** Only your own hand. */
  hand: RacingColor[] | null;
  spectator: Spectator | null;
  partner: Seat | null;
}

export interface CamelUpView {
  you: Seat | null;
  options: CamelUpOptions;
  players: PlayerView[];
  track: CamelId[][];
  crossed: Crossed | null;
  pyramid: DieId[];
  rolled: RolledDie[];
  legStacks: Record<RacingColor, number[]>;
  pyramidTicketsLeft: number;
  winnerPile: { seat: Seat; color: RacingColor | null }[];
  loserPile: { seat: Seat; color: RacingColor | null }[];
  turn: Seat;
  startingSeat: Seat;
  leg: number;
  phase: 'playing' | 'finished';
  final: FinalResult | null;
}
