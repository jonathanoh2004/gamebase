import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { startLocalDatabase } from './lib/embedded-pg';

// LOCAL DEVELOPMENT AND TESTS ONLY.
//
//   pnpm dev:local    Postgres + `next dev` on :3000, dev sign-in, SSE realtime
//   pnpm db:local     just the Postgres, until Ctrl+C
//   tsx scripts/local.ts serve   fresh Postgres + `next start` (for Playwright)

const root = path.resolve(import.meta.dirname, '..');
const mode = process.argv[2] ?? 'dev';
const dataRoot = path.join(root, '.data');

function devSecret(): string {
  const file = path.join(dataRoot, 'dev-auth-secret');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

async function main() {
  await mkdir(dataRoot, { recursive: true });
  const serve = mode === 'serve';
  const port = Number(process.env.LOCAL_PG_PORT ?? (serve ? 54330 : 54329));
  const db = await startLocalDatabase({
    dataDir: path.join(dataRoot, serve ? 'e2e-pg' : 'pg'),
    port,
    persistent: !serve,
    log: (line) => console.log(`[db] ${line}`),
  });
  console.log(`[db] postgres ready on :${port}`);

  const stop = async () => {
    await db.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  if (mode === 'db') {
    console.log(`[db] DATABASE_URL=${db.appUrl}`);
    return;
  }

  const appPort = process.env.PORT ?? (serve ? '3100' : '3000');
  const childEnv = {
    ...process.env,
    GAMEBASE_BACKEND: 'local',
    DATABASE_URL: db.appUrl,
    DEV_AUTH_SECRET: serve ? randomBytes(32).toString('hex') : devSecret(),
    CRON_SECRET: randomBytes(32).toString('hex'),
    NEXT_PUBLIC_SITE_URL: `http://localhost:${appPort}`,
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const args = serve ? ['start', '-p', appPort] : ['dev', '-p', appPort];
  const child = spawn(path.join(root, 'node_modules/.bin/next'), args, {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
  });
  child.on('exit', async (code) => {
    await db.stop().catch(() => {});
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
