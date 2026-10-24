import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { CAMEL_UP_HOWTO } from '@/games/camel-up/howto';
import { manifestFor } from '@/games/manifests';
import { requirePageMember } from '@/lib/auth/pages';
import { showDevTools } from '@/lib/env';
import { CoverFrame } from './cover-frame';
import { CreateRoom } from './create-room';

const HOWTO: Record<string, string[]> = { 'camel-up': CAMEL_UP_HOWTO };

export default async function GamePage(props: PageProps<'/games/[slug]'>) {
  const { slug } = await props.params;
  const viewer = await requirePageMember(`/games/${slug}`);
  const game = manifestFor(slug);
  if (!game || (game.devOnly && !showDevTools())) notFound();
  const howto = HOWTO[game.id] ?? [];

  return (
    <>
      <SiteHeader viewer={viewer} crumb={game.name} />
      <main className="mx-auto grid max-w-[1440px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:py-16">
        <div className="space-y-6">
          <CoverFrame gameId={game.id} />
          <p className="label">
            {game.players.label} · {game.minutes} min · {game.tags.join(' · ')}
          </p>
        </div>
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="font-extrabold text-[clamp(2.75rem,6vw,5rem)] leading-[0.95] tracking-[-0.04em]">
              {game.name}
            </h1>
            <p className="mt-4 text-dim text-lg leading-relaxed">{game.blurb}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CreateRoom gameId={game.id} />
            {showDevTools() && (
              <a
                href={`/dev/${game.id}`}
                className="label border border-rule px-4 py-3 hover:border-paper hover:text-paper"
              >
                Dev sandbox
              </a>
            )}
          </div>
          {howto.length > 0 && (
            <section>
              <h2 className="label mb-4">How it plays</h2>
              <ol className="space-y-3">
                {howto.map((line, i) => (
                  <li
                    key={line}
                    className="grid grid-cols-[2.25rem_1fr] gap-2 border-rule border-t pt-3"
                  >
                    <span className="label pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-dim">{line}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
