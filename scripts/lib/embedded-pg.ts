import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { migrate } from './migrate';

// LOCAL DEVELOPMENT AND TESTS ONLY: a throwaway Postgres 17 with the local
// Supabase shim and all migrations applied. Production uses Supabase.

export const LOCAL_APP_PASSWORD = 'gamebase_app_local';
const SUPERUSER = 'postgres';
const SUPERUSER_PASSWORD = 'postgres';
const DATABASE = 'gamebase';

export interface LocalDatabase {
  /** Connection string for the app's least-privilege runtime role. */
  appUrl: string;
  /** Connection string for the owner role (migrations, test setup). */
  ownerUrl: string;
  port: number;
  stop: () => Promise<void>;
}

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('could not find a free port'));
      });
    });
  });
}

export async function startLocalDatabase(opts: {
  dataDir: string;
  port: number;
  persistent: boolean;
  log?: (line: string) => void;
}): Promise<LocalDatabase> {
  const log = opts.log ?? (() => {});
  const dataDir = path.resolve(opts.dataDir);
  const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));
  if (fresh && !opts.persistent) await rm(dataDir, { recursive: true, force: true });
  await mkdir(path.dirname(dataDir), { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: SUPERUSER,
    password: SUPERUSER_PASSWORD,
    port: opts.port,
    persistent: opts.persistent,
    // Postgres refuses to run as root (as in some containers); run it as the
    // system `postgres` user in that case.
    createPostgresUser: process.getuid?.() === 0,
    onLog: () => {},
    onError: (e) => log(`postgres: ${String(e)}`),
  });

  if (fresh) await pg.initialise();
  await pg.start();

  const base = `postgres://${SUPERUSER}:${SUPERUSER_PASSWORD}@127.0.0.1:${opts.port}`;
  const admin = postgres(`${base}/postgres`, { max: 1, onnotice: () => {} });
  try {
    const exists = await admin`select 1 from pg_database where datname = ${DATABASE}`;
    if (exists.length === 0) await admin`create database gamebase`;
  } finally {
    await admin.end();
  }

  const ownerUrl = `${base}/${DATABASE}`;
  await migrate(ownerUrl, { localShim: true, log });

  // The production role gets LOGIN by hand during setup; locally we do it here.
  // (ALTER ROLE can't take bound parameters, so the local-only password lives
  // in a fixed SQL file.)
  const owner = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    await owner.file(path.resolve(import.meta.dirname, 'local-grants.sql')).simple();
  } finally {
    await owner.end();
  }

  return {
    appUrl: `postgres://gamebase_app:${LOCAL_APP_PASSWORD}@127.0.0.1:${opts.port}/${DATABASE}`,
    ownerUrl,
    port: opts.port,
    stop: () => pg.stop(),
  };
}
