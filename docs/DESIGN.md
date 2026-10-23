# Gamebase: design spec

**Status:** draft v0.1, for your review. Nothing is built yet. Once you sign off (or mark changes), this becomes the build brief: I build the base site (M0–M3), then we port Camel Up together (M4).

**Companion doc:** [PORTING.md](PORTING.md), the playbook I follow when you hand me a game.

---

## 0. The short version

- **What it is:** a web hub of board games ported from their physical versions. Friends play live in shared rooms from any device.
- **How a game gets in:** you send me the rulebook (PDF or Markdown) and photos of the board and pieces, and I port it as code by following PORTING.md. The site itself has no importer.
- **Stack:** Next.js 16, React 19 and TypeScript on Vercel. Supabase for auth, Postgres and realtime. anime.js 4.5 for all motion. CSS 3D by default, and Three.js only where a game earns it.
- **Multiplayer:** the server has the final say. Each game's rules are a pure TypeScript engine. A Vercel function checks every move, Postgres stores the game state, and Supabase Realtime tells clients to sync. Hidden information never leaves the server.
- **Motion:** engines emit events ("die rolled 2", "stack moved 3→5"), and each game's UI turns them into anime.js choreography. Nothing on the board teleports.
- **Look:** dark, graphic and technical, in the spirit of animejs.com. Neutral chrome, saturated piece colors, mono labels, a visible grid, and motion as the personality. No UI kit, no decorative gradients, no glass.
- **Cost:** $0 on Vercel Hobby and Supabase Free at friends-and-family scale (§11).

---

## 1. Goals and non-goals

**Goals**

1. **Two taps to play.** You share a link; a friend opens it, picks a name and is seated as a guest. Accounts are optional.
2. **Feels made for the screen.** Bookkeeping is automatic, the game always shows whose turn it is and what they can do, and every move is animated so you can follow it.
3. **Repeatable ports.** Every game uses the same contract, folder layout, test harness and checklist, so each new game is mostly rules and art.
4. **Phones and laptops in the same game.**
5. **Free to run.**

**Not in v1**

- An in-app importer or game editor. Porting is a developer workflow, and I do it.
- Public matchmaking, rankings, or text and voice chat. Rooms are invite-by-link, and voice happens on Discord.
- Real-time action games. The runtime targets turn-based games and simultaneous secret picks.
- Native apps. An installable web app (PWA) is the most we'd do.

---

## 2. Look and feel

### 2.1 Direction

Here is what "anime.js-inspired" means as concrete rules:

- **Canvas:** a matte, near-black background with warm off-white type. Menus and panels stay neutral, so color comes from the pieces. Player colors come from the same palette.
- **Geometry as a motif:** squares, circles and triangles, 1px rules, a visible 8px grid, index numerals (01, 02…) and mono labels (`ROOM K7QX · 4/6 SEATED`).
- **Motion is the content:** staggers, springs, path-following and layout morphs carry the personality. Screens at rest stay calm and sparse.
- **Editorial layout:** left-aligned, big type and real negative space. The game library *is* the homepage.

animejs.com is blocked from my build environment, so this section comes from memory. M1 ends with a look-and-feel review on a live preview, so we can change course before any game UI exists.

### 2.2 What "not AI-looking" means here

| Avoid | Instead |
|---|---|
| Stock UI kits (the shadcn/MUI look), `rounded-2xl` cards with soft shadows | Our own small set of components: hard edges or one small radius, 1px rules, flat fills |
| Purple-to-blue gradients, glassmorphism, glows | Flat color blocks from the piece palette, and texture (grain, paper, felt) only where a game calls for it |
| Inter, emoji, one generic icon set everywhere | A grotesk and mono font pairing, plus custom SVG glyphs for game concepts |
| A centered hero with a gradient headline over three feature cards | A grid-aligned library of animated game covers |
| Decorative motion (everything fades up on scroll) | Motion that explains: cause, then effect, and where a thing came from and went |

### 2.3 Tokens (starting values, tuned at the M1 review)

