'use client';

import { Menu } from '@base-ui/react/menu';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function UserMenu({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className="ml-2 flex items-center gap-2 rounded-xs p-1 hover:bg-ink-2"
        aria-label={`Account menu for ${name}`}
      >
        {children}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-50">
          <Menu.Popup className="min-w-48 border border-rule-strong bg-ink-1 py-1 text-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <div className="label border-rule border-b px-3 py-2">{name}</div>
            <Menu.Item
              render={<Link href="/me" />}
              className="block px-3 py-2 outline-none data-[highlighted]:bg-ink-2"
            >
              Profile
            </Menu.Item>
            <form action="/auth/signout" method="post">
              <Menu.Item
                render={<button type="submit" />}
                className="block w-full px-3 py-2 text-left outline-none data-[highlighted]:bg-ink-2"
              >
                Sign out
              </Menu.Item>
            </form>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
