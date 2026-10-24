# Porting playbook

This is how a physical board game becomes a Gamebase game. It's the process I follow every time. It's also a Claude Code skill (`.claude/skills/port-game/`), so any Claude session on this repo can run it when you say "port this."

The platform side (engine contract, animation system, data model) is in [DESIGN.md](DESIGN.md).

---

## How to hand me a game

Send a message like this, with the files attached:

> Port **Camel Up** (2nd edition). Rulebook and photos attached. We usually play with 4–6 people, and no house rules.

What to send:

- **Rulebook:** PDF or Markdown. Include the edition and any official FAQ or errata you follow.
- **Photos:**
  - The board from directly above, flat, in good light, with the whole board in frame.
  - Every type of component laid out.
  - A game set up and ready to play.
  - Close-ups of anything with text: cards, tiles, player aids.
- **How your table plays:** house rules, variants, and the player counts you care about.
- **Optional:** the moment you love about the game, and anything the digital version should do better than the cardboard.

Attach the files to your message, or put them under `games/<slug>/source/` so any later session can re-read the originals. The site never serves that folder, and it's gitignored until the repository is private. If your Claude client won't attach a PDF, paste the rules as Markdown.

---

## The process

There are three checkpoints (①②③). At each one I stop and wait for you.

### Phase 1: Read and normalize → `rules.md` (checkpoint ①)

I read the rulebook and photos, then write `games/<slug>/rules.md` in our own words, structured so every rule can be tested. It covers:

- **Components:** every physical thing, with counts, and what it becomes in software.
- **Setup:** step by step, for each player count.
- **Turn structure:** phases, who acts when, and any simultaneous steps.
- **Rules:** numbered `R1`, `R2`… with one testable statement each.
- **Scoring and end of game.**
- **Hidden information and randomness:** exactly who knows what, and every random event.
- **Edge cases and rulings:** each ambiguity, the reading I chose, and why.
- **Digital adaptation:** what changes on screen. Examples: automatic bookkeeping, hidden information enforced by the server, which actions need a confirm, and timers.

**You review `rules.md`.** A misread rule is cheapest to fix here, so no code gets written until you approve it.

### Phase 2: Model

I map the rules onto the engine contract (DESIGN.md §5):

- I define the types: `State`, `Action`, `Event` and `View`.
- I decide exactly what is hidden from whom.
- I list every event, since each event is something the UI will animate.

### Phase 3: Engine and tests (no UI yet)

- I implement `setup`, `decide`, `evolve`, `viewFor`, `redactEvent`, `legalActions` and `outcome` in `engine/`, and register the engine in `games/engines.ts`.
- **At least one test per rule, named by its ID** (`tests/rules.test.ts`). For example: `R12: a camel landing on a spectator tile moves one more space in the tile's direction, and the tile's owner gets 1 coin`.
- **Simulations** (`tests/simulation.test.ts`, on `lib/engine/harness.ts`): many random legal games at every supported player count, with `Math.random` and `Date` rigged to throw. Each must finish without errors and keep its invariants: coin and piece totals add up, and nothing hidden ever shows up in another seat's view.
- **Golden replays:** a full game saved as seed plus actions (a snapshot file), so any later rule change shows up as a diff.

### Phase 4: Visual brief, board and pieces (checkpoint ②)

- **From your photos:** I work out the board geometry (spaces, tracks, zones) in `ui/geometry.ts`, plus the shapes of the components and how the game uses color.
- **An original design** in our visual language, not a reproduction of the publisher's art: SVG and CSS 3D pieces in `ui/`.
- **`ui/layout.ts`:** the one function that places every piece from a view.
- **Hero moments:** the 3–5 beats that deserve custom choreography. Everything else uses the shared motion kit.
- **You react to the sandbox** (`/dev/<slug>`) before I polish.

### Phase 5: Choreography and interaction

- **`ui/choreography.ts`:** an animation for every event type, built on the shared kit first.
- **Interaction:**
  - Legal moves highlighted, with previews.
  - Select, then confirm (Enter confirms, Esc cancels), so a misclick never costs a turn.
  - Keyboard play.
  - The phone layout: every action also reachable as a full-size button.
- **Reduced-motion variants** of everything.

### Phase 6: Integrate and playtest (checkpoint ③)

- **Integration:**
  - the manifest in `games/manifests.ts`
  - the board, cover and options in `games/client.tsx`
  - room options (variants, player counts)
