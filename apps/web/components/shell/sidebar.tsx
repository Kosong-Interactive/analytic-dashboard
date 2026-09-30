import {
  Gamepad2,
  Layers,
  LayoutDashboard,
  SlidersHorizontal,
  Monitor,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type NavKey = "overview" | "trending" | "releases" | "genres" | "mechanics" | "games" | "steam" | "steam-genres" | "steam-mechanics";

/** Which side of the market a page belongs to; Mobile and Desktop metrics are never mixed. */
export type PlatformMode = "mobile" | "desktop";

export function platformModeOf(key: NavKey): PlatformMode {
  return key.startsWith("steam") ? "desktop" : "mobile";
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  key: NavKey;
  href: string;
}

const MOBILE_NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, key: "overview", href: "/" },
  { label: "Trending Games", icon: TrendingUp, key: "trending", href: "/trending" },
  { label: "New Releases", icon: Zap, key: "releases", href: "/new-releases" },
  { label: "Genres", icon: Layers, key: "genres", href: "/genres" },
  { label: "Mechanics", icon: SlidersHorizontal, key: "mechanics", href: "/mechanics" },
  { label: "Games", icon: Gamepad2, key: "games", href: "/games" },
];

const DESKTOP_NAV: NavItem[] = [
  { label: "Steam Charts", icon: Monitor, key: "steam", href: "/steam" },
  { label: "Genres", icon: Layers, key: "steam-genres", href: "/steam/genres" },
  { label: "Mechanics", icon: SlidersHorizontal, key: "steam-mechanics", href: "/steam/mechanics" },
];

const GROUPS: Array<{ title: string; items: NavItem[] }> = [
  { title: "Mobile", items: MOBILE_NAV },
  { title: "Desktop", items: DESKTOP_NAV },
];

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

/** The primary links, shared by the desktop sidebar and the mobile drawer. */
export function NavList({ active, onNavigate }: { active: NavKey; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-4 px-2.5 py-3.5">
      {GROUPS.map(({ title, items }) => (
        <div key={title} role="group" aria-label={title} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[10.5px] font-medium uppercase tracking-wider text-dim">{title}</p>
          {items.map(({ label, icon: Icon, key, href }) => (
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
          ))}
        </div>
      ))}
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
