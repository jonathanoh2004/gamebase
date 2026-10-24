import Link from 'next/link';
import type { Viewer } from '@/lib/auth/viewer';
import { Avatar } from './ui/avatar';
import { UserMenu } from './user-menu';

export function SiteHeader({ viewer, crumb }: { viewer: Viewer; crumb?: string }) {
  return (
    <header className="sticky top-0 z-30 border-rule border-b bg-ink-0/90 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 font-extrabold text-lg tracking-[-0.04em]"
        >
          gamebase
          <span className="label hidden sm:inline">v0.1</span>
        </Link>
        {crumb && (
          <span className="label hidden truncate sm:inline">
            <span className="text-rule-strong">/</span> {crumb}
          </span>
        )}
        <nav className="ml-auto flex items-center gap-1">
          <Link href="/" className="label px-3 py-2 hover:text-paper">
            Library
          </Link>
          {viewer.profile.role === 'owner' && (
            <Link href="/admin" className="label px-3 py-2 hover:text-paper">
              Admin
            </Link>
          )}
          <UserMenu name={viewer.profile.displayName}>
            <Avatar seed={viewer.profile.avatarSeed} color={viewer.profile.color} size={28} />
          </UserMenu>
        </nav>
      </div>
    </header>
  );
}
