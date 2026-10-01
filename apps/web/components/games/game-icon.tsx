import Image from "next/image";

import { initials } from "@/lib/format/format";
import { cn } from "@/lib/utils";

interface GameIconProps {
  title: string;
  iconUrl: string | null;
  size: number;
  className?: string;
}

/** Store icon, or the title's initials when the store gave none. Decorative: the title sits beside it. */
export function GameIcon({ title, iconUrl, size, className }: GameIconProps) {
  const shape = cn("shrink-0 rounded-[22%]", className);
  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className={cn(shape, "bg-surface-alt object-cover")}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(shape, "flex items-center justify-center bg-accent/80 font-mono text-[13px] font-medium text-canvas")}
    >
      {initials(title)}
    </span>
  );
}
