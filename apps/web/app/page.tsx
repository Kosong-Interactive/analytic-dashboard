import Image from "next/image";

const foundationItems = [
  "Next.js App Router",
  "Strict TypeScript",
  "Tailwind CSS",
  "npm workspaces",
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12">
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
            <Image
              src="/kosong-interactive.png"
              alt="Kosong Interactive"
              width={48}
              height={48}
              priority
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Kosong Interactive
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Mobile Game Intelligence
            </h1>
          </div>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Foundation
        </span>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-slate-500">Phase 0.1</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Dashboard foundation is ready.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            The web workspace is prepared for store collection, historical
            snapshots, trend analytics, and AI-assisted game classification.
          </p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {foundationItems.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-700 shadow-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
