import { z } from "zod";

import { parseOverviewFilters, type OverviewFilters } from "../overview/filters";
import type { LabelSort } from "./aggregate";

export const labelSortValues = ["games", "momentum", "new", "rating"] as const satisfies readonly LabelSort[];
export const labelSortLabels: Record<LabelSort, string> = {
  games: "Most games",
  momentum: "Momentum",
  new: "New in 7 days",
  rating: "Average rating",
};

export interface LabelPageConfig<T extends string> {
  path: string;
  types: readonly T[];
  typeLabels: Record<T, string>;
}

export type LabelQuery<T extends string> = OverviewFilters & { type: T; sort: LabelSort };

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseLabelQuery<T extends string>(
  config: LabelPageConfig<T>,
  params: RawSearchParams,
): LabelQuery<T> {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const [defaultType] = config.types;
  if (!defaultType) throw new Error("A label page needs at least one type");
  const shape = z.object({
    type: z.enum(config.types as unknown as [T, ...T[]]).catch(defaultType),
    sort: z.enum(labelSortValues).catch("games"),
  });
  const parsed = shape.parse({ type: first(params.type), sort: first(params.sort) });
  return { ...parseOverviewFilters(params), type: parsed.type as T, sort: parsed.sort };
}

export function labelHref<T extends string>(
  config: LabelPageConfig<T>,
  current: LabelQuery<T>,
  change: Partial<LabelQuery<T>>,
): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.platform !== "all") query.set("platform", next.platform);
  if (next.type !== config.types[0]) query.set("type", next.type);
  if (next.sort !== "games") query.set("sort", next.sort);
  const text = query.toString();
  return text ? `${config.path}?${text}` : config.path;
}

export const genresPage: LabelPageConfig<"genre" | "subgenre"> = {
  path: "/genres",
  types: ["genre", "subgenre"],
  typeLabels: { genre: "Genres", subgenre: "Subgenres" },
};

export const mechanicsPage: LabelPageConfig<"core_mechanic" | "meta_mechanic" | "theme" | "multiplayer_mode"> = {
  path: "/mechanics",
  types: ["core_mechanic", "meta_mechanic", "theme", "multiplayer_mode"],
  typeLabels: {
    core_mechanic: "Core mechanics",
    meta_mechanic: "Meta mechanics",
    theme: "Themes",
    multiplayer_mode: "Multiplayer",
  },
};
