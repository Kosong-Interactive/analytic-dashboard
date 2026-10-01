/**
 * A tiny in-memory cache for values that change once a day. It lives per server instance, so a cold
 * instance computes once and the next visits reuse the result until it expires. Concurrent callers
 * for the same key share one computation, and a failed computation is not cached.
 */
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { expiresAt: number; promise: Promise<T> }>();

  return {
    get(key: string, compute: () => Promise<T>): Promise<T> {
      const current = entries.get(key);
      if (current && current.expiresAt > now()) return current.promise;

      const promise = compute();
      entries.set(key, { expiresAt: now() + ttlMs, promise });
      promise.catch(() => {
        if (entries.get(key)?.promise === promise) entries.delete(key);
      });
      return promise;
    },
    clear() {
      entries.clear();
    },
  };
}
