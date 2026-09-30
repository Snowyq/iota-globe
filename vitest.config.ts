import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    test: {
        clearMocks: true,
        restoreMocks: true,
        unstubGlobals: true,
        env: { TZ: "UTC" },
        projects: [
            {
                extends: true,
                test: {
                    name: "unit",
                    environment: "node",
                    include: ["tests/unit/**/*.test.ts"],
                },
            },
            {
                extends: true,
                test: {
                    name: "functional",
                    environment: "jsdom",
                    include: ["tests/functional/**/*.test.tsx"],
                    setupFiles: ["./tests/setup.ts"],
                },
            },
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: [
                "lib/format.ts",
                "lib/fetch.ts",
                "lib/hubStream.ts",
                "lib/checkpointHub.ts",
                "lib/transactionHub.ts",
                "hooks/useLiveStream.ts",
                "features/globe/clustering.ts",
                "features/globe/Globe.tsx",
                "features/globe/GlobeContext.tsx",
                "features/globe/ValidatorSearch.tsx",
                "features/globe/useValidatorLink.ts",
                "features/validators/stats.ts",
                "features/validators/ValidatorsContext.tsx",
                "features/validators/ValidatorsTable.tsx",
                "features/network/NetworkContext.tsx",
                "features/network/CheckpointStream.tsx",
                "features/network/TransactionStream.tsx",
                "features/dashboard/GlobePanel.tsx",
                "components/Navigation.tsx",
                "views/EpochsPage.tsx",
                "views/TransactionsPage.tsx",
            ],
        },
    },
});
