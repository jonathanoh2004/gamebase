import type { CamelUpEvent, RacingColor } from '../engine/types';
import { camelName } from './palette';

// Plain-language descriptions of events, for the log and screen readers.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function describeEvent(
  e: CamelUpEvent,
  name: (seat: number) => string,
  you: number | null,
): string | null {
  const who = (seat: number) => (seat === you ? 'You' : name(seat));
  switch (e.type) {
    case 'ticketTaken':
      return `${who(e.seat)} took the ${camelName(e.color).toLowerCase()} ${e.value} ticket`;
    case 'spectatorPlaced':
      return `${who(e.seat)} ${e.from === null ? 'placed' : 'moved'} a ${e.side === 'cheer' ? 'cheering' : 'booing'} tile on ${e.space}`;
    case 'betPlaced':
      return `${who(e.seat)} bet on the overall ${e.pile}${e.color ? ` (${camelName(e.color as RacingColor).toLowerCase()})` : ''}`;
    case 'partnered':
      return `${who(e.a)} and ${who(e.b).toLowerCase() === 'you' ? 'you' : who(e.b)} are partners this leg`;
    case 'dieRolled':
      return e.die === 'grey'
        ? `Grey die: ${e.face} ${e.value}. The ${e.camel} crazy camel runs back`
        : `${cap(e.die)} die: ${e.value}`;
    case 'camelsMoved':
      if (e.cause === 'cheer') return 'The crowd cheers them one space on';
      if (e.cause === 'boo') return 'Booed back one space, underneath';
      return null;
    case 'spectatorPaid':
      return `${who(e.owner)} earned 1 from the spectator tile`;
    case 'raceFinished':
      return `${cap(e.camels.find((c) => c !== 'white' && c !== 'black') ?? e.camels[0] ?? 'A camel')} crossed the finish line`;
    case 'legScored':
      return `Leg ${e.leg} scored: ${cap(e.ranking[0] ?? '')} led, ${e.ranking[1] ?? ''} second`;
    case 'legReset':
      return `Leg ${e.leg} begins`;
    case 'overallCard':
      return `${who(e.seat)}: ${camelName(e.color).toLowerCase()} for overall ${e.pile}, ${e.payout > 0 ? `+${e.payout}` : e.payout}`;
    case 'gameEnded':
      return `${cap(e.winner)} won the race; ${e.loser} came last`;
    default:
      return null;
  }
}
