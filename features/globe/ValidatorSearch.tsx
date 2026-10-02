"use client";

import { CornerDownLeft, MapPin, Search } from "lucide-react";
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { ValidatorAvatar } from "@/components/ValidatorAvatar";
import {
    ValidatorsContext,
    type Validator,
} from "@/features/validators/ValidatorsContext";
import { GlobeContext } from "./GlobeContext";

// Lower is better: name prefix, word prefix, name, address, place. -1 = no match.
function rank(v: Validator, q: string) {
    const name = v.payload.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/[\s._-]+/).some((word) => word.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    if (v.iotaAddress.toLowerCase().includes(q.replace(/^0x/, ""))) return 3;
    const place = `${v.geo?.city ?? ""} ${v.geo?.country ?? ""}`.toLowerCase();
    if (place.includes(q)) return 4;
    return -1;
}

function Highlight({ text, query }: { text: string; query: string }) {
    const at = query ? text.toLowerCase().indexOf(query) : -1;
    if (at < 0) return <>{text}</>;
    return (
        <>
            {text.slice(0, at)}
            <mark>{text.slice(at, at + query.length)}</mark>
            {text.slice(at + query.length)}
        </>
    );
}

// Command palette: arrows to move, Enter flies to the validator.
export function ValidatorSearch({ onClose }: { onClose: () => void }) {
    const { validators, selectValidator } = useContext(ValidatorsContext);
    const { moveGlobeTo, setOpenClusterId } = useContext(GlobeContext);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const id = useId();
    const q = query.trim().toLowerCase();
    const results = useMemo(() => {
        const byPower = [...validators].sort(
            (a, b) => b.stats.stakePercent - a.stats.stakePercent
        );
        if (!q) return byPower;
        return byPower
            .map((v) => ({ v, r: rank(v, q) }))
            .filter((x) => x.r >= 0)
            .sort((a, b) => a.r - b.r)
            .map((x) => x.v);
    }, [validators, q]);
    const current = Math.min(active, Math.max(0, results.length - 1));

    useEffect(() => {
        inputRef.current?.focus();
    }, []);
    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${current}"]`)
            ?.scrollIntoView?.({ block: "nearest" });
    }, [current]);

    const choose = (v: Validator | undefined) => {
        if (!v) return;
        setOpenClusterId(null);
        selectValidator?.(v.iotaAddress);
        if (v.geo) moveGlobeTo(v.geo.lat, v.geo.lon, 1.5);
        onClose();
    };

    return (
        <div
            className="validator-search"
            role="dialog"
            aria-label="Find a validator"
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose();
                }
            }}
        >
            <div className="validator-search-field">
                <Search size={15} aria-hidden="true" />
                <input
                    ref={inputRef}
                    role="combobox"
                    aria-label="Validator name, address or country"
                    aria-expanded="true"
                    aria-controls={`${id}-list`}
                    aria-activedescendant={
                        results.length ? `${id}-${current}` : undefined
                    }
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Name, address or country…"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setActive(
                                (current + 1) % Math.max(1, results.length)
                            );
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActive(
                                (current - 1 + results.length) %
                                    Math.max(1, results.length)
                            );
                        } else if (event.key === "Enter") {
                            event.preventDefault();
                            choose(results[current]);
                        }
                    }}
                />
                <kbd>Esc</kbd>
            </div>
            <ul
                className="validator-search-list"
                id={`${id}-list`}
                role="listbox"
                aria-label="Validators"
                ref={listRef}
            >
                {results.map((v, index) => (
                    <li
                        key={v.iotaAddress}
                        id={`${id}-${index}`}
                        role="option"
                        aria-selected={index === current}
                        data-index={index}
                        onMouseMove={() =>
                            index !== current && setActive(index)
                        }
                        onClick={() => choose(v)}
                    >
                        <ValidatorAvatar
                            name={v.payload.name}
                            imageUrl={v.payload.imageUrl}
                        />
                        <span className="validator-search-name">
                            <strong>
                                <Highlight text={v.payload.name} query={q} />
                            </strong>
                            <small>
                                <MapPin size={9} aria-hidden="true" />
                                <span>
                                    {v.geo ? (
                                        <Highlight
                                            text={`${v.geo.city}, ${v.geo.country}`}
                                            query={q}
                                        />
                                    ) : (
                                        "Location unavailable"
                                    )}
                                </span>
                            </small>
                        </span>
                        <span className="validator-search-power">
                            {v.stats.stakePercent.toFixed(2)}%
                            <small>power</small>
                        </span>
                        {index === current && (
                            <CornerDownLeft
                                className="validator-search-enter"
                                size={13}
                                aria-hidden="true"
                            />
                        )}
                    </li>
                ))}
                {!results.length && (
                    <li className="validator-search-empty" role="presentation">
                        No validator matches “{query.trim()}”.
                    </li>
                )}
            </ul>
            <div className="validator-search-foot" aria-hidden="true">
                <span>
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> move
                </span>
                <span>
                    <kbd>↵</kbd> fly to
                </span>
                <span>
                    {results.length} of {validators.length}
                </span>
            </div>
        </div>
    );
}
