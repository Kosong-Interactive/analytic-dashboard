import Link from "next/link";

export default function ResearchNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 text-center text-ink">
      <div>
        <h1 className="text-2xl font-semibold">Research result not found</h1>
        <p className="mt-2 text-base text-dim">It may have been removed or the link is invalid.</p>
        <Link href="/" className="mt-4 inline-flex h-9 items-center rounded-md border border-line-strong px-3 text-base hover:bg-surface">
          Return to Overview
        </Link>
      </div>
    </main>
  );
}
