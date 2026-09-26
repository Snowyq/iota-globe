"use client";

import { NetworkResources } from "@/features/dashboard/NetworkMetrics";
import { Observatory } from "@/features/dashboard/Observatory";
import { ThroughputChart } from "@/features/dashboard/ThroughputChart";
import { ValidatorPreview } from "@/features/dashboard/ValidatorPreview";

export default function Index() {
    return (
        <>
            <Observatory />
            <div className="observatory-below">
                <ThroughputChart />
                <div className="ledger-grid">
                    <ValidatorPreview />
                    <NetworkResources />
                </div>
            </div>
        </>
    );
}
