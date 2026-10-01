import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countryNames,
  marketHomeCountrySchema,
  marketHomeOf,
  marketCountries,
  marketHomeCountry,
  marketLabels,
  marketOf,
  marketValues,
} from "./markets.js";
import { supportedCountryCodes } from "./store.js";

describe("markets", () => {
  it("places every supported storefront in exactly one market", () => {
    for (const country of supportedCountryCodes) {
      const owners = marketValues.filter((market) => marketCountries[market].includes(country));
      assert.equal(owners.length, 1, `${country} belongs to ${owners.length} markets`);
      assert.equal(marketOf(country), owners[0]);
    }
  });

  it("lists no storefront that is not supported", () => {
    const supported = new Set<string>(supportedCountryCodes);
    for (const market of marketValues) {
      assert.ok(marketCountries[market].every((country) => supported.has(country)));
    }
  });

  it("keeps Indonesia on its own and gives SEA and World the agreed storefronts", () => {
    assert.deepEqual(marketCountries.id, ["id"]);
    assert.deepEqual(marketCountries.sea, ["sg", "th", "vn", "ph", "my"]);
    assert.deepEqual(marketCountries.world, ["us", "jp", "kr", "gb", "de", "br", "in"]);
  });

  it("starts each market on a storefront that belongs to it", () => {
    for (const market of marketValues) {
      assert.ok(marketCountries[market].includes(marketHomeCountry[market]));
      assert.equal(marketOf(marketHomeCountry[market]), market);
    }
  });

  it("names every market and storefront", () => {
    assert.deepEqual(marketValues.map((market) => marketLabels[market]), ["Indonesia", "SEA", "World"]);
    for (const country of supportedCountryCodes) assert.ok(countryNames[country].length > 0);
  });

  it("identifies each market by one storefront code", () => {
    assert.deepEqual(marketHomeCountrySchema.options, ["id", "sg", "us"]);
    assert.equal(marketHomeOf("jp"), "us");
    assert.equal(marketHomeOf("th"), "sg");
    assert.equal(marketHomeOf("id"), "id");
    for (const market of marketValues) assert.ok(marketHomeCountrySchema.safeParse(marketHomeCountry[market]).success);
  });
});