- **Neutrals:** background `#0E0E10` · raised `#17171A` · rule `#2A2A2F` · text `#F2EFE8` · muted `#8E8B85`.
- **Piece palette:** 8 saturated hues (red, orange, yellow, lime, teal, sky, violet, pink), checked for color-blind separation. Each hue is paired with a glyph (● ▲ ■ ◆ …), so no game relies on color alone.
- **Type:** Schibsted Grotesk for UI and display, and Martian Mono for labels and numbers. Both are free on Google Fonts and self-hosted through `next/font`.
- **Motion:**
  - UI feedback: 120–180 ms.
  - UI transitions: 300–400 ms on `out(3)`.
  - Piece travel: 450–900 ms on springs.
  - Staggers: 30–60 ms.
  - Landings: `outBack` or squash-and-stretch.

### 2.4 Motion rules

1. **Nothing teleports.** Every visible change has a transition, even if it lasts 150 ms.
2. **Cause before effect.** The die lands, then the camel moves, then the coin flies to its owner.
3. **Pieces have weight; menus and panels are quick.** Board pieces anticipate, overshoot and settle, but menus and panels never make you wait.
4. **Never trap input.** Any sequence can be skipped with a tap, or played at up to 3× speed when you're behind. The board stays readable mid-animation.
5. **Ambient life, used sparingly.** Pieces bob slightly when idle, the board shifts subtly with the pointer, and other players' hovers show up live.
6. **Respect `prefers-reduced-motion`.** Travel becomes a short crossfade, with no shake, parallax or spin. Players get the same information with less movement.

### 2.5 3D policy

- **Default stage, "2.5D tabletop":** the board is DOM/SVG under a CSS `perspective`, gently tilted, with contact shadows under the pieces. anime.js animates `rotateX` and `translateZ` directly, which is cheap and crisp on phones.
- **Real 3D where it earns its place:** Three.js through React Three Fiber, for one or two hero objects per game. Camel Up's dice pyramid is the obvious first one. anime.js 4.5 ships a Three.js adapter, so the same timelines drive DOM and 3D objects. 3D scenes load lazily, never block play, and fall back to 2D on low-power devices or with reduced motion.
- **Art style:** flat-shaded and matte, in the same palette, so 3D objects look like part of the same world.

---

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| App framework | Next.js 16 (App Router), React 19, TypeScript (strict) | Native to Vercel. Move checking runs in route handlers next to the UI, and both import the same engines. |
| Motion | anime.js 4.5 | Timelines, springs, staggers, SVG motion paths, draggables and FLIP layout animation (`createLayout`). `createScope` handles React cleanup, and the Three.js adapter lets one timeline drive DOM and 3D. |
| 3D (optional, per game) | three, React Three Fiber 9, drei | Loaded only on screens that use it. |
| Styling | Tailwind CSS 4 with our own `@theme` tokens | Quick to write, and every value comes from our design tokens. The generic AI look comes from component kits and their defaults, and we use neither. |
| Headless components | Base UI (unstyled) | Correct focus and keyboard handling for dialogs, popovers and menus, without imposing any visuals. |
| Client state | Zustand | Holds the room session, sync state and the animation queue. |
| Validation | Zod 4 | Checks every action payload at the API boundary. |
| Auth | Supabase Auth: anonymous guests, plus Discord, Google or email to keep a profile | Guests play immediately. Linking an account later keeps their history. |
| Database | Supabase Postgres, through Drizzle ORM and Supabase's connection pooler | Typed schema and migrations, plus real transactions with row locks for moves. |
| Realtime | Supabase Realtime: private Broadcast channels and Presence | New-move doorbells, lobby presence, live hovers and emotes. |
| Hosting | Vercel Hobby, with a preview deploy per branch | Every port gets a preview URL you can playtest before it ships. |
| Tests | Vitest for engines and simulations, Playwright for multi-browser games | Engines are pure, so most tests are fast and need no browser. |
| Tooling | pnpm, Biome, GitHub Actions | |

**Considered and rejected:**

- **boardgame.io and Colyseus:** both need a long-running game server, which Vercel doesn't host.
- **PartyKit and Liveblocks:** either would add a second realtime provider for something Supabase already covers.
- **One player's browser as host:** it leaks hidden information and invites cheating.

---

## 4. Architecture

### 4.1 The pieces

