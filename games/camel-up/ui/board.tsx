'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { toast } from '@/components/ui/toast';
import type { BoardProps } from '@/games/client';
import { ApiError } from '@/lib/client/api';
import { useFramePlayer } from '@/lib/client/use-frame-player';
import { Piece, Stage } from '@/lib/motion/stage';
import { canPlaceSpectator } from '../engine/track';
import {
  type CamelUpAction,
  type CamelUpEvent,
  type CamelUpView,
  PARTNERSHIP_MIN_PLAYERS,
  type Pile,
  RACING,
  type RacingColor,
  TRACK_LENGTH,
} from '../engine/types';
import { ActionBar } from './action-bar';
import { BoardArt } from './art';
import { Camel } from './camel';
import { makePlan, type Overlay } from './choreography';
import { describeEvent } from './describe';
import {
  INFIELD,
  LOSER_PILE,
  PYRAMID_CENTER,
  PYRAMID_TICKETS_AT,
  raceFacing,
  STAGE_H,
  STAGE_W,
  TENT_H,
  TENT_W,
  TILE_H,
  TILE_W,
  tentRect,
  tileRect,
  WINNER_PILE,
} from './geometry';
import { CAMEL_SCALE, camelSpaces, layoutCamelUp } from './layout';
import { BoardOverlay } from './overlay';
import { CAMEL_STYLE } from './palette';
import { PlayerPanel } from './panels';
import { CardBack, Die, PyramidToken, SpectatorTile, Ticket } from './pieces';
import { Pyramid } from './pyramid';

// Board and action bar always fit the viewport: the stage is as wide as the
// height left over after the page chrome (--board-chrome) allows.
const BOARD_MAX_W = `max(300px, calc((100dvh - var(--board-chrome, 210px)) * ${STAGE_W / STAGE_H}))`;

