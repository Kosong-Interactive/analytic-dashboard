import { z } from "zod";

/** Same lifetime the Supabase SDK uses for its own key cache. */
const SIGNING_KEYS_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;

const signingKeysSchema = z.object({
  keys: z.array(
    z.looseObject({
      kty: z.enum(["RSA", "EC", "oct"]),
      kid: z.string().optional(),
      alg: z.string().optional(),
      key_ops: z.array(z.string()).default(["verify"]),
    }),
  ),
});

export type SigningKeys = z.infer<typeof signingKeysSchema>;

let cached: { keys: SigningKeys; fetchedAt: number } | null = null;
let inflight: Promise<SigningKeys | undefined> | null = null;

/**
 * The project's public JWT signing keys, cached per server instance. `getClaims` builds a new
 * Supabase client on every request and the SDK caches keys per client, so without this every
 * session check refetched them over the network (about 250 ms each, several times per page).
 * Signatures are still verified; a token signed by a key missing here makes the SDK fetch the
 * current keys itself. `undefined` means "let the SDK fetch", never "skip verification".
 */
export async function loadSigningKeys(): Promise<SigningKeys | undefined> {
  if (cached && Date.now() - cached.fetchedAt < SIGNING_KEYS_TTL_MS) return cached.keys;
  inflight ??= fetchSigningKeys().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function fetchSigningKeys(): Promise<SigningKeys | undefined> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;
  try {
    const response = await fetch(`${url}/auth/v1/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    const parsed = signingKeysSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.keys.length === 0) return undefined;
    cached = { keys: parsed.data, fetchedAt: Date.now() };
    return parsed.data;
  } catch (error) {
    // The SDK falls back to fetching the keys itself, so this only costs speed.
    console.warn("signing key fetch failed", error instanceof Error ? error.name : "unknown");
    return undefined;
  }
}
