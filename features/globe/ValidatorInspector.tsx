"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, MapPin, X } from "lucide-react";
import Link from "next/link";
import { ValidatorAvatar } from "@/components/ValidatorAvatar";
import { SearchField } from "@/components/SearchField";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useGlobeClickOutside } from "@/hooks/useGlobeClickOutside";
import { compact } from "@/features/dashboard/DashboardPrimitives";
import { GlobeContext } from "./GlobeContext";

export function ValidatorInspector() {
    const {
        validators,
        selectedValidator,
        selectValidator,
        deselectValidator,
    } = useContext(ValidatorsContext);
    const { inspectedAddresses, openClusterId, setOpenClusterId, moveGlobeTo } =
        useContext(GlobeContext);
    const panelRef = useRef<HTMLElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const [query, setQuery] = useState("");
    const validator = validators.find(
        (v) => v.iotaAddress === selectedValidator?.iotaAddress
    );
    const group = validators
        .filter((v) => inspectedAddresses.includes(v.iotaAddress))
        .sort((a, b) => b.stats.stakeIOTA - a.stats.stakeIOTA);
    const open = !!validator || (!!openClusterId && group.length > 0);
    const close = () => {
        deselectValidator?.();
        setOpenClusterId(null);
        setQuery("");
        if (returnFocusRef.current?.isConnected)
            returnFocusRef.current.focus({ preventScroll: true });
    };
    useGlobeClickOutside(panelRef, close, open);
    useEffect(() => {
        if (!open) return;
        returnFocusRef.current = document.activeElement as HTMLElement | null;
        panelRef.current?.focus({ preventScroll: true });
    }, [open]);
    if (!open) return null;
    const filtered = group.filter((v) =>
        `${v.payload.name} ${v.iotaAddress} ${v.geo?.country ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase().trim())
    );
    return (
        <aside
            className="validator-inspector"
            ref={panelRef}
            tabIndex={-1}
            aria-label={
                validator
                    ? `${validator.payload.name} validator details`
                    : "Validator group"
            }
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }
            }}
        >
            <div className="inspector-heading">
                <div>
                    {validator && group.length > 0 ? (
                        <button
                            className="inspector-back"
                            onClick={() => deselectValidator?.()}
                        >
                            <ArrowLeft size={13} />
                            Back to group
                        </button>
                    ) : (
                        <>
                            <span className="status-dot" />
                            <span>
                                {openClusterId === "all"
                                    ? "Validator directory"
                                    : "Validator group"}
                                <b>{group.length}</b>
                            </span>
                        </>
                    )}
                </div>
                <button
                    className="icon-button"
                    aria-label="Close validator panel"
                    onClick={close}
                >
                    <X size={15} />
                </button>
            </div>
            {validator ? (
                <>
                    <div className="inspector-detail-body">
                        <div className="inspector-identity">
                            <ValidatorAvatar
                                name={validator.payload.name}
                                imageUrl={validator.payload.imageUrl}
                            />
                            <div>
                                <h3>{validator.payload.name}</h3>
                                <p>
                                    <MapPin size={10} />
                                    {validator.geo
                                        ? `${validator.geo.city}, ${validator.geo.country}`
                                        : "Location unavailable"}
                                </p>
                            </div>
                        </div>
                        <span
                            className={`inspector-status ${validator.isAtRisk ? "at-risk" : ""}`}
                        >
                            {validator.isAtRisk
                                ? "Flagged at risk"
                                : validator.isCommitteeMember
                                  ? "Committee member"
                                  : "Active validator"}
                        </span>
                        <dl className="inspector-metrics">
                            <div>
                                <dt>Total staked</dt>
                                <dd>
                                    {compact(validator.stats.stakeIOTA)}
                                    <small>IOTA</small>
                                </dd>
                            </div>
                            <div>
                                <dt>Staking APY</dt>
                                <dd>
                                    {validator.stats.apyPercent?.toFixed(2) ??
                                        "—"}
                                    <small>%</small>
                                </dd>
                            </div>
                            <div>
                                <dt>Voting power</dt>
                                <dd>
                                    {validator.stats.stakePercent.toFixed(2)}
                                    <small>%</small>
                                </dd>
                            </div>
                            <div>
                                <dt>Commission</dt>
                                <dd>
                                    {(
                                        Number(
                                            validator.payload
                                                .effectiveCommissionRate
                                        ) / 100
                                    ).toFixed(2)}
                                    <small>%</small>
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <Link
                        className="inspector-detail-link"
                        href={`/validators/${validator.iotaAddress}`}
                    >
                        View validator details
                        <ArrowUpRight size={14} />
                    </Link>
                </>
            ) : (
                <>
                    {group.length > 5 && (
                        <SearchField
                            className="inspector-search"
                            label="Search validators in this group"
                            value={query}
                            onChange={setQuery}
                            placeholder="Search this group…"
                        />
                    )}
                    <div className="inspector-list">
                        {filtered.length ? (
                            filtered.map((v) => (
                                <button
                                    key={v.iotaAddress}
                                    onClick={() => {
                                        selectValidator?.(v.iotaAddress);
                                        if (v.geo)
                                            moveGlobeTo(v.geo.lat, v.geo.lon);
                                    }}
                                >
                                    <ValidatorAvatar
                                        name={v.payload.name}
                                        imageUrl={v.payload.imageUrl}
                                    />
                                    <span>
                                        <strong>{v.payload.name}</strong>
                                        <small>
                                            {v.geo?.country ??
                                                "Location unavailable"}
                                        </small>
                                    </span>
                                    <span className="inspector-list-apy">
                                        {v.stats.apyPercent?.toFixed(2) ?? "—"}%
                                        <small>APY</small>
                                    </span>
                                    <ArrowUpRight size={13} />
                                </button>
                            ))
                        ) : (
                            <p className="inspector-no-results">
                                No validators match your search.
                            </p>
                        )}
                    </div>
                    <div className="inspector-footnote">
                        Select a validator to inspect its stake and rewards.
                    </div>
                </>
            )}
        </aside>
    );
}
