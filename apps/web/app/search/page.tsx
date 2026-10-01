import Link from "next/link";

import { GameIcon } from "@/components/games/game-icon";
import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { parseOverviewFilters } from "@/lib/overview/filters";
import { PAGE_LIMITS, searchStoredCatalog } from "@/lib/search/get-search";
import { buildSearchGroups, SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, searchTextSchema } from "@/lib/search/results";

export const metadata = { title: "Search · Game Analytic" };

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  await requireUser(raw ? `/search?q=${encodeURIComponent(raw)}` : "/search");
  const filters = parseOverviewFilters(params);
  const text = searchTextSchema.safeParse(raw ?? "");
  const groups = text.success ? buildSearchGroups(text.data, await searchStoredCatalog(text.data, PAGE_LIMITS)) : [];

  return (
    <AppShell noCounterpart filters={filters} active="games">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Search</h1>
        <p className="text-[15px] text-dim">
          Stored games, developers, and taxonomy labels. Press ⌘K (Ctrl+K) anywhere to search quickly.
        </p>
      </div>

      <form method="get" action="/search" role="search" className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[13px] text-dim">
          Search
          <input
            type="search"
            name="q"
            defaultValue={raw ?? ""}
            minLength={SEARCH_MIN_LENGTH}
            maxLength={SEARCH_MAX_LENGTH}
            className="h-9 rounded-md border border-line-strong bg-surface px-2.5 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <button type="submit" className="h-9 rounded-md bg-accent px-3 text-[15px] font-medium text-canvas hover:opacity-90">
          Search
        </button>
      </form>

      {!text.success ? (
        <Panel title="Results">
          <EmptyState title={raw ? "Search needs 2 to 80 characters" : "Enter a search"}>
            Search matches game titles, developer names, and genre, mechanic, theme, and multiplayer labels.
          </EmptyState>
        </Panel>
      ) : groups.length === 0 ? (
        <Panel title="Results">
          <EmptyState title={`Nothing stored matches “${text.data}”`}>
            Only games the collector has observed are searchable; tracked games are a sample, not the full store
            catalogue.
          </EmptyState>
        </Panel>
      ) : (
        groups.map((group) => (
          <Panel key={group.kind} title={group.label} description={`${group.items.length} shown`}>
            <ul>
              {group.items.map((item) => (
                <li key={item.id} className="border-t border-line-soft">
                  <Link href={item.href} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#13161a]">
                    {item.kind === "game" ? <GameIcon title={item.title} iconUrl={item.iconUrl ?? null} size={28} /> : null}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-medium">{item.title}</span>
                      <span className="truncate text-[13.5px] text-dim">{item.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </AppShell>
  );
}
