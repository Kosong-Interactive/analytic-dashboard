import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets so the login page can load its styles and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|kosong-interactive.png).*)"],
};
