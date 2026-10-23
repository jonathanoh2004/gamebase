import { readdir } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const root = path.resolve(import.meta.dirname, '../..');
const migrationsDir = path.join(root, 'db/migrations');
const shimFile = path.join(root, 'db/shim/supabase-local.sql');

export interface MigrateOptions {
  /** Apply the local Supabase stand-in first. Never set this against Supabase. */
  localShim?: boolean;
  log?: (line: string) => void;
}

/**
 * Applies db/migrations/*.sql in name order, each in its own transaction, and
 * records them in app.schema_migrations. Must run as the database owner
 * (`postgres`), never as the app's runtime role.
 */
export async function migrate(
  databaseUrl: string,
  options: MigrateOptions = {},
): Promise<string[]> {
  const log = options.log ?? (() => {});
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const applied: string[] = [];
  try {
    if (options.localShim) {
      await sql.file(shimFile).simple();
      log('applied local Supabase shim');
    }
    await sql`create schema if not exists app`;
    await sql`
      create table if not exists app.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `;
    const done = new Set(
      (await sql<{ name: string }[]>`select name from app.schema_migrations`).map((r) => r.name),
    );
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      await sql.begin(async (tx) => {
        await tx.file(path.join(migrationsDir, file)).simple();
        await tx`insert into app.schema_migrations (name) values (${file})`;
      });
      applied.push(file);
      log(`applied ${file}`);
    }
    return applied;
  } finally {
    await sql.end();
  }
}
