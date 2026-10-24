import Link from 'next/link';
import { SimplePage } from '@/components/simple-page';
import { getViewer } from '@/lib/auth/viewer';
import { peekInvite } from '@/lib/server/invites';
import { AcceptInvite } from './accept';

export const metadata = { title: 'Invite' };

export default async function InvitePage(props: PageProps<'/invite/[token]'>) {
  const { token } = await props.params;
  const invite = await peekInvite(token);
  if (!invite) {
    return (
      <SimplePage index="00 · Invite" title="This link has expired">
        <p>Invite links work once and only for 48 hours. Ask your friend for a fresh one.</p>
      </SimplePage>
    );
  }
  const viewer = await getViewer();
  const next = `/invite/${token}`;
  return (
    <SimplePage index="00 · Invite" title={`${invite.inviter} invited you`}>
      <p>
        Gamebase is a private place to play board games with friends
        {invite.hasRoom ? ', and there’s a table waiting for you.' : '.'}
      </p>
      {viewer ? (
        viewer.profile.role === 'revoked' ? (
          <p className="text-red">Your access was removed, so this invite can’t be used.</p>
        ) : (
          <AcceptInvite token={token} />
        )
      ) : (
        <Link
          href={`/signin?next=${encodeURIComponent(next)}`}
          className="inline-flex h-12 w-full items-center justify-center bg-paper font-mono text-[13px] text-ink-0 uppercase tracking-[0.08em] hover:bg-yellow"
        >
          Sign in to accept
        </Link>
      )}
    </SimplePage>
  );
}
