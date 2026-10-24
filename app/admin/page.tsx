import { SiteHeader } from '@/components/site-header';
import { requirePageOwner } from '@/lib/auth/pages';
import { listOpenInvites } from '@/lib/server/invites';
import { listMembers } from '@/lib/server/members';
import { AdminClient } from './admin-client';

export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  const viewer = await requirePageOwner('/admin');
  const [members, invites] = await Promise.all([listMembers(), listOpenInvites()]);
  return (
    <>
      <SiteHeader viewer={viewer} crumb="Admin" />
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <h1 className="mb-2 font-extrabold text-4xl tracking-[-0.03em]">Admin</h1>
        <p className="mb-8 text-dim">Who’s in, and the links that let people in.</p>
        <AdminClient
          members={members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          invites={invites.map((i) => ({
            id: i.id,
            createdBy: i.createdBy,
            expiresAt: i.expiresAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
