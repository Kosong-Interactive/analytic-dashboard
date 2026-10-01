import { X } from "lucide-react";
import Link from "next/link";

import { MAX_COMPARED } from "@/lib/compare/comparison";

import { GameIcon } from "../games/game-icon";

/** Sticky bar listing the games picked for Compare, with the button that opens the comparison. */
export function CompareTray({
  selection,
  selectedCount,
  compareHref,
  clearHref,
  removeHref,
}: {
  selection: Array<{ id: string; title: string; iconUrl: string | null }>;
  selectedCount: number;
  compareHref: string;
  clearHref: string;
  removeHref: (id: string) => string;
}) {
  if (selectedCount === 0) return null;
  const elsewhere = selectedCount - selection.length;
  return (
    <aside
      aria-label="Compare selection"
      className="sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-[10px] border border-accent/50 bg-surface-alt px-3 py-2.5 shadow-2xl"
    >
      <p className="text-sm text-ink-soft">
        {selectedCount} of {MAX_COMPARED} selected
      </p>
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {selection.map((game) => (
          <li key={game.id} className="flex items-center gap-1.5 rounded-md border border-line-strong bg-surface py-0.5 pl-1 pr-0.5 text-sm">
            <GameIcon title={game.title} iconUrl={game.iconUrl} size={18} />
            <span className="max-w-[9rem] truncate">{game.title}</span>
            <Link href={removeHref(game.id)} scroll={false} className="inline-flex size-5 items-center justify-center rounded text-dim hover:text-ink">
              <X aria-hidden className="size-3" />
              <span className="sr-only">Remove {game.title} from the selection</span>
            </Link>
          </li>
        ))}
        {elsewhere > 0 ? (
          <li className="text-[13px] text-dim">+{elsewhere} from another storefront</li>
        ) : null}
      </ul>
      <div className="flex items-center gap-2">
        <Link href={clearHref} scroll={false} className="flex h-8 items-center rounded-md border border-line-strong px-3 text-[15px] text-ink-soft hover:bg-surface">
          Clear
        </Link>
        <Link
          href={compareHref}
          aria-disabled={selectedCount < 2}
          className={
            selectedCount < 2
              ? "pointer-events-none flex h-8 items-center rounded-md bg-accent px-3 text-[15px] font-medium text-canvas opacity-50"
              : "flex h-8 items-center rounded-md bg-accent px-3 text-[15px] font-medium text-canvas hover:opacity-90"
          }
        >
          Compare ({selectedCount})
        </Link>
      </div>
      {selectedCount < 2 ? <p className="basis-full text-[13px] text-dim">Pick at least one more game to compare.</p> : null}
    </aside>
  );
}
