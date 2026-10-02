import type { ReactNode } from "react";
import { vi } from "vitest";
import { OptionsContext } from "@/features/options/OptionsContext";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { GlobeContext } from "@/features/globe/GlobeContext";

export function TestNetwork({
    network = "mainnet",
    children,
}: {
    network?: "mainnet" | "testnet";
    children: ReactNode;
}) {
    return (
        <OptionsContext
            value={{
                network,
                selectNetwork: vi.fn(),
                isFullscreen: false,
                canUseFullscreen: false,
                toggleFullscreen: vi.fn(),
            }}
        >
            {children}
        </OptionsContext>
    );
}
export function validatorsContext(
    overrides: Partial<React.ContextType<typeof ValidatorsContext>> = {}
): React.ContextType<typeof ValidatorsContext> {
    return {
        validators: [],
        isLoading: false,
        error: null,
        networkStats: null,
        dataTtl: null,
        refresh: vi.fn(),
        selectedValidator: null,
        selectValidator: vi.fn(),
        deselectValidator: vi.fn(),
        ...overrides,
    };
}
export function globeContext(
    overrides: Partial<React.ContextType<typeof GlobeContext>> = {}
): React.ContextType<typeof GlobeContext> {
    return {
        onGlobeReady: vi.fn(),
        onGlobeDispose: vi.fn(),
        moveGlobeTo: vi.fn(),
        zoomGlobe: vi.fn(),
        setAutoRotate: vi.fn(),
        isRotating: false,
        resetGlobe: vi.fn(),
        getCanvas: () => null,
        geoPoints: [],
        viewMode: "globe",
        setViewMode: vi.fn(),
        openClusterId: null,
        setOpenClusterId: vi.fn(),
        inspectedAddresses: [],
        inspectCluster: vi.fn(),
        ...overrides,
    };
}
