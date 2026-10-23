import { z } from 'zod';
import type { Rng } from '@/lib/engine/rng';
import {
  type GameEngine,
  IllegalAction,
  type Outcome,
  type Seat,
  type Viewer,
} from '@/lib/engine/types';
import {
  canPlaceSpectator,
  crazyToMove,
  directionOf,
  locate,
  onTrack,
  ranking,
  spectatorAt,
} from './track';
import {
  type CamelId,
  type CamelUpAction,
  type CamelUpEvent,
  type CamelUpOptions,
  type CamelUpState,
  type CamelUpView,
  CRAZY,
  type DieId,
  type LegScore,
  type LegScoreLine,
  OVERALL_PAYOUTS,
  PARTNERSHIP_MIN_PLAYERS,
  type Pile,
  PYRAMID_TICKETS,
  RACING,
  type RacingColor,
  STARTING_COINS,
  TICKET_VALUES,
  TRACK_LENGTH,
} from './types';

// Camel Up, 2nd edition. Rule IDs refer to games/camel-up/rules.md.

const freshStacks = (): Record<RacingColor, number[]> =>
  Object.fromEntries(RACING.map((c) => [c, [...TICKET_VALUES]])) as Record<RacingColor, number[]>;

const ALL_DICE: DieId[] = [...RACING, 'grey'];

const racingColor = z.enum(RACING);

const actionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('takeTicket'), color: racingColor }),
  z.strictObject({
    type: z.literal('placeSpectator'),
    space: z.number().int().min(1).max(TRACK_LENGTH),
    side: z.enum(['cheer', 'boo']),
  }),
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('bet'), pile: z.enum(['winner', 'loser']), color: racingColor }),
  z.strictObject({ type: z.literal('partner'), with: z.number().int().min(0).max(7) }),
]);

const optionsSchema = z.strictObject({ hideMoney: z.boolean().default(false) });

// ---------------------------------------------------------------------------

function setup(
  seats: { seat: Seat; name: string }[],
  options: CamelUpOptions,
  rng: Rng,
): CamelUpState {
  const track: CamelId[][] = Array.from({ length: TRACK_LENGTH }, () => []);

  // R4: each racing camel rolls its own die for a start space of 1–3.
  const starts = new Map<number, RacingColor[]>();
  for (const color of RACING) {
    const space = rng.int(1, 3);
    starts.set(space, [...(starts.get(space) ?? []), color]);
  }
  for (const [space, camels] of starts) track[space - 1] = rng.shuffle(camels);

  // R5: the grey die places the crazy camels on 16, 15 or 14.
  const first = rng.pick(CRAZY);
  const second = first === 'white' ? 'black' : 'white';
  track[TRACK_LENGTH - rng.int(1, 3)]?.push(first);
  track[TRACK_LENGTH - rng.int(1, 3)]?.push(second);

  const startingSeat = rng.int(0, seats.length - 1); // R7
  return {
    options,
    players: seats.map((s) => ({
      name: s.name,
      coins: STARTING_COINS,
      legTickets: [],
      pyramidTickets: 0,
      hand: [...RACING],
      spectator: null,
      partner: null,
    })),
    track,
    crossed: null,
    pyramid: [...ALL_DICE],
    rolled: [],
    legStacks: freshStacks(),
    pyramidTicketsLeft: PYRAMID_TICKETS,
    winnerPile: [],
    loserPile: [],
    revealed: { winner: 0, loser: 0 },
    turn: startingSeat,
    startingSeat,
    leg: 1,
    phase: 'playing',
    final: null,
  };
}

// evolve: one event at a time ---------------------------------------------------

function updatePlayer(
  state: CamelUpState,
  seat: Seat,
  fn: (p: CamelUpState['players'][number]) => CamelUpState['players'][number],
): CamelUpState['players'] {
  return state.players.map((p, i) => (i === seat ? fn(p) : p));
}

