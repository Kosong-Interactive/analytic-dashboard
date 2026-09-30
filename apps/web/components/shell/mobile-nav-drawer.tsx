"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Brand, NavList, type NavKey } from "./sidebar";

/**
 * Below `lg` the sidebar opens as a drawer from the left. Dialog handles the focus trap, Escape,
 * and backdrop; choosing a link closes it.
 */
export function MobileNavDrawer({ active }: { active: NavKey }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open menu"
        className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-soft hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.8} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 lg:hidden" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-rail shadow-2xl outline-none transition-transform duration-200 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full lg:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <Brand />
            <Dialog.Close
              aria-label="Close menu"
              className="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </div>
          <NavList active={active} onNavigate={() => setOpen(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
