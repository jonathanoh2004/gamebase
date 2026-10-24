'use client';

import { COVERS } from '@/games/client';

export function CoverFrame({ gameId }: { gameId: string }) {
  const Cover = COVERS[gameId];
  return (
    <div className="aspect-[16/10] w-full overflow-hidden border border-rule">
      {Cover ? <Cover active /> : null}
    </div>
  );
}
