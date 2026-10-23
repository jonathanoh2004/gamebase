import type { AnyEngine, Frame, Viewer } from '@/lib/engine/types';

/**
 * Replays events from `start` and returns one frame per event: the event as
 * this viewer may see it, plus the view right after it. Pure; the server uses
 * it for sync, the dev sandbox for local play.
 */
export function buildFrames(
  engine: AnyEngine,
  start: unknown,
  batches: { version: number; events: unknown[] }[],
  viewer: Viewer,
): Frame[] {
  const frames: Frame[] = [];
  let state = start;
  for (const { version, events } of batches) {
    if (events.length === 0) {
      frames.push({ version, index: 0, event: null, view: engine.viewFor(state, viewer) });
      continue;
    }
    events.forEach((event, index) => {
      state = engine.evolve(state, event);
      frames.push({
        version,
        index,
        event: engine.redactEvent(event, viewer, state),
        view: engine.viewFor(state, viewer),
      });
    });
  }
  return frames;
}
