import postgres from 'postgres';

// Makes an existing account the owner (the one person who manages members
// and invites). Sign in on the site once first: that creates your profile.
// Then, with the OWNER connection string (it reads auth.users, which the app
// role can't):
//
//   MIGRATION_DATABASE_URL=postgres://postgres.<ref>:<password>@<host>:5432/postgres \
//     pnpm make-owner you@example.com

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.MIGRATION_DATABASE_URL;
if (!url || !email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error('usage: MIGRATION_DATABASE_URL=… pnpm make-owner you@example.com');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
try {
  const users = await sql<{ id: string }[]>`
    select id from auth.users where lower(email) = ${email}
  `;
  const user = users[0];
  if (!user || users.length !== 1) {
    console.error('No account uses that email yet. Sign in on the site once, then run this again.');
    process.exitCode = 1;
  } else {
    const updated = await sql`
      update app.profiles set role = 'owner', updated_at = now()
      where id = ${user.id}
      returning id
    `;
    if (updated.length === 0) {
      console.error('That account has no profile yet. Open the site while signed in, then retry.');
      process.exitCode = 1;
    } else {
      console.log('Done: that account is now the owner.');
    }
  }
} finally {
  await sql.end();
}
