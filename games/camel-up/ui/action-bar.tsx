'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import {
  type CamelUpAction,
  type CamelUpView,
  type Pile,
  RACING,
  type RacingColor,
  type Side,
} from '../engine/types';
import { CAMEL_STYLE, camelName } from './palette';
import { RulesButton } from './rules-card';

export function describeAction(a: CamelUpAction, view: CamelUpView): string {
  switch (a.type) {
    case 'takeTicket':
      return `Take the ${camelName(a.color).toLowerCase()} ${view.legStacks[a.color][0] ?? ''} ticket`;
    case 'roll':
      return 'Take a pyramid ticket and roll';
    case 'placeSpectator':
      return `Put your tile on space ${a.space}`;
    case 'bet':
      return `Bet ${camelName(a.color).toLowerCase()} to ${a.pile === 'winner' ? 'win' : 'lose'} the race`;
    case 'partner':
      return `Partner with ${view.players[a.with]?.name ?? 'them'} for the rest of this leg`;
  }
}

export interface ActionBarProps {
  view: CamelUpView;
  seat: number | null;
  myTurn: boolean;
  raceOver: boolean;
  canAct: boolean;
  busy: boolean;
  pending: boolean;
  selected: CamelUpAction | null;
  betPile: Pile | null;
  tileMode: boolean;
  canPlaceTile: boolean;
  /** Seats you could partner with right now (6+ players, both cards available). */
  partnerChoices: number[];
  partnerMode: boolean;
  hand: RacingColor[];
  onPick: (a: CamelUpAction) => void;
  onBetPile: (p: Pile) => void;
  onTileMode: () => void;
  onPartnerMode: () => void;
  onSide: (s: Side) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSkip: () => void;
}

/**
 * Turn status and the select → confirm flow. On a laptop you act on the board
 * itself; on a phone the board is small, so the bar also offers every action
 * as a full-size button.
 */
