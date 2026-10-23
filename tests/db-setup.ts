import { randomBytes } from 'node:crypto';
import { afterAll, inject } from 'vitest';
import { closeDb } from '@/lib/db/client';

// Point the server code at the test database before any test imports it.
process.env.GAMEBASE_BACKEND = 'local';
process.env.DATABASE_URL = inject('appDatabaseUrl');
process.env.DEV_AUTH_SECRET ??= randomBytes(32).toString('hex');

afterAll(async () => {
  await closeDb();
});
