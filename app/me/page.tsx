import { SiteHeader } from '@/components/site-header';
import { requirePageMember } from '@/lib/auth/pages';
import { ProfileForm } from './profile-form';

export const metadata = { title: 'Profile' };

export default async function MePage() {
  const viewer = await requirePageMember('/me');
  return (
    <>
      <SiteHeader viewer={viewer} crumb="Profile" />
      <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <h1 className="mb-8 font-extrabold text-4xl tracking-[-0.03em]">Profile</h1>
        <ProfileForm
          name={viewer.profile.displayName}
          color={viewer.profile.color}
          avatarSeed={viewer.profile.avatarSeed}
          email={viewer.email}
          isOwner={viewer.profile.role === 'owner'}
        />
      </main>
    </>
  );
}
