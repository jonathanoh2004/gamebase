import { SiteHeader } from '@/components/site-header';
import { MANIFESTS } from '@/games/manifests';
import { requirePageMember } from '@/lib/auth/pages';
import { showDevTools } from '@/lib/env';
import { listMyRooms } from '@/lib/server/rooms';
import { Library } from './library';

export default async function Home() {
  const viewer = await requirePageMember('/');
  const rooms = await listMyRooms(viewer);
  const games = MANIFESTS.filter((m) => !m.devOnly || showDevTools());
  return (
    <>
      <SiteHeader viewer={viewer} />
      <main>
        <Library
          games={games}
          rooms={rooms.map((r) => ({ id: r.id, code: r.code, gameId: r.gameId, status: r.status }))}
          name={viewer.profile.displayName}
        />
      </main>
    </>
  );
}
