"use client";

import {
    Component,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    ArrowUpRight,
    Crosshair,
    Globe2,
    Map,
    Minus,
    Pause,
    Play,
    Plus,
    Search,
} from "lucide-react";
import Link from "next/link";
import { GlobeSkeleton } from "@/features/globe/GlobeSkeleton";
import { GlobeNoSSR } from "@/features/globe/GlobeNoSSR";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { ValidatorInspector } from "@/features/globe/ValidatorInspector";
import { ValidatorSearch } from "@/features/globe/ValidatorSearch";
import { useValidatorLink } from "@/features/globe/useValidatorLink";
import type { PointOfView } from "@/features/globe/workerTypes";
import type { GestureHint } from "@/features/globe/Globe";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { isTypingTarget } from "@/lib/utils";
import { Panel } from "./DashboardPrimitives";

class GlobeBoundary extends Component<
    { children: React.ReactNode; onFailure: () => void; onRetry: () => void },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch() {
        this.props.onFailure();
    }
    render() {
        return this.state.failed ? (
            <div className="globe-fallback">
                <Globe2 size={56} strokeWidth={0.8} />
                <strong>The map could not start</strong>
                <span>
                    Background rendering needs OffscreenCanvas and WebGL.
                    <br />
                    You can still explore every validator in the directory.
                </span>
                <button className="subtle-button" onClick={this.props.onRetry}>
                    Try map again
                </button>
                <Link className="text-link" href="/validators">
                    Explore validators
                    <ArrowUpRight size={14} />
                </Link>
            </div>
        ) : (
            this.props.children
        );
    }
}

