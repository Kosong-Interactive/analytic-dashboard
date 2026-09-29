import { buildSearchGroups, searchTextSchema, type CatalogResultInput, type SearchResponse } from "./results";

export type SearchHttpResult =
  | { status: 200; body: SearchResponse }
  | { status: 400 | 401 | 500; body: { error: string } };

export interface SearchHttpDependencies {
  isSignedIn: () => Promise<boolean>;
  search: (text: string) => Promise<CatalogResultInput>;
  /** Receives only the error name, never the query text or database message. */
  logFailure: (errorName: string) => void;
}

/** The route handler's logic without Next.js, so every status path is testable. */
export async function handleSearchRequest(
  params: URLSearchParams,
  deps: SearchHttpDependencies,
): Promise<SearchHttpResult> {
  if (!(await deps.isSignedIn())) return { status: 401, body: { error: "Sign in to search." } };

  const text = searchTextSchema.safeParse(params.get("q") ?? "");
  if (!text.success) return { status: 400, body: { error: "Search needs 2 to 80 characters." } };

  try {
    const result = await deps.search(text.data);
    return { status: 200, body: { query: text.data, groups: buildSearchGroups(text.data, result) } };
  } catch (error) {
    deps.logFailure(error instanceof Error ? error.name : "unknown");
    return { status: 500, body: { error: "Search is unavailable right now. Try again." } };
  }
}
