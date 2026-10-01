import Link from "next/link";

export default function GameNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">Game not found</h1>
      <p className="text-base text-dim">This listing is not tracked, or the link is incorrect.</p>
      <Link href="/trending" className="h-8 rounded-md border border-line-strong px-3 text-base leading-8 hover:bg-surface">
        Browse games
      </Link>
    </main>
  );
}
