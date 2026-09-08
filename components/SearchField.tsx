"use client";

import { Search, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export function SearchField({
    label,
    placeholder,
    value,
    onChange,
    className,
}: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className={cn("search-field search-control", className)}>
            <Search
                className="search-control-icon"
                size={16}
                aria-hidden="true"
            />
            <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-label={label}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && value) {
                        event.preventDefault();
                        event.stopPropagation();
                        onChange("");
                    }
                }}
            />
            {value && (
                <button
                    type="button"
                    className="search-clear"
                    aria-label="Clear search"
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => {
                        onChange("");
                        inputRef.current?.focus({ preventScroll: true });
                    }}
                >
                    <X size={15} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
