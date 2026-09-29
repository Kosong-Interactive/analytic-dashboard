import { z } from "zod";

import { WATCHLIST_NOTE_MAX, watchlistStatusValues } from "./status";

/** Form input for a watchlist change. An empty note clears it; a missing one leaves it unchanged. */
export const watchlistChangeSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("add"), storeAppId: z.uuid() }),
  z.object({
    intent: z.literal("update"),
    storeAppId: z.uuid(),
    status: z.enum(watchlistStatusValues).optional(),
    note: z
      .string()
      .max(WATCHLIST_NOTE_MAX)
      .transform((value) => value.trim() || null)
      .optional(),
  }),
  z.object({ intent: z.literal("remove"), storeAppId: z.uuid() }),
]);

export type WatchlistChange = z.infer<typeof watchlistChangeSchema>;

/** Reads a submitted form into the shape the schema validates; absent fields stay undefined. */
export function watchlistFormInput(formData: FormData): Record<string, unknown> {
  const value = (name: string) => {
    const entry = formData.get(name);
    return typeof entry === "string" ? entry : undefined;
  };
  return {
    intent: value("intent"),
    storeAppId: value("storeAppId"),
    status: value("status") || undefined,
    note: value("note"),
  };
}
