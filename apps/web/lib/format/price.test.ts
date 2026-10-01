import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectPriceChanges, formatUpfrontPrice, matchesPriceFilter } from "./price";

describe("formatUpfrontPrice", () => {
  it("shows zero as Gratis and null as a dash, never the other way round", () => {
    assert.equal(formatUpfrontPrice(0, "IDR"), "Gratis");
    assert.equal(formatUpfrontPrice(0, "USD"), "Gratis");
    assert.equal(formatUpfrontPrice(0, null), "Gratis");
    assert.equal(formatUpfrontPrice(null, "IDR"), "—");
    assert.equal(formatUpfrontPrice(null, null), "—");
  });

  it("formats rupiah without decimals and dollars with cents", () => {
    assert.equal(formatUpfrontPrice(15000, "IDR"), "Rp 15.000");
    assert.equal(formatUpfrontPrice(1250000, "IDR"), "Rp 1.250.000");
    assert.equal(formatUpfrontPrice(4.99, "USD"), "$4.99");
    assert.equal(formatUpfrontPrice(5, "USD"), "$5.00");
    assert.equal(formatUpfrontPrice(1299, "USD"), "$1,299.00");
  });

  it("shows unknown currencies as an amount and its code", () => {
    assert.equal(formatUpfrontPrice(12.5, "EUR"), "12.50 EUR");
    assert.equal(formatUpfrontPrice(3, "eur"), "3 EUR");
  });
});

describe("matchesPriceFilter", () => {
  it("keeps unpriced games out of both Gratis and Berbayar", () => {
    assert.equal(matchesPriceFilter(null, "all"), true);
    assert.equal(matchesPriceFilter(null, "free"), false);
    assert.equal(matchesPriceFilter(null, "paid"), false);
    assert.equal(matchesPriceFilter(0, "free"), true);
    assert.equal(matchesPriceFilter(0, "paid"), false);
    assert.equal(matchesPriceFilter(4.99, "paid"), true);
    assert.equal(matchesPriceFilter(4.99, "free"), false);
  });
});

describe("detectPriceChanges", () => {
  const at = (day: number) => new Date(Date.UTC(2026, 8, day));

  it("reports each change with the old and new price", () => {
    const changes = detectPriceChanges([
      { capturedAt: at(1), price: 4.99, currency: "USD" },
      { capturedAt: at(2), price: 4.99, currency: "USD" },
      { capturedAt: at(3), price: 2.99, currency: "USD" },
    ]);
    assert.deepEqual(changes, [{ at: at(3), from: 4.99, to: 2.99, currency: "USD" }]);
  });

  it("does not treat a missing reading as a change", () => {
    const changes = detectPriceChanges([
      { capturedAt: at(1), price: 4.99, currency: "USD" },
      { capturedAt: at(2), price: null, currency: null },
      { capturedAt: at(3), price: 4.99, currency: "USD" },
    ]);
    assert.deepEqual(changes, []);
  });

  it("reports a switch to free", () => {
    const changes = detectPriceChanges([
      { capturedAt: at(1), price: 15000, currency: "IDR" },
      { capturedAt: at(2), price: 0, currency: "IDR" },
    ]);
    assert.equal(changes[0]?.to, 0);
  });
});