- **A Playwright test** that plays a multiplayer game in several browsers, including a reload mid-game (see `tests/e2e/room.spec.ts`).
- **You playtest on the preview URL:** the sandbox, plus a real room across your own browser windows. Previews stay behind Vercel's login, so friends join once the game is live in production. Your feedback goes back into `rules.md` or the choreography.

### Definition of done

- [ ] `rules.md` approved, and every rule has a test
- [ ] Simulations pass at every supported player count; golden replays committed
- [ ] No hidden information in any other seat's frames (automated check)
- [ ] Every event has an animation and a reduced-motion variant
- [ ] Works at 375 px wide and on desktop; keyboard playable; color-blind glyphs on colored pieces
- [ ] Multiplayer end-to-end test passes, including reconnect
- [ ] Original art only; source files never served by the site
- [ ] Security checks pass for the port's changes: authorization matrix, hostile-input tests, review
- [ ] Listed in the library with an animated cover

---

## Worked example: Camel Up

The first port, built from the 2nd edition (2018) rulebook. Everything below exists in `games/camel-up/`.

**Rules:** `rules.md` numbers 30 rules (R1–R30) and 4 hidden-information rules (H1–H4). It also lists 8 rulings where the book is ambiguous or silent, each marked for your review, and the digital adaptations.

**Components → software**

| Physical | Software |
|---|---|
| 16-space race track | `track: CamelId[][]`: a stack per space, bottom to top. A unit that crosses the line goes into `crossed`, which ends the race. |
| 5 racing camels, plus 2 crazy camels that run backwards | A `CamelId` union. Crazy camels never count in the rankings. |
| Pyramid with 5 racing dice and 1 grey die (picks a crazy camel and a distance) | `pyramid: DieId[]` (the dice still inside) and `rolled` (the dice in the tents). Rolls come from the seeded PRNG. |
| Leg betting tickets, a stack per color | `legStacks: Record<RacingColor, number[]>`. The top of each stack is the next value: 5, 3, 2, 2. |
| Spectator tiles, one per player (cheering +1, booing −1) | `spectator: { space, side } \| null` per player |
| Overall winner and loser cards, placed face-down | `winnerPile` and `loserPile`. The colors are **hidden** from other seats until revealed card by card at the end. |
| Pyramid tickets, coins and partnership cards (6+ players) | `pyramidTickets`, `coins` and `partner` per player |

**Actions:** `takeTicket(color)`, `roll`, `placeSpectator(space, side)`, `bet(pile, color)`, `partner(with)`. Each is a strict Zod schema.

**Events (each one gets animated):**

- **A roll:** `pyramidTicketTaken` → `dieRolled` → `camelsMoved`. Landing on a spectator tile adds `spectatorPaid` and a second `camelsMoved`.
- **Other actions:** `ticketTaken`, `spectatorPlaced`, `partnered`, and `betPlaced`, whose color is redacted for every other seat.
- **Endings:** `legScored` and `legReset` when the fifth die leaves the pyramid. When a unit crosses the line: `raceFinished`, then the final `legScored`, one `overallCard` per bet in placement order, and `gameEnded`.
- `turnPassed` after every action.

**Hidden information:** the colors of the overall bets, your finish cards, and the server's seed. With the *hide money* room option, other players' coin totals stay hidden until the end. Everything else is public, so counting which dice are still in the pyramid is fair play, just like at the table.

**Hero moments, as built:**

1. **The pyramid roll.** A CSS 3D pyramid shakes, then the die (a real CSS 3D cube) flies out, tumbles and bounces into its tent.
2. **The stack hop.** The unit hops space by space along arcs, squashing on each landing, with riders a beat behind.
3. **Spectator tiles.** A landing bounces the stack forward or back (back goes *underneath*), the tile pops, and "+1" floats up on the owner's panel.
4. **End of leg.** A payout card lists each player's tickets and totals while the coins count up. Then a "Leg N" banner, and the tickets and dice are back.
5. **The finish.** A "Finish!" banner, then the overall piles are revealed one card at a time with their payouts, ending on the final standings.

**Digital adaptations:** automatic bookkeeping, select-then-confirm for every action, a real random draw for the pyramid "shake", card-by-card reveals, and the *hide money* option.

**Not built yet (ideas):** a live odds overlay for the current leg (exact, by enumerating the remaining dice; off unless the host turns it on), a per-leg history, and a replay of the last roll.
