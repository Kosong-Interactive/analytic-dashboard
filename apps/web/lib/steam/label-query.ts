import { steamCountrySchema } from "./query";
import { z } from "zod";

import type { SteamLabelSort } from "./label-overview";

export const steamLabelSortValues = ["games", "players", "rating"] as const satisfies readonly SteamLabelSort[];
export const steamLabelSortLabels: Record<SteamLabelSort, string> = {
  games: "Most games",
  players: "Players now",
  rating: "Positive reviews",
};

export interface SteamLabelPageConfig<T extends string> {
  path: string;
  types: readonly T[];
  typeLabels: Record<T, string>;
}

export const steamGenresPage: SteamLabelPageConfig<"genre" | "subgenre"> = {
  path: "/steam/genres",
  types: ["genre", "subgenre"],
  typeLabels: { genre: "Genres", subgenre: "Subgenres" },
};

export const steamMechanicsPage: SteamLabelPageConfig<"core_mechanic" | "meta_mechanic" | "theme" | "multiplayer_mode"> = {
  path: "/steam/mechanics",
  types: ["core_mechanic", "meta_mechanic", "theme", "multiplayer_mode"],
  typeLabels: {
    core_mechanic: "Core mechanics",
    meta_mechanic: "Meta mechanics",
    theme: "Themes",
    multiplayer_mode: "Multiplayer",
  },
};

export interface SteamLabelQuery<T extends string> {
  country: "id" | "us";
  type: T;
  sort: SteamLabelSort;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Unknown values fall back to defaults, so a bad shared link still renders. */
export function parseSteamLabelQuery<T extends string>(
  config: SteamLabelPageConfig<T>,
  params: RawSearchParams,
): SteamLabelQuery<T> {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const [defaultType] = config.types;
  if (!defaultType) throw new Error("A label page needs at least one type");
  const parsed = z
    .object({
      country: steamCountrySchema.catch("id"),
      type: z.enum(config.types as unknown as [T, ...T[]]).catch(defaultType),
      sort: z.enum(steamLabelSortValues).catch("games"),
    })
    .parse({ country: first(params.country), type: first(params.type), sort: first(params.sort) });
  return { country: parsed.country, type: parsed.type as T, sort: parsed.sort };
}

export function steamLabelHref<T extends string>(
  config: SteamLabelPageConfig<T>,
  current: SteamLabelQuery<T>,
  change: Partial<SteamLabelQuery<T>>,
): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.type !== config.types[0]) query.set("type", next.type);
  if (next.sort !== "games") query.set("sort", next.sort);
  const text = query.toString();
  return text ? `${config.path}?${text}` : config.path;
}
