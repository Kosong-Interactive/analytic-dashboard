import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { SteamFreshness } from "@/components/steam/freshness";
import { SteamThumb } from "@/components/steam/steam-thumb";
import { requireUser } from "@/lib/auth/session";
import { formatCount } from "@/lib/format/format";
import { formatPrice, formatRatio, positiveRatio } from "@/lib/steam/format";
import { getSteamGame } from "@/lib/steam/get-steam";
import { parseSteamQuery, steamChartLabels, steamHref } from "@/lib/steam/query";

interface SteamGamePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const steamIdPattern = /^[1-9][0-9]{0,11}$/;

export async function generateMetadata({ params }: SteamGamePageProps) {
  const { id } = await params;
  const result = steamIdPattern.test(id) ? await getSteamGame(id) : null;
  return { title: `${result?.game.title ?? "Steam game"} · Game Analytic` };
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-surface px-4 py-3">
      <dt className="text-[11.5px] text-dim">{label}</dt>
      <dd className="font-mono text-lg">{value}</dd>
      {note ? <dd className="text-[11px] text-dim">{note}</dd> : null}
    </div>
  );
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function SteamGamePage({ params, searchParams }: SteamGamePageProps) {
  const { id } = await params;
  await requireUser(`/steam/${id}`);
  if (!steamIdPattern.test(id)) notFound();
  const query = parseSteamQuery(await searchParams);
  const result = await getSteamGame(id);
  if (!result) notFound();
  const { game, source, asOf } = result;
  const { snapshot } = game;
  const ratio = positiveRatio(snapshot);
  const platforms = [
    game.supportsWindows ? "Windows" : null,
    game.supportsMacos ? "macOS" : null,
    game.supportsLinux ? "Linux" : null,
  ].filter((name): name is string => name !== null);

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam"
      buildHref={(change) => steamHref(query, { country: change.country }, `/steam/${id}`)}
    >
      <div className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-dim">
          <Link href={steamHref(query)} className="hover:text-ink">Steam Charts</Link>
          <ChevronRight aria-hidden className="size-3" />
          <span aria-current="page" className="truncate text-ink-soft">{game.title}</span>
        </nav>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <SteamThumb imageUrl={game.headerImageUrl} width={184} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-[22px] font-semibold tracking-tight">{game.title}</h1>
              <span className="text-[13px] text-dim">
                by <span className="text-ink-soft">{game.developerNames.join(", ") || "unknown developer"}</span>
              </span>
            </div>
            <ul className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <li className="rounded-md border border-line-strong px-2 py-0.5">Steam · Global</li>
              {platforms.map((name) => (
                <li key={name} className="rounded-md border border-line-strong px-2 py-0.5">{name}</li>
              ))}
              <li className="text-dim">
                {game.releaseDate ? `Released ${day(game.releaseDate)} (Steam date)` : "No release date from Steam"}
              </li>
              <li className="text-dim">First observed {day(game.firstSeenAt)}</li>
            </ul>
          </div>
          <a
            href={game.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md border border-line-strong px-3 text-xs text-ink hover:bg-surface"
          >
            Open in Steam
            <ExternalLink aria-hidden className="size-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>

      <SteamFreshness source={source} capturedAt={snapshot?.capturedAt ?? null} asOf={asOf} />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Players now" value={formatCount(snapshot?.currentPlayers ?? null)} note="Concurrent, Steam figure" />
        <Metric label="Positive reviews" value={formatRatio(ratio)} note={ratio === null ? "No review reading" : undefined} />
        <Metric label="Positive" value={formatCount(snapshot?.reviewPositive ?? null)} />
        <Metric label="Negative" value={formatCount(snapshot?.reviewNegative ?? null)} />
        <Metric label="Price · Indonesia" value={formatPrice(game.prices.id, game.isFree)} />
        <Metric label="Price · Global (US)" value={formatPrice(game.prices.us, game.isFree)} />
      </dl>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Genres and tags" description="As listed by Steam; these are store labels, not this system's classification.">
          <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3 text-xs">
            {[
              ["Genres", game.genres],
              ["Tags", game.tags],
              ["Categories", game.categories],
            ].map(([label, values]) => (
              <div key={label as string} className="flex flex-col gap-1.5">
                <p className="text-dim">{label as string}</p>
                {(values as string[]).length === 0 ? (
                  <p className="text-dim">None from Steam</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {(values as string[]).map((value) => (
                      <li key={value} className="rounded-md border border-line-strong px-2 py-0.5 text-ink-soft">{value}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Chart history" description="Last 30 days, newest first">
          {game.ranks.length === 0 ? (
            <EmptyState title="Not on a tracked chart">No chart position was recorded in the last 30 days.</EmptyState>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">Chart positions for {game.title}</caption>
              <thead>
                <tr className="h-[34px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
                  <th scope="col" className="pl-4 text-left font-medium">Captured (UTC)</th>
                  <th scope="col" className="text-left font-medium">Chart</th>
                  <th scope="col" className="pr-4 text-right font-medium">Rank</th>
                </tr>
              </thead>
              <tbody>
                {[...game.ranks].reverse().slice(0, 30).map((entry) => (
                  <tr key={`${entry.chart}-${entry.capturedAt.toISOString()}`} className="h-9 border-b border-line-soft">
                    <td className="pl-4 font-mono text-xs text-ink-soft">{entry.capturedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="text-ink-soft">{steamChartLabels[entry.chart as keyof typeof steamChartLabels] ?? entry.chart}</td>
                    <td className="pr-4 text-right font-mono text-xs">#{entry.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Observations" description="Stored when values change, so a gap means unchanged. Last 30 days, newest first.">
        {game.snapshots.length === 0 ? (
          <EmptyState title="No observations in the last 30 days">Steam returned no review or player reading in this window.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">Observations for {game.title}</caption>
              <thead>
                <tr className="h-[34px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
                  <th scope="col" className="pl-4 text-left font-medium">Captured (UTC)</th>
                  <th scope="col" className="text-right font-medium">Players</th>
                  <th scope="col" className="text-right font-medium">Positive</th>
                  <th scope="col" className="text-right font-medium">Negative</th>
                  <th scope="col" className="pr-4 text-right font-medium">Positive share</th>
                </tr>
              </thead>
              <tbody>
                {[...game.snapshots].reverse().slice(0, 50).map((row) => (
                  <tr key={row.capturedAt.toISOString()} className="h-9 border-b border-line-soft">
                    <td className="pl-4 font-mono text-xs text-ink-soft">{row.capturedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td className="text-right font-mono text-xs">{formatCount(row.currentPlayers)}</td>
                    <td className="text-right font-mono text-xs">{formatCount(row.reviewPositive)}</td>
                    <td className="text-right font-mono text-xs">{formatCount(row.reviewNegative)}</td>
                    <td className="pr-4 text-right font-mono text-xs">{formatRatio(positiveRatio(row))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
