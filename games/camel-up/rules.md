# Camel Up (2nd edition, 2018): normalized rules

Our own summary of the rules, written for the port. The rulebook is the
authority; where it's silent or ambiguous, the ruling we chose is listed under
**Rulings**. Every numbered rule has at least one test named after its ID
(`engine/*.test.ts`).

Source: the 2nd-edition rulebook (Eggertspiele / Plan B Games, 2018). Not
committed: see `docs/PORTING.md`.

---

## Components → software

| Physical | In the engine |
|---|---|
| Race track: 16 spaces in a loop; the finish line sits between space 16 and space 1 | `track`: 16 stacks, bottom to top |
| 5 racing camels: blue, green, red, yellow, purple | `RacingColor` |
| 2 crazy camels: white, black. They run backwards and can't be bet on | `CrazyColor` |
| 5 racing dice, one per racing color, faces 1, 1, 2, 2, 3, 3 | uniform 1–3 |
| 1 grey die, faces 1, 2, 3 in white and 1, 2, 3 in black | uniform over 6 faces: a color and a value |
| Pyramid (holds the dice not yet rolled this leg) | `pyramid`: dice still inside |
| Dice tents (rolled dice this leg) | `rolled`, in order |
| 20 betting tickets: per color 5, 3, 2, 2 | `legStacks[color]`, top first |
| 5 pyramid tickets | `pyramidTicketsLeft` |
| Coins (Egyptian pounds); the bank never runs out | `players[i].coins` |
| 5 finish cards per player, one per racing color, kept hidden | `players[i].hand` (secret) |
| 1 spectator tile per player: cheering (+1) / booing (−1) | `players[i].spectator` |
| 1 partnership card per player (6+ players only) | `players[i].partner` |
| Overall winner / loser betting spaces (face-down card piles) | `winnerPile`, `loserPile` (colors secret) |
| Starting player marker | `startingSeat` |

---

## Setup

- **R1.** Each player starts with 3 coins, 5 finish cards (one per racing color), and their spectator tile in hand. With 6 or more players, each also has a partnership card, "available" side up.
- **R2.** Each color's ticket stack is, from the top: 5, 3, 2, 2.
- **R3.** 5 pyramid tickets are on the board, and all 6 dice are in the pyramid.
- **R4.** Each racing camel starts on space 1, 2 or 3, given by one roll of its own die. Camels sharing a space are stacked in any order.
- **R5.** Crazy camels start at the other end: roll the grey die, then place a crazy camel on space 16, 15 or 14 for a roll of 1, 2 or 3. Roll again for the other crazy camel; if it lands on the same space, it goes on top.
- **R6.** Racing camels face clockwise (the race direction); crazy camels face counterclockwise.
- **R7.** A starting player is chosen (the rulebook says the youngest).

## Turns

- **R8.** Play goes clockwise from the starting player. On your turn you take exactly one action:
  1. take a betting ticket (R9),
  2. place or move your spectator tile (R10),
  3. take a pyramid ticket and roll a die (R11),
  4. bet on the overall winner or loser (R13),
  5. with 6+ players only: form a betting partnership (R14).
- **R9. Betting ticket.** Take the top ticket of any color's stack. You may hold any number of tickets, several of one color included. An empty stack can't be taken from.
- **R10. Spectator tile.** Put your tile, either side up, on a track space that has no camels and no tile. Not on space 1, and not next to a space holding another tile. If your tile is already on the track, this action moves it to a *different* space under the same rules (and you choose its side again).
- **R11. Pyramid.** Take the top pyramid ticket, then release one random die from the pyramid and roll it. Move the camel it calls for (R15–R18). The die then sits in a dice tent until the leg ends.
- **R12.** Each pyramid ticket you hold is worth 1 coin at leg scoring.
- **R13. Overall bet.** Put one of your finish cards face down on the overall-winner pile or the overall-loser pile, on top of any cards already there. Its color is your guess. It stays there for the rest of the game. You can do this once per action for as long as you have cards.
- **R14. Partnership (6+ players).** If your partnership card is available, pick another player whose card is also available. You swap cards and are partners until the end of the leg. They can't refuse.

## Movement

- **R15.** A racing die moves that color's camel forward (clockwise) by the number rolled, carrying every camel stacked on top of it. Camels below it stay put.
- **R16.** A moving unit (a camel plus everything on it) that ends on an occupied space goes on top of the camels already there.
- **R17. Grey die.** It shows a color and a number. Normally the crazy camel of that color moves backward (counterclockwise) by the number, carrying everything on top of it. Two exceptions, checked in order:
  1. if exactly one crazy camel is carrying racing camels, that one moves, whatever the die's color;
  2. otherwise, if one crazy camel sits directly on top of the other, the top one moves.
