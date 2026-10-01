"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Only the digest is logged; the message can contain connection details.
    console.error("overview failed", error.digest);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">The overview could not be loaded</h1>
      <p className="text-base text-dim">
        The data source did not respond. Nothing was changed. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="h-8 rounded-md border border-line-strong px-3 text-base hover:bg-surface"
      >
        Try again
      </button>
    </main>
  );
}
