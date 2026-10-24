'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

// The in-game rules reference: our own summary of games/camel-up/rules.md,
// kept to what a player needs mid-game.

const SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: 'On your turn, do one thing',
    lines: [
      'Ticket: take the top betting ticket of a color. You back that camel to lead at the end of the leg.',
      'Spectator tile: put your tile, cheering (+1) or booing (−1), on an empty space. Not space 1, and not next to another tile. You can move it later as your action.',
      'Roll: take a pyramid ticket and roll one die from the pyramid.',
      'Overall bet: secretly play one of your finish cards on the overall winner or loser pile.',
      'Partner (6+ players): team up with a player whose partner card is still available. They can’t refuse.',
    ],
  },
  {
    title: 'Moving camels',
    lines: [
      'A camel moves with everything stacked on top of it, and lands on top of whatever is there.',
      'Landing on a spectator tile pays its owner 1. Cheering moves the unit 1 more space; booing moves it 1 back, underneath any camels there.',
      'The grey die moves a crazy camel backward. If only one of them carries racing camels, that one moves. If one sits right on the other, the top one moves.',
    ],
  },
  {
    title: 'End of a leg (after 5 dice)',
    lines: [
      'Each ticket on the leading camel pays its value; on the second camel +1; any other −1.',
      'Each pyramid ticket pays 1. Partners also score one of their partner’s tickets (we pick the best one for you, or none if all would cost).',
      'Nobody drops below 0. Tickets, tiles, dice and partnerships reset, and the player after the last roller starts the next leg.',
    ],
  },
  {
    title: 'End of the race',
    lines: [
      'The race ends the moment a camel crosses the finish line. The leg is scored once more.',
      'Overall bets are revealed in the order they were played. Correct calls pay 8, 5, 3, 2, then 1; wrong calls cost 1.',
      'Crazy camels never count in the rankings. Most coins wins; ties share the win.',
    ],
  },
];

export function RulesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)} data-own-enter>
        Rules
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Camel Up · quick rules"
        className="max-h-[85dvh] w-[min(94vw,620px)] overflow-y-auto"
      >
        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="label mb-2 text-paper">{s.title}</h3>
              <ul className="space-y-1.5 text-dim text-sm">
                {s.lines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 bg-mute" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Dialog>
    </>
  );
}
