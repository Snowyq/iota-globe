"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const networks = [
    {
        value: "mainnet",
        name: "IOTA Mainnet",
        short: "Mainnet",
        description: "Production network",
    },
    {
        value: "testnet",
        name: "IOTA Testnet",
        short: "Testnet",
        description: "Development network",
    },
] as const;

// A select-only combobox in the top bar: no portal or body scroll lock.
export function NetworkSelect({
    value,
    onChange,
    disabled = false,
}: {
    value: "mainnet" | "testnet";
    onChange: (network: "mainnet" | "testnet") => void;
    disabled?: boolean;
}) {
    const id = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const selected = networks.findIndex((n) => n.value === value);
    const expanded = open && !disabled;
    const choose = (index: number) => {
        onChange(networks[index].value);
        setOpen(false);
    };
    useEffect(() => {
        if (!expanded) return;
        const outside = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node))
                setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [expanded]);
    return (
        <div
            className="network-select"
            ref={rootRef}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                    setOpen(false);
            }}
        >
            <button
                id="network-select"
                className="network-select-trigger"
                role="combobox"
                aria-label="Network"
                aria-haspopup="listbox"
                aria-expanded={expanded}
                aria-controls={expanded ? `${id}-list` : undefined}
                aria-activedescendant={expanded ? `${id}-${active}` : undefined}
                disabled={disabled}
                onClick={() => {
                    setActive(selected);
                    setOpen(!expanded);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && expanded) {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpen(false);
                        return;
                    }
                    if (event.key === "Tab") {
                        setOpen(false);
                        return;
                    }
                    if (
                        [
                            "ArrowDown",
                            "ArrowUp",
                            "Home",
                            "End",
                            "Enter",
                            " ",
                        ].includes(event.key)
                    ) {
                        event.preventDefault();
                        if (!expanded) {
                            setActive(
                                event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? networks.length - 1
                                      : selected
                            );
                            setOpen(true);
                        } else if (event.key === "Enter" || event.key === " ")
                            choose(active);
                        else if (event.key === "Home") setActive(0);
                        else if (event.key === "End")
                            setActive(networks.length - 1);
                        else
                            setActive(
                                (index) =>
                                    (index +
                                        (event.key === "ArrowDown" ? 1 : -1) +
                                        networks.length) %
                                    networks.length
                            );
                    } else if (/^[mt]$/i.test(event.key)) {
                        event.preventDefault();
                        setActive(event.key.toLowerCase() === "m" ? 0 : 1);
                        setOpen(true);
                    }
                }}
            >
                <span
                    className={`network-select-dot ${value}`}
                    aria-hidden="true"
                />
                <span className="network-select-value">
                    <span className="sr-only">IOTA </span>
                    {networks[selected].short}
                </span>
                <ChevronDown size={15} aria-hidden="true" />
            </button>
            {expanded && (
                <div
                    id={`${id}-list`}
                    className="network-select-menu"
                    role="listbox"
                    aria-label="Choose network"
                >
                    {networks.map((network, index) => (
                        <div
                            key={network.value}
                            id={`${id}-${index}`}
                            role="option"
                            aria-selected={value === network.value}
                            className={`network-select-option ${active === index ? "is-active" : ""}`}
                            onPointerMove={() => setActive(index)}
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => choose(index)}
                        >
                            <span
                                className={`network-select-dot ${network.value}`}
                                aria-hidden="true"
                            />
                            <span>
                                <strong>{network.name}</strong>
                                <small>{network.description}</small>
                            </span>
                            {value === network.value && (
                                <Check size={15} aria-hidden="true" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
