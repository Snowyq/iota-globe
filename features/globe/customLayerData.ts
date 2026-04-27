import locations from "@/assets/random-locations.json";
export const ARC_MID_COLOR = "#93c5fd";

export type CustomLayerDatum =
    | { kind: "mesh" }
    | {
          kind: "star";
          lat: number;
          lng: number;
          altitude: number;
          size: number;
          color: string;
      };

export function createCustomLayerData(): CustomLayerDatum[] {
    const backgroundStars = Array.from({ length: 500 }, () => ({
        kind: "star" as const,
        lat: (Math.random() - 1) * 360,
        lng: (Math.random() - 1) * 360,
        altitude: Math.random() * 2,
        size: Math.random() * 0.4,
        color: "#ffffff",
    }));

    const surfaceStars = locations.map((loc, i) => ({
        kind: "star" as const,
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        altitude: 0.01,
        size: 0.1 + (i % 7) * 0.008,
        color: ARC_MID_COLOR,
    }));

    return [{ kind: "mesh" }, ...surfaceStars, ...backgroundStars];
}
