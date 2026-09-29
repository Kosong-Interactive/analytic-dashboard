import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { overviewHref, type OverviewFilters } from "@/lib/overview/filters";

import { MobileNav, Sidebar, type NavKey } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  filters: OverviewFilters;
  active: NavKey;
  /** Builds the link a country or platform control points to; defaults to the Overview URL. */
  buildHref?: (change: Partial<OverviewFilters>) => string;
  children: ReactNode;
}

export async function AppShell({ filters, active, buildHref, children }: AppShellProps) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          filters={filters}
          buildHref={buildHref ?? ((change) => overviewHref(filters, change))}
          userEmail={user?.email ?? null}
        />
        <MobileNav active={active} />
        <main id="main" className="flex flex-col gap-5 px-4 py-6 sm:px-7 sm:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
