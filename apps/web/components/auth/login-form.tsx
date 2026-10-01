"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";

import { signIn, type LoginState } from "@/app/login/actions";

const initialState: LoginState = { error: null, email: "" };
const inputClass =
  "h-10 w-full rounded-md border border-line-strong bg-canvas px-3 text-base text-ink placeholder:text-dim focus-visible:outline-2 focus-visible:outline-accent";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-[15px] text-ink-soft">
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
      <div className="flex flex-col gap-1.5 text-[15px] text-ink-soft">
        <label htmlFor="login-password">Password</label>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputClass} pr-10`}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls="login-password"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-dim hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        </div>
      </div>
      {state.error ? (
        <p id="login-error" role="alert" className="text-[15px] text-down">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-md bg-accent text-base font-medium text-canvas hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
