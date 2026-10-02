"use client";

import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react";
import { clampAltitude, HOME_VIEW, ZOOM_IN, ZOOM_OUT } from "./view";
import { prefersReducedMotion } from "@/lib/motion";
import type { GlobeController, GlobePoint, MapMode } from "./workerTypes";
export type { GlobePoint } from "./workerTypes";

interface GlobeContextValue {
    onGlobeReady: (methods: GlobeController) => void;
    onGlobeDispose: () => void;
    moveGlobeTo: (lat: number, lng: number, altitude?: number) => void;
    zoomGlobe: (direction: number) => void;
    setAutoRotate: (enabled: boolean) => void;
    isRotating: boolean;
    resetGlobe: () => void;
    getCanvas: () => HTMLCanvasElement | null;
    geoPoints: GlobePoint[];
    viewMode: MapMode;
    setViewMode: (mode: MapMode) => void;
    openClusterId: string | null;
    setOpenClusterId: (id: string | null) => void;
    inspectedAddresses: string[];
    inspectCluster: (id: string, addresses: string[]) => void;
}
export const GlobeContext = createContext<GlobeContextValue>({
    onGlobeReady: () => {},
    onGlobeDispose: () => {},
    moveGlobeTo: () => {},
    zoomGlobe: () => {},
    setAutoRotate: () => {},
    isRotating: false,
    resetGlobe: () => {},
    getCanvas: () => null,
    geoPoints: [],
    viewMode: "globe",
    setViewMode: () => {},
    openClusterId: null,
    setOpenClusterId: () => {},
    inspectedAddresses: [],
    inspectCluster: () => {},
});

export default function GlobeContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { validators } = useContext(ValidatorsContext);
    const controller = useRef<GlobeController | null>(null);
    const [viewMode, setViewMode] = useState<MapMode>("globe");
    const [isRotating, setIsRotating] = useState(false);
    const [inspection, setInspection] = useState<{
        id: string | null;
        addresses: string[];
    }>({ id: null, addresses: [] });
    const geoPoints = useMemo(
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
    const onGlobeReady = useCallback((methods: GlobeController) => {
        controller.current = methods;
        setIsRotating(methods.controls().autoRotate);
    }, []);
    const onGlobeDispose = useCallback(() => {
        controller.current = null;
        setIsRotating(false);
    }, []);
    const setAutoRotate = useCallback((enabled: boolean) => {
        if (!controller.current) return;
        controller.current.controls().autoRotate = enabled;
        setIsRotating(enabled);
    }, []);
    const moveGlobeTo = useCallback(
        (lat: number, lng: number, altitude?: number) => {
            const methods = controller.current;
            if (!methods) return;
            methods.controls().autoRotate = false;
            setIsRotating(false);
            methods.pointOfView(
                {
                    lat,
                    lng,
                    altitude:
                        altitude ??
                        (viewMode === "map"
                            ? 1.1
                            : methods.pointOfView().altitude),
                },
                prefersReducedMotion() ? 0 : 700
            );
        },
        [viewMode]
    );
    const zoomGlobe = useCallback((direction: number) => {
        const methods = controller.current;
        if (!methods) return;
        const view = methods.pointOfView();
        methods.pointOfView(
            {
                ...view,
                altitude: clampAltitude(
                    view.altitude * (direction > 0 ? ZOOM_OUT : ZOOM_IN)
                ),
            },
            prefersReducedMotion() ? 0 : 160
        );
    }, []);
    const resetGlobe = useCallback(() => {
        const methods = controller.current;
        if (!methods) return;
        methods.pointOfView(
            { ...HOME_VIEW[viewMode] },
            prefersReducedMotion() ? 0 : 650
        );
        const rotate = viewMode === "globe" && !prefersReducedMotion();
        methods.controls().autoRotate = rotate;
        setIsRotating(rotate);
        setInspection({ id: null, addresses: [] });
    }, [viewMode]);
    const getCanvas = useCallback(
        () => controller.current?.renderer().domElement ?? null,
        []
    );
    const setOpenClusterId = useCallback(
        (id: string | null) =>
            setInspection((previous) => ({
                id,
                addresses: id ? previous.addresses : [],
            })),
        []
    );
    const inspectCluster = useCallback(
        (id: string, addresses: string[]) => {
            setInspection({ id, addresses });
            setAutoRotate(false);
        },
        [setAutoRotate]
    );
    useOnNetworkChange(() => setInspection({ id: null, addresses: [] }));
    const hasInspectedValidators = validators.some((v) =>
        inspection.addresses.includes(v.iotaAddress)
    );
    const value = useMemo(
        () => ({
            onGlobeReady,
            onGlobeDispose,
            moveGlobeTo,
            zoomGlobe,
            setAutoRotate,
            isRotating,
            resetGlobe,
            getCanvas,
            geoPoints,
            viewMode,
            setViewMode,
            openClusterId: hasInspectedValidators ? inspection.id : null,
            setOpenClusterId,
            inspectedAddresses: hasInspectedValidators
                ? inspection.addresses
                : [],
            inspectCluster,
        }),
        [
            onGlobeReady,
            onGlobeDispose,
            moveGlobeTo,
            zoomGlobe,
            setAutoRotate,
            isRotating,
            resetGlobe,
            getCanvas,
            geoPoints,
            viewMode,
            inspection,
            hasInspectedValidators,
            setOpenClusterId,
            inspectCluster,
        ]
    );
    return (
        <GlobeContext.Provider value={value}>{children}</GlobeContext.Provider>
    );
}
