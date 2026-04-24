"use client";

import { createContext, useCallback, useMemo, useState } from "react";

interface OptionsContext {
    network: "mainnet" | "testnet" | "devnet";
    selectNetwork?: (network: "mainnet" | "testnet" | "devnet") => void;
}

export const OptionsContext = createContext<OptionsContext>({
    network: "testnet",
    selectNetwork: () => {},
});

export default function OptionsContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [network, setNetwork] = useState<"mainnet" | "testnet" | "devnet">(
        "testnet"
    );

    const selectNetwork = useCallback(
        (network: "mainnet" | "testnet" | "devnet") => {
            setNetwork(network);
        },
        []
    );

    const contextValue = useMemo(
        () => ({
            network,
            selectNetwork,
        }),
        [network, selectNetwork]
    );

    return (
        <OptionsContext.Provider value={contextValue}>
            {children}
        </OptionsContext.Provider>
    );
}