function evolve(state: CamelUpState, event: CamelUpEvent): CamelUpState {
  switch (event.type) {
    case 'ticketTaken':
      return {
        ...state,
        legStacks: { ...state.legStacks, [event.color]: state.legStacks[event.color].slice(1) },
        players: updatePlayer(state, event.seat, (p) => ({
          ...p,
          legTickets: [...p.legTickets, { color: event.color, value: event.value }],
        })),
      };
    case 'spectatorPlaced':
      return {
        ...state,
        players: updatePlayer(state, event.seat, (p) => ({
          ...p,
          spectator: { space: event.space, side: event.side },
        })),
      };
    case 'betPlaced': {
      // The real color only exists server-side; a redacted copy never reaches evolve.
      const color = event.color as RacingColor;
      const key = event.pile === 'winner' ? 'winnerPile' : 'loserPile';
      return {
        ...state,
        [key]: [...state[key], { seat: event.seat, color }],
        players: updatePlayer(state, event.seat, (p) => ({
          ...p,
          hand: p.hand.filter((c) => c !== color),
        })),
      };
    }
    case 'partnered':
      return {
        ...state,
        players: state.players.map((p, i) =>
          i === event.a
            ? { ...p, partner: event.b }
            : i === event.b
              ? { ...p, partner: event.a }
              : p,
        ),
      };
    case 'pyramidTicketTaken':
      return {
        ...state,
        pyramidTicketsLeft: state.pyramidTicketsLeft - 1,
        players: updatePlayer(state, event.seat, (p) => ({
          ...p,
          pyramidTickets: p.pyramidTickets + 1,
        })),
      };
    case 'dieRolled':
      return {
        ...state,
        pyramid: state.pyramid.filter((d) => d !== event.die),
        rolled: [...state.rolled, { die: event.die, value: event.value, face: event.face }],
      };
    case 'camelsMoved': {
      const track = state.track.map((stack) => [...stack]);
      const from = track[event.from - 1];
      if (from) from.splice(from.length - event.camels.length, event.camels.length);
      if (!onTrack(event.to)) {
        return {
          ...state,
          track,
          crossed: {
            camels: event.camels,
            space: event.to,
            direction: event.to > TRACK_LENGTH ? 'forward' : 'backward',
          },
        };
      }
      const to = track[event.to - 1] ?? [];
      track[event.to - 1] = event.under ? [...event.camels, ...to] : [...to, ...event.camels];
      return { ...state, track };
    }
    case 'spectatorPaid':
      return {
        ...state,
        players: updatePlayer(state, event.owner, (p) => ({ ...p, coins: p.coins + 1 })),
      };
    case 'raceFinished':
      return state;
    case 'legScored':
      return {
        ...state,
        players: state.players.map((p, seat) => {
          const delta = event.scores.find((s) => s.seat === seat)?.delta ?? 0;
          return { ...p, coins: p.coins + delta };
        }),
      };
    case 'legReset':
      return {
        ...state,
        players: state.players.map((p) => ({
          ...p,
          legTickets: [],
          pyramidTickets: 0,
          spectator: null,
          partner: null,
        })),
        pyramid: [...ALL_DICE],
        rolled: [],
        legStacks: freshStacks(),
        pyramidTicketsLeft: PYRAMID_TICKETS,
        leg: event.leg,
        startingSeat: event.startingSeat,
      };
    case 'overallCard':
      return {
        ...state,
        revealed: { ...state.revealed, [event.pile]: state.revealed[event.pile] + 1 },
        players: updatePlayer(state, event.seat, (p) => ({
          ...p,
          coins: p.coins + (event.delta ?? 0),
        })),
      };
    case 'gameEnded':
      return { ...state, phase: 'finished', final: { winner: event.winner, loser: event.loser } };
    case 'turnPassed':
      return { ...state, turn: event.seat };
  }
}

// decide: validate, then resolve into events ---------------------------------

