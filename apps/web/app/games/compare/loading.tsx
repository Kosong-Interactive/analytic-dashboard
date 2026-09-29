import { AppShell } from "@/components/shell/app-shell";

export default function Loading() {
  return (
    <AppShell filters={{ country: "id", platform: "all" }} active="games">
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        <span className="sr-only">Loading comparison</span>
        <div className="h-14 w-72 animate-pulse rounded-lg bg-surface" />
        <div className="h-28 animate-pulse rounded-[10px] bg-surface" />
        <div className="h-96 animate-pulse rounded-[10px] bg-surface" />
      </div>
    </AppShell>
  );
}
