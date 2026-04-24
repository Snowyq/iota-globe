"use client";

import earthDarkTexture from "@/assets/earth-dark.jpg";
import landTopology from "@/assets/land_10m.json";
import randomLocations from "@/assets/random-locations.json";
import texture from "@/assets/Textures.jpg";
import {
    ClusterMarker,
    type ValidatorCluster,
} from "@/features/iota/ValidatorClusterMarker";
import { ValidatorsContext } from "@/features/iota/ValidatorsContext";
import { cn } from "@/lib/utils";
import {
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import GlobeGL, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import * as topojson from "topojson-client";

type GlobePoint = {
    lat: number;
    lng: number;
    iotaAddress: string;
};

type GlobeArc = {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    color: [string, string, string];
    time: number;
};

type GlobeProps = {
    className?: string;
    onReady?: (methods: GlobeMethods) => void;
    variant?: "home" | "globe";
    ref?: React.RefObject<GlobeMethods | undefined>;
};

type ClusterPoint = {
    id: string;
    lat: number;
    lng: number;
    count: number;
    validators: string[];
} & ValidatorCluster;

type RandomLocationDatum = { lat: string | number; lng: string | number };

type CustomLayerDatum =
    | { kind: "mesh" }
    | {
          kind: "star";
          lat: number;
          lng: number;
          altitude: number;
          size: number;
          color: string;
      };

const INITIAL_ALTITUDE = 3;
const CLUSTER_BUBBLE_ALTITUDE = 0.06;
const ARC_ANIMATE_TIME_MIN = 300;
const ARC_ANIMATE_TIME_MAX = 800;
const ARC_MID_COLOR = "#fff";
const CUSTOM_LAYER_DATA = createCustomLayerData(
    randomLocations as RandomLocationDatum[]
);
const CUSTOM_LAYER_DATA_NO_BACKGROUND_STARS: CustomLayerDatum[] =
    CUSTOM_LAYER_DATA.filter((d) => d.kind !== "star" || d.altitude < 1);
const LAND_FEATURES = (
    topojson.feature(
        landTopology as unknown as Parameters<typeof topojson.feature>[0],
        (
            landTopology as unknown as {
                objects: { land: Parameters<typeof topojson.feature>[1] };
            }
        ).objects.land
    ) as GeoJSON.FeatureCollection
).features;

export function Globe({
    className,
    onReady,
    ref: passedRef,
    variant,
}: GlobeProps) {
    const { validators } = useContext(ValidatorsContext);
    const containerRef = useRef<HTMLDivElement>(null);
    const localGlobeRef = useRef<GlobeMethods | undefined>(undefined);
    const globeRef = passedRef || localGlobeRef;

    const [size, setSize] = useState(() => ({
        width: typeof window !== "undefined" ? window.innerWidth : 1,
        height: typeof window !== "undefined" ? window.innerHeight : 1,
    }));
    const [clusterCellSize, setClusterCellSize] = useState(getCellSize(INITIAL_ALTITUDE));

    const contextPointsData = useMemo<GlobePoint[]>(
        () =>
            validators
                .filter((v) => v.geo)
                .map((v) => ({
                    lat: v.geo!.lat,
                    lng: v.geo!.lon,
                    iotaAddress: v.iotaAddress,
                })),
        [validators]
    );

    const contextArcsData = useMemo(
        () => buildStableArcs(contextPointsData, 3, ARC_MID_COLOR),
        [contextPointsData]
    );

    const globeMaterial = useMemo(
        () =>
            new THREE.MeshPhongMaterial({
                color: "#1a0a3d",
                opacity: 0.95,
                transparent: true,
            }),
        []
    );

    const polygonCapMaterial = useMemo(
        () =>
            new THREE.MeshPhongMaterial({
                color: "#6067F9",
                side: THREE.DoubleSide,
                map: new THREE.TextureLoader().load(texture.src),
            }),
        []
    );

    const handlePolygonSideColor = useCallback(() => "#00000000", []);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateSize = () =>
            setSize({
                width: element.clientWidth,
                height: element.clientHeight,
            });

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const clusteredPoints = useMemo<ClusterPoint[]>(() => {
        if (contextPointsData.length === 0) return [];

        const buckets = new Map<string, GlobePoint[]>();

        contextPointsData.forEach((point) => {
            const latBucket =
                Math.round(point.lat / clusterCellSize) * clusterCellSize;
            const lngBucket =
                Math.round(point.lng / clusterCellSize) * clusterCellSize;
            const key = `${latBucket}:${lngBucket}`;
            const bucket = buckets.get(key) ?? [];
            bucket.push(point);
            buckets.set(key, bucket);
        });

        return [...buckets.values()].map((bucket) => {
            const lat = bucket.reduce((s, p) => s + p.lat, 0) / bucket.length;
            const lng = bucket.reduce((s, p) => s + p.lng, 0) / bucket.length;
            const validators = bucket.map((p) => p.iotaAddress);
            return {
                id: `${Math.round(lat * 1000)}:${Math.round(lng * 1000)}`,
                lat,
                lng,
                count: bucket.length,
                validators,
            };
        });
    }, [contextPointsData, clusterCellSize]);

    const clusterContainersRef = useRef(new Map<string, HTMLElement>());
    const [clusterPortals, setClusterPortals] = useState<
        { id: string; cluster: ClusterPoint; container: HTMLElement }[]
    >([]);

    useLayoutEffect(() => {
        const currentIds = new Set(clusteredPoints.map((c) => c.id));
        for (const id of [...clusterContainersRef.current.keys()]) {
            if (!currentIds.has(id)) clusterContainersRef.current.delete(id);
        }
        for (const cluster of clusteredPoints) {
            if (!clusterContainersRef.current.has(cluster.id)) {
                clusterContainersRef.current.set(
                    cluster.id,
                    document.createElement("div")
                );
            }
        }
        setClusterPortals(
            clusteredPoints.map((cluster) => ({
                id: cluster.id,
                cluster,
                container: clusterContainersRef.current.get(cluster.id)!,
            }))
        );
    }, [clusteredPoints]);

    const handleHtmlElement = useCallback((point: object) => {
        const cluster = point as ClusterPoint;
        return (
            clusterContainersRef.current.get(cluster.id) ??
            document.createElement("div")
        );
    }, []);

    const handlePointColor = useCallback(() => "rgba(34,211,238,0.65)", []);

    const handleVisibilityModifier = useCallback(
        (element: HTMLElement, isVisible: boolean) => {
            element.style.opacity = isVisible ? "1" : "0";
            element.style.pointerEvents = isVisible ? "auto" : "none";
        },
        []
    );

    const handleCustomThreeObject = useCallback((point: object) => {
        const datum = point as CustomLayerDatum;
        if (datum.kind === "mesh") return createGmonadsMesh();
        return new THREE.Mesh(
            new THREE.SphereGeometry(datum.size),
            new THREE.MeshBasicMaterial({ color: datum.color })
        );
    }, []);

    const handleCustomThreeObjectUpdate = useCallback(
        (obj: THREE.Object3D, point: object) => {
            const datum = point as CustomLayerDatum;
            if (datum.kind !== "star") return;
            const coords = globeRef.current?.getCoords(
                datum.lat,
                datum.lng,
                datum.altitude
            );
            if (coords) obj.position.set(coords.x, coords.y, coords.z);
        },
        [globeRef]
    );

    return (
        <div
            ref={containerRef}
            className={cn("absolute inset-0 z-0", className)}
        >
            <GlobeGL
                ref={globeRef}
                width={size.width}
                height={size.height}
                backgroundColor="#08070e"
                rendererConfig={{ alpha: true, antialias: true }}
                globeImageUrl={
                    variant === "globe" ? earthDarkTexture.src : undefined
                }
                globeMaterial={variant === "home" ? globeMaterial : undefined}
                polygonsData={variant === "home" ? LAND_FEATURES : undefined}
                polygonCapMaterial={
                    variant === "home" ? polygonCapMaterial : undefined
                }
                polygonSideColor={
                    variant === "home" ? handlePolygonSideColor : undefined
                }
                polygonAltitude={variant === "home" ? 0.01 : undefined}
                bumpImageUrl={undefined}
                customLayerData={
                    variant === "home"
                        ? CUSTOM_LAYER_DATA_NO_BACKGROUND_STARS
                        : CUSTOM_LAYER_DATA
                }
                customThreeObject={handleCustomThreeObject}
                customThreeObjectUpdate={handleCustomThreeObjectUpdate}
                showAtmosphere={true}
                atmosphereColor="#5784a7"
                atmosphereAltitude={0.5}
                htmlElementsData={clusteredPoints}
                htmlLat="lat"
                htmlLng="lng"
                htmlAltitude={CLUSTER_BUBBLE_ALTITUDE}
                htmlElement={handleHtmlElement}
                htmlElementVisibilityModifier={handleVisibilityModifier}
                htmlTransitionDuration={0}
                pointsData={clusteredPoints}
                pointAltitude={CLUSTER_BUBBLE_ALTITUDE}
                pointRadius={0.12}
                pointColor={handlePointColor}
                pointsMerge={true}
                pointResolution={10}
                ringsData={clusteredPoints}
                ringAltitude={0.01}
                ringMaxRadius={1}
                ringPropagationSpeed={0.1}
                ringRepeatPeriod={1000}
                ringColor={"rgba(34,211,238,0.3)"}
                arcsData={contextArcsData}
                arcColor="color"
                arcAltitudeAutoScale={0.3}
                arcStroke={0.5}
                arcDashLength={0.9}
                arcDashGap={2}
                arcDashAnimateTime="time"
                onGlobeReady={() => {
                    if (globeRef.current) onReady?.(globeRef.current);

                    const controls = globeRef.current?.controls();
                    if (!controls) return;

                    controls.autoRotate = true;
                    controls.autoRotateSpeed = 0.35;
                    controls.enablePan = false;
                    controls.enableZoom = true;
                    controls.enableDamping = true;
                    controls.dampingFactor = 0.08;
                    controls.minDistance = 140;
                    controls.maxDistance = 360;

                    globeRef.current?.pointOfView({
                        lat: 19.054339351561637,
                        lng: -50.421161072148465,
                        altitude: INITIAL_ALTITUDE,
                    });
                    setClusterCellSize(getCellSize(INITIAL_ALTITUDE));
                }}
                onZoom={(pov) => {
                    const next = getCellSize(pov.altitude);
                    setClusterCellSize(next);
                }}
            />
            {clusterPortals.map(({ id, cluster, container }) =>
                createPortal(<ClusterMarker cluster={cluster} />, container, id)
            )}
        </div>
    );
}

function buildStableArcs(
    points: GlobePoint[],
    linksPerPoint: number,
    midColor: string
): GlobeArc[] {
    if (points.length < 2) return [];

    const arcs: GlobeArc[] = [];

    points.forEach((source, si) => {
        const targets = points
            .filter((_, ti) => ti !== si)
            .sort(
                (a, b) =>
                    hashString(`${source.iotaAddress}->${a.iotaAddress}`) -
                    hashString(`${source.iotaAddress}->${b.iotaAddress}`)
            )
            .slice(0, linksPerPoint);

        targets.forEach((target) => {
            arcs.push({
                startLat: source.lat,
                startLng: source.lng,
                endLat: target.lat,
                endLng: target.lng,
                color: ["rgba(255,255,255,0)", midColor, "rgba(255,255,255,0)"],
                time: randomInt(ARC_ANIMATE_TIME_MIN, ARC_ANIMATE_TIME_MAX),
            });
        });
    });

    return arcs;
}

function hashString(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function createCustomLayerData(
    locations: RandomLocationDatum[]
): CustomLayerDatum[] {
    const surfaceStars = locations.map((loc, i) => ({
        kind: "star" as const,
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        altitude: 0.01,
        size: 0.1 + (i % 7) * 0.008,
        color: ARC_MID_COLOR,
    }));

    const backgroundStars = Array.from({ length: 500 }, () => ({
        kind: "star" as const,
        lat: (Math.random() - 0.5) * 180,
        lng: (Math.random() - 0.5) * 360,
        altitude: 1.5 + Math.random() * 2.5,
        size: 0.3 + Math.random() * 0.5,
        color: "#ffffff",
    }));

    return [{ kind: "mesh" }, ...surfaceStars, ...backgroundStars];
}

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function getCellSize(altitude: number) {
    if (altitude > 2.8) return 18;
    if (altitude > 2.2) return 15;
    if (altitude > 1.7) return 10;
    if (altitude > 1.3) return 10;
    return 3;
}

function createGmonadsMesh() {
    const group = new THREE.Group();

    group.add(
        new THREE.Mesh(
            new THREE.SphereGeometry(100.3, 64, 64),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color("#1a0a3d"),
                transparent: true,
                opacity: 0.18,
                depthWrite: false,
            })
        )
    );

    group.add(
        new THREE.Mesh(
            new THREE.SphereGeometry(101.6, 48, 48),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color("#003e46"),
                transparent: true,
                opacity: 0.2,
                side: THREE.BackSide,
                depthWrite: false,
            })
        )
    );

    return group;
}
