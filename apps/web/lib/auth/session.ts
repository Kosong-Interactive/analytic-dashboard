import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "../supabase/server";
import { loadSigningKeys } from "../supabase/signing-keys";
import { loginPath } from "./redirect";

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** Verified once per request: the page and the app shell both ask, and share the answer. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const [supabase, jwks] = await Promise.all([createClient(), loadSigningKeys()]);
  const { data } = await supabase.auth.getClaims(undefined, jwks ? { jwks } : undefined);
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** Call at the top of every protected page, before any data is read. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(returnTo));
  return user;
}
