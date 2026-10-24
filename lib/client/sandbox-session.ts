'use client';

import { createRng } from '@/lib/engine/rng';
import type { AnyEngine, Frame, Seat } from '@/lib/engine/types';
import type { FxMessage } from '@/lib/realtime/messages';
import { buildFrames } from '@/lib/runtime/frames';
import type { FrameListener, GameSession } from './session';

// DEV SANDBOX ONLY: runs an engine entirely in the browser with every seat on
// one screen (pass-and-play), test bots, and a frame log for inspection.

export interface SandboxLogEntry {
  version: number;
  seat: Seat;
  action: unknown;
  events: unknown[];
}

export class SandboxSession implements GameSession {
  private state: unknown;
  private version = 0;
  private listener: FrameListener | null = null;
  private viewer: Seat | 'spectator' = 0;
  private fx = new Set<(m: FxMessage) => void>();
  readonly log: SandboxLogEntry[] = [];
  private subscribers = new Set<() => void>();

  constructor(
    readonly engine: AnyEngine,
    readonly players: number,
    private seed: string,
    options: unknown = {},
  ) {
    this.state = engine.setup({
      seats: Array.from({ length: players }, (_, seat) => ({ seat, name: `Seat ${seat + 1}` })),
      options: engine.optionsSchema.parse(options),
      rng: createRng(seed, 0),
    });
  }

  /** Full server-side state, for the inspector only. */
  get fullState() {
    return this.state;
  }

  get currentVersion() {
    return this.version;
  }

  get active(): Seat[] {
    return this.engine.activeSeats(this.state);
  }

  get viewing() {
    return this.viewer;
  }

  subscribe(cb: () => void) {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private changed() {
    for (const cb of this.subscribers) cb();
  }

  /** Switch whose eyes the board sees through (hidden information included). */
  setViewer(viewer: Seat | 'spectator') {
    this.viewer = viewer;
    this.snapshot();
    this.changed();
  }

  private snapshot() {
    this.listener?.({
      kind: 'snapshot',
      version: this.version,
      view: this.engine.viewFor(this.state, this.viewer),
      seat: this.viewer === 'spectator' ? null : this.viewer,
    });
  }

  attachBoard(listener: FrameListener) {
    this.listener = listener;
    this.snapshot();
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }

  /** Plays `action` as `seat` (defaults to the viewer). */
  async act(action: { type: string; [key: string]: unknown }, seat?: Seat) {
    const actor = seat ?? (this.viewer === 'spectator' ? this.active[0] : this.viewer);
    if (actor === undefined) throw new Error('nobody can act');
    const parsed = this.engine.actionSchema.parse(action);
    const version = this.version + 1;
    const events = this.engine.decide(this.state, parsed, {
      seat: actor,
      rng: createRng(this.seed, version),
    });
    const before = this.state;
    let next = before;
    for (const e of events) next = this.engine.evolve(next, e);
    this.state = next;
    this.version = version;
    this.log.push({ version, seat: actor, action: parsed, events });
    const frames: Frame[] = buildFrames(this.engine, before, [{ version, events }], this.viewer);
    this.listener?.({ kind: 'frames', frames });
    this.changed();
  }

  /** A test bot: a random legal move for the first active seat. */
  async botMove(rng = createRng(`${this.seed}:bot`, this.version)) {
    const seat = this.active[0];
    if (seat === undefined) return false;
    const legal = this.engine.legalActions(this.state, seat);
    if (legal.length === 0) return false;
    await this.act(rng.pick(legal), seat);
    return true;
  }

  sendFx(msg: FxMessage) {
    for (const cb of this.fx) cb(msg);
  }

  onFx(cb: (msg: FxMessage) => void) {
    this.fx.add(cb);
    return () => this.fx.delete(cb);
  }
}
