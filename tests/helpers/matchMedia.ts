import { vi } from "vitest";

export function installMatchMedia(initial: Record<string, boolean> = {}) {
    const queries = new Map<string, MediaQueryList>();
    vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => {
            if (!queries.has(query)) {
                // A real EventTarget preserves listener identity and dispatch semantics.
                const media = new EventTarget() as MediaQueryList;
                Object.defineProperties(media, {
                    matches: {
                        value: initial[query] ?? false,
                        configurable: true,
                    },
                    media: { value: query },
                    onchange: { value: null, writable: true },
                });
                media.addListener = (callback) => {
                    if (callback) media.addEventListener("change", callback);
                };
                media.removeListener = (callback) => {
                    if (callback) media.removeEventListener("change", callback);
                };
                queries.set(query, media);
            }
            return queries.get(query)!;
        })
    );
    return {
        set(query: string, matches: boolean) {
            const media = queries.get(query);
            if (!media) throw new Error(`No subscription for ${query}`);
            Object.defineProperty(media, "matches", {
                value: matches,
                configurable: true,
            });
            const event = Object.assign(new Event("change"), {
                matches,
                media: query,
            });
            media.dispatchEvent(event);
            media.onchange?.call(media, event);
        },
    };
}
