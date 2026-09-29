import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { TrendingList } from "@/lib/trending/list";
import { trendingHref, type TrendingQuery } from "@/lib/trending/query";
import { cn } from "@/lib/utils";

export function Pagination({ list, query }: { list: TrendingList; query: TrendingQuery }) {
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.total, list.page * list.pageSize);
  const linkClass =
    "flex h-8 items-center gap-1 rounded-md border border-line-strong px-2.5 text-[13px] text-ink-soft hover:bg-surface-alt";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3"
    >
      <p className="text-xs text-dim">
        Showing {first}–{last} of {list.total} · page {list.page} of {list.pageCount}
      </p>
      <div className="flex gap-2">
        <Link
          href={trendingHref(query, { page: list.page - 1 })}
          aria-disabled={list.page <= 1}
          tabIndex={list.page <= 1 ? -1 : undefined}
          className={cn(linkClass, list.page <= 1 && disabledClass)}
        >
          <ChevronLeft aria-hidden className="size-3.5" />
          Previous
        </Link>
        <Link
          href={trendingHref(query, { page: list.page + 1 })}
          aria-disabled={list.page >= list.pageCount}
          tabIndex={list.page >= list.pageCount ? -1 : undefined}
          className={cn(linkClass, list.page >= list.pageCount && disabledClass)}
        >
          Next
          <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </nav>
  );
}
