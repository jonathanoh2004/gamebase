---
name: port-game
description: Port a physical board game to Gamebase from its rulebook and photos. Use when the user hands over a rulebook (PDF or Markdown) and board photos and asks to port, add or implement a game, or to continue a port in progress.
---

# Port a board game

Follow [docs/PORTING.md](../../../docs/PORTING.md): it is the source of truth, and this is its checklist. Use `games/camel-up/` as the reference port for structure, naming and test style. The platform contract is in [docs/DESIGN.md](../../../docs/DESIGN.md) §5–6.

Stop at each checkpoint (①②③) and wait for the user.

## 0. Intake

- Save the rulebook and photos under `games/<slug>/source/`. That folder is gitignored while the repo is public, so never commit it unless the user says the repo is private.
- If a PDF renders badly, extract its embedded images (`pdfimages -png`) and read those.
- Note the edition, the player counts the user cares about, and any house rules.

## 1. Rules → `games/<slug>/rules.md` (checkpoint ①)

- Write it in your own words, never copied text. Cover components → software, setup, turn structure, numbered rules `R1…`, scoring and end of game, hidden information `H1…`, rulings, and digital adaptations.
- Mark every ruling (ambiguity, or anything the book doesn't say) so the user can confirm it.
- **Stop.** The user reviews `rules.md` before any code exists.

## 2–3. Engine and tests

- `engine/types.ts` holds State, Action, Event and View, all plain JSON. Each Action is a strict Zod schema.
- `engine/index.ts` exports a `GameEngine` (`lib/engine/types.ts`). It is pure: no `Date`, no `Math.random`, no I/O, no UI imports. Biome enforces this. Randomness comes only from `ctx.rng` in `decide`, and results go into events.
- `viewFor` and `redactEvent` decide what each seat sees. Secrets never go anywhere else.
- Register the engine in `games/engines.ts`.
- Tests in `games/<slug>/tests/`:
  - `rules.test.ts`: at least one test per rule, named by its ID.
  - `simulation.test.ts`: random games at every player count through `simulate()` from `lib/engine/harness.ts`, checking invariants and that no frame leaks another seat's secrets.
  - A golden replay snapshot.
- `pnpm test` must pass.

## 4. Board (checkpoint ②)

- Write `ui/geometry.ts` (stage coordinates), then `ui/layout.ts` (view → `Placement` for every piece; the single source of positions).
- The art is original SVG and CSS 3D in our palette (`app/globals.css` tokens, `lib/palette.ts`). Pair every color with a glyph.
- `ui/board.tsx` renders `Stage` and `Piece` (`lib/motion/stage.tsx`) from `useFramePlayer`. Register the board, cover and options in `games/client.tsx`, and the manifest in `games/manifests.ts`.
- Expose only public state as `data-*` attributes, for tests.
- **Stop.** The user tries `/dev/<slug>` (`pnpm dev:local`) before you polish.

## 5. Choreography and interaction

- `ui/choreography.ts` maps each event to `{ pre, travel, post }`, built on `lib/motion/kit.ts` first. Respect `ctx.reduced`.
- Interaction:
  - Highlight legal moves.
  - Select, then confirm (Enter confirms, Esc cancels).
  - Make every action reachable on a 375 px phone.
- Check it in the sandbox: bot moves, a full autoplayed game, a phone viewport, with no console errors.

## 6. Integrate and playtest (checkpoint ③)

- Add a Playwright spec modeled on `tests/e2e/room.spec.ts`: several browsers, a reload, and a spectator.
- Run `pnpm check`, then `pnpm build && pnpm test:e2e`. In a sandbox, set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is preinstalled.
- Walk the definition of done in PORTING.md, review the security of the port's changes, commit, and hand over for a playtest.
