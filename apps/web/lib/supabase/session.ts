import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { loginPath } from "../auth/redirect";
import { loadSigningKeys } from "./signing-keys";

/**
 * Refreshes the Supabase session cookie and sends signed-out visitors to /login.
 * Pages still verify the user themselves (`requireUser`); this is the first line, not the only one.
 */
export async function updateSession(request: NextRequest) {
  // Loaded before the client exists, so nothing runs between createServerClient and getClaims.
  const jwks = await loadSigningKeys();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Nothing may run between createServerClient and getClaims, or sessions can drop at random.
  const { data } = await supabase.auth.getClaims(undefined, jwks ? { jwks } : undefined);
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;
  const onLogin = pathname === "/login";

  // A fetch cannot follow a redirect to an HTML login page, so API routes answer 401 instead.
  if (!signedIn && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (!signedIn && !onLogin) {
    return NextResponse.redirect(new URL(loginPath(pathname + search), request.url));
  }
  if (signedIn && onLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}
