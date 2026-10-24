# Gamebase: design spec

**Status:** v1.0, built. The base site (M0–M3) and the Camel Up port (M4) exist and are tested on the local stack. §11 shows what's done and what's left, and §14 logs the decisions. Where this spec and the code disagree, the code wins: fix the spec.

**Companion doc:** [PORTING.md](PORTING.md), the playbook I follow when you hand me a game.

---

## 0. The short version

- **What it is:** a private, invite-only web hub of board games ported from their physical versions. Friends play live in shared rooms, mostly on laptops, with phones fully supported.
- **How a game gets in:** you send me the rulebook (PDF or Markdown) and photos of the board and pieces, and I port it as code by following PORTING.md. The site itself has no importer.
- **Stack:** Next.js 16, React 19 and TypeScript on Vercel. Supabase for auth, Postgres and realtime. anime.js 4.5 for all motion. CSS 3D by default, and Three.js only where a game earns it (none has yet).
- **Multiplayer:** the server has the final say. Each game's rules are a pure TypeScript engine. A Vercel function checks every move, Postgres stores the game state, and Supabase Realtime tells clients to sync. Hidden information never leaves the server.
- **Motion:** engines emit events ("die rolled 2", "stack moved 3→5"), and each game's UI turns them into anime.js choreography. Nothing on the board teleports.
- **Look:** dark, graphic and technical, in the spirit of animejs.com. Neutral chrome, saturated piece colors, mono labels, a visible grid, and motion as the personality. No UI kit, no decorative gradients, no glass.
- **Security:** invite-only membership, and sign-in with Discord, Google or email: no passwords and no guest accounts. The browser never talks to the database directly, and other players only ever see your display name, avatar and color (§8).
- **Cost:** $0 on Vercel Hobby and Supabase Free at friends-and-family scale (§12).

---

## 1. Goals and non-goals

**Goals**

1. **One link to play.** A friend opens your invite link, signs in with Discord, Google or email, and lands in your lobby.
2. **Feels made for the screen.** Bookkeeping is automatic, the game always shows whose turn it is and what they can do, and every move is animated so you can follow it.
3. **Repeatable ports.** Every game uses the same contract, folder layout, test harness and checklist, so each new game is mostly rules and art.
4. **Laptop-first, phone-friendly.** Layouts get polished for laptops first, and every game also works on a phone.
5. **Private by design.** Invite-only, and nobody can see more of another player than their display name, avatar and color.
6. **Free to run.**

**Not in v1**

- An in-app importer or game editor. Porting is a developer workflow, and I do it.
- Public matchmaking, rankings, or text and voice chat. Voice happens on Discord.
- Guest accounts. Everyone signs in, so every player is a real identity that can be revoked.
- Bots and pass-and-play for players. Both exist only in the dev sandbox, as testing tools.
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

- **Default stage:** the board is flat DOM/SVG on a fixed-size stage. Individual pieces that deserve depth are real CSS 3D objects, and anime.js animates their `rotateX`/`rotateY` directly, which is cheap and crisp on phones. In Camel Up those are the dice (cubes that tumble out of the pyramid) and the pyramid itself.
- **Real 3D where it earns its place:** Three.js through React Three Fiber, for one or two hero objects per game. Such scenes would load lazily, never block play, and fall back to 2D on low-power devices or with reduced motion. Camel Up turned out not to need any.
- **Art style:** flat-shaded and matte, in the same palette, so 3D objects look like part of the same world.

