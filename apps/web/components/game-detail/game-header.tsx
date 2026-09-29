import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { initials } from "@/lib/format/format";
import type { GameDetailView } from "@/lib/games/view-model";
import { countryLabels, platformLabels } from "@/lib/overview/filters";

function countryLabel(code: string): string {
  return countryLabels[code as keyof typeof countryLabels] ?? code.toUpperCase();
}

export function GameHeader({ view }: { view: GameDetailView }) {
  const { listing, siblings } = view;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-dim">
        <Link href="/trending" className="hover:text-ink">Games</Link>
        <ChevronRight aria-hidden className="size-3" />
        <span aria-current="page" className="truncate text-ink-soft">{listing.title}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent/80 font-mono text-lg font-medium text-canvas"
        >
          {initials(listing.title)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[22px] font-semibold tracking-tight">{listing.title}</h1>
            <span className="text-[13px] text-dim">
              by <span className="text-ink-soft">{listing.developerName ?? "unknown developer"}</span>
            </span>
          </div>
          <ul className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <li className="rounded-md border border-line-strong px-2 py-0.5">{platformLabels[listing.store]}</li>
            <li className="rounded-md border border-line-strong px-2 py-0.5">{countryLabel(listing.country)}</li>
            <li className="rounded-md border border-line-strong px-2 py-0.5">{listing.storeCategory ?? "No category"}</li>
            <li className="text-dim">
              {listing.releaseDate
                ? `Released ${listing.releaseDate.toISOString().slice(0, 10)} (store date)`
                : "No release date from the store"}
            </li>
            <li className="text-dim">First observed {listing.firstSeenAt.toISOString().slice(0, 10)}</li>
          </ul>
        </div>
        <a
          href={listing.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md border border-line-strong px-3 text-xs text-ink hover:bg-surface"
        >
          Open in {platformLabels[listing.store]}
          <ExternalLink aria-hidden className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>

      {siblings.length > 0 ? (
        <p className="text-xs text-dim">
          Also tracked in:{" "}
          {siblings.map((sibling, index) => (
            <span key={sibling.storeAppId}>
              {index > 0 ? ", " : ""}
              <Link href={`/games/${sibling.storeAppId}`} className="text-ink-soft underline-offset-2 hover:underline">
                {platformLabels[sibling.store]} · {countryLabel(sibling.country)}
              </Link>
            </span>
          ))}
          . Matched by store ID; each storefront is scored separately.
        </p>
      ) : null}
    </div>
  );
}
