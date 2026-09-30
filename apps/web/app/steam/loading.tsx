import { AppShell } from "@/components/shell/app-shell";

export default function Loading() {
  return (
    <AppShell filters={{ country: "id", platform: "all" }} active="steam-overview">
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        <span className="sr-only">Loading Steam overview</span>
        <div className="h-12 w-72 max-w-full animate-pulse rounded-lg bg-surface" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-[108px] animate-pulse rounded-[10px] bg-surface" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-[10px] bg-surface" />
      </div>
    </AppShell>
  );
}
