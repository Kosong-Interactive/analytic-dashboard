import {
  countryCodeSchema,
  storeSchema,
  supportedCountryCodes,
  storeValues,
  type CountryCode,
  type Store,
} from "@analytic-dashboard/shared";

export interface CollectorDescriptor {
  countries: CountryCode[];
  sources: Store[];
}

export function createCollectorDescriptor(): CollectorDescriptor {
  return {
    countries: supportedCountryCodes.map((country) =>
      countryCodeSchema.parse(country),
    ),
    sources: storeValues.map((store) => storeSchema.parse(store)),
  };
}
