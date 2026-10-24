'use client';

import type { Frame } from '@/lib/engine/types';
import type { FxMessage } from '@/lib/realtime/messages';

/** What a game board consumes: an initial snapshot, then frames to animate. */
export type FrameMessage =
  | { kind: 'snapshot'; version: number; view: unknown; seat: number | null }
  /** `seat` is set when the viewer changes along with these frames (sandbox). */
  | { kind: 'frames'; frames: Frame[]; seat?: number | null };

export type FrameListener = (msg: FrameMessage) => void;

/**
 * The seam between a board and wherever the game runs: a live room on the
 * server (RoomController) or the in-browser dev sandbox (SandboxSession).
 */
export interface GameSession {
  attachBoard(listener: FrameListener): () => void;
  /** Sends a move for the viewer's seat (the sandbox may switch seats). */
  act(action: { type: string; [key: string]: unknown }): Promise<void>;
  sendFx(msg: FxMessage): void;
  onFx(cb: (msg: FxMessage) => void): () => void;
}
