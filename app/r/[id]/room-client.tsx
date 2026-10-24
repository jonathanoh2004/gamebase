'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { useClientConfig } from '@/components/providers';
import { cn } from '@/components/ui/cn';
import { BOARDS } from '@/games/client';
import { RoomController } from '@/lib/client/room-controller';
import type { RoomView } from '@/lib/server/rooms';
import { Lobby } from './lobby';
import { Results } from './results';

export function RoomClient({
  initial,
  me,
  gameName,
}: {
  initial: RoomView;
  me: { name: string };
  gameName: string;
}) {
  const config = useClientConfig();
  const [controller] = useState(() => new RoomController(config, initial, me));
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const room = useStore(controller.store, (s) => s.room);
  const channel = useStore(controller.store, (s) => s.channel);

  if (room.status === 'abandoned') {
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <span className="label">Room {room.code}</span>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">This room was closed.</h1>
        <Link href="/" className="label mt-6 inline-block hover:text-paper">
          ← Back to the library
        </Link>
      </main>
    );
  }

  const inGame = room.match && (room.status === 'playing' || room.status === 'finished');
  const Board = BOARDS[room.gameId];
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-rule border-b py-4">
        <h1 className="font-extrabold text-2xl tracking-[-0.03em]">{gameName}</h1>
        <span className="label">Room {room.code}</span>
        <span className="label">
          {room.status === 'lobby' ? 'Lobby' : room.status === 'playing' ? 'Playing' : 'Finished'}
        </span>
        <span
          className={cn(
            'label ml-auto flex items-center gap-2',
            channel === 'live' ? 'text-green' : channel === 'down' ? 'text-red' : 'text-mute',
          )}
          title="Live connection"
          data-testid="channel-status"
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              channel === 'live'
                ? 'bg-green'
                : channel === 'down'
                  ? 'bg-red'
                  : 'animate-pulse bg-mute',
            )}
          />
          {channel === 'live' ? 'live' : channel === 'down' ? 'offline · retrying' : 'connecting'}
        </span>
      </div>
      {inGame && room.match && Board ? (
        <div className="space-y-6 pt-6">
          {room.match.players.every((p) => !p.isYou) && (
            <p className="label text-teal">Watching as a spectator</p>
          )}
          <Board session={controller} players={room.match.players} mode="live" />
          {room.status === 'finished' && <Results room={room} controller={controller} />}
        </div>
      ) : (
        <Lobby room={room} controller={controller} />
      )}
    </main>
  );
}
