import { redirect } from 'next/navigation';
import { SimplePage } from '@/components/simple-page';
import { getViewer, isMemberRole } from '@/lib/auth/viewer';
import { safeNextPath } from '@/lib/http/safe-redirect';
import { WelcomeForm } from './welcome-form';

export default async function WelcomePage(props: PageProps<'/welcome'>) {
  const params = await props.searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  const viewer = await getViewer();
  if (!viewer) redirect('/signin');
  if (!isMemberRole(viewer.profile.role)) redirect('/pending');
  // Suggest a name from the identity provider; only its owner ever sees it.
  const suggested = (viewer.suggestedName ?? '').split(/\s+/)[0]?.slice(0, 24) ?? '';
  return (
    <SimplePage index="00 · Welcome" title="Pick your name">
      <WelcomeForm
        next={next}
        suggested={viewer.profile.displayName || suggested}
        avatarSeed={viewer.profile.avatarSeed}
        color={viewer.profile.color}
      />
    </SimplePage>
  );
}