```
┌──────────────────────┐   HTTPS   ┌──────────────────────────┐   SQL    ┌────────────────┐
│ Browser              │ ────────▶ │ Vercel · Next.js         │ ───────▶ │ Supabase       │
│  hub, lobby, game UI │ ◀──────── │  pages (server-render)   │ ◀─────── │  Postgres      │
│  room store          │           │  /api/rooms/* handlers   │          │  Auth          │
│  director + anime.js │           │  game engines (pure TS)  │          │  Realtime      │
└──────────────────────┘           └──────────────────────────┘          └────────────────┘
            ▲                                                                     │
            └────────────── websocket: new-move doorbell, presence ───────────────┘
```

### 4.2 One move, end to end

1. A player picks a legal action. The client sends `POST /api/rooms/K7QX/actions` with `{ action, expectedVersion }`.
2. The route handler checks the Supabase session and the player's seat, then validates the payload against the game's action schema.
3. In one Postgres transaction, the handler:
   1. Locks the match row (`SELECT … FOR UPDATE`) and checks `expectedVersion`.
   2. Runs the engine: `decide`, then `evolve` for each resulting event.
   3. Appends a row to `match_actions`, writes the new state and bumps `version`.
4. A database trigger on `match_actions` calls `realtime.send()`, so the room's private channel gets a doorbell `{ version: 42 }` exactly when the move commits. A move that rolls back never rings. The doorbell carries no game data.
5. The acting player gets their **frames** in the POST response. A frame is an `{ event, view }` pair, redacted for that seat. Everyone else hears the doorbell and calls `GET /api/rooms/K7QX/sync?after=41`, and the server replays the new events from the previous saved state to build each viewer's frames.
6. Each client's **director** plays its frames in order (§6). When you click, your UI responds immediately (press states, a tile lifting), but the board only changes when the server's frames arrive.

Why this shape:

- **Hidden information is safe by construction.** Clients only ever receive `viewFor(state, seat)`. The full state and the random seed never leave the server.
- **Missed messages can't desync anyone.** Realtime is only a doorbell; the source of truth is "frames since version N." Reconnecting, refreshing and switching devices all take the same path. Clients poll every 15 seconds or so while the websocket is down.
- **Races are boring.** The row lock puts moves in order. A stale `expectedVersion` gets a 409; the client then syncs and shows what changed.
- **Replays come free.** The seed plus the action log replays any game deterministically. That drives the results screen, bug reports and tests.

### 4.3 Randomness

Every random draw comes from a seeded generator: `rng = PRNG(matchSeed, version)`. The seed is created with `crypto` when the match starts and is stored server-side only. Results are written into events (`dieRolled { value: 2 }`), so `evolve` never needs randomness. The same seed and the same actions always replay the same game, and clients can't predict rolls because they never see the seed.

### 4.4 Rooms and lifecycle

- **States:** `lobby → playing → finished`, or `abandoned`.
- **Lobby:** the host picks game options and seats. Players join by 4-letter code (from an alphabet without 0/O or 1/I lookalikes) or by link, pick a color, and ready up.
- **Spectators:** anyone with the link can watch, if the host allows it.
- **Disconnects:** a player who drops keeps their seat. After a timeout, the host can hand the seat to a bot or to someone else.
- **Rematch:** starts a new match in the same room with the same seats.
- **Pass-and-play:** one device can seat several players. It runs the same engine in the browser, and games with hidden information show a "pass to Mia" screen between turns.

---

## 5. The game module contract

Every game is one folder:

```
games/camel-up/
  rules.md          our normalized rules: numbered, testable, in our own words
  manifest.ts       name, player counts, length, options, cover, engine version
  engine/           PURE TypeScript: no React, DOM, network, Math.random or Date
    types.ts        State, Action, Event, View
    setup.ts        initial state from seats + options + rng
    rules.ts        decide() and evolve()
    views.ts        viewFor() and redactEvent()
    index.ts        exports the GameEngine
  ui/               React + anime.js
    Board.tsx       renders a view on the stage
    layout.ts       view → resting place of every piece (the single source of positions)
    choreography.ts event → animation
    pieces/         camels, dice, tiles, cards as SVG/React components
    3d/             optional, lazy-loaded R3F scenes
  assets/           our own art (never scans or traces of the original)
  source/           your PDF and photos: gitignored, never deployed
  tests/            rule tests (named by rule ID), simulations, golden replays
```

The engine interface (trimmed):

