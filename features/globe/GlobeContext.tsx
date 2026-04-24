"use client";

import { type ValidatorResponseItem } from "@/app/api/route";
import { OptionsContext } from "@/features/options/OptionsContext";
import { fetchIota } from "@/lib/fetchIota";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
    resetGlobe: () => void;
    getCanvas: () => HTMLCanvasElement | null;
    geoPoints: GlobePoint[];
}

export const GlobeContext = createContext<GlobeContextValue>({
    onGlobeReady: () => {},
    moveGlobeTo: () => {},
    resetGlobe: () => {},
    getCanvas: () => null,
    geoPoints: [],
});

export default function GlobeContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { network } = useContext(OptionsContext);
    const globeMethodsRef = useRef<GlobeMethods | undefined>(undefined);
    const returnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const geoSigRef = useRef("");
    const [geoPoints, setGeoPoints] = useState<GlobePoint[]>([]);

    useEffect(() => {
        // eslint-disable-next-line
        setGeoPoints([]);
        geoSigRef.current = "";

        const load = async () => {
            try {
                const info = await fetchIota(network);
                const sig = buildGeoSignature(info.validators);
                if (geoSigRef.current === sig) return;
                geoSigRef.current = sig;
                setGeoPoints(
                    info.validators
                        .filter((v) => v.geo)
                        .map((v) => ({ lat: v.geo!.lat, lng: v.geo!.lon, iotaAddress: v.iotaAddress }))
                );
            } catch (e) {
                console.error("Globe geo fetch failed:", e);
            }
        };

        load();
        const interval = setInterval(load, 30_000);
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

            const targetAltitude = altitude ?? methods.pointOfView().altitude;
            methods.controls().autoRotate = false;
            methods.pointOfView({ lat, lng, altitude: targetAltitude }, 1000);
        },
        []
    );

    const getCanvas = useCallback(
        () => globeMethodsRef.current?.renderer().domElement ?? null,
        []
    );

    const resetGlobe = useCallback(() => {
        if (returnTimeoutRef.current !== null) {
            clearTimeout(returnTimeoutRef.current);
        }

        returnTimeoutRef.current = setTimeout(() => {
            const methods = globeMethodsRef.current;
            if (!methods) return;
            methods.pointOfView(HOME_POV, 1500);
            methods.controls().autoRotate = true;
            returnTimeoutRef.current = null;
        }, RETURN_DELAY_MS);
    }, []);

    return (
        <GlobeContext.Provider
            value={{
                onGlobeReady,
                moveGlobeTo,
                resetGlobe,
                getCanvas,
                geoPoints,
            }}
        >
            {children}
        </GlobeContext.Provider>
    );
}
