"use client";

import { useContext, useEffect, useRef } from "react";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { GlobeContext } from "./GlobeContext";

const VALIDATOR_PARAM = "validator";

/** Shareable overview URL that opens this validator. */
export function validatorLink(address: string, origin?: string) {
    const base = origin ?? window.location.origin;
    return `${base}/?${VALIDATOR_PARAM}=${address}`;
}

/** Opens ?validator= once ready, then keeps the URL in sync. */
export function useValidatorLink(ready: boolean) {
    const { validators, selectedValidator, selectValidator } =
        useContext(ValidatorsContext);
    const { moveGlobeTo, setOpenClusterId } = useContext(GlobeContext);
    // undefined: URL not read yet, null: nothing pending.
    const pending = useRef<string | null | undefined>(undefined);

    useEffect(() => {
        pending.current =
            new URLSearchParams(window.location.search)
                .get(VALIDATOR_PARAM)
                ?.trim()
                .toLowerCase() || null;
    }, []);

    useEffect(() => {
        const wanted = pending.current;
        if (!ready || !wanted || validators.length === 0) return;
        pending.current = null;
        const validator = validators.find(
            (v) => v.iotaAddress.toLowerCase() === wanted
        );
        if (!validator) {
            replaceParam(null);
            return;
        }
        setOpenClusterId(null);
        selectValidator?.(validator.iotaAddress);
        if (validator.geo)
            moveGlobeTo(validator.geo.lat, validator.geo.lon, 1.5);
    }, [ready, validators, selectValidator, moveGlobeTo, setOpenClusterId]);

    useEffect(() => {
        // Don't clear the param before the linked validator has opened.
        if (pending.current !== null) return;
        replaceParam(selectedValidator?.iotaAddress ?? null);
    }, [selectedValidator]);
}

function replaceParam(address: string | null) {
    const url = new URL(window.location.href);
    if (address) url.searchParams.set(VALIDATOR_PARAM, address);
    else url.searchParams.delete(VALIDATOR_PARAM);
    if (url.href !== window.location.href)
        window.history.replaceState(window.history.state, "", url);
}
