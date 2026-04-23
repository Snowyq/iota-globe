"use client";

import { createContext, useCallback, useRef } from "react";
import type { GlobeMethods } from "react-globe.gl";

const HOME_POV = { lat: 23.4367, lng: -50.42, altitude: 1.8 };
const RETURN_DELAY_MS = 500;

export type GlobePin = {
    lat: number;
    lng: number;
    name: string;
    logoUrl: string | null;
};

interface GlobeContextValue {
    onGlobeReady: (methods: GlobeMethods) => void;
    moveGlobeTo: (lat: number, lng: number, altitude?: number) => void;
    resetGlobe: () => void;
}

export const GlobeContext = createContext<GlobeContextValue>({
    onGlobeReady: () => {},
    moveGlobeTo: () => {},
    resetGlobe: () => {},
});

export default function GlobeContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const globeMethodsRef = useRef<GlobeMethods | undefined>(undefined);
    const returnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onGlobeReady = useCallback((methods: GlobeMethods) => {
        globeMethodsRef.current = methods;
    }, []);

    const moveGlobeTo = useCallback(
        (lat: number, lng: number, altitude = 1.5) => {
            const methods = globeMethodsRef.current;
            if (!methods) return;

            if (returnTimeoutRef.current !== null) {
                clearTimeout(returnTimeoutRef.current);
                returnTimeoutRef.current = null;
            }

            methods.controls().autoRotate = false;
            methods.pointOfView({ lat, lng, altitude }, 1000);
        },
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
            }}
        >
            {children}
        </GlobeContext.Provider>
    );
}
