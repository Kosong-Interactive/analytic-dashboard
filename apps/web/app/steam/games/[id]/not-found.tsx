import Link from "next/link";

export default function SteamGameNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold">Steam game not found</h1>
      <p className="text-sm text-dim">This game is not tracked, or the link is incorrect.</p>
      <Link href="/steam/games" className="h-8 rounded-md border border-line-strong px-3 text-sm leading-8 hover:bg-surface">
        Back to Steam games
      </Link>
    </main>
  );
}
