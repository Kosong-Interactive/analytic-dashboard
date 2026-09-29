import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SegmentedLinksProps {
  label: string;
  items: Array<{ key: string; label: ReactNode; href: string; active: boolean }>;
  className?: string;
  /** Tighter padding below `sm`, for the top bar on phones. */
  compact?: boolean;
}

/** A row of links styled as a segmented control; each option is a shareable URL. */
export function SegmentedLinks({ label, items, className, compact = false }: SegmentedLinksProps) {
  return (
    <nav
      aria-label={label}
      className={cn("flex flex-wrap gap-0.5 rounded-lg border border-line-strong/60 bg-surface p-0.5", className)}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "flex h-[26px] items-center whitespace-nowrap rounded-md text-xs",
            compact ? "px-2 sm:px-2.5" : "px-2.5",
            item.active ? "bg-line text-ink" : "text-dim hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
