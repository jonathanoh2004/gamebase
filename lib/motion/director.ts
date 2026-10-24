'use client';

import {
  type AnimationParams,
  animate,
  createTimeline,
  type JSAnimation,
  type TargetsParam,
  type Timeline,
  type TimelineParams,
  utils,
} from 'animejs';
import { flushSync } from 'react-dom';
import type { Frame } from '@/lib/engine/types';
import { DUR, EASE } from './tokens';

// The frame director (docs/DESIGN.md §6.2). It plays server frames in order:
//   1. pre     lead-in while the board still shows the previous view
//   2. commit  React renders the new view; moved pieces are held at their old
//              spots by an offset on their inner motion wrapper (FLIP)
//   3. travel  those offsets animate back to zero (glide, hop, fly…)
//   4. post    follow-through
// React always renders the true state, so skipping or interrupting an
// animation can never leave the board wrong: at worst a piece snaps.

export interface Placement {
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  /** Stacking order. */
  z?: number;
}

export type Layout = Record<string, Placement>;

export interface Move {
  id: string;
  from: Placement;
  to: Placement;
  /** The piece's inner motion wrapper (safe to animate). */
  motion: HTMLElement;
  /** Offset from `to` back to `from`, in the piece's own frame. */
  offset: { x: number; y: number; rotate: number; scale: number };
}

export interface StepCtx<V> {
  prev: V;
  next: V;
  reduced: boolean;
  speed: number;
  stage: HTMLElement;
  piece(id: string): HTMLElement | null;
  motion(id: string): HTMLElement | null;
  /** A leaving piece's ghost (its last look), if it left this frame. */
  ghost(id: string): HTMLElement | null;
  animate(targets: TargetsParam, params: AnimationParams): JSAnimation;
  timeline(params?: TimelineParams): Timeline;
  wait(ms: number): Promise<void>;
  /** The default travel: every move glides home. */
  glide(moves: Move[], params?: AnimationParams): Promise<void>;
}

/** Each step may return anything awaitable (an animation, a promise) or nothing. */
export interface FramePlan<V> {
  pre?: (ctx: StepCtx<V>) => unknown;
  travel?: (ctx: StepCtx<V>, moves: Move[]) => unknown;
  post?: (ctx: StepCtx<V>) => unknown;
}

export interface DirectorOptions<V, E> {
  stage: () => HTMLElement | null;
  layout: (view: V) => Layout;
  commit: (view: V) => void;
  plan?: (event: E | null, prev: V, next: V) => FramePlan<V>;
  reduced: () => boolean;
  onBusyChange?: (busy: boolean) => void;
  onFrame?: (frame: Frame<V, E>) => void;
}

interface Completable {
  complete(): unknown;
}

const EPS = 0.25;
/** More actions than this queued (a tab left in the background): jump ahead. */
const CATCH_UP_AFTER = 4;

function differs(a: Placement, b: Placement) {
  return (
    Math.abs(a.x - b.x) > EPS ||
    Math.abs(a.y - b.y) > EPS ||
    Math.abs((a.rotate ?? 0) - (b.rotate ?? 0)) > EPS ||
    Math.abs((a.scale ?? 1) - (b.scale ?? 1)) > 0.001
  );
}

/** The from→to delta expressed in the destination's rotated, scaled frame. */
function offsetFor(from: Placement, to: Placement): Move['offset'] {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const r = (-(to.rotate ?? 0) * Math.PI) / 180;
  const s = to.scale ?? 1;
  return {
    x: (dx * Math.cos(r) - dy * Math.sin(r)) / s,
    y: (dx * Math.sin(r) + dy * Math.cos(r)) / s,
    rotate: (from.rotate ?? 0) - (to.rotate ?? 0),
    scale: (from.scale ?? 1) / s,
  };
}

const keyOf = (f: Frame) => f.version * 10_000 + f.index;

export class Director<V, E> {
  private queue: Frame<V, E>[] = [];
  private running = false;
  private disposed = false;
  private active = new Set<Completable>();
  private skipping = false;
  private lastKey = -1;
  private speed = 1;
  /** Bumped by every snap; a frame from an older epoch stops touching state. */
  private epoch = 0;
  private busy = false;

  constructor(
    private view: V,
    private readonly opts: DirectorOptions<V, E>,
  ) {}

