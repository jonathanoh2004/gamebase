import { redirect } from 'next/navigation';
import { SignOutButton, SimplePage } from '@/components/simple-page';
import { getViewer, isMemberRole } from '@/lib/auth/viewer';

export default async function PendingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/signin');
  if (isMemberRole(viewer.profile.role)) redirect('/');
  return (
    <SimplePage index="00 · Invite only" title="You need an invite">
      <p>
        You’re signed in, but Gamebase is invite-only. Ask a friend who’s already a member to send
        you an invite link, then open it here.
      </p>
      <SignOutButton />
    </SimplePage>
  );
}