```ts
type Seat = number;                      // 0..n-1
type Viewer = Seat | "spectator";

interface GameEngine<State, Action, Event, View, Options = {}> {
  id: string;                            // "camel-up"
  version: number;                       // bump when State changes shape
  players: { min: number; max: number };
  actionSchema: ZodType<Action>;         // checked before decide()

  setup(ctx: { seats: Seat[]; options: Options; rng: Rng }): State;
  activeSeats(state: State): Seat[];     // who may act now (several = simultaneous)
  legalActions(state: State, seat: Seat): Action[];               // UI hints, bots, fuzzing
  decide(state: State, action: Action, ctx: { seat: Seat; rng: Rng }): Event[]; // or throws IllegalAction
  evolve(state: State, event: Event): State;                      // pure, no randomness
  viewFor(state: State, viewer: Viewer): View;                    // drop what this viewer can't see
  redactEvent(event: Event, viewer: Viewer): Event | null;
  outcome(state: State): Outcome | null;                          // final standings once over
}
```

The UI side:

```ts
interface GameUI<View, Action, Event> {
  Board: ComponentType<{ view: View; me: Viewer; act: (a: Action) => void }>;
  layout(view: View): Record<PieceId, Placement>;   // x, y, z, rotation, scale
  choreography: { [T in Event["type"]]?: Choreo<Extract<Event, { type: T }>> };
  Rules: ComponentType;                              // in-game rules reference
}

type Choreo<E> = (event: E, stage: Stage) => {
  pre?: Timeline;        // before the board changes: shake, roll, reveal
  travel?: TravelStyle;  // how moved pieces reach their new spot: hop, fly, slide, flip
  post?: Timeline;       // after landing: coin pop, score tick, toast
};
```

**Rules that keep engines honest:**

- **Plain JSON in, plain JSON out.** State, actions, events and views must serialize as plain JSON, so they're easy to store, diff and test.
- **Import boundary.** Biome blocks `engine/` from importing React, Next, Supabase or any UI code.
- **No hidden randomness.** The simulation harness runs engines with `Math.random` and `Date` rigged to throw. Any randomness or clock read outside the seeded `rng` fails tests.
- **Simultaneous turns.** When several seats choose at once, `activeSeats` returns all of them. The engine holds their hidden choices until everyone has picked.
- **Shared runtime.** The game-agnostic runtime handles seats, turn enforcement, versions, persistence, frames, timeouts and bots, so games never touch any of that.
- **Registry.** `games/index.ts` lists every manifest. Each game's UI is a dynamic import, so the homepage never ships every game's code.

---

## 6. Animation system

### 6.1 The ownership rule

React decides what exists and where it rests. anime.js only plays motion *into* those resting places.

Concretely, every board piece is an absolutely positioned child of a single stage element, placed by `layout(view)`. Pieces never change parent, so React keys stay stable and every move is just a transform. The stage uses a fixed coordinate space that scales to the screen, so layouts are written once for every screen size.

When a frame arrives, React renders the new view first. Moved pieces are then held at their old spot by an offset transform, applied before the browser paints, and anime.js plays that offset down to zero along the event's path (the FLIP technique). The page always shows the true state underneath, so a skipped, interrupted or broken animation can never leave the board wrong; at worst, a piece snaps.

UI outside the board (lobby seats, lists, panels) uses anime.js's `createLayout` for the same kind of FLIP morph. That's how lobby seat cards turn into in-game player panels.

### 6.2 The director

Each client runs one director. It plays frames from a queue:

```
for each frame { event, view }:
  1. pre      the event's lead-in; the board is unchanged (pyramid shakes, die tumbles to "2")
  2. commit   React renders `view`; moved pieces are held at their old spots
  3. travel   anime.js plays each piece home along its path (hop arcs, flights, flips)
  4. post     follow-through (coin pops, counters tick, a toast for big moments)
```

- **Catch-up:** frames queue while one plays. If the queue backs up (you looked away, or your phone slept), the director speeds up, and past a threshold it jumps straight to the latest view.
- **Control:** tapping skips to the end of the current frame. Playback speed (1×, 1.5× or 2×) is a per-user setting.
- **Reduced motion:** with `prefers-reduced-motion`, travel becomes 150 ms crossfades, and shakes and spins are dropped.
- **Cleanup:** everything runs inside `createScope`, so leaving the screen reverts cleanly and leaks nothing.

### 6.3 Shared motion kit (`lib/motion`)

Every game gets:

