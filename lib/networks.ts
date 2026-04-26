export const NETWORK_URLS: Record<string, string> = {
    mainnet: process.env.MAINNET_URL as string,
    testnet: process.env.TESTNET_URL as string,
};

export type Network = keyof typeof NETWORK_URLS;
