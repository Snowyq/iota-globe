"use client";

import earthDarkTexture from "@/assets/earth-dark.jpg";
import landTopology from "@/assets/land_10m.json";
import texture from "@/assets/Textures.jpg";
import {
    ARC_MID_COLOR,
    CustomLayerDatum,
} from "@/features/globe/customLayerData";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { randomInt } from "@/lib/math";
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
import { ClusterMarker, type ValidatorCluster } from "./ClusterMarker";

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
    globeOffset?: [number, number];
    targetAltitude?: number;
    customLayerData: CustomLayerDatum[];
    ref?: React.RefObject<GlobeMethods | undefined>;
};

type ClusterPoint = ValidatorCluster;

const INITIAL_ALTITUDE = 3;
const CLUSTER_BUBBLE_ALTITUDE = 0.06;
const ARC_ANIMATE_TIME_MIN = 300;
const ARC_ANIMATE_TIME_MAX = 800;

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
    globeOffset = [0, 0],
    targetAltitude,
    customLayerData,
}: GlobeProps) {
    const { onGlobeReady: notifyGlobeReady, geoPoints } =
        useContext(GlobeContext);
    const containerRef = useRef<HTMLDivElement>(null);
    const localGlobeRef = useRef<GlobeMethods | undefined>(undefined);
    const globeRef = passedRef || localGlobeRef;

    // Animate to target altitude when it changes
    useEffect(() => {
        if (targetAltitude === undefined) return;
        globeRef.current?.pointOfView({ altitude: targetAltitude }, 500);
    }, [targetAltitude, globeRef]);

    // Handle resizing: Globe intended to be used without SSR - just in case checking
    const [size, setSize] = useState(() => ({
        width: typeof window !== "undefined" ? window.innerWidth : 1,
        height: typeof window !== "undefined" ? window.innerHeight : 1,
    }));

    const [clusterCellSize, setClusterCellSize] = useState(
        getCellSize(INITIAL_ALTITUDE)
    );

    const contextArcsData = useMemo(
        () => buildStableArcs(geoPoints, 3, ARC_MID_COLOR),
        [geoPoints]
    );

    const globeMaterial = useMemo(
        () =>
            new THREE.MeshPhongMaterial({
                color: "#0f2856",
                opacity: 0.92,
                transparent: true,
            }),
        []
    );

    const polygonCapMaterial = useMemo(
        () =>
            new THREE.MeshPhongMaterial({
                color: "#3368cc",
                side: THREE.DoubleSide,
                map: new THREE.TextureLoader().load(texture.src),
            }),
        []
    );

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
        if (geoPoints.length === 0) return [];

        const buckets = new Map<string, GlobePoint[]>();

        geoPoints.forEach((point) => {
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
    }, [geoPoints, clusterCellSize]);

    const clusterContainersRef = useRef(new Map<string, HTMLElement>());
    const [clusterPortals, setClusterPortals] = useState<
        { id: string; cluster: ClusterPoint; container: HTMLElement }[]
    >([]);

    const handleHtmlElement = useCallback((point: object) => {
        const cluster = point as ClusterPoint;
        if (!clusterContainersRef.current.has(cluster.id)) {
            clusterContainersRef.current.set(
                cluster.id,
                document.createElement("div")
            );
        }
        return clusterContainersRef.current.get(cluster.id)!;
    }, []);

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

    const handleVisibilityModifier = useCallback(
        (element: HTMLElement, isVisible: boolean) => {
            element.style.opacity = isVisible ? "1" : "0";
            element.style.pointerEvents = isVisible ? "auto" : "none";
        },
        []
    );

    const handleCustomThreeObject = useCallback((point: object) => {
        const datum = point as CustomLayerDatum;
        if (datum.kind === "mesh") return createMesh();
        return new THREE.Mesh(
            new THREE.SphereGeometry(datum.size),
            new THREE.MeshBasicMaterial({ color: datum.color })
        );
    }, []);

    const handleCustomThreeObjectUpdate = useCallback(
        (obj: THREE.Object3D, point: object) => {
            const datum = point as CustomLayerDatum;
            if (datum.kind !== "star") return;
            Object.assign(
                obj.position,
                globeRef.current?.getCoords(
                    datum.lat,
                    datum.lng,
                    datum.altitude
                )
            );
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
                globeOffset={globeOffset}
                backgroundColor="rgba(0,0,0,0)"
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
                    variant === "home" ? () => "#00000000" : undefined
                }
                polygonAltitude={variant === "home" ? 0.01 : undefined}
                bumpImageUrl={undefined}
                customLayerData={customLayerData}
                customThreeObject={handleCustomThreeObject}
                customThreeObjectUpdate={handleCustomThreeObjectUpdate}
                showAtmosphere={true}
                atmosphereColor="#5595dc"
                atmosphereAltitude={0.35}
                htmlElementsData={clusteredPoints}
                htmlLat="lat"
                htmlLng="lng"
                htmlAltitude={CLUSTER_BUBBLE_ALTITUDE}
                htmlElement={handleHtmlElement}
                htmlElementVisibilityModifier={handleVisibilityModifier}
                htmlTransitionDuration={0}
                pointsData={clusteredPoints}
                pointAltitude={CLUSTER_BUBBLE_ALTITUDE}
                pointRadius={0.2}
                pointColor={() => "rgba(147,197,253,0.9)"}
                pointsMerge={true}
                pointResolution={2}
                arcsData={contextArcsData}
                arcColor="color"
                arcAltitudeAutoScale={0.3}
                arcStroke={0.3}
                arcDashLength={0.9}
                arcDashGap={2}
                arcDashAnimateTime="time"
                onGlobeReady={() => {
                    requestAnimationFrame(() => {
                        const globe = globeRef.current;
                        if (!globe) return;

                        onReady?.(globe);
                        notifyGlobeReady(globe);

                        const controls = globe.controls();
                        if (!controls) return;

                        controls.autoRotate = true;
                        controls.autoRotateSpeed = 0.35;
                        controls.enablePan = false;
                        controls.enableZoom = true;
                        controls.enableDamping = true;
                        controls.dampingFactor = 0.08;
                        controls.minDistance = 200;
                        controls.maxDistance = 500;

                        globe.pointOfView({
                            lat: 19.054339351561637,
                            lng: -50.421161072148465,
                            altitude: INITIAL_ALTITUDE,
                        });
                        setClusterCellSize(getCellSize(INITIAL_ALTITUDE));
                    });
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
            .sort(() => Math.random() - 0.5)
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

function createMesh() {
    const group = new THREE.Group();
    group.add(
        new THREE.Mesh(
            new THREE.SphereGeometry(100.3, 64, 64),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color("#1a4080"),
                transparent: true,
                opacity: 0.15,
                depthWrite: false,
            })
        )
    );
    group.add(
        new THREE.Mesh(
            new THREE.SphereGeometry(101.6, 48, 48),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color("#0d2350"),
                transparent: true,
                opacity: 0,
                side: THREE.BackSide,
                depthWrite: false,
            })
        )
    );
    return group;
}

function getCellSize(altitude: number) {
    if (altitude > 2.8) return 18;
    if (altitude > 2.2) return 15;
    if (altitude > 1.7) return 10;
    if (altitude > 1.3) return 10;
    return 3;
}
