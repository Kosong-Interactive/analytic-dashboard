import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { loginPath } from "../auth/redirect";

/**
 * Refreshes the Supabase session cookie and sends signed-out visitors to /login.
 * Pages still verify the user themselves (`requireUser`); this is the first line, not the only one.
 */
export async function updateSession(request: NextRequest) {
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
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;
  const onLogin = pathname === "/login";

  if (!signedIn && !onLogin) {
    return NextResponse.redirect(new URL(loginPath(pathname + search), request.url));
  }
  if (signedIn && onLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}