- `hop(path)`: arcs with squash and stretch.
- `flyTo(target)`: arcs with scale and spin.
- `flip(card)`, `countUp(n)`, `pop`, `shake` and `trail`.
- Stagger presets and the director itself.
- A dev-only frame inspector: scrub, slow motion and replay any frame.

Game-specific choreography builds on these, so a new game only writes its hero moments from scratch.

### 6.4 Presence motion

Over Realtime Broadcast (never stored), other players' hovers show up as faint outlines: "Mia is eyeing the blue tile". Quick emotes travel the same way. These messages are throttled and switched off under reduced motion.

Games mark private targets so their hovers are never broadcast. For example, in Camel Up, which camel you're about to back for the overall win must stay secret.

---

## 7. Data model (Postgres)

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (the auth user), `display_name`, `avatar_seed`, `color` | Guests get one too, and linking an account keeps it. |
| `rooms` | `id`, `code`, `game_id`, `host_id`, `status`, `options`, timestamps | `status` is `lobby`, `playing`, `finished` or `abandoned`. |
| `room_seats` | `room_id`, `seat`, `user_id` or bot, `color`, `ready` | |
| `matches` | `id`, `room_id`, `engine_version`, `seed`, `state`, `version`, `outcome`, timestamps | `seed` and `state` are server-only. |
| `match_actions` | `match_id`, `version`, `seat`, `action`, `events`, `state_after`, `created_at` | Append-only. Frames, replays and debugging all come from here. |

**Security:**

- Row-level security is on for every table.
- The browser reads only its own profile and public room info directly. Everything about a match goes through the API, which uses a server-side database role.
- Realtime channels are private. A policy on `realtime.messages` lets only seated players and allowed spectators join a room's channel.

---

## 8. Screens

| Route | What it is |
|---|---|
| `/` | **The library.** A large wordmark assembles from game-piece shapes (a die face, a camel, a tile) on a staggered spring. Below it sits a grid of game covers. Each cover is a tiny looping scene of that game's real pieces, playing on hover or focus (on phones, when it scrolls into view). Mono metadata under each: `3–8 PLAYERS · 30 MIN · DICE · BETTING`. A strip above the grid lists rooms you're in. |
| `/games/[slug]` | **Game page:** animated cover, a 60-second overview, players and length, plus **Create room** and **Play on one device**. |
| `/r/[code]` | **The room.** One route that morphs between lobby, game and results, so the lobby's seats become the in-game player panels. |
| `/me` | **Profile:** name, avatar, preferred colors, match history. |
| `/dev/[slug]` | **Dev sandbox** (preview deploys only): every seat on one screen, preset scenarios ("leg about to end"), the frame inspector and speed controls. Ports get built here, and you can playtest early here. |

**Game screen layout:**

- The board takes center stage, with player panels along the edge showing score, holdings and whose turn it is.
- The current player gets an action bar with legal options highlighted.
- A compact event log is always visible, and the rules reference is one tap away.
- When the tab is in the background, its title and favicon flag that it's your turn.
- On phones, the board sits on top, players become a horizontal strip, and actions live in a bottom sheet.

---

## 9. Repository layout

```
app/                Next.js routes: hub, room, profile, dev sandbox, api/
components/         design-system components (Button, Panel, Seat, Tag, Dialog…)
lib/
  engine/           game contract types, PRNG, test harness, bot, simulation runner
  runtime/          server match service: lock, apply, persist, build frames
  client/           room session store, sync, realtime, director
  motion/           anime.js kit: presets, director, stage, reduced motion
  supabase/         browser and server clients, auth helpers
games/              one folder per game (§5) + games/index.ts registry
db/                 Drizzle schema and SQL migrations (RLS, realtime policies, triggers)
docs/               this spec, PORTING.md
.claude/skills/     port-game skill: PORTING.md as a runnable checklist
CLAUDE.md           conventions for any Claude session working in this repo
```

This is one Next.js app rather than a monorepo, which is simpler for Vercel and for me. Lint rules enforce the engine/UI split instead of package boundaries. We can split into packages later if it ever matters.

---

## 10. Build plan

Each milestone ends with something you can click on a Vercel preview.

