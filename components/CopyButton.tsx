"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function CopyButton({
    value,
    label = "Copy value",
    icon = <Copy size={12} />,
    className = "copy-button",
}: {
    value: string;
    label?: string;
    icon?: ReactNode;
    className?: string;
}) {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setState("copied");
        } catch {
            setState("failed");
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2000);
    };
    return (
        <button
            className={className}
            aria-label={
                state === "copied"
                    ? "Copied"
                    : state === "failed"
                      ? "Copy failed. Try again."
                      : label
            }
            title={
                state === "copied"
                    ? "Copied"
                    : state === "failed"
                      ? "Copy failed"
                      : label
            }
            onClick={copy}
        >
            {state === "copied" ? <Check size={12} /> : icon}
            <span className="sr-only" role="status">
                {state === "copied"
                    ? "Copied to clipboard"
                    : state === "failed"
                      ? "Unable to access clipboard"
                      : ""}
            </span>
        </button>
    );
}
