import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Panel } from "./panel";

const LINKS = [
  { href: "/genres", title: "Genres", text: "Spread of tracked games across genres and subgenres" },
  { href: "/mechanics", title: "Mechanics", text: "Core and meta mechanics, themes, and multiplayer modes" },
];

export function ClassificationLinks() {
  return (
    <Panel title="Genres and mechanics" description="Inferred from store genres and keyword rules">
      <ul className="grid gap-px border-t border-line-soft sm:grid-cols-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-[#13161a]">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-medium">{link.title}</span>
                <span className="text-sm text-dim">{link.text}</span>
              </span>
              <ArrowRight aria-hidden className="size-4 shrink-0 text-dim" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