export function ActionBar(props: ActionBarProps) {
  const { view, seat, myTurn, raceOver, canAct, busy, pending, selected, betPile, tileMode } =
    props;
  const { partnerChoices, partnerMode } = props;
  const canPartner = partnerChoices.length > 0;
  const turnName = view.players[view.turn]?.name ?? '';
  let status: string;
  if (raceOver) status = 'The race is over';
  else if (seat === null) status = `Watching · ${turnName}’s turn`;
  else if (myTurn) status = 'Your turn · pick one action';
  else status = `${turnName}’s turn`;
  const choosing = !selected && !betPile && !tileMode && !partnerMode;

  return (
    <div
      className={cn('border bg-ink-1 px-4 py-3', myTurn ? 'border-yellow' : 'border-rule')}
      data-testid="action-bar"
    >
      <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2">
        <span data-your-turn className={cn('font-bold', myTurn && 'text-yellow')}>
          {status}
        </span>
        {myTurn && choosing && (
          <span className="hidden text-mute text-sm md:inline">
            Tap a ticket, the pyramid, a glowing space, or a bet pile
            {canPartner ? ', or partner up.' : '.'}
          </span>
        )}
        {myTurn && tileMode && !selected && (
          <span className="text-dim text-sm">Tap a glowing space for your tile.</span>
        )}
        {myTurn && partnerMode && !selected && (
          <span className="text-dim text-sm">
            Pick a partner for the rest of this leg. At scoring, you each also score one of the
            other’s tickets.
          </span>
        )}
        {selected && (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{describeAction(selected, view)}</span>
            {selected.type === 'placeSpectator' && (
              <span className="flex">
                {(['cheer', 'boo'] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => props.onSide(side)}
                    aria-pressed={selected.side === side}
                    className={cn(
                      'label border px-2 py-1.5',
                      selected.side === side ? 'border-paper text-paper' : 'border-rule',
                    )}
                  >
                    {side === 'cheer' ? '+1 cheer' : '−1 boo'}
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {busy && (
            <Button size="sm" variant="quiet" onClick={props.onSkip}>
              Skip ▸▸
            </Button>
          )}
          {myTurn && choosing && canPartner && (
            <Button
              size="sm"
              variant="ghost"
              className="max-md:hidden"
              onClick={props.onPartnerMode}
              disabled={!canAct}
              data-testid="partner"
            >
              Partner
            </Button>
          )}
          {myTurn && choosing && (
            <Button
              size="sm"
              variant="ghost"
              className="max-md:hidden"
              onClick={() => props.onPick({ type: 'roll' })}
              disabled={!canAct || view.pyramidTicketsLeft === 0}
              data-testid="roll"
            >
              Roll
            </Button>
          )}
          {!selected && !betPile && !tileMode && !partnerMode && <RulesButton />}
          {(selected || betPile || tileMode || partnerMode) && (
            <Button size="sm" variant="quiet" onClick={props.onCancel} data-own-enter>
              Cancel
            </Button>
          )}
          {selected && (
            <Button
              size="sm"
              onClick={props.onConfirm}
              disabled={busy || pending}
              data-testid="confirm"
              data-own-enter
            >
              {pending ? '…' : 'Confirm ↵'}
            </Button>
          )}
        </span>
      </div>

      {myTurn && betPile && !selected && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="label">Overall</span>
          <span className="flex">
            {(['winner', 'loser'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => props.onBetPile(p)}
                aria-pressed={betPile === p}
                className={cn(
                  'label border px-2 py-1.5',
                  betPile === p ? 'border-paper text-paper' : 'border-rule',
                )}
              >
                {p}
              </button>
            ))}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {props.hand.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => props.onPick({ type: 'bet', pile: betPile, color: c })}
                className="flex items-center gap-1.5 border border-rule-strong px-2 py-1.5 hover:border-paper"
                aria-label={`Bet ${CAMEL_STYLE[c].label}`}
              >
                <span className="size-3 rounded-full" style={{ background: CAMEL_STYLE[c].fill }} />
                <span className="label">{c}</span>
              </button>
            ))}
          </span>
        </div>
      )}

      {myTurn && partnerMode && !selected && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="partner-picker">
          <span className="label">Partner with</span>
          {partnerChoices.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => props.onPick({ type: 'partner', with: s })}
              className="label border border-teal/60 px-3 py-1.5 text-teal hover:bg-teal hover:text-ink-0"
            >
              {view.players[s]?.name ?? `Seat ${s + 1}`}
            </button>
          ))}
        </div>
      )}

      {myTurn && choosing && (
        <div className="mt-3 grid gap-2 md:hidden" data-testid="action-picker">
          <div className="grid grid-cols-5 gap-1.5">
            {RACING.map((c) => {
              const top = view.legStacks[c][0];
              return (
                <button
                  key={c}
                  type="button"
                  disabled={!canAct || top === undefined}
                  onClick={() => props.onPick({ type: 'takeTicket', color: c })}
                  className="flex h-12 items-center justify-center rounded-[4px] font-extrabold text-ink-0 text-lg disabled:opacity-30"
                  style={{ background: CAMEL_STYLE[c].fill }}
                  aria-label={
                    top === undefined
                      ? `No ${CAMEL_STYLE[c].label} tickets left`
                      : `Take the ${CAMEL_STYLE[c].label} ticket worth ${top}`
                  }
                >
                  {top ?? '–'}
                </button>
              );
            })}
          </div>
          <div className={cn('grid gap-1.5', canPartner ? 'grid-cols-4' : 'grid-cols-3')}>
            <Button
              variant="ghost"
              disabled={!canAct || view.pyramidTicketsLeft === 0}
              onClick={() => props.onPick({ type: 'roll' })}
            >
              Roll
            </Button>
            <Button
              variant="ghost"
              disabled={!canAct || !props.canPlaceTile}
              onClick={props.onTileMode}
            >
              Tile
            </Button>
            <Button
              variant="ghost"
              disabled={!canAct || props.hand.length === 0}
              onClick={() => props.onBetPile('winner')}
            >
              Bet
            </Button>
            {canPartner && (
              <Button variant="ghost" disabled={!canAct} onClick={props.onPartnerMode}>
                Partner
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
