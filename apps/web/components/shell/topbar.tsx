import { supportedCountryCodes } from "@analytic-dashboard/shared";

import {
  countryLabels,
  platformLabels,
  platformValues,
  type OverviewFilters,
} from "@/lib/overview/filters";

import { CommandPalette } from "../search/command-palette";
import { SegmentedLinks } from "./segmented-links";
import { UserMenu } from "./user-menu";

export function Topbar({
  filters,
  buildHref,
  userEmail,
}: {
  filters: OverviewFilters;
  buildHref: (change: Partial<OverviewFilters>) => string;
  userEmail: string | null;
}) {
  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2 sm:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <p className="shrink-0 text-[13px] font-semibold lg:hidden">Game Analytic</p>
        <div className="min-w-0 flex-1 sm:flex-none">
          <CommandPalette />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedLinks
          label="Country"
          items={supportedCountryCodes.map((code) => ({
            key: code,
            label: countryLabels[code],
            href: buildHref({ country: code }),
            active: filters.country === code,
          }))}
        />
        <SegmentedLinks
          label="Platform"
          items={platformValues.map((value) => ({
            key: value,
            label: platformLabels[value],
            href: buildHref({ platform: value }),
            active: filters.platform === value,
          }))}
        />
        {userEmail ? <UserMenu email={userEmail} /> : null}
      </div>
    </header>
  );
}
