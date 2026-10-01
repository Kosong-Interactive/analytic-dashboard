import { platformLabel } from "@analytic-dashboard/shared";

import { formatRelative } from "@/lib/format/format";
import { formatUpfrontPrice } from "@/lib/format/price";
import type { GameDetailView } from "@/lib/games/view-model";
import { countryLabels } from "@/lib/overview/filters";

import { EmptyState, Panel } from "../overview/panel";

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Upfront price with its store, country, and snapshot time. In-app purchases are not collected. */
export function PricePanel({ view }: { view: GameDetailView }) {
  const { listing, asOf, price } = view;
  const country = countryLabels[listing.country as keyof typeof countryLabels] ?? listing.country.toUpperCase();
  const current = price.current;

  return (
    <Panel
      title="Upfront price"
      description="Price to download, in the storefront currency. In-app purchases are not tracked."
    >
      {current === null ? (
        <EmptyState title="No observation yet">No price reading has been stored for this listing.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3">
          <div className="flex flex-col gap-1">
            <p className="text-[22px] font-semibold leading-none tracking-tight">
              {formatUpfrontPrice(current.price, current.currency)}
            </p>
            <p className="text-xs text-dim">
              {current.price === null ? "The store gave no price for this observation. " : ""}
              {platformLabel(listing.store)} · {country} · observed {formatRelative(current.capturedAt, asOf)} (
              {current.capturedAt.toISOString().slice(0, 16).replace("T", " ")} UTC)
            </p>
          </div>
          {price.changes.length === 0 ? (
            <p className="text-xs text-dim">No price change in the stored history.</p>
          ) : (
            <ul aria-label="Price changes" className="flex flex-col gap-1 text-[13px]">
              {[...price.changes].reverse().map((change) => (
                <li key={change.at.toISOString()} className="flex flex-wrap items-center gap-x-2">
                  <span className="font-mono text-xs text-dim">{day(change.at)}</span>
                  <span className="font-mono text-xs">
                    {formatUpfrontPrice(change.from, change.currency)} → {formatUpfrontPrice(change.to, change.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
