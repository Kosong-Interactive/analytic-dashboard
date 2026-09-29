"use server";

import { redirect } from "next/navigation";

import { credentialsSchema } from "@/lib/auth/credentials";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
  /** Echoed back so the form can refill it; the password is never returned. */
  email: string;
}

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const submittedEmail = String(formData.get("email") ?? "");
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email address and your password.", email: submittedEmail };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Only the code is logged: never the email or password. The message is the same for
    // unknown accounts and wrong passwords so it cannot be used to discover accounts.
    console.warn("sign-in failed", error.code ?? error.status);
    return { error: "Incorrect email or password.", email: submittedEmail };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
