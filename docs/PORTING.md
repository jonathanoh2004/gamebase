# Porting playbook

This is how a physical board game becomes a Gamebase game. It's the process I follow every time. Once you approve it, it also becomes a Claude Code skill (`.claude/skills/port-game/`), so any Claude session on this repo can run it when you say "port this."

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

If your Claude client won't attach a PDF, paste the rules as Markdown. Another option is to make the repo private and commit the files under `games/<slug>/source/`. That folder is gitignored by default because this repo is public; source files are inputs only and never deployed.

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

- I implement `setup`, `decide`, `evolve`, `viewFor`, `redactEvent`, `legalActions` and `outcome`.
- **At least one test per rule, named by its ID.** For example: `R12: a camel landing on a spectator tile moves one more space in the tile's direction, and the tile's owner gets 1 coin`.
- **Simulations:** thousands of random legal games at every supported player count. Each must finish without errors and keep its invariants: coin and piece totals add up, and nothing hidden ever shows up in another seat's view.
- **Golden replays:** a few full games saved as seed plus actions, so any later rule change shows up as a diff.

### Phase 4: Visual brief, board and pieces (checkpoint ②)

- **From your photos:** I work out the board geometry (spaces, tracks, zones), the shapes of the components and how the game uses color.
- **An original design** in our visual language, not a reproduction of the publisher's art.
- **`layout.ts`:** the one function that places every piece from a view.
- **Hero moments:** the 3–5 beats that deserve custom choreography. Everything else uses the shared motion kit.
- **You react to a static mock or a short clip** in the sandbox before I polish.

### Phase 5: Choreography and interaction

- **`choreography.ts`:** an animation for every event type, built on the shared kit first.
- **Interaction:**
  - Legal moves highlighted, with hover previews.
  - A confirm on actions that can't be undone.
  - Keyboard play.
  - The phone layout.
- **Reduced-motion variants** of everything.

### Phase 6: Integrate and playtest (checkpoint ③)

- **Integration:** the manifest and registry entry, plus room options (variants, player counts).
- **A Playwright test** that plays a full multiplayer game in several browsers, including a reload mid-game.
- **You playtest on the preview URL,** in the sandbox and in a real room. Your feedback goes back into `rules.md` or the choreography.

### Definition of done

- [ ] `rules.md` approved, and every rule has a test
- [ ] Simulations pass at every supported player count; golden replays committed
- [ ] No hidden information in any other seat's frames (automated check)
- [ ] Every event has an animation and a reduced-motion variant
- [ ] Works at 375 px wide and on desktop; keyboard playable; color-blind glyphs on colored pieces
- [ ] Multiplayer end-to-end test passes, including reconnect
- [ ] Original art only; source files not committed
- [ ] Listed in the library with an animated cover

---

## Worked example: Camel Up (preview)

This preview is based on what I know of the 2nd edition. **Your rulebook replaces all of it in Phase 1.**

**Components → software**

| Physical | Software |
|---|---|
| 16-space race track | `track: CamelId[][]`: a stack per space, bottom to top |
| 5 racing camels, plus 2 crazy camels that run backwards | A `CamelId` union. Crazy camels never count in the rankings. |
| Pyramid with 5 racing dice and 1 grey die (picks a crazy camel and a distance) | `pyramid: { inside: DieId[] }`. Rolls come from the seeded PRNG. |
| Leg betting tiles, a stack per color | `legTiles: Record<Color, number[]>` (the top of the stack is the next value) |
| Spectator tiles, one per player (cheering +1, booing −1) | `spectator?: { space, side }` per player (absent while the tile is in hand) |
| Overall winner and loser cards, placed face-down | `overall: { winner: Bet[]; loser: Bet[] }`. Colors stay **hidden** until the end. |
| Pyramid tickets and coins | `pyramidTickets` and `coins` per player |

**Actions:**

- `takeLegTile(color)`
- `placeSpectator(space, side)`
- `rollPyramid()`
- `betOverall("winner" | "loser", color)`

**Events (each one gets animated):**

- **A roll:** `pyramidShaken` → `dieRolled(die, value)` → `stackMoved(camels, from, to)` → `spectatorTriggered(owner, ±1)` → `coinsAwarded(seat, n, reason)`.
- **Other actions:** `legTileTaken`, `spectatorPlaced`, and `overallBetPlaced`, whose color is redacted for every other seat.
- **Endings:** `legEnded(ranking, payouts)` when the fifth die leaves the pyramid, then `raceFinished`, `overallRevealed(bets)` and `gameEnded(standings)`.

**Hidden information:** only the colors of the overall bets, plus the server's seed. Everything else is public, so counting which dice are still in the pyramid is fair play, just like at the table.

**Hero moments:**

1. **The pyramid.** A real 3D pyramid (React Three Fiber) shakes, then a die drops out and tumbles to its face. This is the one 3D object in the game.
2. **The stack hop.** The camel and everything riding it hop space by space along an arc, squashing on each landing. Riders lag a few frames behind, so the tower wobbles. Crazy camels run backwards with a different gait.
3. **Spectator tiles.** Landing on one bounces the stack forward or back, and a coin arcs from the bank to the tile's owner.
4. **End of leg.** The camels shuffle into a podium, each player's tiles flip to show their payout, and coin totals count up.
5. **The finish.** Overall bets flip one at a time in the order they were placed, and each payout lands as it's revealed.

**Digital extras (each optional, off by default):**

- **A live odds overlay for the current leg.** It's exact: it enumerates the remaining dice in a Web Worker. It also changes how the game plays, so it's off unless the host turns it on.
- A per-leg history.
- A "what just happened" replay of the last roll.