/** Emits events while keeping a working copy of the state, so decide and evolve can't drift. */
class Emitter {
  readonly events: CamelUpEvent[] = [];
  constructor(public state: CamelUpState) {}
  emit(event: CamelUpEvent) {
    this.events.push(event);
    this.state = evolve(this.state, event);
  }
}

/** R15–R18: moves `camel` and everything on it by `steps` (signed), then any tile bounce. */
function moveUnit(out: Emitter, camel: CamelId, steps: number) {
  const at = locate(out.state.track, camel);
  if (!at) throw new Error(`camel ${camel} is not on the track`);
  const unit = (out.state.track[at.space - 1] ?? []).slice(at.height);
  const to = at.space + steps;
  out.emit({ type: 'camelsMoved', camels: unit, from: at.space, to, under: false, cause: 'die' });
  if (!onTrack(to)) return finishRace(out, unit, to);

  const tile = spectatorAt(out.state, to);
  if (!tile) return;
  out.emit({ type: 'spectatorPaid', owner: tile.owner, space: to });
  const direction = Math.sign(steps);
  const bounceTo = to + (tile.side === 'cheer' ? direction : -direction);
  out.emit({
    type: 'camelsMoved',
    camels: unit,
    from: to,
    to: bounceTo,
    under: tile.side === 'boo',
    cause: tile.side,
  });
  if (!onTrack(bounceTo)) finishRace(out, unit, bounceTo);
}

function finishRace(out: Emitter, camels: CamelId[], to: number) {
  out.emit({ type: 'raceFinished', direction: to > TRACK_LENGTH ? 'forward' : 'backward', camels });
}

/** What actually changes hands: you can never pay more than you have (R24, R29). */
function payable(change: number, coins: number): number {
  const delta = Math.max(change, -coins);
  return delta === 0 ? 0 : delta; // never -0
}

/** R24–R25. */
function legScores(state: CamelUpState): { ranking: RacingColor[]; scores: LegScore[] } {
  const order = ranking(state);
  const [first, second] = order;
  const reward = (color: RacingColor) => (color === first ? null : color === second ? 1 : -1);
  const linesOf = (seat: Seat): LegScoreLine[] => {
    const p = state.players[seat];
    if (!p) return [];
    return [
      ...p.legTickets.map((t) => ({
        kind: 'ticket' as const,
        color: t.color,
        value: t.value,
        reward: reward(t.color) ?? t.value,
      })),
      ...Array.from({ length: p.pyramidTickets }, () => ({
        kind: 'pyramid' as const,
        color: null,
        value: 1,
        reward: 1,
      })),
    ];
  };
  const scores = state.players.map((p, seat) => {
    const lines = linesOf(seat);
    if (p.partner !== null) {
      // Ruling 5: take the partner's best ticket, or nothing if all would cost.
      const best = linesOf(p.partner).reduce<LegScoreLine | null>(
        (top, line) => (line.reward > (top?.reward ?? 0) ? line : top),
        null,
      );
      if (best) lines.push({ ...best, kind: 'partner' });
    }
    const total = lines.reduce((sum, l) => sum + l.reward, 0);
    return { seat, lines, total, delta: payable(total, p.coins) };
  });
  return { ranking: order, scores };
}

/** R29: card by card, winner pile first; each payment respects the 0 floor. */
function scoreOverall(out: Emitter) {
  const order = ranking(out.state);
  const winner = order[0] as RacingColor;
  const loser = order[order.length - 1] as RacingColor;
  for (const pile of ['winner', 'loser'] as Pile[]) {
    const target = pile === 'winner' ? winner : loser;
    const cards = pile === 'winner' ? out.state.winnerPile : out.state.loserPile;
    let correctSoFar = 0;
    cards.forEach((card, index) => {
      const correct = card.color === target;
      const payout = correct ? (OVERALL_PAYOUTS[correctSoFar++] ?? 1) : -1;
      const coins = out.state.players[card.seat]?.coins ?? 0;
      out.emit({
        type: 'overallCard',
        pile,
        index,
        seat: card.seat,
        color: card.color,
        correct,
        payout,
        delta: payable(payout, coins),
      });
    });
  }
  out.emit({ type: 'gameEnded', winner, loser });
}

