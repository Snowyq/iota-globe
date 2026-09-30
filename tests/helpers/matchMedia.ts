import { vi } from "vitest";

/** Stubs matchMedia; queries listed in `matching` report true. */
export function installMatchMedia(matching: Record<string, boolean> = {}) {
    const queries = new Map<string, MediaQueryList>();
    vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => {
            if (!queries.has(query)) {
                const media = new EventTarget() as MediaQueryList;
                Object.defineProperties(media, {
                    matches: { value: matching[query] ?? false },
                    media: { value: query },
                    onchange: { value: null, writable: true },
                });
                queries.set(query, media);
            }
            return queries.get(query)!;
        })
    );
}
