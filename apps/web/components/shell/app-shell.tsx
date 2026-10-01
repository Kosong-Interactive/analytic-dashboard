import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { overviewHref, type OverviewFilters } from "@/lib/overview/filters";

import { platformModeOf } from "@/lib/shell/navigation";

import { MarketNotice } from "./market-notice";
import { Sidebar, type NavKey } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  filters: OverviewFilters;
  active: NavKey;
  /** Builds the link a country or platform control points to; defaults to the Overview URL. */
  buildHref?: (change: Partial<OverviewFilters>) => string;
  /** Set on pages with no equivalent in the other mode; the switch then leads to that mode's Overview. */
  noCounterpart?: boolean;
  children: ReactNode;
}

export async function AppShell({ filters, active, buildHref, noCounterpart, children }: AppShellProps) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent text-[15px] font-medium text-canvas focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Sidebar active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          active={active}
          filters={filters}
          buildHref={buildHref ?? ((change) => overviewHref(filters, change))}
          userEmail={user?.email ?? null}
          noCounterpart={noCounterpart}
        />
        {platformModeOf(active) === "mobile" ? <MarketNotice country={filters.country} /> : null}
        <main id="main" tabIndex={-1} className="flex flex-col gap-5 px-4 py-6 outline-none sm:px-7 sm:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
