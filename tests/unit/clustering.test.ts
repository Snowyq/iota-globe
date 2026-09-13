import { describe, expect, it } from "vitest";
import {
    clusterValidators,
    getClusterCellSize,
} from "@/features/globe/clustering";
import type { GlobePoint } from "@/features/globe/workerTypes";

describe("geographic clustering", () => {
    const points: GlobePoint[] = [
        { lat: 49, lng: 9, iotaAddress: "a" },
        { lat: 51, lng: 11, iotaAddress: "b" },
        { lat: -30, lng: 130, iotaAddress: "c" },
    ];
    it("handles an empty network", () =>
        expect(clusterValidators([], 20)).toEqual([]));
    it("groups nearby validators and computes a geographic center", () => {
        const clusters = clusterValidators(points, 30);
        expect(clusters).toHaveLength(2);
        expect(clusters[0]).toMatchObject({
            lat: 50,
            lng: 10,
            count: 2,
            validators: ["a", "b"],
        });
        expect(clusters.flatMap((c) => c.validators).sort()).toEqual([
            "a",
            "b",
            "c",
        ]);
    });
    it("keeps cluster identities stable across response ordering", () => {
        expect(
            clusterValidators(points, 30)
                .map((c) => c.id)
                .sort()
        ).toEqual(
            clusterValidators([...points].reverse(), 30)
                .map((c) => c.id)
                .sort()
        );
    });
    it("reveals individual operators at closer zoom", () =>
        expect(clusterValidators(points, 1)).toHaveLength(3));
    it("uses larger cells on small screens and on the 2D world map", () => {
        expect(getClusterCellSize(2.1, 390, "globe")).toBeGreaterThan(
            getClusterCellSize(2.1, 900, "globe")
        );
        expect(getClusterCellSize(2.1, 900, "map")).toBeGreaterThan(
            getClusterCellSize(2.1, 900, "globe")
        );
        expect(getClusterCellSize(3, 900, "globe")).toBeGreaterThan(
            getClusterCellSize(1.5, 900, "globe")
        );
        expect(getClusterCellSize(1, 900, "globe")).toBeLessThan(
            getClusterCellSize(1.5, 900, "globe")
        );
    });
});
