import Link from "next/link";

import { supportedCountryCodes } from "@analytic-dashboard/shared";

import {
  countryLabels,
  overviewHref,
  platformLabels,
  platformValues,
  type OverviewFilters,
} from "@/lib/overview/filters";
import { cn } from "@/lib/utils";

interface SegmentedProps {
  label: string;
  items: Array<{ key: string; label: string; href: string; active: boolean }>;
}

function Segmented({ label, items }: SegmentedProps) {
  return (
    <nav
      aria-label={label}
      className="flex gap-0.5 rounded-lg border border-line-strong/60 bg-surface p-0.5"
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "flex h-[26px] items-center rounded-md px-2.5 text-xs",
            item.active ? "bg-line text-ink" : "text-dim hover:text-ink",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Topbar({ filters }: { filters: OverviewFilters }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2 sm:px-7">
      <p className="text-[13px] font-semibold tracking-[0.16em] lg:invisible">GAME INTEL</p>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Country"
          items={supportedCountryCodes.map((code) => ({
            key: code,
            label: countryLabels[code],
            href: overviewHref(filters, { country: code }),
            active: filters.country === code,
          }))}
        />
        <Segmented
          label="Platform"
          items={platformValues.map((value) => ({
            key: value,
            label: platformLabels[value],
            href: overviewHref(filters, { platform: value }),
            active: filters.platform === value,
          }))}
        />
      </div>
    </header>
  );
}
