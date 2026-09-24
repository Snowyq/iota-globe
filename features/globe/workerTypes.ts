export type MapMode = "globe" | "map";
export type GlobePoint = { lat: number; lng: number; iotaAddress: string };
export type ProjectedCluster = { id: string; lat: number; lng: number };
export type PointOfView = { lat: number; lng: number; altitude: number };
export interface GlobeController {
    pointOfView(): PointOfView;
    pointOfView(view: Partial<PointOfView>, duration?: number): void;
    controls(): { autoRotate: boolean };
    renderer(): { domElement: HTMLCanvasElement };
}
// Insets, in CSS pixels, of the part of the canvas that panels leave free;
// the planet is sized to and centred in it.
export type GlobeFrame = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
export type WorkerInput =
    | {
          type: "init";
          canvas: OffscreenCanvas;
          width: number;
          height: number;
          pixelRatio: number;
          reducedMotion: boolean;
          mode: MapMode;
          frame: GlobeFrame;
      }
    | {
          type: "resize";
          width: number;
          height: number;
          pixelRatio: number;
          frame: GlobeFrame;
      }
    | { type: "data"; points: GlobePoint[]; clusters: ProjectedCluster[] }
    | { type: "view"; view: Partial<PointOfView>; duration: number }
    | { type: "mode"; mode: MapMode }
    | { type: "rotate"; enabled: boolean }
    | { type: "drag"; dx: number; dy: number }
    // The pointer lifted after a drag; the view may coast on.
    | { type: "release" }
    // Multiply the altitude; on the flat map, about the canvas point x, y.
    | { type: "zoom"; factor: number; x?: number; y?: number }
    | { type: "visibility"; visible: boolean }
    | { type: "motion"; reduced: boolean }
    // One certified checkpoint; its load sets how bright the pulse runs.
    | { type: "pulse"; load: number };
export type WorkerOutput =
    | { type: "ready" }
    | { type: "error"; message: string }
    | {
          type: "frame";
          view: PointOfView;
          markers: { id: string; x: number; y: number; visible: boolean }[];
      };
