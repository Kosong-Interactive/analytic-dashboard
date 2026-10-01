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
import { platformModeOf, platformSwitchHref } from "@/lib/shell/navigation";

import type { NavKey } from "./sidebar";
import { UserMenu } from "./user-menu";

/** Phones get a shorter storefront name; it still says "US store" so it is never read as worldwide. */
const shortCountryLabels: Record<(typeof supportedCountryCodes)[number], string> = {
  id: "Indonesia",
  us: "US store",
};

/** Steam has one global chart; the country only picks which regional price is shown. */
const desktopCountryLabels: Record<(typeof supportedCountryCodes)[number], string> = {
  id: "Indonesia",
  us: "Global",
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
  noCounterpart = false,
}: {
  active: NavKey;
  filters: OverviewFilters;
  buildHref: (change: Partial<OverviewFilters>) => string;
  userEmail: string | null;
  /** The page has no equivalent in the other mode, so the switch leads to that mode's Overview. */
  noCounterpart?: boolean;
}) {
  const mode = platformModeOf(active);
  const switchHref = (target: "mobile" | "desktop") =>
    platformSwitchHref({ active, target, country: filters.country, noCounterpart });
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
          label="Device"
          compact
          className="shrink-0 flex-nowrap"
          items={[
            { key: "mobile", label: "Mobile", href: switchHref("mobile"), active: mode === "mobile" },
            { key: "desktop", label: "Desktop", href: switchHref("desktop"), active: mode === "desktop" },
          ]}
        />
        <SegmentedLinks
          label="Country"
          compact
          className="shrink-0 flex-nowrap"
          items={supportedCountryCodes.map((code) => ({
            key: code,
            label: (
              <>
                {mode === "desktop" ? (
                  desktopCountryLabels[code]
                ) : (
                  <>
                    <span className="sm:hidden">{shortCountryLabels[code]}</span>
                    <span className="hidden sm:inline">{countryLabels[code]}</span>
                  </>
                )}
              </>
            ),
            href: buildHref({ country: code }),
            active: filters.country === code,
          }))}
        />
        {mode === "mobile" ? (
          <SegmentedLinks
            label="Store"
            compact
            className="shrink-0 flex-nowrap"
            items={platformValues.map((value) => ({
              key: value,
              label: platformLabels[value],
              href: buildHref({ platform: value }),
              active: filters.platform === value,
            }))}
          />
        ) : (
          <SegmentedLinks
            label="Source"
            compact
            className="shrink-0 flex-nowrap"
            items={[{ key: "steam", label: "Steam", href: "/steam", active: true }]}
          />
        )}
      </div>
      {userEmail ? (
        <div className="order-3 shrink-0 sm:order-4">
          <UserMenu email={userEmail} />
        </div>
      ) : null}
    </header>
  );
}