---

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| App framework | Next.js 16 (App Router), React 19, TypeScript (strict) | Native to Vercel. Move checking runs in route handlers next to the UI, and both import the same engines. |
| Motion | anime.js 4.5 | Timelines, springs, staggers, SVG motion paths, draggables and FLIP layout animation (`createLayout`). `createScope` handles React cleanup, and the Three.js adapter lets one timeline drive DOM and 3D. |
| 3D (optional, per game) | three and React Three Fiber, if a game ever needs them | Not installed: CSS 3D has covered everything so far. |
| Styling | Tailwind CSS 4 with our own `@theme` tokens | Quick to write, and every value comes from our design tokens. The generic AI look comes from component kits and their defaults, and we use neither. |
| Headless components | Base UI (unstyled) | Correct focus and keyboard handling for dialogs, popovers and menus, without imposing any visuals. |
| Client state | Zustand | Holds the room session, sync state and the animation queue. |
| Validation | Zod 4 | Checks every request at the API boundary. |
| Auth | Supabase Auth: Discord, Google and email magic links | No passwords to store or leak, and one click for most people. |
| Email delivery | Resend (free tier) as Supabase's mail sender | Supabase's built-in mailer is for testing and only sends to your own team. |
| Bot protection | Cloudflare Turnstile (free) | Stops scripted sign-ins and email spam. |
| Database | Supabase Postgres, through Drizzle ORM on postgres.js and Supabase's connection pooler (transaction mode) | Typed queries with bound parameters, and real transactions with row locks for moves. Migrations are hand-written SQL. |
| Realtime | Supabase Realtime: private Broadcast channels and Presence | New-move doorbells, lobby presence, live hovers and emotes. |
| Hosting | Vercel Hobby, with a preview deploy per branch | Every port gets a preview URL you can playtest before it ships. |
| Local stack | Embedded Postgres, a dev sign-in and SSE realtime (`GAMEBASE_BACKEND=local`) | The whole app runs and is tested with no cloud accounts. It refuses to start on a production deployment. |
| Tests | Vitest for engines, simulations and database code (on a throwaway embedded Postgres), Playwright for multi-browser games | Engines are pure, so most tests are fast and need no browser. |
| Tooling | pnpm, Biome, GitHub Actions, Dependabot | |

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

The browser never connects to Postgres. It talks to our API over HTTPS, and to Supabase only for sign-in and the realtime websocket.

### 4.2 One move, end to end

1. A player picks a legal action. The client sends `POST /api/rooms/:id/actions` with `{ action, expectedVersion }`.
2. The route handler verifies the Supabase session, checks that the user is a member seated in this room, and validates the payload against the game's action schema.
3. In one Postgres transaction, the handler:
   1. Locks the match row (`SELECT … FOR UPDATE`) and checks `expectedVersion`.
   2. Runs the engine: `decide`, then `evolve` for each resulting event.
   3. Appends a row to `match_actions`, writes the new state and bumps `version`.
4. A database trigger on `match_actions` calls `realtime.send()`, so the room's private channel gets a doorbell `{ version: 42 }` exactly when the move commits. A move that rolls back never rings. The doorbell carries no game data.
5. The acting player gets their **frames** in the POST response. A frame is `{ version, index, event, view }`, redacted for that seat. Everyone else hears the doorbell and calls `GET /api/rooms/:id/sync?after=41`, and the server replays the new events from the previous saved state to build each viewer's frames.
6. Each client's **director** plays its frames in order (§6). When you click, your UI responds immediately (press states, a tile lifting), but the board only changes when the server's frames arrive.

Why this shape:

- **Hidden information is safe by construction.** Clients only ever receive `viewFor(state, seat)`. The full state and the random seed never leave the server.
- **Missed messages can't desync anyone.** Realtime is only a doorbell; the source of truth is "frames since version N." Reconnecting, refreshing and switching devices all take the same path. Clients poll every 8 seconds while the websocket is down, and every 30 seconds as a safety net.
- **Races are boring.** The row lock puts moves in order. A stale `expectedVersion` gets a 409; the client then syncs and shows what changed.
- **Replays come free.** The seed plus the action log replays any game deterministically. That drives the results screen, bug reports and tests.

### 4.3 Randomness

Every random draw comes from a seeded generator: `rng = PRNG(matchSeed, version)`. The seed is created with `crypto` when the match starts and is stored server-side only. Results are written into events (`dieRolled { value: 2 }`), so `evolve` never needs randomness. The same seed and the same actions always replay the same game, and clients can't predict rolls because they never see the seed.

### 4.4 Rooms and lifecycle

- **States:** `lobby → playing → finished`, or `abandoned`.
- **Lobby:** the host picks game options and seats. Other members open the room's link, pick a color and ready up. To bring in someone new, the host sends a one-time invite that makes them a member and drops them into this lobby (§8.2).
- **Spectators:** members with the room link can watch, if the host allows it.
- **Disconnects:** a player who drops keeps their seat and picks up where they left off, from any device. The host can close the room to end a game. Handing a seat to someone else is on the later list.
- **Rematch:** starts a new match in the same room with the same seats.
- **Testing only, for now:** bots and pass-and-play (every seat on one screen) live in the dev sandbox (§9). Either can be opened up to players later.

---

## 5. The game module contract