  get current(): V {
    return this.view;
  }

  get pending(): number {
    return this.queue.length + (this.running ? 1 : 0);
  }

  setSpeed(speed: number) {
    this.speed = Math.max(0.25, Math.min(4, speed));
  }

  /** Queue frames from the server; duplicates and old frames are ignored. */
  enqueue(frames: Frame<V, E>[]) {
    for (const f of frames) {
      const key = keyOf(f as Frame);
      const queuedMax = this.queue.length
        ? keyOf(this.queue[this.queue.length - 1] as Frame)
        : this.lastKey;
      if (key > queuedMax) this.queue.push(f);
    }
    // Callers may be inside a React effect, where flushSync is not allowed;
    // starting on a microtask puts every commit outside React's own work.
    queueMicrotask(() => void this.run());
  }

  /** Jump straight to a view (a fresh snapshot, or the end of a backlog). */
  snap(view: V, version?: number) {
    this.epoch++;
    this.finishActive();
    this.queue = [];
    this.view = view;
    if (version !== undefined) this.lastKey = version * 10_000 + 9_999;
    queueMicrotask(() => {
      if (!this.disposed && this.view === view) this.show(view);
    });
  }

  private show(view: V) {
    flushSync(() => this.opts.commit(view));
    this.resetOffsets();
  }

  /** Finish the current frame instantly. */
  skip() {
    this.skipping = true;
    this.finishActive();
  }

  dispose() {
    this.disposed = true;
    this.finishActive();
    this.queue = [];
  }

  private setBusy(busy: boolean) {
    if (busy === this.busy) return;
    this.busy = busy;
    this.opts.onBusyChange?.(busy);
  }

  private finishActive() {
    for (const a of [...this.active]) {
      try {
        a.complete();
      } catch {
        // already done
      }
    }
    this.active.clear();
  }

