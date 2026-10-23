import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { freePort, startLocalDatabase } from '../scripts/lib/embedded-pg';

declare module 'vitest' {
  export interface ProvidedContext {
    appDatabaseUrl: string;
    ownerDatabaseUrl: string;
  }
}

// Starts one throwaway Postgres for the whole `db` test project.
export default async function setup(project: TestProject) {
  const port = await freePort();
  const dir = path.resolve(
    import.meta.dirname,
    `../.data/test-pg-${randomBytes(4).toString('hex')}`,
  );
  const db = await startLocalDatabase({ dataDir: dir, port, persistent: false });
  project.provide('appDatabaseUrl', db.appUrl);
  project.provide('ownerDatabaseUrl', db.ownerUrl);
  return async () => {
    await db.stop();
  };
}