function endOfAction(out: Emitter, seat: Seat) {
  const n = out.state.players.length;
  const next = (seat + 1) % n;
  if (out.state.crossed) {
    // R28–R29: final leg scoring, then the overall bets.
    out.emit({ type: 'legScored', leg: out.state.leg, ...legScores(out.state) });
    scoreOverall(out);
    return;
  }
  if (out.state.pyramidTicketsLeft === 0) {
    // R23–R27.
    out.emit({ type: 'legScored', leg: out.state.leg, ...legScores(out.state) });
    out.emit({ type: 'legReset', leg: out.state.leg + 1, startingSeat: next });
  }
  out.emit({ type: 'turnPassed', seat: next });
}

function decide(state: CamelUpState, action: CamelUpAction, seat: Seat, rng: Rng): CamelUpEvent[] {
  if (state.phase !== 'playing') throw new IllegalAction('The race is over.');
  if (seat !== state.turn) throw new IllegalAction('It’s not your turn.');
  const me = state.players[seat];
  if (!me) throw new IllegalAction('You’re not in this game.');
  const out = new Emitter(state);

  switch (action.type) {
    case 'takeTicket': {
      const value = state.legStacks[action.color][0];
      if (value === undefined)
        throw new IllegalAction(`No ${action.color} tickets are left this leg.`);
      out.emit({ type: 'ticketTaken', seat, color: action.color, value });
      break;
    }
    case 'placeSpectator': {
      if (!canPlaceSpectator(state, seat, action.space)) {
        throw new IllegalAction('Your spectator tile can’t go there.');
      }
      out.emit({
        type: 'spectatorPlaced',
        seat,
        space: action.space,
        side: action.side,
        from: me.spectator?.space ?? null,
      });
      break;
    }
    case 'roll': {
      if (state.pyramidTicketsLeft <= 0 || state.pyramid.length === 0) {
        throw new IllegalAction('The pyramid is empty.');
      }
      out.emit({ type: 'pyramidTicketTaken', seat });
      const die = rng.pick(state.pyramid);
      const value = rng.int(1, 3);
      if (die === 'grey') {
        const face = rng.pick(CRAZY);
        const camel = crazyToMove(out.state.track, face);
        out.emit({ type: 'dieRolled', die, value, face, camel });
        moveUnit(out, camel, value * directionOf(camel));
      } else {
        out.emit({ type: 'dieRolled', die, value, face: null, camel: die });
        moveUnit(out, die, value);
      }
      break;
    }
    case 'bet': {
      if (!me.hand.includes(action.color)) {
        throw new IllegalAction(`You already played your ${action.color} card.`);
      }
      out.emit({ type: 'betPlaced', seat, pile: action.pile, color: action.color });
      break;
    }
    case 'partner': {
      if (state.players.length < PARTNERSHIP_MIN_PLAYERS) {
        throw new IllegalAction('Partnerships need six or more players.');
      }
      const other = state.players[action.with];
      if (action.with === seat || !other) throw new IllegalAction('Pick another player.');
      if (me.partner !== null) throw new IllegalAction('You already have a partner this leg.');
      if (other.partner !== null) throw new IllegalAction('They already have a partner this leg.');
      out.emit({ type: 'partnered', a: seat, b: action.with });
      break;
    }
  }
  endOfAction(out, seat);
  return out.events;
}

