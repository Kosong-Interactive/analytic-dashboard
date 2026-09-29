import type { ReactNode } from "react";

import type { OverviewFilters } from "@/lib/overview/filters";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  filters: OverviewFilters;
  children: ReactNode;
}

export function AppShell({ filters, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar filters={filters} />
        <main id="main" className="flex flex-col gap-5 px-4 py-6 sm:px-7 sm:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