  private resetOffsets() {
    const stage = this.opts.stage();
    if (!stage) return;
    for (const el of stage.querySelectorAll<HTMLElement>('[data-motion]')) {
      utils.set(el, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
    }
    stage.querySelector('[data-ghost-layer]')?.replaceChildren();
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    this.setBusy(true);
    try {
      while (this.queue.length && !this.disposed) {
        if (this.actionsQueued() > CATCH_UP_AFTER) {
          const skipped = this.queue;
          const last = skipped[skipped.length - 1] as Frame<V, E>;
          this.finishActive();
          this.queue = [];
          this.view = last.view;
          this.show(last.view);
          this.lastKey = keyOf(last as Frame);
          // No animation, but listeners (the event log) still hear every move.
          for (const f of skipped) this.opts.onFrame?.(f);
          continue;
        }
        const frame = this.queue.shift() as Frame<V, E>;
        const epoch = this.epoch;
        this.skipping = false;
        await this.play(frame, epoch);
        if (epoch !== this.epoch) continue; // a snapshot replaced it mid-play
        this.lastKey = keyOf(frame as Frame);
        this.opts.onFrame?.(frame);
      }
    } finally {
      this.running = false;
      this.setBusy(false);
    }
  }

  /** Distinct actions waiting (one action can emit many frames). */
  private actionsQueued(except?: number) {
    const versions = new Set(this.queue.map((f) => (f as Frame).version));
    if (except !== undefined) versions.delete(except);
    return versions.size;
  }

  private makeCtx(
    prev: V,
    next: V,
    stage: HTMLElement,
    ghosts: Map<string, HTMLElement>,
    version: number,
  ): StepCtx<V> {
    const reduced = this.opts.reduced();
    // Moves waiting behind this one? Play faster so the table catches up.
    const behind = this.actionsQueued(version);
    const speed = this.speed * (behind >= 3 ? 2.2 : behind >= 1 ? 1.4 : 1);
    const track = <T extends Completable>(a: T): T => {
      this.active.add(a);
      if (this.skipping) a.complete();
      return a;
    };
    const ctx: StepCtx<V> = {
      prev,
      next,
      reduced,
      speed,
      stage,
      piece: (id) => stage.querySelector<HTMLElement>(`[data-piece="${CSS.escape(id)}"]`),
      motion: (id) =>
        stage.querySelector<HTMLElement>(`[data-piece="${CSS.escape(id)}"] > [data-motion]`),
      ghost: (id) => ghosts.get(id) ?? null,
      animate: (targets, params) => {
        const a = animate(targets, { ...params, playbackRate: speed });
        void a.then(() => this.active.delete(a));
        return track(a);
      },
      timeline: (params) => {
        const t = createTimeline({ ...params, playbackRate: speed });
        void t.then(() => this.active.delete(t));
        return track(t);
      },
      wait: (ms) =>
        this.skipping
          ? Promise.resolve()
          : new Promise((resolve) => {
              const timer = setTimeout(resolve, ms / speed);
              track({
                complete: () => {
                  clearTimeout(timer);
                  resolve(undefined);
                },
              });
            }),
      glide: async (moves, params) => {
        await Promise.all(
          moves.map((m) =>
            ctx.animate(m.motion, {
              x: 0,
              y: 0,
              rotate: 0,
              scale: 1,
              duration: DUR.glide,
              ease: EASE.ui,
              ...params,
            }),
          ),
        );
      },
    };
    return ctx;
  }

  private async play(frame: Frame<V, E>, epoch: number) {
    const stale = () => epoch !== this.epoch || this.disposed;
    const stage = this.opts.stage();
    const prev = this.view;
    const next = frame.view;
    if (!stage) {
      // Not mounted: just keep the state current.
      this.opts.commit(next);
      this.view = next;
      return;
    }
    const plan = this.opts.plan?.(frame.event, prev, next) ?? {};
    const ghostLayer = stage.querySelector<HTMLElement>('[data-ghost-layer]');
    const ghosts = new Map<string, HTMLElement>();
    const ctx = this.makeCtx(prev, next, stage, ghosts, frame.version);

    if (plan.pre && !ctx.reduced) await plan.pre(ctx);
    if (stale()) return;

    const before = this.opts.layout(prev);
    const after = this.opts.layout(next);

    // Leaving pieces: keep a ghost of their last look.
    for (const id of Object.keys(before)) {
      if (after[id] || !ghostLayer) continue;
      const el = ctx.piece(id);
      if (!el) continue;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.removeAttribute('data-piece');
      clone.dataset.ghost = id;
      ghostLayer.appendChild(clone);
      ghosts.set(id, clone);
    }

    flushSync(() => this.opts.commit(next));
    // The commit can run effects that snap to a new view; that view wins.
    if (stale()) {
      for (const g of ghosts.values()) g.remove();
      return;
    }
    this.view = next;

    const moves: Move[] = [];
    for (const [id, to] of Object.entries(after)) {
      const from = before[id];
      const motion = ctx.motion(id);
      if (!motion) continue;
      if (!from) {
        if (!ctx.reduced) utils.set(motion, { opacity: 0, scale: 0.6 });
        continue;
      }
      if (!differs(from, to)) continue;
      const offset = offsetFor(from, to);
      moves.push({ id, from, to, motion, offset });
    }

    if (ctx.reduced) {
      for (const m of moves) utils.set(m.motion, { x: 0, y: 0, rotate: 0, scale: 1 });
      await Promise.all(
        moves.map((m) =>
          ctx.animate(m.motion, { opacity: [0.35, 1], duration: DUR.fade, ease: 'linear' }),
        ),
      );
    } else {
      for (const m of moves) utils.set(m.motion, m.offset);
      const entering = Object.keys(after)
        .filter((id) => !before[id])
        .map((id) => ctx.motion(id))
        .filter((el): el is HTMLElement => el !== null);
      const enter = entering.length
        ? ctx.animate(entering, { opacity: 1, scale: 1, duration: DUR.ui, ease: EASE.back })
        : null;
      const leave = [...ghosts.values()].map((g) =>
        ctx.animate(g, { opacity: 0, scale: 0.85, duration: DUR.ui, ease: EASE.ui }),
      );
      await (plan.travel ? plan.travel(ctx, moves) : ctx.glide(moves));
      await Promise.all([enter, ...leave]);
    }

    for (const g of ghosts.values()) g.remove();
    if (stale()) return;
    if (plan.post && !ctx.reduced) await plan.post(ctx);
    // Whatever happened above, every piece ends exactly where React put it.
    for (const m of moves) utils.set(m.motion, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });
  }
}
