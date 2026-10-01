import Link from "next/link";

import { EmptyState, Panel } from "@/components/overview/panel";
import { Pager } from "@/components/releases/pagination";
import { AppShell } from "@/components/shell/app-shell";
import { SteamFreshness } from "@/components/steam/freshness";
import { SteamGamesControls } from "@/components/steam/games-controls";
import { SteamGamesTable } from "@/components/steam/games-table";
import { requireUser } from "@/lib/auth/session";
import { MIN_LABEL_CONFIDENCE } from "@/lib/labels/constants";
import { getSteamGameCatalog } from "@/lib/steam/get-steam";
import { buildSteamGamesList } from "@/lib/steam/games-list";
import {
  clearedSteamGameFilters,
  parseSteamGamesQuery,
  steamGameSortLabels,
  steamGamesHref,
} from "@/lib/steam/games-query";

export const metadata = { title: "Steam Games · Game Analytic" };

interface SteamGamesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamGamesPage({ searchParams }: SteamGamesPageProps) {
  await requireUser("/steam/games");
  const query = parseSteamGamesQuery(await searchParams);
  const catalog = await getSteamGameCatalog(query.country);
  const list = buildSteamGamesList({
    games: catalog.games,
    membership: catalog.membership,
    query,
    asOf: catalog.asOf,
  });
  const priceLabel = query.country === "id" ? "Indonesia (IDR)" : "Global (USD)";

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam-games"
      buildHref={(change) => steamGamesHref(query, { country: change.country })}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Games</h1>
        <p className="text-[15px] text-dim">
          Every tracked Steam game · Steam Global · prices in {priceLabel} · {list.tracked} tracked
        </p>
      </div>

      <SteamFreshness source={catalog.source} capturedAt={catalog.chartCapturedAt.most_played} asOf={catalog.asOf} />
      <SteamGamesControls query={query} options={list.options} />

      <Panel title="Tracked games" description={`${list.total} of ${list.tracked} tracked games match`}>
        {list.rows.length === 0 ? (
          <EmptyState title={list.tracked === 0 ? "No Steam games collected yet" : "No games match these filters"}>
            {list.tracked === 0 ? (
              "Games appear here after the scheduled Steam collection has run."
            ) : (
              <>
                Loosen or{" "}
                <Link href={steamGamesHref(query, clearedSteamGameFilters)} className="underline">
                  clear the filters
                </Link>
                . Games without a value (for example no release date or reviews) never match a filter on that value.
              </>
            )}
          </EmptyState>
        ) : (
          <SteamGamesTable
            rows={list.rows}
            query={query}
            asOf={catalog.asOf}
            firstRank={(list.page - 1) * list.pageSize + 1}
            caption={`Tracked Steam games sorted by ${steamGameSortLabels[query.sort]}, page ${list.page} of ${list.pageCount}`}
          />
        )}
        <Pager
          page={list.page}
          pageCount={list.pageCount}
          pageSize={list.pageSize}
          total={list.total}
          hrefFor={(page) => steamGamesHref(query, { page })}
        />
      </Panel>

      <p className="text-sm leading-5 text-dim">
        Tracked games are a sample from the Steam Most Played and Top Sellers charts, not the Steam catalog. Players,
        reviews, and chart positions are Steam&apos;s own global figures; only the price follows the country you pick.
        “First seen” is when this system first observed a game, not its release date. Genre and mechanic labels are
        inferred from Steam user tags and keywords (shown only at {Math.round(MIN_LABEL_CONFIDENCE * 100)}%+ confidence).
        A dash means the value is missing, never zero.
      </p>
    </AppShell>
  );
}
