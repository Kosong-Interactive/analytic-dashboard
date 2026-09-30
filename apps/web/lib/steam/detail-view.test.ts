import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SteamGameDetail } from "@analytic-dashboard/db";

import { buildSteamMetrics, buildSteamSeries } from "./detail-view";

const at = (day: number) => new Date(Date.UTC(2026, 8, day));

function snap(day: number, players: number | null, positive: number | null, negative: number | null) {
  return {
    capturedAt: at(day),
    reviewPositive: positive,
    reviewNegative: negative,
    reviewTotal: positive === null || negative === null ? null : positive + negative,
    reviewsCapturedAt: positive === null ? null : at(day),
    currentPlayers: players,
    playersCapturedAt: players === null ? null : at(day),
  };
}

describe("buildSteamSeries", () => {
  it("skips missing readings instead of drawing zero", () => {
    const series = buildSteamSeries({
      snapshots: [snap(1, 100, 90, 10), snap(2, null, 91, 9), snap(3, 0, null, null)],
      ranks: [
        { chart: "most_played", rank: 5, lastWeekRank: null, capturedAt: at(1) },
        { chart: "top_sellers", rank: 2, lastWeekRank: null, capturedAt: at(1) },
      ],
    });
    assert.deepEqual(series.players.map((p) => p.value), [100, 0]);
    assert.deepEqual(series.positive.map((p) => p.value), [90, 91]);
    assert.deepEqual(series.reviews.map((p) => p.value), [100, 100]);
    assert.deepEqual(series.mostPlayedRank.map((p) => p.value), [5]);
    assert.deepEqual(series.topSellersRank.map((p) => p.value), [2]);
  });
});

describe("buildSteamMetrics", () => {
  const base = { snapshot: snap(1, 1200, 90, 10), ranks: [], prices: {}, isFree: false } satisfies Pick<SteamGameDetail, "snapshot" | "ranks" | "prices" | "isFree">;
  const byLabel = (metrics: ReturnType<typeof buildSteamMetrics>) => new Map(metrics.map((m) => [m.label, m]));

  it("labels player and review figures as Global and never shows a missing value as zero", () => {
    const metrics = byLabel(buildSteamMetrics({ ...base, snapshot: null }, "id"));
    assert.equal(metrics.get("Players now")?.value, "—");
    assert.equal(metrics.get("Positive reviews")?.value, "—");
    assert.equal(metrics.get("Chart rank")?.value, "—");
    assert.equal(metrics.get("Price · Indonesia")?.value, "—");
    const known = byLabel(buildSteamMetrics(base, "id"));
    assert.equal(known.get("Positive reviews")?.value, "90.0%");
    assert.match(known.get("Players now")?.note ?? "", /Global/);
  });

  it("uses the best chart position and its move against last week", () => {
    const metrics = byLabel(
      buildSteamMetrics(
        {
          ...base,
          ranks: [
            { chart: "most_played", rank: 12, lastWeekRank: 20, capturedAt: at(3) },
            { chart: "top_sellers", rank: 4, lastWeekRank: 2, capturedAt: at(3) },
            { chart: "top_sellers", rank: 9, lastWeekRank: 9, capturedAt: at(1) },
          ],
        },
        "us",
      ),
    );
    assert.equal(metrics.get("Chart rank")?.value, "#4");
    assert.equal(metrics.get("Rank vs last week")?.value, "−2");
  });

  it("shows the selected country's price, and Gratis for a free game", () => {
    const price = { country: "id", currency: "IDR", initialPrice: 150000, finalPrice: 150000, discountPercent: 0, capturedAt: at(1) };
    assert.equal(byLabel(buildSteamMetrics({ ...base, prices: { id: price } }, "id")).get("Price · Indonesia")?.value, "Rp 150.000");
    assert.equal(byLabel(buildSteamMetrics({ ...base, isFree: true }, "us")).get("Price · Global (US)")?.value, "Gratis");
  });
});
