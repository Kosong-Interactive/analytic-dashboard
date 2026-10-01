import { platformLabel, supports } from "@analytic-dashboard/shared";

import { formatCount } from "@/lib/format/format";
import type { GameDetailView } from "@/lib/games/view-model";
import { platformLabels } from "@/lib/overview/filters";

import { EmptyState, Panel } from "../overview/panel";

export function ObservationsTable({ view }: { view: GameDetailView }) {
  const { observations, listing, historyDays } = view;
  // Columns a platform never publishes are left out rather than shown as a column of dashes.
  const showReviews = supports(listing.store, "reviewCount");
  const showInstalls = supports(listing.store, "installs");
  const unpublished = [!showReviews && "review counts", !showInstalls && "installs"].filter(Boolean);
  return (
    <Panel
      title="Source observations"
      description={`Every stored snapshot from ${platformLabels[listing.store]} for this listing · last 30 days · UTC`}
    >
      {observations.length === 0 ? (
        <EmptyState title="No observations stored">
          This listing has been discovered but no snapshot has been stored for it yet.
        </EmptyState>
      ) : (
        <>
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Stored observations for {listing.title}, newest first</caption>
              <thead className="sticky top-0 bg-surface-alt text-[13px] text-dim">
                <tr className="h-8 border-y border-line">
                  <th scope="col" className="px-4 text-left font-medium">Captured at</th>
                  <th scope="col" className="px-2 text-right font-medium">Rating</th>
                  <th scope="col" className="px-2 text-right font-medium">Ratings</th>
                  {showReviews ? <th scope="col" className="px-2 text-right font-medium">Reviews</th> : null}
                  {showInstalls ? <th scope="col" className="px-2 text-right font-medium">Installs (range)</th> : null}
                  <th scope="col" className="px-4 text-left font-medium">Version</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {observations.map((row) => (
                  <tr key={row.capturedAt.toISOString()} className="h-8 border-b border-line-soft">
                    <td className="whitespace-nowrap px-4">{row.capturedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="px-2 text-right">{row.rating === null ? "—" : row.rating.toFixed(2)}</td>
                    <td className="px-2 text-right">{formatCount(row.ratingCount)}</td>
                    {showReviews ? <td className="px-2 text-right">{formatCount(row.reviewCount)}</td> : null}
                    {showInstalls ? <td className="px-2 text-right">{row.installs ?? "—"}</td> : null}
                    <td className="px-4">{row.version ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line-soft px-4 py-3 text-sm text-dim">
            {observations.length} snapshots over {historyDays === null ? "0" : historyDays.toFixed(1)} days. A new
            snapshot is stored only when a value changes, plus a daily heartbeat. “—” means the store did not report
            the value.
            {unpublished.length > 0 ? ` ${platformLabel(listing.store)} does not publish ${unpublished.join(" or ")}.` : ""}
          </p>
        </>
      )}
    </Panel>
  );
}
