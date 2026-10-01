import { z } from "zod";

/**
 * Every storefront this system can collect, grouped into markets in `markets.ts`. A code listed here
 * is only collected once it is also enabled in `config/countries/enabled.json`.
 */
export const supportedCountryCodes = ["id", "us", "sg", "th", "vn", "ph", "my", "jp", "kr", "gb", "de", "br", "in"] as const;
export const storeValues = ["app_store", "google_play"] as const;

export const countryCodeSchema = z.enum(supportedCountryCodes);
export const storeSchema = z.enum(storeValues);
export const localeSchema = z
  .string()
  .min(2)
  .max(16)
  .regex(/^[a-z]{2}(?:[-_][A-Z]{2})?$/, "Invalid locale format");

export const storeContextSchema = z.object({
  store: storeSchema,
  country: countryCodeSchema,
  locale: localeSchema,
});

export const storeListingIdentitySchema = storeContextSchema.extend({
  externalId: z.string().trim().min(1),
});

export type CountryCode = z.infer<typeof countryCodeSchema>;
export type Store = z.infer<typeof storeSchema>;
export type StoreContext = z.infer<typeof storeContextSchema>;
export type StoreListingIdentity = z.infer<
  typeof storeListingIdentitySchema
>;