export function CamelUpBoard({ session, players, mode }: BoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<number | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState<CamelUpAction | null>(null);
  const [betPile, setBetPile] = useState<Pile | null>(null);
  const [tileMode, setTileMode] = useState(false);
  const [pending, setPending] = useState(false);
  const clear = useCallback(() => {
    setSelected(null);
    setBetPile(null);
    setTileMode(false);
  }, []);

  const plan = useMemo(
    () => makePlan({ root: () => rootRef.current, setOverlay, you: () => youRef.current }),
    [],
  );
  const namesRef = useRef<(seat: number) => string>(() => '');
  const onFrame = useCallback((frame: { event: CamelUpEvent | null }) => {
    if (!frame.event) return;
    const line = describeEvent(frame.event, namesRef.current, youRef.current);
    if (line) setLog((l) => [line, ...l].slice(0, 30));
  }, []);

  const { view, seat, busy, stageRef, skip } = useFramePlayer<CamelUpView, CamelUpEvent>(session, {
    layout: layoutCamelUp,
    plan,
    onFrame,
  });
  youRef.current = seat;
  namesRef.current = (s: number) => view?.players[s]?.name ?? `Seat ${s + 1}`;

  // The engine stays in 'playing' through the final scoring; a crossed unit ends the race.
  const raceOver = !!view && (view.phase === 'finished' || view.crossed !== null);
  const myTurn = !!view && !raceOver && seat !== null && view.turn === seat;
  const canAct = myTurn && !busy && !pending;

  // Drop stale selections whenever the turn or view moves on.
  useEffect(() => {
    if (!canAct) clear();
  }, [canAct, clear]);

  const confirm = useCallback(async () => {
    if (!selected || !canAct) return;
    setPending(true);
    try {
      await session.act(selected);
      clear();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : (err as Error).message, 'bad');
    } finally {
      setPending(false);
    }
  }, [selected, canAct, session, clear]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clear();
      } else if (
        e.key === 'Enter' &&
        selected &&
        // Confirm/Cancel and form fields keep their own Enter behavior.
        !(e.target as HTMLElement | null)?.closest('input, textarea, select, [data-own-enter]')
      ) {
        e.preventDefault();
        void confirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, confirm, clear]);

  // Flag the tab when it becomes your turn while you're elsewhere.
  useEffect(() => {
    if (!myTurn || mode !== 'live') return;
    const base = document.title;
    if (document.hidden) document.title = '● Your turn · Gamebase';
    const reset = () => {
      if (!document.hidden) document.title = base.replace('● Your turn · ', '');
    };
    document.addEventListener('visibilitychange', reset);
    return () => {
      document.removeEventListener('visibilitychange', reset);
      document.title = base.replace('● Your turn · ', '');
    };
  }, [myTurn, mode]);

  const legalSpaces = useMemo(() => {
    if (!view || seat === null) return new Set<number>();
    const out = new Set<number>();
    for (let s = 2; s <= TRACK_LENGTH; s++) if (canPlaceSpectator(view, seat, s)) out.add(s);
    return out;
  }, [view, seat]);

  if (!view) {
    return (
      <div className="flex aspect-[1200/800] w-full items-center justify-center border border-rule">
        <span className="label animate-pulse">Setting up the table…</span>
      </div>
    );
  }

  const me = seat !== null ? view.players[seat] : null;
  const positions = camelSpaces(view);
  const pieces = layoutCamelUp(view);
  const selectedSpace = selected?.type === 'placeSpectator' ? selected.space : null;
  const showSpaces = canAct && (selected?.type === 'placeSpectator' || selected === null);
  const strongSpaces = canAct && tileMode;
  const partnersAllowed = view.players.length >= PARTNERSHIP_MIN_PLAYERS;

  const pick = (a: CamelUpAction) => {
    if (!canAct) return;
    setBetPile(null);
    if (a.type !== 'placeSpectator') setTileMode(false);
    setSelected(a);
  };

  return (
    <div
      ref={rootRef}
      className="grid gap-4 xl:grid-cols-[1fr_320px]"
      data-testid="camel-up"
      // Public state only, for tests and tooling.
      data-leg={view.leg}
      data-turn={view.turn}
      data-rolled={view.rolled.length}
      data-over={raceOver || undefined}
    >
      <div className="mx-auto w-full min-w-0 space-y-3" style={{ maxWidth: BOARD_MAX_W }}>
        <div className="relative">
          <Stage
            ref={stageRef}
            width={STAGE_W}
            height={STAGE_H}
            className="border border-rule"
            label="Camel Up board"
          >
            <BoardArt highlight={showSpaces ? legalSpaces : new Set()} strong={strongSpaces} />

            {/* track spaces as click targets for the spectator tile */}
            {Array.from({ length: TRACK_LENGTH }, (_, i) => i + 1).map((space) => {
              const r = tileRect(space);
              const legal = canAct && legalSpaces.has(space);
              return (
                <button
                  key={space}
                  type="button"
                  disabled={!legal}
                  aria-label={
                    legal ? `Place your spectator tile on space ${space}` : `Space ${space}`
                  }
                  onClick={() =>
                    pick({
                      type: 'placeSpectator',
                      space,
                      side: selected?.type === 'placeSpectator' ? selected.side : 'cheer',
                    })
                  }
                  className={cn(
                    'absolute cursor-default disabled:pointer-events-none',
                    legal && 'cursor-pointer hover:bg-yellow/10',
                    selectedSpace === space && 'bg-yellow/15 outline-2 outline-yellow',
                  )}
                  style={{ left: r.x + 3, top: r.y + 3, width: r.w - 6, height: r.h - 6 }}
                />
              );
            })}

            {/* ticket tents */}
            {RACING.map((color) => {
              const r = tentRect(color);
              const stack = view.legStacks[color];
              const legal = canAct && stack.length > 0;
              const chosen = selected?.type === 'takeTicket' && selected.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  data-tent={color}
                  disabled={!legal}
                  onClick={() => pick({ type: 'takeTicket', color })}
                  aria-label={
                    stack.length
                      ? `Take the ${CAMEL_STYLE[color].label} ticket worth ${stack[0]}`
                      : `No ${CAMEL_STYLE[color].label} tickets left`
                  }
                  className={cn(
                    'absolute flex items-center justify-center rounded-[6px] border transition-transform duration-200',
                    legal
                      ? 'cursor-pointer border-rule-strong hover:-translate-y-1'
                      : 'cursor-default border-rule',
                    chosen && 'outline-2 outline-yellow outline-offset-2 -translate-y-1',
                    raceOver && 'opacity-35',
                  )}
                  style={{
                    left: r.x,
                    top: r.y,
                    width: TENT_W,
                    height: TENT_H,
                    background: '#241c13',
                  }}
                >
                  {stack.length === 0 ? (
                    <span className="label">empty</span>
                  ) : (
                    <span className="relative">
                      {stack.slice(1).map((v, i) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: stack depth
                          key={i}
                          className="absolute top-0 left-0 opacity-60"
                          style={{ transform: `translate(${(i + 1) * 3}px, ${(i + 1) * 3}px)` }}
                        >
                          <Ticket color={color} value={v} />
                        </span>
                      ))}
                      <span data-top-ticket className="relative block">
                        <Ticket color={color} value={stack[0] ?? 0} />
                      </span>
                    </span>
                  )}
                </button>
              );
            })}

            {/* overall winner / loser piles */}
            {(
              [
                ['winner', WINNER_PILE, view.winnerPile],
                ['loser', LOSER_PILE, view.loserPile],
              ] as const
            ).map(([pile, r, cards]) => {
              const legal = canAct && (me?.hand?.length ?? 0) > 0;
              return (
                <div
                  key={pile}
                  className="absolute"
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                  data-pile={pile}
                >
                  <button
                    type="button"
                    disabled={!legal}
                    onClick={() => {
                      setSelected(null);
                      setTileMode(false);
                      setBetPile((p) => (p === pile ? null : pile));
                    }}
                    aria-label={`Bet on the overall ${pile}`}
                    className={cn(
                      'absolute inset-0 flex items-end gap-1 p-3 pt-7',
                      legal && 'cursor-pointer hover:bg-yellow/5',
                      betPile === pile && 'bg-yellow/10 outline-2 outline-yellow',
                    )}
                  >
                    <span className="relative flex" data-pile-top>
                      {cards.length === 0 ? (
                        <span className="label">no bets</span>
                      ) : (
                        cards.slice(-6).map((c, i) => (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: placement order
                            key={i}
                            className="-ml-6 first:ml-0"
                            style={{ zIndex: i }}
                          >
                            <CardBack owner={players[c.seat]?.color ?? 'yellow'} color={c.color} />
                          </span>
                        ))
                      )}
                    </span>
                    {cards.length > 0 && <span className="label ml-auto">×{cards.length}</span>}
                  </button>
                </div>
              );
            })}

            {/* pyramid, tickets and dice tents */}
            <button
              type="button"
              disabled={!canAct || view.pyramidTicketsLeft === 0}
              onClick={() => pick({ type: 'roll' })}
              aria-label="Take a pyramid ticket and roll a die"
              className={cn(
                'absolute rounded-full',
                canAct && 'cursor-pointer',
                selected?.type === 'roll' && 'outline-2 outline-yellow outline-offset-8',
              )}
              style={{
                left: PYRAMID_CENTER.x - 84,
                top: PYRAMID_CENTER.y - 92,
                width: 168,
                height: 150,
              }}
              data-testid="pyramid"
            >
              <Pyramid size={168} />
            </button>
            <div
              data-pyramid-tickets
              className="absolute flex items-end"
              style={{ left: PYRAMID_TICKETS_AT.x - 22, top: PYRAMID_TICKETS_AT.y - 26 }}
              role="img"
              aria-label={`${view.pyramidTicketsLeft} pyramid tickets left`}
            >
              {Array.from({ length: view.pyramidTicketsLeft }, (_, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: identical tokens
                  key={i}
                  data-top-token={i === view.pyramidTicketsLeft - 1 ? '' : undefined}
                  className="-ml-7 first:ml-0"
                  style={{ transform: `translateY(${-i * 3}px)` }}
                >
                  <PyramidToken />
                </span>
              ))}
            </div>
            <div className="label absolute" style={{ left: INFIELD.x + 32, top: INFIELD.y + 26 }}>
              Leg {view.leg} · {5 - view.pyramidTicketsLeft}/5 dice
            </div>
            {Array.from({ length: 5 }, (_, i) => {
              const at = {
                x: INFIELD.x + 430 + (i % 3) * 78,
                y: INFIELD.y + 96 + Math.floor(i / 3) * 92,
              };
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
                  key={i}
                  className="absolute rounded-[6px] border border-sand-2/25 border-dashed"
                  style={{ left: at.x - 31, top: at.y - 31, width: 62, height: 62 }}
                />
              );
            })}

            {/* preview of the tile you're about to place */}
            {selected?.type === 'placeSpectator' && seat !== null && (
              <div
                className="pointer-events-none absolute opacity-60"
                style={{
                  left: tileRect(selected.space).x + TILE_W / 2,
                  top: tileRect(selected.space).y + TILE_H / 2 + 18,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 5,
                }}
                aria-hidden="true"
              >
                <SpectatorTile side={selected.side} owner={players[seat]?.color ?? 'yellow'} />
              </div>
            )}

            {/* moving pieces */}
            {view.players.map((p, owner) =>
              p.spectator && pieces[`tile-${owner}`] ? (
                <Piece
                  // biome-ignore lint/suspicious/noArrayIndexKey: one tile per seat, seats are fixed
                  key={`tile-${owner}`}
                  id={`tile-${owner}`}
                  place={pieces[`tile-${owner}`] ?? { x: 0, y: 0 }}
                >
                  <SpectatorTile
                    side={p.spectator.side}
                    owner={players[owner]?.color ?? 'yellow'}
                  />
                </Piece>
              ) : null,
            )}
            {view.rolled.map((d) => (
              <Piece
                key={`die-${d.die}`}
                id={`die-${d.die}`}
                place={pieces[`die-${d.die}`] ?? { x: 0, y: 0 }}
              >
                <Die die={d.die} value={d.value} face={d.face} />
              </Piece>
            ))}
            {[...positions.entries()].map(([camel, at]) => {
              const crazy = camel === 'white' || camel === 'black';
              const facing = raceFacing(at.crossed ? 1 : at.space);
              return (
                <Piece
                  key={camel}
                  id={`camel-${camel}`}
                  place={pieces[`camel-${camel}`] ?? { x: 0, y: 0 }}
                >
                  <div data-camel={camel} style={{ transformOrigin: 'bottom center' }}>
                    <Camel
                      camel={camel}
                      size={CAMEL_SCALE}
                      facing={crazy ? (facing === 'left' ? 'right' : 'left') : facing}
                    />
                  </div>
                </Piece>
              );
            })}

            <BoardOverlay overlay={overlay} view={view} onClose={() => setOverlay(null)} />
          </Stage>
        </div>

        <ActionBar
          view={view}
          seat={seat}
          myTurn={myTurn}
          raceOver={raceOver}
          canAct={canAct}
          busy={busy}
          pending={pending}
          selected={selected}
          betPile={betPile}
          tileMode={tileMode}
          canPlaceTile={legalSpaces.size > 0}
          hand={me?.hand ?? []}
          onPick={pick}
          onBetPile={(p) => {
            setSelected(null);
            setTileMode(false);
            setBetPile(p);
          }}
          onTileMode={() => {
            setSelected(null);
            setTileMode(true);
          }}
          onSide={(side) =>
            selected?.type === 'placeSpectator' && setSelected({ ...selected, side })
          }
          onConfirm={confirm}
          onCancel={clear}
          onSkip={skip}
        />
      </div>

      <aside className="grid grid-cols-2 content-start gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-1">
        {view.players.map((_, s) => (
          <PlayerPanel
            // biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed for a match
            key={s}
            view={view}
            seat={s}
            player={players[s]}
            canPartner={
              canAct &&
              partnersAllowed &&
              s !== seat &&
              me?.partner === null &&
              view.players[s]?.partner === null
            }
            onPartner={() => pick({ type: 'partner', with: s })}
            onPickBet={
              s === seat && canAct
                ? (color: RacingColor) =>
                    setSelected({ type: 'bet', pile: betPile ?? 'winner', color })
                : undefined
            }
          />
        ))}
        <section className="col-span-full border border-rule bg-ink-1 p-3" aria-label="Game log">
          <h3 className="label mb-2">Log</h3>
          <ol className="max-h-56 space-y-1 overflow-auto text-dim text-sm" aria-live="polite">
            {log.length === 0 && <li className="text-mute">The race is about to start.</li>}
            {log.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
              <li key={`${i}-${line}`} className={i === 0 ? 'text-paper' : undefined}>
                {line}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
