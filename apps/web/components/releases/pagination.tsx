import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface PagerProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}

export function Pager({ page, pageCount, pageSize, total, hrefFor }: PagerProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const linkClass =
    "flex h-8 items-center gap-1 rounded-md border border-line-strong px-2.5 text-[15px] text-ink-soft hover:bg-surface-alt";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3">
      <p className="text-sm text-dim">
        Showing {first}–{last} of {total} · page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        <Link href={hrefFor(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={cn(linkClass, page <= 1 && disabled)}>
          <ChevronLeft aria-hidden className="size-3.5" />
          Previous
        </Link>
        <Link
          href={hrefFor(page + 1)}
          aria-disabled={page >= pageCount}
          tabIndex={page >= pageCount ? -1 : undefined}
          className={cn(linkClass, page >= pageCount && disabled)}
        >
          Next
          <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </nav>
  );
}
