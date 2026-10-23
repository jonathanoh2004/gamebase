import type { PlayerColor } from '@/lib/db/schema';

// Library metadata. Safe for both server and browser: no engine or UI code.

export interface GameManifest {
  id: string;
  name: string;
  tagline: string;
  blurb: string;
  players: { min: number; max: number; label: string };
  minutes: number;
  tags: string[];
  accent: PlayerColor;
  /** Only shown in dev sandboxes (local backend / previews). */
  devOnly?: boolean;
}

export const MANIFESTS: GameManifest[] = [
  {
    id: 'camel-up',
    name: 'Camel Up',
    tagline: 'Bet on a stampede.',
    blurb:
      'Five camels race around a pyramid, carrying each other on their backs while two crazy ones run the wrong way. Back the leader each leg, place your spectator tile, and call the overall winner and loser before anyone else does.',
    players: { min: 2, max: 8, label: '3–8 players' },
    minutes: 30,
    tags: ['dice', 'betting', 'racing'],
    accent: 'yellow',
  },
  {
    id: 'guess-roll',
    name: 'Guess the Roll',
    tagline: 'Runtime test game.',
    blurb:
      'Everyone secretly calls high or low, then the die decides. Exists to test the platform.',
    players: { min: 1, max: 6, label: '1–6 players' },
    minutes: 3,
    tags: ['test'],
    accent: 'teal',
    devOnly: true,
  },
];

export const manifestFor = (id: string) => MANIFESTS.find((m) => m.id === id) ?? null;
