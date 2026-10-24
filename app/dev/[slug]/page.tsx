import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { manifestFor } from '@/games/manifests';
import { requirePageMember } from '@/lib/auth/pages';
import { showDevTools } from '@/lib/env';
import { Sandbox } from './sandbox';

export const metadata = { title: 'Sandbox' };

// DEV ONLY: answers 404 on production deployments.
export default async function SandboxPage(props: PageProps<'/dev/[slug]'>) {
  if (!showDevTools()) notFound();
  const { slug } = await props.params;
  const viewer = await requirePageMember(`/dev/${slug}`);
  const game = manifestFor(slug);
  if (!game) notFound();
  return (
    <>
      <SiteHeader viewer={viewer} crumb={`${game.name} · sandbox`} />
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <Sandbox gameId={game.id} min={game.players.min} max={game.players.max} />
      </main>
    </>
  );
}
