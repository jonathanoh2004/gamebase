import { redirect } from 'next/navigation';
import { SignOutButton, SimplePage } from '@/components/simple-page';
import { getViewer } from '@/lib/auth/viewer';

export default async function RevokedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/signin');
  if (viewer.profile.role !== 'revoked') redirect('/');
  return (
    <SimplePage index="00 · Access" title="Your access was removed">
      <p>
        The owner of this Gamebase removed your account’s access. If that’s a mistake, ask them.
      </p>
      <SignOutButton />
    </SimplePage>
  );
}
