import { AppShell } from "@/components/shell/app-shell";

export default function Loading() {
  return (
    <AppShell filters={{ country: "id", platform: "all" }} active="games">
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        <span className="sr-only">Loading game</span>
        <div className="h-20 w-96 max-w-full animate-pulse rounded-lg bg-surface" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-[10px] bg-surface" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-[10px] bg-surface" />
      </div>
    </AppShell>
  );
}
