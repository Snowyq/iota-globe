import type { MapMode, PointOfView } from "./workerTypes";

/** Camera position each mode opens at and resets to. */
export const HOME_VIEW: Record<MapMode, PointOfView> = {
    globe: { lat: 22, lng: 8, altitude: 2.4 },
    map: { lat: 0, lng: 0, altitude: 2.1 },
};

export const MIN_ALTITUDE = 0.55;
export const MAX_ALTITUDE = 5;
export const clampAltitude = (altitude: number) =>
    Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, altitude));

/** Altitude factors for one zoom step (keyboard and zoom buttons). */
export const ZOOM_OUT = 1.2;
export const ZOOM_IN = 0.85;
