'use client';

import { animate, stagger } from 'animejs';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Wordmark } from '@/components/wordmark';
import { COVERS } from '@/games/client';
import type { GameManifest } from '@/games/manifests';
import { useReducedMotion } from '@/lib/motion/reduced';
import { useAnimeScope } from '@/lib/motion/use-scope';

interface MyRoom {
  id: string;
  code: string;
  gameId: string;
  status: string;
}

export function Library({
  games,
  rooms,
  name,
}: {
  games: GameManifest[];
  rooms: MyRoom[];
  name: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useAnimeScope(root, () => {
    if (reduced || !root.current) return;
    animate(root.current.querySelectorAll('[data-rise]'), {
      opacity: [0, 1],
      y: [24, 0],
      duration: 640,
      ease: 'out(4)',
      delay: stagger(70, { start: 450 }),
    });
  }, [reduced]);

  const slots = Math.max(0, 3 - games.length);
  return (
    <div ref={root} className="mx-auto max-w-[1440px] px-4 pb-24 sm:px-6">
      <section className="grid gap-10 border-rule border-b py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:py-20">
        <Wordmark />
        <div data-rise className="max-w-sm space-y-4 lg:pb-4">
          <p className="label">Hello, {name}</p>
          <p className="text-dim text-lg leading-relaxed">
            Pick a game, open a room, send the link. Everyone at the table sees every move happen.
          </p>
        </div>
      </section>

      {rooms.length > 0 && (
        <section data-rise className="border-rule border-b py-8">
          <h2 className="label mb-4">01 · Your rooms</h2>
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => {
              const game = games.find((g) => g.id === r.gameId);
              return (
                <Link
                  key={r.id}
                  href={`/r/${r.id}`}
                  className="group flex items-center gap-3 border border-rule px-4 py-3 hover:border-paper"
                >
                  <span className="font-bold">{game?.name ?? r.gameId}</span>
                  <span className="label">{r.code}</span>
                  <span
                    className={`label ${r.status === 'playing' ? 'text-green' : r.status === 'lobby' ? 'text-yellow' : ''}`}
                  >
                    {r.status === 'playing' ? '● live' : r.status}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="py-10">
        <h2 data-rise className="label mb-6">
          {rooms.length > 0 ? '02' : '01'} · Library
        </h2>
        <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2 xl:grid-cols-3">
          {games.map((g, i) => (
            <GameCard key={g.id} game={g} index={i + 1} />
          ))}
          {Array.from({ length: slots }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder slots
              key={i}
              data-rise
              className="flex min-h-[360px] flex-col justify-between bg-ink-0 p-6"
            >
              <span className="label">
                {String(games.length + i + 1).padStart(2, '0')} · Open slot
              </span>
              <p className="max-w-[16rem] text-mute">
                The next game goes here. Send Claude a rulebook and some photos.
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function GameCard({ game, index }: { game: GameManifest; index: number }) {
  const [active, setActive] = useState(false);
  const Cover = COVERS[game.id];
  return (
    <Link
      href={`/games/${game.id}`}
      data-rise
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className="group flex flex-col bg-ink-0 outline-offset-[-2px]"
    >
      <div className="aspect-[16/10] overflow-hidden border-rule border-b">
        {Cover ? <Cover active={active} /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="label">{String(index).padStart(2, '0')}</span>
          {game.devOnly && <span className="label text-teal">dev only</span>}
        </div>
        <h3 className="font-extrabold text-3xl tracking-[-0.03em] group-hover:text-yellow">
          {game.name}
        </h3>
        <p className="text-dim">{game.tagline}</p>
        <p className="label mt-auto">
          {game.players.label} · {game.minutes} min · {game.tags.join(' · ')}
        </p>
      </div>
    </Link>
  );
}
