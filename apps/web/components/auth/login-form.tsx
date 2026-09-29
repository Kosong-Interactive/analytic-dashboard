"use client";

import { useActionState } from "react";

import { signIn, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null, email: "" };
const inputClass =
  "h-10 w-full rounded-md border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-dim focus-visible:outline-2 focus-visible:outline-accent";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          defaultValue={state.email}
          placeholder="you@company.com"
          className={inputClass}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </label>
      {state.error ? (
        <p id="login-error" role="alert" className="text-[13px] text-down">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-accent text-sm font-medium text-canvas hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
