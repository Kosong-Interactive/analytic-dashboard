import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appLabelAssignmentSchema,
  appSnapshotSchema,
  storeContextSchema,
} from "./index.js";

describe("store contracts", () => {
  it("accepts only configured countries and sources", () => {
    assert.equal(
      storeContextSchema.safeParse({
        store: "app_store",
        country: "id",
        locale: "id_ID",
      }).success,
      true,
    );
    assert.equal(
      storeContextSchema.safeParse({
        store: "unknown",
        country: "sg",
        locale: "en_SG",
      }).success,
      false,
    );
  });
});

describe("snapshot contracts", () => {
  const validSnapshot = {
    storeAppId: "9aeaa9f1-d8ad-4999-9dc4-d087925a67cc",
    capturedAt: "2026-09-29T10:00:00.000Z",
    rating: 4.5,
    ratingCount: 100,
    reviewCount: 80,
    minInstalls: 1_000,
    maxInstalls: 5_000,
    price: 0,
    currency: "usd",
    version: "1.0.0",
  };

  it("normalizes currency while preserving nullable missing metrics", () => {
    const result = appSnapshotSchema.parse({
      ...validSnapshot,
      currency: "idr",
      reviewCount: null,
    });

    assert.equal(result.currency, "IDR");
    assert.equal(result.reviewCount, null);
  });

  it("rejects invalid ratings and reversed install ranges", () => {
    assert.equal(
      appSnapshotSchema.safeParse({ ...validSnapshot, rating: 6 }).success,
      false,
    );
    assert.equal(
      appSnapshotSchema.safeParse({
        ...validSnapshot,
        minInstalls: 10_000,
        maxInstalls: 1_000,
      }).success,
      false,
    );
  });
});

describe("classification contracts", () => {
  const baseAssignment = {
    appId: "9aeaa9f1-d8ad-4999-9dc4-d087925a67cc",
    labelSlug: "match-3",
    labelType: "core_mechanic",
    confidence: 0.92,
    evidence: [{ field: "description", excerpt: "Match colorful tiles." }],
    taxonomyVersion: "v1",
    inputHash: "sha256:example",
  } as const;

  it("requires AI provenance", () => {
    assert.equal(
      appLabelAssignmentSchema.safeParse({
        ...baseAssignment,
        source: "ai",
        promptVersion: "v1",
        model: "small-classifier",
        isManualOverride: false,
      }).success,
      true,
    );
    assert.equal(
      appLabelAssignmentSchema.safeParse({
        ...baseAssignment,
        source: "ai",
        promptVersion: null,
        model: null,
        isManualOverride: false,
      }).success,
      false,
    );
  });

  it("requires manual assignments to be marked as overrides", () => {
    assert.equal(
      appLabelAssignmentSchema.safeParse({
        ...baseAssignment,
        source: "manual",
        promptVersion: null,
        model: null,
        isManualOverride: true,
      }).success,
      true,
    );
  });
});
