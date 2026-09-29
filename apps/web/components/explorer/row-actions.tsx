import { Check, GitCompare } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { WatchToggle } from "../watchlist/watch-toggle";

export interface RowActionContext {
  watched: ReadonlyMap<string, unknown>;
  compareIds: readonly string[];
  compareFull: boolean;
  /** Link that adds or removes the game from the compare selection. */
  toggleCompareHref: (id: string) => string;
}

/** Watchlist star and compare toggle for one game row, like a product list's watch/compare buttons. */
export function RowActions({ id, title, context }: { id: string; title: string; context: RowActionContext }) {
  const selected = context.compareIds.includes(id);
  const blocked = !selected && context.compareFull;
  return (
    <div className="flex items-center gap-1.5">
      <WatchToggle storeAppId={id} title={title} watched={context.watched.has(id)} />
      {blocked ? (
        <span
          aria-disabled="true"
          title="Four games are selected; remove one to add another"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong px-2 text-[11px] text-dim opacity-50"
        >
          <GitCompare aria-hidden className="size-3" />
          Compare
        </span>
      ) : (
        <Link
          href={context.toggleCompareHref(id)}
          scroll={false}
          aria-pressed={selected}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] hover:bg-surface-alt",
            selected ? "border-accent/60 text-accent" : "border-line-strong text-ink-soft hover:text-ink",
          )}
        >
          {selected ? <Check aria-hidden className="size-3" /> : <GitCompare aria-hidden className="size-3" />}
          Compare
          <span className="sr-only">{selected ? ` (selected, remove ${title})` : ` ${title}`}</span>
        </Link>
      )}
    </div>
  );
}
