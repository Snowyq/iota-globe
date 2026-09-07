import type { GlobePoint, MapMode } from "./workerTypes";
export type ValidatorCluster = {
    id: string;
    lat: number;
    lng: number;
    count: number;
    validators: string[];
};

export function getClusterCellSize(
    altitude: number,
    width: number,
    mode: MapMode
) {
    const scale = width < 500 ? 1.35 : 1;
    const base =
        altitude > 2.8 ? 26 : altitude > 1.7 ? 20 : altitude > 1.3 ? 13 : 6;
    return base * scale * (mode === "map" ? 1.2 : 1);
}
export function clusterValidators(
    points: GlobePoint[],
    cell: number
): ValidatorCluster[] {
    const buckets = new Map<string, GlobePoint[]>();
    points.forEach((point) => {
        const key = `${Math.round(point.lat / cell)}:${Math.round(point.lng / cell)}`;
        const bucket = buckets.get(key) ?? [];
        bucket.push(point);
        buckets.set(key, bucket);
    });
    return [...buckets].map(([id, bucket]) => ({
        id,
        lat: bucket.reduce((sum, point) => sum + point.lat, 0) / bucket.length,
        lng: bucket.reduce((sum, point) => sum + point.lng, 0) / bucket.length,
        count: bucket.length,
        validators: bucket.map((point) => point.iotaAddress),
    }));
}
