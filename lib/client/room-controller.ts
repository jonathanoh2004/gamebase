'use client';

import { createStore } from 'zustand/vanilla';
import type { Outcome } from '@/lib/engine/types';
import type { ClientConfig } from '@/lib/env';
import { type ChannelStatus, openRoomChannel, type RoomChannel } from '@/lib/realtime/client';
import type { FxMessage, PresenceEntry } from '@/lib/realtime/messages';
import type { ActionResult, SyncResult } from '@/lib/runtime/match-service';
import type { LobbyCommand, RoomView } from '@/lib/server/rooms';
import { ApiError, api } from './api';
import type { FrameListener, GameSession } from './session';
import { throttled } from './throttle';

export interface RoomState {
  room: RoomView;
  channel: ChannelStatus;
  presence: PresenceEntry[];
  /** Latest match version delivered to the board. */
  version: number | null;
  seat: number | null;
  outcome: Outcome | null;
}

const SAFETY_POLL_MS = 30_000;
const DOWN_POLL_MS = 8_000;
/**
 * Any member in the channel can broadcast, so a doorbell is only a hint.
 * Doorbell-driven fetches run at most this often: real moves still arrive at
 * once, and a flood of fake doorbells can't burn through the rate limits.
 */
const DOORBELL_GAP_MS = 500;

/**
 * Keeps one room in sync (docs/DESIGN.md §4.2): realtime doorbells trigger
 * fetches of the truth over HTTPS, with polling whenever the socket is down
 * and on tab focus. Frames go to the attached board in order.
 */
export class RoomController implements GameSession {
  readonly store;
  private board: FrameListener | null = null;
  private channel: RoomChannel | null = null;
  private fxListeners = new Set<(m: FxMessage) => void>();
  private syncing: Promise<void> | null = null;
  private resyncQueued = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private lobbyBell = throttled(() => {
    if (!this.stopped) void this.refreshRoom();
  }, DOORBELL_GAP_MS);
  private matchBell = throttled(() => {
    if (!this.stopped) void this.sync();
  }, DOORBELL_GAP_MS);

  constructor(
    private readonly config: ClientConfig,
    initial: RoomView,
    private readonly me: { name: string },
  ) {
    this.store = createStore<RoomState>(() => ({
      room: initial,
      channel: 'connecting',
      presence: [],
      version: null,
      seat: initial.you.matchSeat,
      outcome: initial.match?.outcome ?? null,
    }));
  }

  get roomId() {
    return this.store.getState().room.id;
  }

  /** Idempotent (React may mount, unmount and remount in development). */
  start() {
    this.stopped = false;
    if (this.channel) return;
    const room = this.store.getState().room;
    this.channel = openRoomChannel(
      this.config,
      room.id,
      { seat: room.you.matchSeat ?? room.you.seat, name: this.me.name },
      {
        onLobby: () => this.lobbyBell.call(),
        onMatch: (v) => {
          const known = this.store.getState().version;
          if (known === null || v > known) this.matchBell.call();
        },
        onPresence: (presence) => this.store.setState({ presence }),
        onFx: (msg) => {
          for (const cb of this.fxListeners) cb(msg);
        },
        onStatus: (channel) => {
          this.store.setState({ channel });
          if (channel === 'live') void this.catchUp();
        },
      },
    );
    document.addEventListener('visibilitychange', this.onVisible);
    this.schedulePoll();
  }

  stop() {
    this.stopped = true;
    this.channel?.close();
    this.channel = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.lobbyBell.cancel();
    this.matchBell.cancel();
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible') void this.catchUp();
  };

  private schedulePoll() {
    if (this.stopped) return;
    const down = this.store.getState().channel !== 'live';
    this.pollTimer = setTimeout(
      async () => {
        await this.catchUp().catch(() => {});
        this.schedulePoll();
      },
      down ? DOWN_POLL_MS : SAFETY_POLL_MS,
    );
  }

  private async catchUp() {
    await this.refreshRoom();
    await this.sync();
  }

  async refreshRoom() {
    try {
      const room = await api<RoomView>(`/api/rooms/${this.roomId}`);
      const prev = this.store.getState().room;
      this.store.setState({ room, seat: room.you.matchSeat, outcome: room.match?.outcome ?? null });
      // A new match started (or a rematch): the board needs a fresh snapshot.
      if (room.match && room.match.id !== prev.match?.id) {
        this.store.setState({ version: null });
        void this.sync();
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        this.store.setState((s) => ({ room: { ...s.room, status: 'abandoned' } }));
      }
    }
  }

  /** Fetches whatever this viewer hasn't seen yet. Coalesces concurrent calls. */
  sync(): Promise<void> {
    if (this.syncing) {
      this.resyncQueued = true;
      return this.syncing;
    }
    this.syncing = (async () => {
      do {
        this.resyncQueued = false;
        const { room, version } = this.store.getState();
        if (!room.match || !this.board) return;
        const query = version === null ? '' : `?after=${version}`;
        try {
          const res = await api<SyncResult>(`/api/rooms/${room.id}/sync${query}`);
          this.deliver(res);
        } catch {
          // The next doorbell, poll or focus retries.
        }
      } while (this.resyncQueued);
    })().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private deliver(res: SyncResult | (ActionResult & { snapshot?: null; seat?: number | null })) {
    const board = this.board;
    if ('snapshot' in res && res.snapshot != null) {
      board?.({
        kind: 'snapshot',
        version: res.version,
        view: res.snapshot,
        seat: res.seat ?? null,
      });
    } else if (res.frames.length) {
      board?.({ kind: 'frames', frames: res.frames });
    }
    this.store.setState((s) => ({
      version: Math.max(s.version ?? -1, res.version),
      outcome: res.outcome ?? s.outcome,
      seat: 'seat' in res && res.seat !== undefined ? res.seat : s.seat,
    }));
  }

  attachBoard(listener: FrameListener) {
    this.board = listener;
    // The board starts from a fresh snapshot of this viewer's view.
    this.store.setState({ version: null });
    void this.sync();
    return () => {
      if (this.board === listener) this.board = null;
    };
  }

  async act(action: { type: string; [key: string]: unknown }) {
    const { room, version } = this.store.getState();
    if (version === null) throw new ApiError(409, 'stale', 'Catching up…', {});
    try {
      const res = await api<ActionResult>(`/api/rooms/${room.id}/actions`, {
        body: { expectedVersion: version, action },
      });
      this.deliver(res);
      if (res.outcome) void this.refreshRoom();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'stale') void this.sync();
      throw error;
    }
  }

  async lobby(command: LobbyCommand) {
    const res = await api<RoomView | { closed: true } | { left: true }>(
      `/api/rooms/${this.roomId}/lobby`,
      { body: { command } },
    );
    if ('id' in res) this.store.setState({ room: res });
    return res;
  }

  sendFx(msg: FxMessage) {
    this.channel?.sendFx(msg);
  }

  onFx(cb: (msg: FxMessage) => void) {
    this.fxListeners.add(cb);
    return () => this.fxListeners.delete(cb);
  }
}