Every game is one folder:

```
games/
  manifests.ts        library metadata for every game: name, player counts, length, tags
  engines.ts          id → engine, for the server and the sandbox
  client.tsx          id → board, cover and options UI, all dynamic imports
  camel-up/
    rules.md          our normalized rules: numbered, testable, in our own words
    howto.ts          the short overview on the game page
    engine/           PURE TypeScript: no React, DOM, network, Math.random or Date
      types.ts        State, Action, Event, View
      track.ts        board logic shared by rules and UI: stacks, rankings, tile rules
      index.ts        setup, decide, evolve, viewFor, redactEvent, outcome → the GameEngine
    ui/               React + anime.js
      board.tsx       renders a view on the stage, with the action bar and player panels
      geometry.ts     board coordinates: spaces, tents, piles, pyramid
      layout.ts       view → resting place of every piece (the single source of positions)
      choreography.ts event → animation
      art.tsx, camel.tsx, pieces.tsx, pyramid.tsx       our own SVG and CSS 3D art
      overlay.tsx, panels.tsx, action-bar.tsx, cover.tsx, options.tsx
    tests/            rule tests (named by rule ID), simulations, a golden replay
    source/           your rulebook and photos: reference only, never served by the site
```

The engine interface (trimmed):

```ts
type Seat = number;                      // 0..n-1
type Viewer = Seat | "spectator";

interface GameEngine<State, Action, Event, View, Options> {
  id: string;                            // "camel-up"
  version: number;                       // bump when State changes shape
  players: { min: number; max: number };
  actionSchema: ZodType<Action>;         // strict; checked before decide()
  optionsSchema: ZodType<Options>;       // room options, e.g. { hideMoney }

  setup(ctx: { seats: SeatInfo[]; options: Options; rng: Rng }): State;
  activeSeats(state: State): Seat[];     // who may act now (several = simultaneous)
  legalActions(state: State, seat: Seat): Action[];               // UI hints, bots, fuzzing
  decide(state: State, action: Action, ctx: { seat: Seat; rng: Rng }): Event[]; // or throws IllegalAction
  evolve(state: State, event: Event): State;                      // pure, no randomness
  viewFor(state: State, viewer: Viewer): View;                    // drop what this viewer can't see
  redactEvent(event: Event, viewer: Viewer, after: State): Event | null;
  outcome(state: State): Outcome | null;                          // final standings once over
}
```

The UI side:

```ts
// What a board receives (games/client.tsx)
interface BoardProps {
  session: GameSession;            // a live room, or the in-browser sandbox
  players: MatchPlayer[];          // names, colors and avatars by seat
  mode: "live" | "sandbox";
}

// Inside the board, the director plays frames into the view React renders.
const { view, seat, busy, stageRef, skip } = useFramePlayer(session, {
  layout,   // view → Record<PieceId, Placement>: x, y, z, rotation, scale
  plan,     // (event, prev, next) → { pre?, travel?, post? }
  onFrame,  // after each frame: the event log, sounds
});
```

`pre` runs before the board changes (shake, roll, reveal), `travel` decides how moved pieces get home (hop, fly, slide), and `post` is the follow-through (coin pop, score tick, overlay).

**Rules that keep engines honest:**

- **Plain JSON in, plain JSON out.** State, actions, events and views must serialize as plain JSON, so they're easy to store, diff and test.
- **Import boundary.** Biome blocks `engine/` from importing React, Next, Supabase or any UI code.
- **No hidden randomness.** The simulation harness runs engines with `Math.random` and `Date` rigged to throw. Any randomness or clock read outside the seeded `rng` fails tests.
- **Simultaneous turns.** When several seats choose at once, `activeSeats` returns all of them. The engine holds their hidden choices until everyone has picked.
- **Shared runtime.** The game-agnostic runtime handles seats, turn enforcement, versions, persistence and frames, so games never touch any of that. Test bots live in the sandbox.
- **Registry.** `games/manifests.ts` lists every game, `games/engines.ts` maps ids to engines, and `games/client.tsx` maps ids to boards through dynamic imports, so the homepage never ships every game's code.

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

