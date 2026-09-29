import Link from "next/link";

import { cn } from "@/lib/utils";

interface SegmentedLinksProps {
  label: string;
  items: Array<{ key: string; label: string; href: string; active: boolean }>;
}

/** A row of links styled as a segmented control; each option is a shareable URL. */
export function SegmentedLinks({ label, items }: SegmentedLinksProps) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-0.5 rounded-lg border border-line-strong/60 bg-surface p-0.5">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "flex h-[26px] items-center rounded-md px-2.5 text-xs",
            item.active ? "bg-line text-ink" : "text-dim hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
