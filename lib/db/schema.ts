import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Mirrors db/migrations/*.sql, which are the source of truth. Integration
// tests run every query against the real migrated schema.

export const app = pgSchema('app');

export const PLAYER_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const ROLES = ['pending', 'member', 'owner', 'revoked'] as const;
export type Role = (typeof ROLES)[number];

export const ROOM_STATUSES = ['lobby', 'playing', 'finished', 'abandoned'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const profiles = app.table('profiles', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull().default(''),
  avatarSeed: text('avatar_seed').notNull(),
  color: text('color').$type<PlayerColor>().notNull().default('yellow'),
  role: text('role').$type<Role>().notNull().default('pending'),
  invitedBy: uuid('invited_by'),
  ...timestamps,
});

export const rooms = app.table('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  gameId: text('game_id').notNull(),
  hostId: uuid('host_id'),
  status: text('status').$type<RoomStatus>().notNull().default('lobby'),
  locked: boolean('locked').notNull().default(false),
  allowSpectators: boolean('allow_spectators').notNull().default(true),
  options: jsonb('options').$type<Record<string, unknown>>().notNull().default({}),
  lobbyVersion: integer('lobby_version').notNull().default(0),
  currentMatchId: uuid('current_match_id'),
  ...timestamps,
});

export const roomSeats = app.table(
  'room_seats',
  {
    roomId: uuid('room_id').notNull(),
    seat: integer('seat').notNull(),
    userId: uuid('user_id').notNull(),
    color: text('color').$type<PlayerColor>().notNull(),
    ready: boolean('ready').notNull().default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.seat] })],
);

export const invites = app.table('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull(),
  createdBy: uuid('created_by').notNull(),
  roomId: uuid('room_id'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedBy: uuid('used_by'),
  usedAt: timestamp('used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface MatchSeat {
  seat: number;
  userId: string | null;
  name: string;
  color: PlayerColor;
  avatarSeed: string;
}

export const matches = app.table('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull(),
  gameId: text('game_id').notNull(),
  engineVersion: integer('engine_version').notNull(),
  seed: text('seed').notNull(),
  seats: jsonb('seats').$type<MatchSeat[]>().notNull(),
  state: jsonb('state').$type<unknown>().notNull(),
  version: integer('version').notNull().default(0),
  outcome: jsonb('outcome').$type<unknown>(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const matchActions = app.table(
  'match_actions',
  {
    matchId: uuid('match_id').notNull(),
    version: integer('version').notNull(),
    seat: integer('seat'),
    action: jsonb('action').$type<unknown>().notNull(),
    events: jsonb('events').$type<unknown[]>().notNull(),
    stateAfter: jsonb('state_after').$type<unknown>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.version] })],
);

export const rateLimits = app.table(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
