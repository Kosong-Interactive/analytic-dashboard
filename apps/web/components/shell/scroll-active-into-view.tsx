"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A horizontally scrolling row that brings its `aria-current="page"` item into view, so the
 * current section is visible on a phone even when it sits past the right edge.
 */
export function ScrollActiveIntoView({ className, label, children }: { className?: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = ref.current;
    const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !current) return;
    row.scrollLeft = current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2;
  });
  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
