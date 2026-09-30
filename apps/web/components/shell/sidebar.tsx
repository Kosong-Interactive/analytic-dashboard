import {
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

export type NavKey = "overview" | "trending" | "releases" | "genres" | "mechanics" | "games";

interface NavItem {
  label: string;
  icon: LucideIcon;
  key: NavKey;
  href: string;
}

const NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, key: "overview", href: "/" },
  { label: "Trending Games", icon: TrendingUp, key: "trending", href: "/trending" },
  { label: "New Releases", icon: Zap, key: "releases", href: "/new-releases" },
  { label: "Genres", icon: Layers, key: "genres", href: "/genres" },
  { label: "Mechanics", icon: SlidersHorizontal, key: "mechanics", href: "/mechanics" },
  { label: "Games", icon: Gamepad2, key: "games", href: "/games" },
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
    <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2.5 py-3.5">
      {NAV.map(({ label, icon: Icon, key, href }) => (
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
