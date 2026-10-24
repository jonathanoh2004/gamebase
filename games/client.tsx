'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { GameSession } from '@/lib/client/session';
import type { MatchPlayer } from '@/lib/server/rooms';
import { CamelUpCover } from './camel-up/ui/cover';
import { CamelUpOptions } from './camel-up/ui/options';
import { GuessRollCover } from './guess-roll/ui/cover';

// Browser-side game modules. Boards are code-split per game, so the library
// never downloads every game's UI.

export interface BoardProps {
  session: GameSession;
  /** Seat-indexed names, colors and avatars. */
  players: MatchPlayer[];
  mode: 'live' | 'sandbox';
}

export interface OptionsProps {
  options: Record<string, unknown>;
  editable: boolean;
  onChange: (options: Record<string, unknown>) => void;
}

const Loading = () => (
  <div className="flex aspect-[1200/760] w-full items-center justify-center border border-rule">
    <span className="label animate-pulse">Setting up the table…</span>
  </div>
);

export const BOARDS: Record<string, ComponentType<BoardProps>> = {
  'camel-up': dynamic(() => import('./camel-up/ui/board').then((m) => m.CamelUpBoard), {
    ssr: false,
    loading: Loading,
  }),
  'guess-roll': dynamic(() => import('./guess-roll/ui/board').then((m) => m.GuessRollBoard), {
    ssr: false,
    loading: Loading,
  }),
};

export const COVERS: Record<string, ComponentType<{ active: boolean }>> = {
  'camel-up': CamelUpCover,
  'guess-roll': GuessRollCover,
};

export const OPTIONS: Record<string, ComponentType<OptionsProps>> = {
  'camel-up': CamelUpOptions,
};
