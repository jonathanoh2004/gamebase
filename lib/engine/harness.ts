import { createRng, type Rng } from './rng';
import type { AnyEngine, Seat, SeatInfo } from './types';

// Test harness for engines (docs/DESIGN.md §5, PORTING.md phase 3).

/**
 * Runs `fn` with Math.random and Date rigged to throw, so any randomness or
 * clock read outside the seeded rng fails the test.
 */
export function deterministic<T>(fn: () => T): T {
  // biome-ignore lint/nursery/noJsRestrictedProperties: saved so the trap below can be undone
  const realRandom = Math.random;
  const RealDate = globalThis.Date;
  const trap = () => {
    throw new Error('engines must not use Math.random or Date; use the seeded rng');
  };
  Math.random = trap;
  globalThis.Date = new Proxy(RealDate, {
    construct: trap,
    apply: trap,
    get: trap,
  }) as DateConstructor;
  try {
    return fn();
  } finally {
    Math.random = realRandom;
    globalThis.Date = RealDate;
  }
}

export const seatsFor = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, seat) => ({ seat, name: `P${seat + 1}` }));

export interface SimStep {
  seat: Seat;
  action: unknown;
  events: unknown[];
  before: unknown;
  after: unknown;
}

export interface SimResult {
  steps: SimStep[];
  final: unknown;
  outcome: ReturnType<AnyEngine['outcome']>;
  actions: { seat: Seat; action: unknown }[];
}

export interface SimOptions {
  players: number;
  seed: string;
  options?: unknown;
  maxSteps?: number;
  /** Choose a move; defaults to a uniformly random legal action. */
  choose?: (legal: unknown[], seat: Seat, state: unknown, rng: Rng) => unknown;
  /** Called after every step, inside the deterministic sandbox. */
  onStep?: (step: SimStep) => void;
}

/** Plays a whole game the way the server would: version-keyed rng streams. */
export function simulate(engine: AnyEngine, opts: SimOptions): SimResult {
  const pickRng = createRng(`${opts.seed}:bots`, 'choices');
  const options = engine.optionsSchema.parse(opts.options ?? {});
  return deterministic(() => {
    let state = engine.setup({
      seats: seatsFor(opts.players),
      options,
      rng: createRng(opts.seed, 0),
    });
    const steps: SimStep[] = [];
    const actions: SimResult['actions'] = [];
    const max = opts.maxSteps ?? 5000;
    for (let version = 1; version <= max; version++) {
      const active = engine.activeSeats(state);
      if (active.length === 0) break;
      const seat = active[pickRng.int(0, active.length - 1)] as Seat;
      const legal = engine.legalActions(state, seat);
      if (legal.length === 0) throw new Error(`seat ${seat} is active but has no legal action`);
      const action = opts.choose
        ? opts.choose(legal, seat, state, pickRng)
        : legal[pickRng.int(0, legal.length - 1)];
      const events = engine.decide(state, action, { seat, rng: createRng(opts.seed, version) });
      const before = state;
      for (const event of events) state = engine.evolve(state, event);
      const step = { seat, action, events, before, after: state };
      steps.push(step);
      actions.push({ seat, action });
      opts.onStep?.(step);
    }
    if (engine.activeSeats(state).length > 0) throw new Error(`game did not end in ${max} moves`);
    return { steps, final: state, outcome: engine.outcome(state), actions };
  });
}

/** Replays recorded actions; returns the final state (for golden replays). */
export function replay(
  engine: AnyEngine,
  seed: string,
  players: number,
  actions: { seat: Seat; action: unknown }[],
  options: unknown = {},
): unknown {
  return deterministic(() => {
    let state = engine.setup({
      seats: seatsFor(players),
      options: engine.optionsSchema.parse(options),
      rng: createRng(seed, 0),
    });
    actions.forEach(({ seat, action }, i) => {
      const events = engine.decide(state, action, { seat, rng: createRng(seed, i + 1) });
      for (const event of events) state = engine.evolve(state, event);
    });
    return state;
  });
}

/** JSON round-trip must be lossless: state is stored as jsonb. */
export function assertPlainJson(value: unknown, label: string) {
  const copy = JSON.parse(JSON.stringify(value));
  const same = JSON.stringify(copy) === JSON.stringify(value);
  if (!same) throw new Error(`${label} is not plain JSON`);
  const walk = (v: unknown, path: string) => {
    if (v === undefined) throw new Error(`${label} has undefined at ${path}`);
    if (typeof v === 'number' && !Number.isFinite(v))
      throw new Error(`${label} has ${v} at ${path}`);
    if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) walk(child, `${path}.${k}`);
    }
  };
  walk(value, '$');
}

/** A random legal move. Dev sandbox and tests only. */
export function randomMove(engine: AnyEngine, state: unknown, seat: Seat, rng: Rng): unknown {
  const legal = engine.legalActions(state, seat);
  if (legal.length === 0) throw new Error('no legal moves');
  return rng.pick(legal);
}
