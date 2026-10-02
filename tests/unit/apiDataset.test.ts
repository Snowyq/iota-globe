import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as network } from "@/app/api/network/route";
import { GET as validators } from "@/app/api/validators/route";
import { GET as epochs } from "@/app/api/epochs/route";
import { GET as checkpoints } from "@/app/api/checkpoints/stream/route";
import { GET as transactions } from "@/app/api/transactions/stream/route";

const client = vi.hoisted(() => vi.fn());
vi.mock("@iota/iota-sdk/client", () => ({ IotaClient: client }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

describe("dataset validation", () => {
    it.each([
        ["network", network],
        ["validators", validators],
        ["epochs", epochs],
        ["checkpoint stream", checkpoints],
        ["transaction stream", transactions],
    ] as const)("%s rejects unknown datasets", async (_name, get) => {
        for (const dataset of ["unknown", "__proto__", "constructor"]) {
            const response = await get(
                new NextRequest(
                    `http://localhost/api/test?dataset=${encodeURIComponent(dataset)}`
                )
            );
            expect(response.status).toBe(400);
        }
        expect(client).not.toHaveBeenCalled();
    });
});
