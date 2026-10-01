"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Collapses its content behind a button below `lg`; from `lg` up the content is always shown and
 * the button is hidden. Without JavaScript the content stays hidden on phones only until the
 * page hydrates, so the form itself never depends on this component to work.
 */
export function MobileDisclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 items-center justify-between rounded-[10px] border border-line bg-surface px-3 text-[15px] text-ink-soft lg:hidden"
      >
        {label}
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div id={id} className={cn(open ? "block" : "hidden", "lg:block")}>
        {children}
      </div>
    </div>
  );
}