| # | Milestone | Done when |
|---|---|---|
| M0 | **Scaffold.** Next.js app, strict TypeScript, Biome, Vitest, Playwright, GitHub Actions CI, the Vercel project, Supabase projects (dev and prod), env vars, CLAUDE.md. | CI is green and every push gets a preview deploy. |
| M1 | **Look and motion.** Tokens, type, components, the motion kit, and the library and game pages filled with placeholder games. | **You sign off on the look and feel.** This is the "not AI-looking" checkpoint. |
| M2 | **Accounts and rooms.** Guest and OAuth sign-in, profiles, create or join by code or link, a live lobby with seats, colors, ready-up and host controls. | Two browsers meet in a lobby and see each other live. |
| M3 | **Game runtime.** Engine contract, PRNG, the match service with locking, action and sync endpoints, the realtime doorbell, the client store and director, the dev sandbox, pass-and-play, results and rematch, and a basic bot. All of it is proven end to end on a tiny test game (dice plus one hidden choice) that never appears in the library. | A scripted Playwright game with three browsers runs start to finish, surviving a mid-game refresh. |
| M4 | **Camel Up**, with you, following PORTING.md: rules checkpoint, engine and tests, art and choreography, playtest, polish. | You've played a full game with friends on the production URL. |
| M5 | **Hardening.** A mobile pass, accessibility, performance budgets, error and empty states, reconnect edge cases, optional turn timers, and the Supabase keep-alive. | Accessibility and performance checks pass, and a week of real use produces no stuck or desynced games. |

**Later:**

- Sound: dice rattle, hooves, coins.
- Smarter game-specific bots.
- Stats.
- Interactive tutorials.
- Undo of your last action, as long as it revealed nothing new.
- A light "paper" theme.
- An installable PWA.

---

## 11. Free-tier budget

These are approximate allowances from public pricing pages; confirm them at signup.

| Service | Free allowance | What we'd use |
|---|---|---|
| Vercel Hobby | About 1M function calls a month, 4 active-CPU hours and 100 GB transfer. Crons run at most daily. **Non-commercial use only.** | A 5-player Camel Up game is roughly 500 function calls. |
| Supabase Free | 2 projects, 500 MB of Postgres, 50K monthly active users and 5 GB of egress. Realtime allows about 200 concurrent connections and about 2M messages a month. | Game state is kilobytes, and a game sends around 1K realtime messages. |
| Supabase pausing | Free projects pause after **7 days without activity**. | A daily Vercel cron touches the database, and also cleans up abandoned rooms. |

If we ever get close to a limit (we won't with friends), the first upgrade is Supabase Pro.

---

## 12. Risks and decisions to know about

- **IP:**
  - Game mechanics are free to reuse, but artwork, rulebook text and names belong to the publishers.
  - All art is our own: inspired by the layout, never scanned or traced. `rules.md` is written in our own words.
  - Your PDFs and photos stay out of git, because this repo is **public**. If you'd rather keep rulebooks in the repo for reference, we can make it private.
  - The site stays unlisted (`noindex`) and invite-only, which also fits Vercel Hobby's non-commercial terms.
- **Deploys during a game:**
  - Engines carry a version number.
  - If a deploy changes a game's state shape in a breaking way, matches running on the old version say "this game was updated, start a rematch" instead of loading into the new engine.
  - Non-breaking fixes apply to running games.
- **anime.js vs React:** the ownership rule (§6.1) and `createScope` cleanup prevent conflicts. If something still goes wrong, the page already shows the true state, so the worst case is a missing animation, never a wrong board.
- **Phones and 3D:** 3D is lazy-loaded and optional, with a quality toggle. The 2.5D board is the baseline everywhere.
- **No timers on serverless:** Vercel functions can't run timers. Turn timeouts are therefore checked on the next request or by the daily cron, and they're off by default.

---

## 13. Questions for you

1. **Camel Up edition:** the 2nd edition (2018: crazy camels, 3–8 players) or the 2014 original? Any house rules?
2. **Audience:** just your friends (unlisted and invite-only, which is my default) or open to anyone?
3. **Sign-in:** my default is guests plus Discord, Google and email magic links. Want to drop any of them?
4. **Devices:** mostly laptops, mostly phones, or a mix? I'll support both; your answer decides which layout gets polished first.
5. **Pass-and-play and bots:** should players see these options, or keep them as dev tools for now?
6. **Repo visibility:** keep it public (rulebooks and photos stay out of git) or make it private?
