"use client";

import { type ValidatorResponseItem } from "@/app/api/validators/route";
import { OptionsContext } from "@/features/options/OptionsContext";
import { fetchValidators } from "@/lib/fetch";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { GlobeMethods } from "react-globe.gl";

type GlobePoint = {
    lat: number;
    lng: number;
    iotaAddress: string;
};

function buildGeoSignature(validators: ValidatorResponseItem[]) {
    return validators
        .filter((v) => v.geo)
        .map((v) => `${v.iotaAddress}:${v.geo!.lat}:${v.geo!.lon}`)
        .sort()
        .join(";");
}

const HOME_POV = { lat: 23.4367, lng: -50.42, altitude: 3 };
const RETURN_DELAY_MS = 500;

export type GlobePin = {
    lat: number;
    lng: number;
    name: string;
    logoUrl: string | null;
};

export type { GlobePoint };

interface GlobeContextValue {
    onGlobeReady: (methods: GlobeMethods) => void;
    moveGlobeTo: (lat: number, lng: number, altitude?: number) => void;
    zoomGlobe: (deltaY: number) => void;
    startSpinning: () => void;
    resetGlobe: () => void;
    getCanvas: () => HTMLCanvasElement | null;
    geoPoints: GlobePoint[];
    openClusterId: string | null;
    setOpenClusterId: (id: string | null) => void;
}

export const GlobeContext = createContext<GlobeContextValue>({
    onGlobeReady: () => {},
    moveGlobeTo: () => {},
    zoomGlobe: () => {},
    startSpinning: () => {},
    resetGlobe: () => {},
    getCanvas: () => null,
    geoPoints: [],
    openClusterId: null,
    setOpenClusterId: () => {},
});

export default function GlobeContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { network } = useContext(OptionsContext);
    const globeMethodsRef = useRef<GlobeMethods | undefined>(undefined);
    const returnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastMoveAtRef = useRef(0);
    const geoSigRef = useRef("");
    const [geoPoints, setGeoPoints] = useState<GlobePoint[]>([]);
    const [openClusterId, setOpenClusterId] = useState<string | null>(null);

    useEffect(() => {
        // eslint-disable-next-line
        setGeoPoints([]);
        geoSigRef.current = "";

        const load = async () => {
            try {
                const { data } = await fetchValidators(network);
                const sig = buildGeoSignature(data.validators);
                if (geoSigRef.current === sig) return;
                geoSigRef.current = sig;
                setGeoPoints(
                    data.validators
                        .filter((v) => v.geo)
                        .map((v) => ({
                            lat: v.geo!.lat,
                            lng: v.geo!.lon,
                            iotaAddress: v.iotaAddress,
                        }))
                );
            } catch (e) {
                console.error("Globe geo fetch failed:", e);
            }
        };

        load();
        const interval = setInterval(load, 60_000);
        return () => clearInterval(interval);
    }, [network]);

    const onGlobeReady = useCallback((methods: GlobeMethods) => {
        globeMethodsRef.current = methods;
    }, []);

    const moveGlobeTo = useCallback(
        (lat: number, lng: number, altitude?: number) => {
            const methods = globeMethodsRef.current;
            if (!methods) return;

            if (returnTimeoutRef.current !== null) {
                clearTimeout(returnTimeoutRef.current);
                returnTimeoutRef.current = null;
            }

            lastMoveAtRef.current = Date.now();

            try {
                methods.controls().autoRotate = false;
            } catch {
                console.error("Failed to move globe (non-fatal)");
            }
            const targetAltitude = altitude ?? methods.pointOfView().altitude;
            methods.pointOfView({ lat, lng, altitude: targetAltitude }, 1000);
        },
        []
    );

    const zoomGlobe = useCallback((deltaY: number) => {
        const methods = globeMethodsRef.current;
        if (!methods) return;
        try {
            const pov = methods.pointOfView();
            const factor = deltaY > 0 ? 1.2 : 0.85;
            const newAlt = Math.min(Math.max(pov.altitude * factor, 0.15), 8);
            methods.pointOfView(
                { lat: pov.lat, lng: pov.lng, altitude: newAlt },
                0
            );
        } catch {
            console.error("Failed to zoom globe (non-fatal)");
        }
    }, []);

    const getCanvas = useCallback(
        () => globeMethodsRef.current?.renderer().domElement ?? null,
        []
    );

    const startSpinning = useCallback(() => {
        try {
            if (globeMethodsRef.current)
                globeMethodsRef.current.controls().autoRotate = true;
        } catch {
            console.error("Failed to start globe spinning (non-fatal)");
        }
    }, []);

    const resetGlobe = useCallback(() => {
        if (returnTimeoutRef.current !== null) {
            clearTimeout(returnTimeoutRef.current);
        }

        const scheduledAt = Date.now();
        returnTimeoutRef.current = setTimeout(() => {
            if (lastMoveAtRef.current > scheduledAt) return;
            const methods = globeMethodsRef.current;
            if (!methods) return;
            methods.pointOfView(HOME_POV, 1500);
            try {
                methods.controls().autoRotate = true;
            } catch {
                console.error("Failed to reset globe (non-fatal)");
            }
            returnTimeoutRef.current = null;
        }, RETURN_DELAY_MS);
    }, []);

    const contextValue = useMemo(() => {
        return {
            onGlobeReady,
            moveGlobeTo,
            zoomGlobe,
            startSpinning,
            resetGlobe,
            getCanvas,
            geoPoints,
            openClusterId,
            setOpenClusterId,
        };
    }, [
        onGlobeReady,
        moveGlobeTo,
        zoomGlobe,
        startSpinning,
        resetGlobe,
        getCanvas,
        geoPoints,
        openClusterId,
        setOpenClusterId,
    ]);

    return (
        <GlobeContext.Provider value={contextValue}>
            {children}
        </GlobeContext.Provider>
    );
}
