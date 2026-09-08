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
    Maximize2,
    Minimize2,
    Minus,
    Pause,
    Play,
    Plus,
    Search,
    Hand,
    Check,
} from "lucide-react";
import Link from "next/link";
import { GlobeSkeleton } from "@/features/globe/GlobeSkeleton";
import { GlobeNoSSR } from "@/features/globe/GlobeNoSSR";
import { GlobeContext } from "@/features/globe/GlobeContext";
import { ValidatorInspector } from "@/features/globe/ValidatorInspector";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { Panel, PanelHeader } from "./DashboardPrimitives";

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
        inspectCluster,
        openClusterId,
    } = useContext(GlobeContext);
    const [expanded, setExpanded] = useState(false);
    const [touchInteractive, setTouchInteractive] = useState(false);
    const [phase, setPhase] = useState<"loading" | "ready" | "error">(
        "loading"
    );
    const [attempt, setAttempt] = useState(0);
    const [slow, setSlow] = useState(false);
    const ready = phase === "ready";
    const inspectorOpen = ready && (!!selectedValidator || !!openClusterId);
    const handleReady = useCallback(() => setPhase("ready"), []);
    const handleFailure = useCallback(() => setPhase("error"), []);
    const restart = useCallback(() => {
        setPhase("loading");
        setSlow(false);
        setAttempt((value) => value + 1);
    }, []);
    const panelRef = useRef<HTMLElement>(null);
    const expandRef = useRef<HTMLButtonElement>(null);
    const located = validators.filter((v) => v.geo);
    const countries = new Set(located.map((v) => v.geo!.countryCode)).size;
    useEffect(() => {
        if (phase !== "loading") return;
        const timer = setTimeout(() => setSlow(true), 8000);
        return () => clearTimeout(timer);
    }, [phase, attempt]);
    useEffect(() => {
        if (!expanded) return;
        const opener = document.activeElement as HTMLElement | null;
        const expandButton = expandRef.current;
        panelRef.current?.focus({ preventScroll: true });
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const keydown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            if (event.key === "Escape") {
                event.preventDefault();
                setExpanded(false);
            }
            if (event.key === "Tab") {
                const nodes = [
                    ...(panelRef.current?.querySelectorAll<HTMLElement>(
                        'a[href], button:not(:disabled), input, [tabindex="0"]'
                    ) ?? []),
                ].filter(
                    (node) =>
                        node.getClientRects().length > 0 &&
                        !node.closest("[hidden], [inert]")
                );
                if (!nodes.length) return;
                const first = nodes[0],
                    last = nodes[nodes.length - 1];
                if (
                    event.shiftKey &&
                    (document.activeElement === first ||
                        document.activeElement === panelRef.current)
                ) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener("keydown", keydown);
        return () => {
            document.body.style.overflow = overflow;
            window.removeEventListener("keydown", keydown);
            (opener?.isConnected ? opener : expandButton)?.focus({
                preventScroll: true,
            });
        };
    }, [expanded]);
    return (
        <div
            className={`globe-slot ${inspectorOpen ? "has-inspector" : ""} ${expanded ? "is-fullscreen" : ""}`}
        >
            {expanded && (
                <button
                    className="globe-backdrop"
                    aria-label="Close expanded map"
                    tabIndex={-1}
                    onClick={() => setExpanded(false)}
                />
            )}
            <Panel
                ref={panelRef}
                tabIndex={expanded ? -1 : undefined}
                role={expanded ? "dialog" : undefined}
                aria-modal={expanded || undefined}
                aria-label="Global validator network"
                className={`globe-panel ${viewMode === "map" ? "is-map" : ""} ${expanded ? "is-expanded" : ""} ${inspectorOpen ? "has-inspector" : ""}`}
            >
                <PanelHeader
                    title="A globally connected network"
                    description="Explore the validators securing IOTA"
                    action={
                        <button
                            ref={expandRef}
                            className="icon-button"
                            aria-label={
                                expanded
                                    ? "Exit fullscreen map"
                                    : "Expand network map"
                            }
                            title={
                                expanded
                                    ? "Exit fullscreen (Esc)"
                                    : "Expand network map"
                            }
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? (
                                <Minimize2 size={16} />
                            ) : (
                                <Maximize2 size={16} />
                            )}
                        </button>
                    }
                />
                <div className="globe-toolbar">
                    <div
                        className="map-mode-switch"
                        aria-label="Map projection"
                    >
                        <button
                            aria-pressed={viewMode === "globe"}
                            onClick={() => setViewMode("globe")}
                        >
                            <Globe2 size={13} />
                            3D globe
                        </button>
                        <button
                            aria-pressed={viewMode === "map"}
                            onClick={() => setViewMode("map")}
                        >
                            <Map size={13} />
                            2D map
                        </button>
                    </div>
                    <button
                        className="map-directory-button"
                        disabled={!ready || !validators.length}
                        onClick={() => {
                            deselectValidator?.();
                            inspectCluster(
                                "all",
                                validators.map((v) => v.iotaAddress)
                            );
                        }}
                    >
                        <Search size={13} />
                        <span>Find validator</span>
                    </button>
                </div>
                <div className="globe-visual">
                    <div className="globe-grid" aria-hidden="true" />
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
                                touchInteractive={expanded || touchInteractive}
                                onReady={handleReady}
                            />
                        </div>
                    </GlobeBoundary>
                    {phase === "loading" && (
                        <GlobeSkeleton
                            slow={slow}
                            onRetry={restart}
                            mode={viewMode}
                        />
                    )}
                </div>
                <fieldset className="globe-controls" disabled={!ready}>
                    <legend className="sr-only">Map controls</legend>
                    <button
                        className="icon-button"
                        aria-label="Zoom in"
                        title="Zoom in (+)"
                        onClick={() => zoomGlobe(-1)}
                    >
                        <Plus size={17} />
                    </button>
                    <button
                        className="icon-button"
                        aria-label="Zoom out"
                        title="Zoom out (−)"
                        onClick={() => zoomGlobe(1)}
                    >
                        <Minus size={17} />
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
                        <Crosshair size={17} />
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
                                <Pause size={15} />
                            ) : (
                                <Play size={15} />
                            )}
                        </button>
                    )}
                </fieldset>
                {ready && (
                    <ValidatorInspector key={openClusterId ?? "single"} />
                )}
                <div className="globe-bottom">
                    <div>
                        <strong>
                            {networkStats ? validators.length : "—"}
                        </strong>
                        <span>Validators</span>
                    </div>
                    <div>
                        <strong>{networkStats ? countries : "—"}</strong>
                        <span>Countries</span>
                    </div>
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
                            `${located.length}/${validators.length} located`
                        )}
                        <small>
                            {viewMode === "globe"
                                ? "IP estimates · illustrative links"
                                : "IP estimates · equirectangular map"}
                        </small>
                    </p>
                </div>
                {ready && (
                    <div className="map-interaction-hint">
                        <span className="map-desktop-hint">
                            {viewMode === "globe"
                                ? "Drag to rotate · select a marker"
                                : "Zoom to explore · select a marker"}
                        </span>
                        {!expanded && (
                            <button
                                className="map-touch-toggle"
                                aria-pressed={touchInteractive}
                                onClick={() => {
                                    setTouchInteractive(!touchInteractive);
                                    setAutoRotate(false);
                                }}
                            >
                                {touchInteractive ? (
                                    <Check size={13} />
                                ) : (
                                    <Hand size={13} />
                                )}
                                {touchInteractive
                                    ? "Done · scroll page"
                                    : "Explore map"}
                            </button>
                        )}
                        {expanded && (
                            <span className="map-touch-hint">
                                Drag to move · pinch to zoom
                            </span>
                        )}
                    </div>
                )}
            </Panel>
        </div>
    );
}
