import {
  countryCodeSchema,
  storeSchema,
  storeValues,
  type CountryCode,
  type Store,
} from "@analytic-dashboard/shared";

import { loadEnabledCountries } from "./runtime/config.js";

export interface CollectorDescriptor {
  countries: CountryCode[];
  sources: Store[];
}

/** The storefronts enabled in `config/countries/enabled.json`, not every storefront the code supports. */
export function createCollectorDescriptor(
  enabledCountries: readonly string[] = Object.keys(loadEnabledCountries().countries),
): CollectorDescriptor {
  return {
    countries: enabledCountries.map((country) => countryCodeSchema.parse(country)),
    sources: storeValues.map((store) => storeSchema.parse(store)),
  };
}
