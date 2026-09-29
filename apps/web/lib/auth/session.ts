import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "../supabase/server";
import { loginPath } from "./redirect";

export interface CurrentUser {
  id: string;
  email: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/** Call at the top of every protected page, before any data is read. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(returnTo));
  return user;
}
