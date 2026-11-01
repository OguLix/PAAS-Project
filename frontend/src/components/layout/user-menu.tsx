'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut } from 'lucide-react';
import { signOut, useSession } from '@/features/auth/session-store';

export function UserMenu() {
  const session = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (session.status !== 'authenticated' || !session.user) {
    return null;
  }

  const initial = session.user.email.slice(0, 1).toUpperCase();

  async function handleSignOut(): Promise<void> {
    setPending(true);

    try {
      await signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-lg border border-line bg-white py-1.5 pr-2 pl-1.5 text-sm text-ink transition-colors hover:bg-subtle"
      >
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-subtle font-display text-xs font-semibold text-deep"
        >
          {initial}
        </span>
        <span className="hidden max-w-40 truncate text-muted sm:inline">{session.user.email}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-lg border border-line bg-white p-1 shadow-sm"
        >
          <DropdownMenu.Label className="px-3 py-2 text-xs text-muted">
            Signed in as
            <span className="mt-0.5 block truncate text-sm font-medium text-ink">
              {session.user.email}
            </span>
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          <DropdownMenu.Item
            disabled={pending}
            onSelect={() => {
              void handleSignOut();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-ink outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-subtle"
          >
            <LogOut aria-hidden="true" className="size-4 text-muted" />
            {pending ? 'Signing out' : 'Sign out'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
