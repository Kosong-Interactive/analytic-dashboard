"use client";

import { Menu } from "@base-ui/react/menu";
import { LogOut, SlidersHorizontal, User } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { signOut } from "@/app/login/actions";

export function UserMenu({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Account menu"
        className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-soft hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-accent data-[popup-open]:bg-surface-alt"
      >
        <User aria-hidden className="size-4" strokeWidth={1.8} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="min-w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-line-strong bg-surface-alt p-1 text-[15px] text-ink shadow-xl outline-none">
            <Menu.Group>
              <Menu.GroupLabel className="px-2.5 pb-2 pt-1.5">
                <span className="block text-[13px] text-dim">Signed in as</span>
                <span className="block truncate text-ink-soft" title={email}>
                  {email}
                </span>
              </Menu.GroupLabel>
            </Menu.Group>
            <Menu.Separator className="my-1 h-px bg-line" />
            <Menu.LinkItem
              render={<Link href="/settings/studio-fit" />}
              className="flex h-8 cursor-default items-center gap-2 rounded-md px-2.5 text-ink-soft outline-none data-[highlighted]:bg-line data-[highlighted]:text-ink"
            >
              <SlidersHorizontal aria-hidden className="size-3.5" />
              Studio Fit
            </Menu.LinkItem>
            <Menu.Item
              disabled={pending}
              closeOnClick={false}
              onClick={() => startTransition(() => signOut())}
              className="flex h-8 cursor-default items-center gap-2 rounded-md px-2.5 text-ink-soft outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-line data-[highlighted]:text-ink"
            >
              <LogOut aria-hidden className="size-3.5" />
              {pending ? "Signing out…" : "Sign out"}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
