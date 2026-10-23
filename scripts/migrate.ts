import { migrate } from './lib/migrate';

// Applies db/migrations to a real database (Supabase). Needs the OWNER
// connection string (the `postgres` role), never the app role:
//
//   MIGRATION_DATABASE_URL=postgres://postgres.<ref>:<password>@<host>:5432/postgres pnpm db:migrate

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error('Set MIGRATION_DATABASE_URL to the owner connection string (see docs/SETUP.md).');
  process.exit(1);
}

const applied = await migrate(url, { log: (line) => console.log(line) });
console.log(applied.length ? `done: ${applied.length} migration(s)` : 'already up to date');
