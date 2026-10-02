import { describe, expect, it } from "vitest";
import {
    clusterValidators,
    getClusterCellSize,
} from "@/features/globe/clustering";
import type { GlobePoint } from "@/features/globe/workerTypes";

const points: GlobePoint[] = [
    { lat: 49, lng: 9, iotaAddress: "a" },
    { lat: 51, lng: 11, iotaAddress: "b" },
    { lat: -30, lng: 130, iotaAddress: "c" },
];
const ids = (list: GlobePoint[]) =>
    clusterValidators(list, 30)
        .map((c) => c.id)
        .sort();

describe("clustering", () => {
    it("groups nearby validators around their center", () => {
        expect(clusterValidators([], 20)).toEqual([]);
        const clusters = clusterValidators(points, 30);
        expect(clusters).toHaveLength(2);
        expect(clusters[0]).toMatchObject({
            lat: 50,
            lng: 10,
            count: 2,
            validators: ["a", "b"],
        });
    });

    it("keeps cluster ids stable across input order", () => {
        expect(ids(points)).toEqual(ids([...points].reverse()));
    });

    it("splits clusters at close zoom", () => {
        expect(clusterValidators(points, 1)).toHaveLength(3);
    });

    it("uses larger cells on small screens, the 2D map and far zoom", () => {
        const size = getClusterCellSize;
        expect(size(2.1, 390, "globe")).toBeGreaterThan(
            size(2.1, 900, "globe")
        );
        expect(size(2.1, 900, "map")).toBeGreaterThan(size(2.1, 900, "globe"));
        expect(size(3, 900, "globe")).toBeGreaterThan(size(1.5, 900, "globe"));
        expect(size(1, 900, "globe")).toBeLessThan(size(1.5, 900, "globe"));
    });
});
