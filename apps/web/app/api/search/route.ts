import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { searchStoredCatalog } from "@/lib/search/get-search";
import { handleSearchRequest } from "@/lib/search/http";

/** Search for the command palette. Results depend on the signed-in session, so nothing is cached. */
export async function GET(request: NextRequest) {
  const result = await handleSearchRequest(request.nextUrl.searchParams, {
    isSignedIn: async () => (await getCurrentUser()) !== null,
    search: (text) => searchStoredCatalog(text),
    logFailure: (errorName) => console.error("catalog search failed", errorName),
  });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
