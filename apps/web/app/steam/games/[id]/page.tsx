import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChartPanel, summarize } from "@/components/game-detail/history-panels";
import { LabelsPanel } from "@/components/game-detail/labels-panel";
import { MetricCardGrid } from "@/components/game-detail/metric-cards";
import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { SteamFreshness } from "@/components/steam/freshness";
import { SteamThumb } from "@/components/steam/steam-thumb";
import { requireUser } from "@/lib/auth/session";
import { formatCount } from "@/lib/format/format";
import { resolveListingLabels } from "@/lib/labels/resolve";
import { buildSteamMetrics, buildSteamSeries } from "@/lib/steam/detail-view";
import { formatPrice, formatRatio, positiveRatio } from "@/lib/steam/format";
import { getSteamGame } from "@/lib/steam/get-steam";
import { listSteamTaxonomyOptions } from "@/lib/steam/manual-labels";
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

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function stamp(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

const percent = (value: number) => `${value.toFixed(1)}%`;

export default async function SteamGamePage({ params, searchParams }: SteamGamePageProps) {
  const { id } = await params;
  await requireUser(`/steam/games/${id}`);
  if (!steamIdPattern.test(id)) notFound();
  const query = parseSteamQuery(await searchParams);
  const [result, taxonomy] = await Promise.all([getSteamGame(id), listSteamTaxonomyOptions()]);
  if (!result) notFound();
  const { game, labels, source, asOf } = result;
  const { snapshot } = game;
  const series = buildSteamSeries(game);
  const platforms = [
    game.supportsWindows ? "Windows" : null,
    game.supportsMacos ? "macOS" : null,
    game.supportsLinux ? "Linux" : null,
  ].filter((name): name is string => name !== null);
  const gamesHref = query.country === "id" ? "/steam/games" : `/steam/games?country=${query.country}`;

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam-games"
      buildHref={(change) => steamHref(query, { country: change.country }, `/steam/games/${id}`)}
    >
      <div className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-dim">
          <Link href={gamesHref} className="hover:text-ink">Games</Link>
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
              <li className="rounded-md border border-line-strong px-2 py-0.5">Steam</li>
              <li className="rounded-md border border-line-strong px-2 py-0.5">Global</li>
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
      <MetricCardGrid items={buildSteamMetrics(game, query.country)} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Players over time"
          description="Concurrent players · Steam Global · stored on change, drawn as steps"
          points={series.players}
          summary={summarize(series.players, formatCount)}
          emptyText="Steam has not reported a player count for this game yet."
          label="Players"
        />
        <ChartPanel
          title="Positive reviews over time"
          description="Share of positive reviews · Steam Global"
          points={series.positive}
          summary={summarize(series.positive, percent)}
          emptyText="Steam has not reported reviews for this game yet."
          decimals={1}
          label="Positive"
        />
        <ChartPanel
          title="Most Played rank over time"
          description="Steam Global chart · lower is better"
          points={series.mostPlayedRank}
          summary={summarize(series.mostPlayedRank, (v) => `#${v}`, true)}
          emptyText="This game has not appeared in the Most Played chart."
          invert
          label="Rank"
        />
        <ChartPanel
          title="Top Sellers rank over time"
          description="Steam Global chart · lower is better"
          points={series.topSellersRank}
          summary={summarize(series.topSellersRank, (v) => `#${v}`, true)}
          emptyText="This game has not appeared in the Top Sellers chart."
          invert
          label="Rank"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <Panel title="Regional prices" description="Upfront price per storefront · Steam sets a price per country">
            {game.isFree ? (
              <p className="border-t border-line-soft px-4 py-3 text-[13px] text-ink-soft">Free to play.</p>
            ) : (
              <ul className="flex flex-col border-t border-line-soft text-[13px]">
                {(["id", "us"] as const).map((country) => {
                  const price = game.prices[country];
                  return (
                    <li key={country} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
                      <span>{country === "id" ? "Indonesia" : "Global (US)"}</span>
                      <span className="font-mono text-xs">
                        {formatPrice(price, false)}
                        {price ? <span className="ml-2 text-dim">observed {day(price.capturedAt)}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
        <div className="xl:col-span-7">
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
                    {[...game.snapshots].reverse().slice(0, 30).map((row) => (
                      <tr key={row.capturedAt.toISOString()} className="h-9 border-b border-line-soft">
                        <td className="pl-4 font-mono text-xs text-ink-soft">{stamp(row.capturedAt)}</td>
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
        </div>
      </div>

      <LabelsPanel
        steamApp={{ id: game.steamAppId, externalId: game.externalId }}
        labels={resolveListingLabels(labels)}
        options={taxonomy}
      />

      <Panel title="Steam tags and categories" description="As listed by Steam; these are store labels, not this system's classification.">
        <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3 text-xs">
          {(
            [
              ["Genres", game.genres],
              ["Tags", game.tags],
              ["Categories", game.categories],
            ] as const
          ).map(([label, values]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <p className="text-dim">{label}</p>
              {values.length === 0 ? (
                <p className="text-dim">None from Steam</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {values.map((value) => (
                    <li key={value} className="rounded-md border border-line-strong px-2 py-0.5 text-ink-soft">{value}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {game.ranks.length > 0 ? (
        <Panel title="Chart history" description="Last 30 days, newest first · Steam Global">
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
                  <td className="pl-4 font-mono text-xs text-ink-soft">{stamp(entry.capturedAt)}</td>
                  <td className="text-ink-soft">{steamChartLabels[entry.chart as keyof typeof steamChartLabels] ?? entry.chart}</td>
                  <td className="pr-4 text-right font-mono text-xs">#{entry.rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </AppShell>
  );
}
