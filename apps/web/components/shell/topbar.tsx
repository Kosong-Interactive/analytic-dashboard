import { supportedCountryCodes } from "@analytic-dashboard/shared";

import {
  countryLabels,
  platformLabels,
  platformValues,
  type OverviewFilters,
} from "@/lib/overview/filters";

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
      <p className="text-[13px] font-semibold lg:invisible">Game Analytic</p>
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
