"use client";

import { useContext } from "react";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useNowTime } from "@/hooks/useNowTime";
import { formatDuration } from "@/lib/format";
import { TextLink } from "./DashboardPrimitives";

const CELLS = 48;

// Epochs last a day, so the clock time says enough; the date goes in a
// tooltip.
const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    });

const utc = (ms: number) =>
    new Date(ms).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    });

export function EpochProgress() {
    const { networkStats } = useContext(ValidatorsContext);
    const now = useNowTime();
    const start = Number(networkStats?.epochStartTimestampMs);
    const duration = Number(networkStats?.epochDurationMs);
    const progress =
        networkStats && duration > 0
            ? Math.max(0, Math.min(100, ((now - start) / duration) * 100))
            : null;
    const filled = Math.floor(((progress ?? 0) / 100) * CELLS);
    return (
        <section className="epoch-banner" aria-label="Current epoch">
            <div className="epoch-title">
                <span>Epoch</span>
                <strong>{networkStats ? `#${networkStats.epoch}` : "—"}</strong>
            </div>
            <div className="epoch-progress">
                <div className="epoch-progress-labels">
                    <span title={networkStats ? `${utc(start)} UTC` : undefined}>
                        {networkStats ? `Opened ${clock(start)}` : "—"}
                    </span>
                    <b>{progress?.toFixed(1) ?? "—"}%</b>
                    <span
                        title={
                            networkStats
                                ? `${utc(start + duration)} UTC`
                                : undefined
                        }
                    >
                        {networkStats
                            ? `Closes ${clock(start + duration)} UTC`
                            : "—"}
                    </span>
                </div>
                <div
                    className="progress-cells"
                    role="progressbar"
                    aria-label="Epoch progress"
                    aria-valuenow={progress ?? undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    {Array.from({ length: CELLS }, (_, i) => (
                        <i
                            key={i}
                            className={
                                i < filled
                                    ? "is-filled"
                                    : i === filled && progress != null
                                      ? "is-current"
                                      : undefined
                            }
                        />
                    ))}
                </div>
            </div>
            <div className="epoch-remaining">
                <strong>
                    {networkStats
                        ? formatDuration(Math.max(0, start + duration - now))
                        : "—"}
                </strong>
                <span>until the next epoch</span>
            </div>
            <TextLink href="/epochs">Epoch ledger</TextLink>
        </section>
    );
}
