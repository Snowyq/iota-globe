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
export type WorkerInput =
    | {
          type: "init";
          canvas: OffscreenCanvas;
          width: number;
          height: number;
          pixelRatio: number;
          reducedMotion: boolean;
          mode: MapMode;
      }
    | { type: "resize"; width: number; height: number; pixelRatio: number }
    | { type: "data"; points: GlobePoint[]; clusters: ProjectedCluster[] }
    | { type: "view"; view: Partial<PointOfView>; duration: number }
    | { type: "mode"; mode: MapMode }
    | { type: "rotate"; enabled: boolean }
    | { type: "drag"; dx: number; dy: number }
    | { type: "visibility"; visible: boolean }
    | { type: "motion"; reduced: boolean };
export type WorkerOutput =
    | { type: "ready" }
    | { type: "error"; message: string }
    | {
          type: "frame";
          view: PointOfView;
          markers: { id: string; x: number; y: number; visible: boolean }[];
      };