function legalActions(state: CamelUpState, seat: Seat): CamelUpAction[] {
  if (state.phase !== 'playing' || seat !== state.turn) return [];
  const me = state.players[seat];
  if (!me) return [];
  const actions: CamelUpAction[] = [];
  for (const color of RACING) {
    if (state.legStacks[color].length > 0) actions.push({ type: 'takeTicket', color });
  }
  if (state.pyramidTicketsLeft > 0) actions.push({ type: 'roll' });
  for (let space = 2; space <= TRACK_LENGTH; space++) {
    if (canPlaceSpectator(state, seat, space)) {
      actions.push({ type: 'placeSpectator', space, side: 'cheer' });
      actions.push({ type: 'placeSpectator', space, side: 'boo' });
    }
  }
  for (const color of me.hand) {
    actions.push({ type: 'bet', pile: 'winner', color });
    actions.push({ type: 'bet', pile: 'loser', color });
  }
  if (state.players.length >= PARTNERSHIP_MIN_PLAYERS && me.partner === null) {
    state.players.forEach((p, other) => {
      if (other !== seat && p.partner === null) actions.push({ type: 'partner', with: other });
    });
  }
  return actions;
}

function viewFor(state: CamelUpState, viewer: Viewer): CamelUpView {
  const you = viewer === 'spectator' ? null : viewer;
  const over = state.phase === 'finished';
  const pile = (cards: CamelUpState['winnerPile'], revealed: number) =>
    cards.map((c, i) => ({ seat: c.seat, color: i < revealed || c.seat === you ? c.color : null }));
  return {
    you,
    options: state.options,
    players: state.players.map((p, seat) => ({
      name: p.name,
      coins: state.options.hideMoney && !over && seat !== you ? null : p.coins,
      legTickets: p.legTickets,
      pyramidTickets: p.pyramidTickets,
      handCount: p.hand.length,
      hand: seat === you ? p.hand : null,
      spectator: p.spectator,
      partner: p.partner,
    })),
    track: state.track,
    crossed: state.crossed,
    pyramid: state.pyramid,
    rolled: state.rolled,
    legStacks: state.legStacks,
    pyramidTicketsLeft: state.pyramidTicketsLeft,
    winnerPile: pile(state.winnerPile, state.revealed.winner),
    loserPile: pile(state.loserPile, state.revealed.loser),
    turn: state.turn,
    startingSeat: state.startingSeat,
    leg: state.leg,
    phase: state.phase,
    final: state.final,
  };
}

function redactEvent(event: CamelUpEvent, viewer: Viewer, after: CamelUpState): CamelUpEvent {
  const you = viewer === 'spectator' ? null : viewer;
  if (event.type === 'betPlaced' && event.seat !== you) return { ...event, color: null };
  if (event.type === 'legScored' && after.options.hideMoney && after.phase !== 'finished') {
    return {
      ...event,
      scores: event.scores.map((s) => (s.seat === you ? s : { ...s, delta: null })),
    };
  }
  return event;
}

function outcome(state: CamelUpState): Outcome | null {
  if (state.phase !== 'finished' || !state.final) return null;
  const coins = state.players.map((p) => p.coins);
  const distinct = [...new Set(coins)].sort((a, b) => b - a);
  const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1);
  return {
    standings: coins.map((score, seat) => ({ seat, score, rank: distinct.indexOf(score) + 1 })),
    summary: `${cap(state.final.winner)} won the race and ${state.final.loser} came last.`,
  };
}

export const camelUp: GameEngine<
  CamelUpState,
  CamelUpAction,
  CamelUpEvent,
  CamelUpView,
  CamelUpOptions
> = {
  id: 'camel-up',
  version: 1,
  players: { min: 2, max: 8 },
  actionSchema,
  optionsSchema,
  setup: ({ seats, options, rng }) => setup(seats, options, rng),
  activeSeats: (state) => (state.phase === 'playing' ? [state.turn] : []),
  legalActions,
  decide: (state, action, { seat, rng }) => decide(state, action, seat, rng),
  evolve,
  viewFor,
  redactEvent,
  outcome,
};
