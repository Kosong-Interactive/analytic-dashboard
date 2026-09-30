import { AppShell } from "@/components/shell/app-shell";

export default function Loading() {
  return (
    <AppShell filters={{ country: "id", platform: "all" }} active="steam-trending">
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        <span className="sr-only">Loading Steam trending</span>
        <div className="h-12 w-72 max-w-full animate-pulse rounded-lg bg-surface" />
        <div className="h-96 animate-pulse rounded-[10px] bg-surface" />
      </div>
    </AppShell>
  );
}
