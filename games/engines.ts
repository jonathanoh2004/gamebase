import type { AnyEngine } from '@/lib/engine/types';
import { camelUp } from './camel-up/engine';
import { guessRoll } from './guess-roll/engine';

// Every playable engine, by game id. Pure code: imported by the server runtime
// and by the dev sandbox in the browser.

const ENGINES: Record<string, AnyEngine> = {
  [camelUp.id]: camelUp,
  [guessRoll.id]: guessRoll,
};

export function engineFor(id: string): AnyEngine | null {
  return ENGINES[id] ?? null;
}