export function GlobePanel() {
    const {
        validators,
        networkStats,
        deselectValidator,
        isLoading,
        error,
        refresh,
        selectedValidator,
    } = useContext(ValidatorsContext);
    const {
        zoomGlobe,
        resetGlobe,
        setAutoRotate,
        isRotating,
        viewMode,
        setViewMode,
        openClusterId,
    } = useContext(GlobeContext);
    const [phase, setPhase] = useState<"loading" | "ready" | "error">(
        "loading"
    );
    const [attempt, setAttempt] = useState(0);
    const [slow, setSlow] = useState(false);
    // Keep the skeleton mounted until its fade-out ends.
    const [skeletonGone, setSkeletonGone] = useState(false);
    const handleSkeletonGone = useCallback(() => setSkeletonGone(true), []);
    const [searching, setSearching] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchButton = useRef<HTMLButtonElement>(null);
    const ready = phase === "ready";
    const inspectorOpen = ready && (!!selectedValidator || !!openClusterId);
    useValidatorLink(ready);
    const handleFailure = useCallback(() => setPhase("error"), []);
    const restart = useCallback(() => {
        setPhase("loading");
        setSlow(false);
        setSkeletonGone(false);
        setAttempt((value) => value + 1);
    }, []);
    const located = validators.filter((v) => v.geo);
    const countries = new Set(located.map((v) => v.geo!.countryCode)).size;
    const canSearch = ready && validators.length > 0;

    const flash = useCallback((text: string, ms: number) => {
        setHint(text);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), ms);
    }, []);
    useEffect(
        () => () => {
            if (hintTimer.current) clearTimeout(hintTimer.current);
        },
        []
    );
    // Wheel and one-finger drags scroll the page, so hint the real gesture.
    const handleHint = useCallback(
        (kind: GestureHint) => {
            if (kind === "touch") {
                flash("Use two fingers to turn the globe", 1600);
                return;
            }
            const mac = /Mac|iP(hone|ad|od)/.test(navigator.platform);
            flash(`Hold ${mac ? "⌘" : "Ctrl"} and scroll to zoom`, 1400);
        },
        [flash]
    );
    // Show the touch gestures once when the map is ready.
    const handleReady = useCallback(() => {
        setPhase("ready");
        if (window.matchMedia?.("(pointer: coarse)").matches)
            flash("Two fingers to turn · pinch to zoom", 3200);
    }, [flash]);

    useEffect(() => {
        if (phase !== "loading") return;
        const timer = setTimeout(() => setSlow(true), 8000);
        return () => clearTimeout(timer);
    }, [phase, attempt]);

    // ⌘K or "/" toggles the search.
    useEffect(() => {
        if (!canSearch) return;
        const keydown = (event: KeyboardEvent) => {
            if (
                (event.key.toLowerCase() === "k" &&
                    (event.metaKey || event.ctrlKey)) ||
                (event.key === "/" && !isTypingTarget(event.target))
            ) {
                event.preventDefault();
                setSearching((open) => !open);
            }
        };
        window.addEventListener("keydown", keydown);
        return () => window.removeEventListener("keydown", keydown);
    }, [canSearch]);
    const closeSearch = useCallback(() => {
        setSearching(false);
        searchButton.current?.focus({ preventScroll: true });
    }, []);

    const latRef = useRef<HTMLSpanElement>(null);
    const lngRef = useRef<HTMLSpanElement>(null);
    const altRef = useRef<HTMLSpanElement>(null);
    // Updated every frame, so write to the DOM directly.
    const handleView = useCallback((view: PointOfView) => {
        const lng = ((((view.lng + 180) % 360) + 360) % 360) - 180;
        if (latRef.current)
            latRef.current.textContent = `${Math.abs(view.lat).toFixed(1).padStart(4, "0")}°${view.lat >= 0 ? "N" : "S"}`;
        if (lngRef.current)
            lngRef.current.textContent = `${Math.abs(lng).toFixed(1).padStart(5, "0")}°${lng >= 0 ? "E" : "W"}`;
        if (altRef.current)
            altRef.current.textContent = view.altitude.toFixed(2);
    }, []);
    return (
        <div className={`globe-slot ${inspectorOpen ? "has-inspector" : ""}`}>
            <Panel
                aria-label="Global validator network"
                className={`globe-panel ${viewMode === "map" ? "is-map" : ""} ${inspectorOpen ? "has-inspector" : ""}`}
            >
                <div className="globe-visual">
                    <GlobeBoundary
                        key={attempt}
                        onFailure={handleFailure}
                        onRetry={restart}
                    >
                        <div
                            className={`globe-renderer ${ready ? "is-ready" : ""}`}
                            aria-hidden={!ready}
                            inert={!ready}
                        >
                            <GlobeNoSSR
                                mode={viewMode}
                                onReady={handleReady}
                                onView={handleView}
                                onHint={handleHint}
                            />
                        </div>
                    </GlobeBoundary>
                    {(phase === "loading" || (ready && !skeletonGone)) && (
                        <GlobeSkeleton
                            slow={slow && !ready}
                            onRetry={restart}
                            mode={viewMode}
                            leaving={ready}
                            onGone={handleSkeletonGone}
                        />
                    )}
                </div>
                <div className="stage-center">
                    <div className="globe-toolbar">
                        <div
                            className="map-mode-switch"
                            role="group"
                            aria-label="Map projection"
                        >
                            <button
                                aria-pressed={viewMode === "globe"}
                                aria-label="3D globe"
                                title="3D globe"
                                onClick={() => setViewMode("globe")}
                            >
                                <Globe2 size={14} />
                            </button>
                            <button
                                aria-pressed={viewMode === "map"}
                                aria-label="2D map"
                                title="2D map"
                                onClick={() => setViewMode("map")}
                            >
                                <Map size={14} />
                            </button>
                        </div>
                        <button
                            ref={searchButton}
                            className="map-search-button"
                            disabled={!canSearch}
                            aria-label="Find validator"
                            aria-haspopup="dialog"
                            aria-expanded={searching}
                            aria-keyshortcuts="Meta+K Control+K /"
                            onClick={() => setSearching(!searching)}
                        >
                            <Search size={14} />
                            <kbd aria-hidden="true">⌘K</kbd>
                        </button>
                    </div>
                    {searching && canSearch && (
                        <>
                            <button
                                className="validator-search-scrim"
                                aria-label="Close search"
                                tabIndex={-1}
                                onClick={closeSearch}
                            />
                            <ValidatorSearch onClose={closeSearch} />
                        </>
                    )}
                    <div className="map-readout is-located">
                        <h2 className="map-title">Validator map</h2>
                        <p>
                            <span className="legend-dot" />
                            {isLoading ? (
                                <span role="status">
                                    {networkStats
                                        ? "Refreshing locations…"
                                        : "Locating validators…"}
                                </span>
                            ) : error ? (
                                <span role="status">
                                    Locations unavailable{" "}
                                    <button onClick={refresh}>Retry</button>
                                </span>
                            ) : (
                                <>
                                    {located.length}/{validators.length} located
                                    {networkStats &&
                                        ` · ${countries} countries`}
                                </>
                            )}
                        </p>
                        <small>
                            {viewMode === "globe"
                                ? "IP estimates · illustrative links"
                                : "IP estimates · equirectangular"}
                        </small>
                    </div>
                    <div
                        className="map-readout is-telemetry"
                        aria-hidden="true"
                    >
                        {viewMode === "globe" && (
                            <p className="is-pulse">
                                <span className="pulse-dot" />
                                One pulse per checkpoint
                            </p>
                        )}
                        <p className="is-view">
                            <span ref={latRef}>22.0°N</span>
                            <span ref={lngRef}>008.0°E</span>
                            <span className="map-readout-label">
                                Alt <span ref={altRef}>2.40</span>
                            </span>
                        </p>
                    </div>
                    <fieldset className="globe-controls" disabled={!ready}>
                        <legend className="sr-only">Map controls</legend>
                        <button
                            className="icon-button"
                            aria-label="Zoom in"
                            title="Zoom in (+)"
                            onClick={() => zoomGlobe(-1)}
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            className="icon-button"
                            aria-label="Zoom out"
                            title="Zoom out (−)"
                            onClick={() => zoomGlobe(1)}
                        >
                            <Minus size={16} />
                        </button>
                        <span />
                        <button
                            className="icon-button"
                            aria-label="Reset map view"
                            title="Reset map view"
                            onClick={() => {
                                resetGlobe();
                                deselectValidator?.();
                            }}
                        >
                            <Crosshair size={16} />
                        </button>
                        {viewMode === "globe" && (
                            <button
                                className="icon-button"
                                aria-pressed={isRotating}
                                aria-label={
                                    isRotating
                                        ? "Pause globe rotation"
                                        : "Resume globe rotation"
                                }
                                title={
                                    isRotating
                                        ? "Pause rotation"
                                        : "Resume rotation"
                                }
                                onClick={() => setAutoRotate(!isRotating)}
                            >
                                {isRotating ? (
                                    <Pause size={14} />
                                ) : (
                                    <Play size={14} />
                                )}
                            </button>
                        )}
                    </fieldset>
                    <p
                        className={`map-gesture-hint ${hint ? "is-shown" : ""}`}
                        role="status"
                    >
                        {hint}
                    </p>
                </div>
                {ready && (
                    <ValidatorInspector key={openClusterId ?? "single"} />
                )}
            </Panel>
        </div>
    );
}
