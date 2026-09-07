"use client";

import { useContext } from "react";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { GlobeContext } from "./GlobeContext";

import type { ValidatorCluster } from "./clustering";
export type { ValidatorCluster } from "./clustering";

export function ClusterMarker({ cluster }: { cluster: ValidatorCluster }) {
    const {
        validators,
        selectedValidator,
        selectValidator,
        deselectValidator,
    } = useContext(ValidatorsContext);
    const { moveGlobeTo, openClusterId, setOpenClusterId, inspectCluster } =
        useContext(GlobeContext);
    const single = cluster.count === 1;
    const validator = single
        ? validators.find((v) => v.iotaAddress === cluster.validators[0])
        : null;
    const selected =
        cluster.validators.includes(selectedValidator?.iotaAddress ?? "") ||
        openClusterId === cluster.id;
    return (
        <button
            data-globe-marker
            className={`globe-marker ${selected ? "selected" : ""}`}
            aria-label={
                single
                    ? `Inspect ${validator?.payload.name ?? "validator"}`
                    : `Inspect group of ${cluster.count} validators`
            }
            aria-pressed={selected}
            onClick={(event) => {
                event.stopPropagation();
                if (single) {
                    setOpenClusterId(null);
                    selectValidator?.(cluster.validators[0]);
                    moveGlobeTo(cluster.lat, cluster.lng);
                } else {
                    deselectValidator?.();
                    inspectCluster(cluster.id, cluster.validators);
                }
            }}
        >
            <span className="marker-point" />
            {single
                ? (validator?.payload.name.slice(0, 3).toUpperCase() ?? "1")
                : cluster.count}
        </button>
    );
}