- **Catch-up:** frames queue while one plays. When moves back up (you looked away, or your laptop slept), the director speeds up: 1.4× with one move waiting, 2.2× with three. With more than four moves queued it jumps straight to the latest view. One move can emit many frames (Camel Up's final roll emits about twenty), and they count as one move.
- **Control:** a Skip button finishes the current frame. The director has a playback-speed control; a per-user speed setting is on the later list.
- **Snapshots win:** a fresh snapshot (a reconnect, or the sandbox switching seats) replaces whatever frame is playing. The frame in flight stops touching state.
- **Reduced motion:** with `prefers-reduced-motion`, travel becomes a 160 ms crossfade, and shakes, flights and spins are dropped.
- **Cleanup:** everything runs inside `createScope`, so leaving the screen reverts cleanly and leaks nothing. Commits never run inside React's own render or effects.

### 6.3 Shared motion kit (`lib/motion`)

Every game gets:

- `hop` and `arc`: travel along a path, with squash and stretch.
- `pop`, `shake`, `countUp`, `floatText` (the "+5" tags) and `staggerIn`.
- Motion tokens (durations, eases, springs) and the director itself.

On the later list: `flip`, `trail`, and a frame inspector in the sandbox (scrub, slow motion, replay).

Game-specific choreography builds on these, so a new game only writes its hero moments from scratch.

### 6.4 Presence motion

Over Realtime Broadcast (never stored), other players' hovers show up as faint outlines: "Mia is eyeing the blue tile". Quick emotes travel the same way. These messages are throttled and switched off under reduced motion.

Games mark private targets so their hovers are never broadcast. For example, in Camel Up, which camel you're about to back for the overall win must stay secret.

Built so far: lobby presence (who's in the room). The hover and emote messages are defined and validated (`lib/realtime/messages.ts`), but no game shows them yet.

---

## 7. Data model (Postgres)

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (the auth user), `display_name`, `avatar_seed`, `color`, `role` | `role` is `pending`, `member`, `owner` or `revoked`. No email or provider data is copied here. |
| `invites` | `token_hash`, `created_by`, `room_id` (optional), `expires_at`, `used_by`, `used_at` | One-time member invites. Only a hash of each token is stored, so a database leak exposes no working links. |
| `rooms` | `id` (random UUID, also the link), `code` (display label), `game_id`, `host_id`, `status`, `locked`, `allow_spectators`, `options`, `lobby_version`, `current_match_id`, timestamps | `status` is `lobby`, `playing`, `finished` or `abandoned`. Bumping `lobby_version` rings the lobby doorbell. |
| `room_seats` | `room_id`, `seat`, `user_id`, `color`, `ready` | |
| `matches` | `id`, `room_id`, `engine_version`, `seed`, `seats`, `state`, `version`, `outcome`, timestamps | `seed` and `state` never leave the server. `seats` keeps names and colors as they were at the start, so history survives an account deletion. |
| `match_actions` | `match_id`, `version`, `seat`, `action`, `events`, `state_after`, `created_at` | Append-only. Frames, replays and debugging all come from here. |
| `rate_limits` | `key`, `window_start`, `count` | Counters for the rate limiter (§8.3). |

All of these live in a private `app` schema that the browser can't reach. §8 covers how access is locked down.

---

## 8. Security and privacy

Friends-only doesn't lower the bar. The site is on the public internet, so it's built as if strangers will probe it.

### 8.1 What we're protecting

- **People's accounts and personal data:** emails and sign-in identities.
- **Fair games:** hidden information stays hidden, dice can't be predicted, and only legal moves count.
- **The database and its credentials.**
- **The free-tier quotas,** which a script could burn through.

### 8.2 Who gets in

- **Sign-in:** Discord, Google, or a magic link sent by email. There are no passwords to leak, and no guest accounts.
- **Members only:** signing in by itself grants nothing. Until someone invites you, the site shows "you need an invite" and nothing else. You become a member by opening a **one-time invite link** from an existing member, and unused links expire after 48 hours.
- **The owner (you):** your account is made owner by hand, once, after your first sign-in. You can see every member and open invite and revoke either. A revoked member is locked out on their next request and signed out on every device.
- **Rooms:** a room's link (`/r/<random id>`) only works for members. New players can only join while the lobby is open, and the host can kick players or lock the room. The short code on screen (`K7QX`) is just a label.
- **What other players see:** your display name, your generated avatar and your color. Never your email, your Discord or Google account, or your profile photo.
- **Unlisted:** every page sits behind sign-in, and the site tells search engines not to index it.

### 8.3 Controls

| Risk | Control |
|---|---|
| **SQL injection** | All queries go through Drizzle with bound parameters; no SQL is ever assembled from strings. Lint and CI reject raw-SQL escape hatches (`sql.raw`), and our database functions contain no dynamic SQL. |
| **Reading other people's data** | Our tables sit in a private `app` schema that Supabase's public Data API doesn't expose, so the browser can't query the database at all. Every API route goes through one wrapper (`route()` in `lib/http/route.ts`) that declares its auth level, and the room and match services check seats and host rights inside their transactions. The server's database role can reach only our tables, not Supabase's `auth` schema, and row-level security is on everywhere as a second wall. |
| **Leaking hidden game information** | Per-seat views and event redaction (§5), with automated leak tests. Hovers on private choices are never broadcast (§6.4). |
| **Stolen or forged sessions** | The server verifies the Supabase token on every request and never trusts a user ID sent by the browser. Auth is checked wherever data is read, not just in Next.js's request proxy. OAuth uses PKCE; email links are single-use token hashes verified on the server. Both rely on an exact allowlist of redirect URLs, and after sign-in we only redirect to same-site paths. |
| **Cross-site scripting** | React escapes all text, and lint bans `dangerouslySetInnerHTML`. Display names are length- and character-checked and always rendered as plain text. A strict Content Security Policy with per-request nonces allows no third-party scripts except Turnstile on the sign-in page. |
| **Cross-site requests and clickjacking** | Endpoints that change anything accept only JSON with a same-origin `Origin` header. Cookies are `SameSite=Lax`, and the site refuses to load inside frames. |
| **Transport and headers** | HTTPS only, with HSTS, `nosniff`, a strict referrer policy, and a permissions policy that turns off the camera, microphone and location. |
| **Malformed or hostile input** | Zod schemas check every parameter, query and body and reject unknown fields, and request bodies are size-capped. The engine then re-checks that the move is legal. |
| **Spam and quota abuse** | Per-user and per-IP rate limits on every endpoint that changes anything, plus Cloudflare Turnstile on email sign-in and Supabase's own auth limits. |
| **Spoofed realtime messages** | Channels are private: a database policy lets you join a room's channel only if you're seated in that room or allowed to watch. Peer messages (hovers, emotes) are treated as untrusted decoration: fixed IDs only, shape-checked on arrival, and never able to touch game state. Doorbells are only hints, since any member in a channel could fake one. Clients fetch the truth over HTTPS at most twice a second, so a flood of fake doorbells can't exhaust anyone's rate limit. |
| **Leaked secrets** | The Supabase secret key and database URL exist only as server-side Vercel env vars. Server modules import `server-only`, so they can't end up in browser bundles. The local stack needs no keys at all, and CI scans every push for secrets. |
| **Vulnerable dependencies** | A committed lockfile. pnpm blocks install scripts by default and is set to skip releases less than three days old. Dependabot and `pnpm audit` run in CI, and Next.js and React security patches get applied promptly. |
| **Exposed dev tools** | The dev sandbox and test bots exist only on the local stack and on preview deploys, which stay behind Vercel's login. The dev sign-in refuses to run on a production deployment. |

### 8.4 Privacy

- **Minimal data:** we store a display name, an avatar seed and a color. Emails stay inside Supabase Auth: they're never copied into our tables, and the only endpoint that returns one is your own `/me`.
- **Generated avatars,** not photos pulled from Google or Discord.
- **Quiet logs:** request IDs, never tokens or emails. Errors shown to users never include internals.
- **Your account, your call:** `/me` can sign you out of every device or delete your account. Deleting removes your login and profile, and past games show "former player" in your place.

### 8.5 How it's verified

- **An authorization test matrix** (`tests/e2e/authz.spec.ts`): endpoints are called as signed out, pending, member, seated player, the player whose turn it is, spectator, host and owner. Each must allow or refuse exactly as designed, and no response may carry another player's cards or anyone's account id.
- **Hostile-input tests** (same file): other origins, wrong content types, SQL metacharacters, oversized payloads, unknown fields and malformed actions must be rejected cleanly.
- **Leak checks in simulations:** thousands of random games check that no seat's frames ever contain another seat's secrets.
- **Supabase's Security Advisor** must come back clean (no table without row-level security, no unsafe functions) before each release.
- **A security review** of every milestone's changes before they merge.

---

## 9. Screens

| Route | What it is |
|---|---|
| `/signin` | **Sign in** with Discord, Google or email. Signed-in non-members see "you need an invite" and nothing else. |
| `/invite/[token]` | **Accept an invite:** sign in, become a member, and land in the inviting room's lobby if there is one. |
| `/` | **The library.** A large wordmark assembles from game-piece shapes (a die face, a camel, a tile) on a staggered spring. Below it sits a grid of game covers. Each cover is a tiny looping scene of that game's real pieces, playing on hover or focus (on phones, when it scrolls into view). Mono metadata under each: `3–8 PLAYERS · 30 MIN · DICE · BETTING`. A strip above the grid lists rooms you're in. |
| `/games/[slug]` | **Game page:** animated cover, a 60-second overview, players and length, and **Create room**. |
| `/r/[id]` | **The room.** One route that morphs between lobby, game and results, so the lobby's seats become the in-game player panels. |
| `/me` | **Profile:** name, color, avatar, your email (only you see it), sign out everywhere, delete account. Match history is on the later list. |
| `/admin` | **Owner only:** members (revoke, restore) and invite links (create, revoke). |
| `/dev/[slug]` | **Dev sandbox** (local stack and preview deploys only): every seat on one screen, with pass-and-play that follows the turn. You can view as any seat or a spectator, run test bots or autoplay, and inspect the full server state. Ports get built here, and you can playtest early here. Preset scenarios and a frame inspector are on the later list. |

**Game screen layout:**

- Laid out for laptops first. The board takes center stage, with player panels along the edge showing score, holdings and whose turn it is.
- The current player gets an action bar with legal options highlighted.
- The board is sized so that it and the action bar always fit the window.
- A compact event log is always visible, and a quick rules reference opens from the action bar.
- When the tab is in the background, its title flags that it's your turn.
- On phones, the board sits on top. The action bar under it offers every action as a full-size button, and the player panels form a compact grid below.

---

## 10. Repository layout

```
app/                Next.js routes: hub, room, invite, profile, admin, dev sandbox, api/
components/         design-system components (Button, Panel, Dialog, Avatar…)
lib/
  auth/             sessions, authorization, rate limiter, dev sign-in (local only)
  http/             the API route wrapper, errors, safe redirects
  db/               Drizzle schema and the database client
  engine/           game contract types, PRNG, simulation harness
  runtime/          server match service: lock, apply, persist, build frames
  server/           rooms, lobby, invites, members
  client/           room controller (sync + realtime), sandbox session, frame player
  realtime/         channel client, local SSE hub, message schemas
  motion/           anime.js kit: tokens, director, stage, reduced motion
  security/         Content Security Policy
  supabase/         browser and server clients
games/              one folder per game (§5), plus the manifest, engine and UI registries
db/                 SQL migrations (roles, RLS, realtime policies, triggers) and the local shim
scripts/            the local stack, migrations, make-owner
tests/              database test setup and Playwright end-to-end tests
docs/               this spec, PORTING.md, SETUP.md
.claude/skills/     port-game skill: PORTING.md as a runnable checklist
CLAUDE.md           conventions for any Claude session working in this repo
```

This is one Next.js app rather than a monorepo, which is simpler for Vercel and for me. Lint rules enforce the engine/UI split instead of package boundaries. We can split into packages later if it ever matters.

---

## 11. Build plan

Each milestone ends with something you can click on a Vercel preview.

| # | Milestone | Done when | Status |
|---|---|---|---|
| M0 | **Scaffold.** Next.js app, strict TypeScript, Biome, Vitest, Playwright, GitHub Actions CI, the Vercel project, the Supabase project, env vars, CLAUDE.md. Plus the security baseline: headers and CSP, secret scanning, dependency audit, the private schema and a least-privilege database role. | CI is green and every push gets a preview deploy. | Built. The Vercel and Supabase projects need your accounts ([SETUP.md](SETUP.md)). CI hasn't run on GitHub yet. |
| M1 | **Look and motion.** Tokens, type, components, the motion kit, and the library and game pages. | **You sign off on the look and feel.** This is the "not AI-looking" checkpoint. | Built; your review is open. |
| M2 | **Accounts, membership and rooms.** Discord, Google and email sign-in; invite-only membership; profiles; your owner page; rooms with links; a live lobby with seats, colors, ready-up and host controls (kick, lock). | Two members meet in a lobby and see each other live, a non-member gets nothing, and the authorization test matrix passes. | Built and passing on the local stack. The Supabase sign-in paths can only be tried on your project. |
| M3 | **Game runtime.** Engine contract, PRNG, the match service with locking, action and sync endpoints, the realtime doorbell, the client store and director, the dev sandbox with pass-and-play and test bots, and results and rematch. All of it is proven on a tiny test game that never appears in the library. | A scripted Playwright game with three browsers runs start to finish, surviving a mid-game refresh. | Done. |
| M4 | **Camel Up**, with you, following PORTING.md: rules checkpoint, engine and tests, art and choreography, playtest, polish. | You've played a full game with friends on the production URL. | Engine, board and choreography are done and tested. The rulings in `rules.md` and a real playtest wait on you. |
| M5 | **Hardening.** A mobile pass, accessibility, performance budgets, error and empty states, reconnect edge cases, optional turn timers, the Supabase keep-alive, and a full security review. | Accessibility and performance checks pass, and a week of real use produces no stuck or desynced games. | Partly done: the phone layout, reconnects and a security review. Accessibility and performance budgets and turn timers remain. |

**Later:**

- Bots and pass-and-play for players.
- Sound: dice rattle, hooves, coins.
- Smarter game-specific bots.
- Stats.
- Interactive tutorials.
- Undo of your last action, as long as it revealed nothing new.
- A light "paper" theme.
- An installable PWA.

---

## 12. Free-tier budget

These are approximate allowances from public pricing pages; confirm them at signup.

| Service | Free allowance | What we'd use |
|---|---|---|
| Vercel Hobby | About 1M function calls a month, 4 active-CPU hours and 100 GB transfer. Crons run at most daily. **Non-commercial use only.** | A 5-player Camel Up game is roughly 500 function calls. |
| Supabase Free | 2 projects, 500 MB of Postgres, 50K monthly active users and 5 GB of egress. Realtime allows about 200 concurrent connections and about 2M messages a month. | Game state is kilobytes, and a game sends around 1K realtime messages. |
| Supabase pausing | Free projects pause after **7 days without activity**. | A daily Vercel cron touches the database, and also cleans up abandoned rooms. |
| Resend Free | About 3,000 emails a month (100 a day). | Only sign-in links: a handful a week. |
| Cloudflare Turnstile | Free. | Sign-in checks only. |

If we ever get close to a limit (we won't with friends), the first upgrade is Supabase Pro.

---

## 13. Risks and decisions to know about

- **IP:**
  - Game mechanics are free to reuse, but artwork, rulebook text and names belong to the publishers.
  - All art is our own: inspired by the layout, never scanned or traced. `rules.md` is written in our own words.
  - Rulebooks and photos go under `games/<slug>/source/`, so any later session can re-read them. The folder is gitignored until the repository is private, and the site never serves it.
  - The site is invite-only and unlisted, which also fits Vercel Hobby's non-commercial terms.
- **Deploys during a game:**
  - Engines carry a version number.
  - If a deploy changes a game's state shape in a breaking way, matches running on the old version say "this game was updated, start a rematch" instead of loading into the new engine.
  - Non-breaking fixes apply to running games.
- **anime.js vs React:** the ownership rule (§6.1) and `createScope` cleanup prevent conflicts. If something still goes wrong, the page already shows the true state, so the worst case is a missing animation, never a wrong board.
- **Phones and 3D:** no game uses Three.js yet. The CSS 3D dice and pyramid run fine on phones.
- **No timers on serverless:** Vercel functions can't run timers. Turn timeouts are therefore checked on the next request or by the daily cron, and they're off by default.

---

## 14. Decisions

| Question | Decision |
|---|---|
| Camel Up edition | 2nd edition (2018), with crazy camels; 2–8 players (the box says 3–8; 2 is our addition, ruling 8 in `rules.md`) |
| Audience | Friends only: invite-only membership, unlisted |
| Sign-in | Discord, Google and email magic links; no guest accounts |
| Who can invite | Any member, with one-time links; you can revoke anyone |
| Devices | Laptop-first; phones fully supported |
| Bots and pass-and-play | Testing tools in the dev sandbox for now |
| Repo | Private, so rulebooks and photos can be committed for reference. GitHub still lists it as public, so the sources stay gitignored until it's private. |
| Sign-in buttons | Configurable with `SIGNIN_METHODS`, so unused providers don't show |
| Security | Built as if strangers will probe it (§8) |
