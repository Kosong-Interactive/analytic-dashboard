import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, description, action, className, children }: PanelProps) {
  return (
    <section className={cn("rounded-[10px] border border-line bg-surface", className)}>
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="text-xs text-dim">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line-soft px-4 py-8 text-center">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-xl text-xs leading-5 text-dim">{children}</p>
    </div>
  );
}
