import { supportedCountryCodes } from "@analytic-dashboard/shared";

import {
  countryLabels,
  platformLabels,
  platformValues,
  type OverviewFilters,
} from "@/lib/overview/filters";

import { CommandPalette } from "../search/command-palette";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { SegmentedLinks } from "./segmented-links";
import type { NavKey } from "./sidebar";
import { UserMenu } from "./user-menu";

/** Phones get a shorter storefront name; it still says "US store" so it is never read as worldwide. */
const shortCountryLabels: Record<(typeof supportedCountryCodes)[number], string> = {
  id: "Indonesia",
  us: "US store",
};

/**
 * Two rows on phones (menu, brand, search, account; then storefront filters) and one row from `sm` up.
 * The filter row scrolls sideways on the narrowest screens instead of wrapping a third time.
 */
export function Topbar({
  active,
  filters,
  buildHref,
  userEmail,
}: {
  active: NavKey;
  filters: OverviewFilters;
  buildHref: (change: Partial<OverviewFilters>) => string;
  userEmail: string | null;
}) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-canvas px-4 py-2 sm:flex-nowrap sm:px-7">
      <div className="order-1 flex shrink-0 items-center gap-1.5 lg:hidden">
        <MobileNavDrawer active={active} />
        <p className="text-[13px] font-semibold">Game Analytic</p>
      </div>
      <div className="order-2 min-w-0 flex-1 sm:max-w-56">
        <CommandPalette />
      </div>
      <div className="no-scrollbar order-4 flex w-full items-center gap-2 overflow-x-auto sm:order-3 sm:ml-auto sm:w-auto sm:gap-3">
        <SegmentedLinks
          label="Country"
          compact
          className="shrink-0 flex-nowrap"
          items={supportedCountryCodes.map((code) => ({
            key: code,
            label: (
              <>
                <span className="sm:hidden">{shortCountryLabels[code]}</span>
                <span className="hidden sm:inline">{countryLabels[code]}</span>
              </>
            ),
            href: buildHref({ country: code }),
            active: filters.country === code,
          }))}
        />
        <SegmentedLinks
          label="Platform"
          compact
          className="shrink-0 flex-nowrap"
          items={platformValues.map((value) => ({
            key: value,
            label: platformLabels[value],
            href: buildHref({ platform: value }),
            active: filters.platform === value,
          }))}
        />
      </div>
      {userEmail ? (
        <div className="order-3 shrink-0 sm:order-4">
          <UserMenu email={userEmail} />
        </div>
      ) : null}
    </header>
  );
}
