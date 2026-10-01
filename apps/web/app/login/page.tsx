import Image from "next/image";

import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata = { title: "Sign in · Game Analytic" };

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-[10px] border border-line bg-surface p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/kosong-interactive.png" alt="" width={40} height={40} priority />
          <div className="flex flex-col gap-1">
            <h1 className="text-[17px] font-semibold leading-none">Game Analytic</h1>
            <p className="text-sm leading-none text-dim">by Kosong Interactive</p>
          </div>
        </div>
        <p className="mb-5 text-[15px] text-dim">Sign in to view the game market dashboard.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
