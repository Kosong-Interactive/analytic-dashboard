import {
  Eye,
  Gamepad2,
  Layers,
  LayoutDashboard,
  SlidersHorizontal,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type NavKey = "overview" | "trending" | "releases" | "genres" | "mechanics" | "games" | "watchlist";

interface NavItem {
  label: string;
  icon: LucideIcon;
  key?: NavKey;
  href?: string;
}

// Only built pages are links; the rest are listed so the planned scope is visible.
const NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, key: "overview", href: "/" },
  { label: "Trending Games", icon: TrendingUp, key: "trending", href: "/trending" },
  { label: "New Releases", icon: Zap, key: "releases", href: "/new-releases" },
  { label: "Genres", icon: Layers, key: "genres", href: "/genres" },
  { label: "Mechanics", icon: SlidersHorizontal, key: "mechanics", href: "/mechanics" },
  { label: "Games", icon: Gamepad2, key: "games", href: "/games" },
  { label: "Watchlist", icon: Eye, key: "watchlist", href: "/watchlist" },
];

export function Sidebar({ active }: { active: NavKey }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-rail lg:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <Image
          src="/kosong-interactive.png"
          alt="Kosong Interactive"
          width={38}
          height={38}
          priority
          className="-ml-1 shrink-0"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold leading-none">
            Game Analytic
          </span>
          <span className="text-[10.5px] leading-none text-dim">by Kosong Interactive</span>
        </div>
      </div>
      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2.5 py-3.5">
        {NAV.map(({ label, icon: Icon, key, href }) =>
          href ? (
            <Link
              key={label}
              href={href}
              aria-current={key === active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] hover:bg-[#14171b]",
                key === active ? "bg-[#181b20] text-ink" : "text-ink-soft",
              )}
            >
              <Icon
                aria-hidden
                className={cn("size-4", key === active ? "text-accent" : "text-dim")}
                strokeWidth={1.7}
              />
              {label}
            </Link>
          ) : (
            <span
              key={label}
              aria-disabled="true"
              className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-dim/70"
            >
              <Icon aria-hidden className="size-4" strokeWidth={1.7} />
              <span className="flex-1">{label}</span>
              <span className="text-[10px] uppercase tracking-wider">Soon</span>
            </span>
          ),
        )}
      </nav>
    </aside>
  );
}

/** Below the `lg` breakpoint the sidebar is hidden, so built pages stay reachable from a compact row. */
export function MobileNav({ active }: { active: NavKey }) {
  const links = NAV.filter((item) => item.href);
  return (
    <nav
      aria-label="Primary"
      className="flex gap-1 overflow-x-auto border-b border-line bg-rail px-4 py-1.5 sm:px-7 lg:hidden"
    >
      {links.map(({ label, icon: Icon, key, href }) => (
        <Link
          key={label}
          href={href ?? "/"}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-[13px]",
            key === active ? "bg-[#181b20] text-ink" : "text-dim",
          )}
        >
          <Icon aria-hidden className="size-4" strokeWidth={1.7} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
