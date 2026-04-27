"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";

const FULLSCREEN_MIN_WIDTH = 1536; // 2xl

interface OptionsContext {
    network: "mainnet" | "testnet";
    selectNetwork?: (network: "mainnet" | "testnet") => void;
    isFullscreen: boolean;
    canUseFullscreen: boolean;
    toggleFullscreen: () => void;
}

export const OptionsContext = createContext<OptionsContext>({
    network: "testnet",
    selectNetwork: () => {},
    isFullscreen: false,
    canUseFullscreen: false,
    toggleFullscreen: () => {},
});

export default function OptionsContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [network, setNetwork] = useState<"mainnet" | "testnet">("testnet");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [canUseFullscreen, setCanUseFullscreen] = useState(false);

    useEffect(() => {
        setCanUseFullscreen(window.innerWidth >= FULLSCREEN_MIN_WIDTH);
        const observer = new ResizeObserver(([entry]) => {
            const wide = entry.contentRect.width >= FULLSCREEN_MIN_WIDTH;
            setCanUseFullscreen(wide);
            if (!wide) setIsFullscreen(false);
        });
        observer.observe(document.documentElement);
        return () => observer.disconnect();
    }, []);

    const selectNetwork = useCallback((network: "mainnet" | "testnet") => {
        setNetwork(network);
    }, []);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen((v) => !v);
    }, []);

    const contextValue = useMemo(
        () => ({ network, selectNetwork, isFullscreen: isFullscreen && canUseFullscreen, canUseFullscreen, toggleFullscreen }),
        [network, selectNetwork, isFullscreen, canUseFullscreen, toggleFullscreen]
    );

    return (
        <OptionsContext.Provider value={contextValue}>
            {children}
        </OptionsContext.Provider>
    );
}
