import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary";
};

/** Link semantics with the visual affordance and focus treatment of a button. */
export function LinkButton({ className, variant = "primary", ...props }: LinkButtonProps) {
  return (
    <Link
      {...props}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-opacity",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        variant === "primary"
          ? "bg-accent text-canvas hover:opacity-90"
          : "border border-line-strong bg-surface text-ink-soft hover:bg-surface-alt",
        className,
      )}
    />
  );
}
