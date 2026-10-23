import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

// One pool per server instance. `prepare: false` is required by Supabase's
// transaction-mode pooler. Every query goes through Drizzle or postgres.js
// tagged templates, so values are always sent as bound parameters.

function create() {
  const sql = postgres(env().DATABASE_URL, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return { sql, db: drizzle(sql, { schema }) };
}

type Handle = ReturnType<typeof create>;
const holder = globalThis as unknown as { __gamebaseDb?: Handle };

function handle(): Handle {
  holder.__gamebaseDb ??= create();
  return holder.__gamebaseDb;
}

export const db = () => handle().db;
export const sql = () => handle().sql;
export type Db = Handle['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Closes the pool (tests and scripts). */
export async function closeDb() {
  const h = holder.__gamebaseDb;
  holder.__gamebaseDb = undefined;
  await h?.sql.end();
}
