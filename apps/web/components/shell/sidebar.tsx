import {
  Gamepad2,
  Layers,
  LayoutDashboard,
  Monitor,
  SlidersHorizontal,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { MODE_TITLES, navItemsFor, platformModeOf, type NavKey } from "@/lib/shell/navigation";
import { cn } from "@/lib/utils";

export type { NavKey, PlatformMode } from "@/lib/shell/navigation";
export { platformModeOf } from "@/lib/shell/navigation";

const ICONS: Record<NavKey, LucideIcon> = {
  overview: LayoutDashboard,
  trending: TrendingUp,
  releases: Zap,
  genres: Layers,
  mechanics: SlidersHorizontal,
  games: Gamepad2,
  "steam-overview": LayoutDashboard,
  "steam-trending": TrendingUp,
  "steam-releases": Zap,
  "steam-genres": Layers,
  "steam-mechanics": SlidersHorizontal,
  "steam-games": Gamepad2,
  "steam-charts": Monitor,
};

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/kosong-interactive.png"
        alt="Kosong Interactive"
        width={38}
        height={38}
        priority
        className="-ml-1 shrink-0"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold leading-none">Game Analytic</span>
        <span className="text-[10.5px] leading-none text-dim">by Kosong Interactive</span>
      </div>
    </div>
  );
}

/**
 * The primary links of the active mode only, shared by the desktop sidebar and the mobile drawer.
 * The group title marks the mode; the Mobile|Desktop switch in the top bar is the only way to change it.
 */
export function NavList({ active, onNavigate }: { active: NavKey; onNavigate?: () => void }) {
  const mode = platformModeOf(active);
  const title = MODE_TITLES[mode];
  return (
    <nav aria-label="Primary" className="flex flex-col gap-4 px-2.5 py-3.5">
      <div role="group" aria-label={title} className="flex flex-col gap-0.5">
        <p className="px-2.5 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-dim">{title}</p>
        {navItemsFor(mode).map(({ label, key, href }) => {
          const Icon = ICONS[key];
          return (
            <Link
              key={key}
              href={href}
              onClick={onNavigate}
              aria-current={key === active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] hover:bg-[#14171b] lg:h-8",
                key === active ? "bg-[#181b20] text-ink" : "text-ink-soft",
              )}
            >
              <Icon aria-hidden className={cn("size-4", key === active ? "text-accent" : "text-dim")} strokeWidth={1.7} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop only; below `lg` the same links open from the menu button in the top bar. */
export function Sidebar({ active }: { active: NavKey }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-rail lg:flex">
      <div className="flex h-14 items-center border-b border-line px-4">
        <Brand />
      </div>
      <NavList active={active} />
    </aside>
  );
}
