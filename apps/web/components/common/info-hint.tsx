"use client";

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";

/**
 * An explanation behind an info icon. Opens on hover, on click or tap (for touch screens), and
 * from the keyboard; Escape or clicking outside closes it.
 */
export function InfoHint({ label, children }: { label: string; children: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        closeDelay={100}
        aria-label={`About ${label}`}
        className="-m-1.5 flex size-6 items-center justify-center rounded-md text-dim hover:bg-surface-alt hover:text-ink-soft focus-visible:outline-2 focus-visible:outline-accent data-[popup-open]:text-ink-soft"
      >
        <Info aria-hidden className="size-[13px]" strokeWidth={1.8} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={12} className="z-50">
          <Popover.Popup className="max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-line-strong bg-surface-alt px-3 py-2 text-sm leading-5 text-ink-soft shadow-xl outline-none">
            <Popover.Title className="mb-0.5 text-sm font-medium text-ink">{label}</Popover.Title>
            <Popover.Description>{children}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
