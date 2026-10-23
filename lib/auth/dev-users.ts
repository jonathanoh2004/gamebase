import { createHash } from 'node:crypto';
import type { PlayerColor, Role } from '@/lib/db/schema';

// LOCAL BACKEND ONLY: the cast of the dev sign-in page and the tests.

export interface DevUser {
  key: string;
  name: string;
  role: Role;
  color: PlayerColor;
}

export const DEV_USERS: DevUser[] = [
  { key: 'ada', name: 'Ada', role: 'owner', color: 'yellow' },
  { key: 'ben', name: 'Ben', role: 'member', color: 'blue' },
  { key: 'cy', name: 'Cy', role: 'member', color: 'green' },
  { key: 'dee', name: 'Dee', role: 'member', color: 'red' },
  { key: 'eli', name: 'Eli', role: 'member', color: 'violet' },
  { key: 'fay', name: 'Fay', role: 'member', color: 'orange' },
  { key: 'gus', name: 'Gus', role: 'member', color: 'teal' },
  { key: 'hal', name: 'Hal', role: 'member', color: 'pink' },
  // Signed in but never invited: exercises the invite flow.
  { key: 'nia', name: '', role: 'pending', color: 'yellow' },
];

export const DEV_USER_KEY = /^[a-z]{2,16}$/;

/** Stable UUID per dev user, so sessions survive restarts of the local database. */
export function devUserId(key: string): string {
  const h = createHash('sha256').update(`gamebase-dev-user:${key}`).digest('hex');
  const variant = ((Number.parseInt(h[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
