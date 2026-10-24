@AGENTS.md

# Gamebase

A friends-only hub for live, animated ports of physical board games. Next.js 16 on Vercel, Supabase for accounts, Postgres and Realtime, anime.js for motion. Read [docs/DESIGN.md](docs/DESIGN.md) for the architecture and [docs/PORTING.md](docs/PORTING.md) before porting a game. The `port-game` skill walks through a port step by step.

## Commands

- `pnpm dev:local`: the whole app on :3000 with no cloud accounts. It runs embedded Postgres in `.data/`, a dev sign-in page and SSE realtime.
- `pnpm check`: lint (Biome), typecheck, plus unit and database tests. Run it before every commit.
- `pnpm build && pnpm test:e2e`: Playwright against a fresh local stack on :3100. In a sandbox with a preinstalled Chromium, set `PLAYWRIGHT_CHROMIUM_PATH`.
- `/dev/<game>`: the sandbox. It shows every seat on one screen, with test bots and the full state.

## Layout

- `lib/engine`: the engine contract (`GameEngine`), seeded RNG, simulation harness.
- `lib/runtime`: server-authoritative matches (`applyAction`, `syncMatch`) and per-viewer frames.
- `lib/server`, `app/api`: rooms, lobby, invites and members. Every route goes through `lib/http/route.ts`.
- `lib/motion`: the director (event → animation) and the Stage/Piece primitives.
- `games/<id>/`: `rules.md` (normalized rules), `engine/` (pure TS), `ui/` (board, layout, choreography), `tests/`.
- `db/migrations`: hand-written SQL, applied by `pnpm db:migrate` (Supabase) or automatically by the local stack.

## Rules that matter

- Engines are pure and deterministic. No `Date`, no `Math.random`, no I/O, no UI imports (Biome enforces this). Randomness comes from the `rng` passed to `decide`.
- Hidden information lives only in engine state. `viewFor` and `redactEvent` decide what each seat sees. Never put secrets in props, data attributes or logs.
- Server is the authority: the client proposes actions; the server validates them with the game's strict Zod schema and the engine.
- SQL only through Drizzle or postgres.js tagged templates. `sql.raw` and `.unsafe()` are banned.
- Every API route declares its auth level, body schema (strict) and rate limit through `route()`.
- Rulebooks and photos go in `games/<id>/source/`, which is gitignored while the repository is public.
- Animation: React owns where a piece rests (`layout.ts`); anime.js owns how it gets there (`choreography.ts`). Respect reduced motion.
