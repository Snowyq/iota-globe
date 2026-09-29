import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** `signal` (if any) that also aborts after `ms`. */
export function withTimeout(signal: AbortSignal | undefined, ms: number) {
    const timeout = AbortSignal.timeout(ms);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** True when a key event comes from a text field. */
export function isTypingTarget(target: EventTarget | null) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
}