- **R18. Spectator tiles.** When a unit ends its move on a tile, the tile's owner gains 1 coin at once. Then the unit moves one more space: in its own direction of travel if the tile is cheering (landing on top of any camels there), or one space back if it's booing (sliding *under* any camels there). The tile stays put.
- **R19.** Camels never turn around: racing camels always face clockwise and crazy camels counterclockwise, even when carried the wrong way.
- **R20.** A rolled die can't be rolled again until the next leg.

## Ranking

- **R21.** A racing camel further along the track is ahead. On the same space, higher in the stack is ahead. Crazy camels never count.
- **R22.** Camels that crossed the finish line forward are ahead of everyone. Racing camels carried backward across the finish line by a crazy camel are behind everyone (top of that stack still ahead of the bottom).

## End of a leg

- **R23.** The leg ends right after the player who took the 5th pyramid ticket finishes moving. One die stays in the pyramid.
- **R24. Leg scoring.** Each player totals:
  - each ticket of the leading camel: its value (5, 3 or 2);
  - each ticket of the second camel: +1;
  - each ticket of any other camel: −1;
  - each pyramid ticket: +1.

  The total is then paid out, or paid in. Nobody goes below 0: if you owe more than you have, you pay what you have.
- **R25. Partner bonus (6+).** A player with a partner may also add the reward of one of the partner's tickets (betting or pyramid) to their own total, or nothing.
- **R26. Cleanup.** Tickets return to their stacks (5, 3, 2, 2), pyramid tickets return, spectator tiles return to their owners, all dice go back in the pyramid, and partnership cards flip back to available.
- **R27.** The next leg starts with the player after the one who took the last pyramid ticket, which is just the normal turn order continuing.

## End of the game

- **R28.** The race ends immediately when any unit crosses the finish line, in either direction. That includes a crazy camel running backward past space 1.
- **R29.** Then there's one last leg scoring (R24–R25), followed by overall bets, the winner pile first and then the loser pile. Cards are revealed in the order they were placed. The overall winner is the leading racing camel and the overall loser the last one (R21–R22).
  - Correct cards pay 8, 5, 3 and 2 coins to the first four, then 1 to each further correct card.
  - Each wrong card costs its owner 1 coin, never below 0.
- **R30.** Most coins wins. Ties share the win.

## Hidden information

- **H1.** Your finish cards in hand are yours alone; others see only how many you hold.
- **H2.** Everyone sees who placed each card on the overall piles and in what order, never the color, until the end-of-game reveal.
- **H3.** Money is public by default. The room option *hide money* shows only your own total until the end (the rulebook lets players keep their exact total private).
- **H4.** Everything else is public: the track, tiles, tickets taken, which dice have rolled (so which remain in the pyramid), and partnerships. The server's random seed never leaves the server.

## Randomness

Setup rolls (R4, R5), the stacking order of camels sharing a start space, the starting player (R7), which die leaves the pyramid (uniform among those inside), and every roll. All of it comes from the seeded per-move generator on the server.

---

## Rulings

Where the rulebook leaves room, this is how the port plays. Each one is easy to change if you play differently.

1. **Moving your own tile (R10):** while you move it, your tile's current space doesn't count as "holding a tile", so you may move it one space over.
2. **"Carrying racing camels" (R17):** means any racing camel anywhere above that crazy camel in its stack, not only directly on top. In practice both readings pick the same camel.
3. **Booing tile under a crazy camel (R18):** it moves the crazy unit one space clockwise and slides it under any camels there.
4. **Overall payouts (R29):** paid card by card in reveal order, and the "never below 0" rule applies to each card as it's revealed.
5. **Partner bonus (R25):** the port picks your partner's best ticket for you, or none if every one would cost you. That's always the best choice.
6. **Starting player (R7):** random.
7. **Setup stacking (R4):** random order.
8. **Player count:** the box says 3–8; the port also allows 2.

## Digital adaptation

- All bookkeeping is automatic: ticket values, leg scoring, and partner bonuses.
- Every action is select-then-confirm, so a misclick never costs a turn.
- The pyramid "shake" is a real random draw among the dice still inside.
- Overall bets are revealed card by card with their payouts, in placement order.
- Optional room setting: hide money (H3).
