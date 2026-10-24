import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { manifestFor } from '@/games/manifests';
import { requirePageMember } from '@/lib/auth/pages';
import { HttpError } from '@/lib/http/errors';
import { getRoomView, type RoomView } from '@/lib/server/rooms';
import { RoomClient } from './room-client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const metadata = { title: 'Room' };

export default async function RoomPage(props: PageProps<'/r/[id]'>) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const viewer = await requirePageMember(`/r/${id}`);
  let room: RoomView;
  try {
    room = await getRoomView(viewer, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const game = manifestFor(room.gameId);
  return (
    <>
      <SiteHeader viewer={viewer} crumb={`${game?.name ?? room.gameId} · ${room.code}`} />
      <RoomClient
        initial={room}
        me={{ name: viewer.profile.displayName }}
        gameName={game?.name ?? room.gameId}
      />
    </>
  );
}
