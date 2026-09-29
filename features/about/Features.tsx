"use client";

import { useState } from "react";

const FEATURES = [
    {
        name: "Globe",
        fact: "A dot-matrix planet drawn by Three.js in a worker, with one pulse for every certified checkpoint.",
        video: "/about/globe.mp4",
        poster: "/about/globe-poster.jpg",
        alt: "The globe turning slowly, validator groups marked over Europe",
        square: true,
    },
    {
        name: "Flat map",
        fact: "The same renderer as a flat equirectangular map: a shader draws the dots and coasts, and the world wraps sideways.",
        src: "/about/map.jpg",
        alt: "Overview in flat map mode with validator groups across Europe and the Americas",
    },
    {
        name: "Validator search",
        fact: "⌘K opens a palette ranked by name, word, address and place. Enter flies the camera to the validator and opens it.",
        src: "/about/search.jpg",
        alt: "Search palette over the globe with one match for “swiss”",
    },
    {
        name: "Group inspector",
        fact: "A cluster opens into a searchable list of its validators, each with APY and a link to its stake and rewards.",
        src: "/about/inspector.jpg",
        alt: "Inspector listing the twelve validators in a European group",
    },
    {
        name: "Validators",
        fact: "The whole committee in one directory: sort, filter and page by stake, voting power, APY and country.",
        src: "/about/validators.jpg",
        alt: "Validators page with the sortable directory",
    },
    {
        name: "Transactions",
        fact: "Recent transactions as they land, with sender and digest search, type filters and a pause that holds the list still.",
        src: "/about/transactions.jpg",
        alt: "Transactions page with the live list",
    },
];

// React doesn't render the `muted` attribute and iOS won't autoplay without
// it, so set it by hand. Plays only while on screen.
const playWhileVisible = (video: HTMLVideoElement | null) => {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
    });
    observer.observe(video);
    return () => observer.disconnect();
};

// Hover, focus or tap a name to show its screenshot.
export function Features() {
    const [active, setActive] = useState(0);
    const current = FEATURES[active];
    return (
        <div className="features">
            <div className="features-stage">
                <div className="features-visual">
                    <div className="features-square" aria-hidden="true" />
                    <div className="features-frame">
                        {FEATURES.map((feature, index) =>
                            feature.video ? (
                                <video
                                    key={feature.name}
                                    ref={playWhileVisible}
                                    className={`is-square ${index === active ? "is-active" : ""}`}
                                    src={feature.video}
                                    poster={feature.poster}
                                    muted
                                    loop
                                    autoPlay
                                    playsInline
                                    aria-label={feature.alt}
                                />
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    key={feature.name}
                                    className={
                                        index === active ? "is-active" : ""
                                    }
                                    src={feature.src}
                                    alt={feature.alt}
                                    width={2160}
                                    height={1350}
                                    loading="lazy"
                                />
                            )
                        )}
                    </div>
                </div>
                <p className="features-fact" aria-live="polite">
                    {current.fact}
                </p>
            </div>
            <div className="features-index">
                <h2 id="features-title">Features</h2>
                <ul aria-labelledby="features-title">
                    {FEATURES.map((feature, index) => (
                        <li key={feature.name}>
                            <button
                                type="button"
                                aria-pressed={index === active}
                                onMouseEnter={() => setActive(index)}
                                onFocus={() => setActive(index)}
                                onClick={() => setActive(index)}
                            >
                                <i
                                    className="motif-bullet"
                                    aria-hidden="true"
                                />
                                {feature.name}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
