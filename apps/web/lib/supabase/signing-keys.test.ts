import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.example.supabase.co";

describe("loadSigningKeys", () => {
  it("returns undefined on a bad response, then fetches once and serves later calls from cache", async () => {
    const { loadSigningKeys } = await import("./signing-keys");
    const calls: string[] = [];
    const original = globalThis.fetch;
    let body: unknown = { keys: [] };
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    try {
      // An empty key set is not cached, so the SDK keeps fetching keys itself.
      assert.equal(await loadSigningKeys(), undefined);

      body = { keys: [{ kty: "EC", kid: "k1", alg: "ES256", crv: "P-256", x: "x", y: "y" }] };
      const [first, second] = await Promise.all([loadSigningKeys(), loadSigningKeys()]);
      const third = await loadSigningKeys();
      assert.equal(first?.keys[0]?.kid, "k1");
      assert.deepEqual(first?.keys[0]?.key_ops, ["verify"]);
      assert.equal((first?.keys[0] as Record<string, unknown> | undefined)?.crv, "P-256");
      assert.equal(second, first);
      assert.equal(third, first);
      assert.equal(calls.length, 2);
      assert.equal(calls[0], "https://project.example.supabase.co/auth/v1/.well-known/jwks.json");
    } finally {
      globalThis.fetch = original;
    }
  });
});
