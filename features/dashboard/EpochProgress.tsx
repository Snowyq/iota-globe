"use client";

import { useContext } from "react";
import { Clock3, Layers3 } from "lucide-react";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { useNowTime } from "@/hooks/useNowTime";
import { formatDuration } from "@/lib/format";
import { TextLink } from "./DashboardPrimitives";

export function EpochProgress() {
    const { networkStats } = useContext(ValidatorsContext);
    const now = useNowTime();
    const start = Number(networkStats?.epochStartTimestampMs);
    const duration = Number(networkStats?.epochDurationMs);
    const progress =
        networkStats && duration > 0
            ? Math.max(0, Math.min(100, ((now - start) / duration) * 100))
            : null;
    return (
        <section className="epoch-banner">
            <span className="epoch-icon">
                <Layers3 size={20} strokeWidth={1.5} />
            </span>
            <div className="epoch-title">
                <span>Current epoch</span>
                <strong>{networkStats ? `#${networkStats.epoch}` : "—"}</strong>
            </div>
            <div className="epoch-progress">
                <div>
                    <span>Epoch progress</span>
                    <b>{progress?.toFixed(1) ?? "—"}%</b>
                </div>
                <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="Epoch progress"
                    aria-valuenow={progress ?? undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <span style={{ width: `${progress ?? 0}%` }} />
                </div>
            </div>
            <div className="epoch-remaining">
                <Clock3 size={15} />
                <span>
                    {networkStats
                        ? formatDuration(Math.max(0, start + duration - now))
                        : "—"}
                    <small>remaining</small>
                </span>
            </div>
            <TextLink href="/epochs">Epoch history</TextLink>
        </section>
    );
}
