const cache = new Map<string, { value: unknown; expiresAt: number }>();
const inFlight = new Map<string, Promise<unknown>>();

export function cachedFetch<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt) return Promise.resolve(hit.value as T);

    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher()
        .then((value) => {
            cache.set(key, { value, expiresAt: Date.now() + ttl });
            inFlight.delete(key);
            return value;
        })
        .catch((err) => {
            inFlight.delete(key);
            throw err;
        });

    inFlight.set(key, promise);
    return promise;
}
