import 'server-only';
import { redirect } from 'next/navigation';
import { getViewer, isMemberRole, type Viewer } from './viewer';

// Page-level gates for server components. API routes use lib/http/route.ts.

/** Signed-in members with a display name; everyone else is sent where they belong. */
export async function requirePageMember(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(next)}`);
  if (viewer.profile.role === 'revoked') redirect('/revoked');
  if (!isMemberRole(viewer.profile.role)) redirect('/pending');
  if (!viewer.profile.displayName) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  return viewer;
}

export async function requirePageOwner(next: string): Promise<Viewer> {
  const viewer = await requirePageMember(next);
  if (viewer.profile.role !== 'owner') redirect('/');
  return viewer;
}
