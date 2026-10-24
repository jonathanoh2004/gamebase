# Gamebase

A web hub for playing digital ports of physical board games with friends: share a link, join a room, and play live, with every move animated. Friends only and unlisted: you join by invite.

**Games:** Camel Up (2nd edition, 2–8 players).

## Run it locally

You need Node 22.18+ and pnpm 10. No cloud accounts are needed.

```sh
pnpm install
pnpm dev:local        # http://localhost:3000. Pick a test user on the sign-in page.
```

`dev:local` starts an embedded Postgres in `.data/` and applies the migrations. It also turns on a dev-only sign-in with a fixed cast of users (Ada is the owner). Open a second browser as another user to play against yourself. The dev sandbox at `/dev/camel-up` puts every seat on one screen and has test bots.

## Checks

```sh
pnpm check            # Biome, TypeScript, unit + database tests
pnpm build && pnpm test:e2e   # Playwright: live rooms, phones, authorization
```

## Deploy

Vercel and Supabase on free tiers. See [docs/SETUP.md](docs/SETUP.md).

## Docs

- [docs/DESIGN.md](docs/DESIGN.md): the platform design (stack, architecture, security, motion).
- [docs/PORTING.md](docs/PORTING.md): how a board game gets ported, with Camel Up as the worked example.
- [docs/SETUP.md](docs/SETUP.md): Supabase, auth providers and Vercel, step by step.
