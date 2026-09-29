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

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
}

// Only built pages are links; the rest are listed so the planned scope is visible.
const NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "Trending Games", icon: TrendingUp },
  { label: "New Releases", icon: Zap },
  { label: "Genres", icon: Layers },
  { label: "Mechanics", icon: SlidersHorizontal },
  { label: "Games", icon: Gamepad2 },
  { label: "Watchlist", icon: Eye },
];

export function Sidebar() {
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
          <span className="text-[13px] font-semibold leading-none tracking-[0.16em]">
            GAME INTEL
          </span>
          <span className="text-[10.5px] leading-none text-dim">by Kosong Interactive</span>
        </div>
      </div>
      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2.5 py-3.5">
        {NAV.map(({ label, icon: Icon, href }) =>
          href ? (
            <Link
              key={label}
              href={href}
              aria-current="page"
              className="flex h-8 items-center gap-2.5 rounded-md bg-[#181b20] px-2.5 text-[13px] text-ink"
            >
              <Icon aria-hidden className="size-4 text-accent" strokeWidth={1.7} />
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
