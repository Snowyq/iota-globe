"use client";

import Link from "next/link";
import { Fragment, useContext, useRef } from "react";
import { ValidatorsContext } from "@/features/validators/ValidatorsContext";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { DataFlow } from "./DataFlow";
import { DotWordmark } from "./DotWordmark";
import { Features } from "./Features";
import { SmoothScroll } from "./SmoothScroll";

const REPO = "https://github.com/Snowyq/iota-globe";

// Section nav drawn as a stack of folders, one colour per section.
const FOLDERS = [
    { href: "#features", name: "Features" },
    { href: "#data-flow", name: "Data flow" },
    { href: "#performance", name: "Performance" },
    { href: "#decisions", name: "Decisions" },
    { href: "#run", name: "Run it" },
];

const PRACTICES = [
    {
        title: "The planet draws elsewhere",
        body: "Three.js runs in a Web Worker on an OffscreenCanvas, so WebGL never holds up a click, a keystroke or a scroll.",
    },
    {
        title: "Markers move without layout",
        body: "The HTML labels over the canvas are moved with transforms alone, and only when their position has actually changed.",
    },
    {
        title: "A burst becomes one render",
        body: "The backlog that arrives after a reconnect is merged into state once per frame, never once per checkpoint.",
    },
    {
        title: "Quality yields before the frame rate",
        body: "When frames start running late the worker lowers its resolution, and raises it again once the GPU catches up.",
    },
    {
        title: "Only data moves",
        body: "Decorative animation was taken out. What moves on screen is the network itself, and it rests under reduced motion.",
    },
];

const DECISIONS: { part: string; rows: [string, string, string, string][] }[] =
    [
        {
            part: "Rendering",
            rows: [
                [
                    "Globe in a Web Worker",
                    "Input never waits on WebGL",
                    "OffscreenCanvas",
                    "globe.worker.ts",
                ],
                [
                    "One shader for the flat map",
                    "Dots and coasts on the GPU",
                    "ShaderMaterial",
                    "globe.worker.ts",
                ],
                [
                    "HTML markers over the canvas",
                    "Crisp labels, real buttons",
                    "Transform-only writes",
                    "Globe.tsx",
                ],
                [
                    "Quality steps down on late frames",
                    "Holds the frame rate",
                    "Adaptive pixel ratio",
                    "globe.worker.ts",
                ],
            ],
        },
        {
            part: "Data",
            rows: [
                [
                    "RPC behind API routes",
                    "No endpoints in the browser",
                    "Route handlers",
                    "app/api",
                ],
                [
                    "One hub per stream",
                    "One poll serves every tab",
                    "SSE fan-out",
                    "checkpointHub.ts",
                ],
                [
                    "Merge once per frame",
                    "A backlog costs one render",
                    "rAF batching",
                    "CheckpointStream.tsx",
                ],
                [
                    "Reset on network switch",
                    "No late cross-network data",
                    "Change guards",
                    "useOnNetworkChange.ts",
                ],
            ],
        },
        {
            part: "Interface",
            rows: [
                [
                    "The overview fits one screen",
                    "Nothing hides below the fold",
                    "Container queries",
                    "globals.css",
                ],
                [
                    "⌘K validator palette",
                    "Find it, then fly there",
                    "Ranked matching",
                    "ValidatorSearch.tsx",
                ],
                [
                    "Scroll belongs to the page",
                    "Zoom with ⌘ or a pinch",
                    "Gesture hints",
                    "Globe.tsx",
                ],
            ],
        },
        {
            part: "Quality",
            rows: [
                [
                    "Tests at two levels",
                    "Units and whole flows",
                    "Vitest, Testing Library",
                    "tests/",
                ],
                [
                    "Reduced motion respected",
                    "Rotation and pulses stop",
                    "Media query",
                    "globe.worker.ts",
                ],
            ],
        },
    ];

// Split in React rather than with SplitText so live values inside can
// still re-render.
function Words({ text }: { text: string }) {
    return (
        <>
            {text.split(/(\s+)/).map((part, index) =>
                /^\s+$/.test(part) ? (
                    part
                ) : part ? (
                    <span className="w" key={index}>
                        {part}
                    </span>
                ) : null
            )}
        </>
    );
}

function Letters({ text }: { text: string }) {
    // Letters are wrapped per word so lines only break between words.
    return (
        <>
            {text.split(" ").map((word, w) => (
                // Space outside the inline-block, where it won't collapse.
                <Fragment key={w}>
                    {w > 0 && " "}
                    <span className="ch-word">
                        {[...word].map((letter, index) => (
                            <span
                                className="ch-mask"
                                aria-hidden="true"
                                key={index}
                            >
                                <span className="ch">{letter}</span>
                            </span>
                        ))}
                    </span>
                </Fragment>
            ))}
        </>
    );
}

const RISE = { opacity: 0, ease: "power3.out" };

function animateHero() {
    gsap.from(".about-hero .ch", {
        yPercent: 110,
        duration: 1.1,
        ease: "power4.out",
        stagger: 0.035,
    });
    gsap.from(".about-hero-actions", {
        ...RISE,
        y: 18,
        duration: 0.9,
        delay: 0.5,
    });
    gsap.from(".about-hero-lede", {
        ...RISE,
        y: 18,
        duration: 0.9,
        delay: 0.35,
    });
    gsap.from(".folder", {
        yPercent: 60,
        duration: 1.2,
        delay: 0.15,
        ease: "power4.out",
        stagger: 0.07,
    });
    // Folders fan apart as the hero scrolls out.
    gsap.utils.toArray<HTMLElement>(".folder").forEach((el, i) => {
        gsap.to(el, {
            y: -i * 26,
            ease: "none",
            scrollTrigger: {
                trigger: ".about-hero",
                start: "top top",
                end: "bottom top",
                scrub: true,
            },
        });
    });
}

function animateIntro() {
    gsap.fromTo(
        ".about-statement .w",
        { opacity: 0.5 },
        {
            opacity: 1,
            stagger: 0.05,
            ease: "none",
            scrollTrigger: {
                trigger: ".about-intro",
                start: "top 70%",
                end: "bottom 60%",
                scrub: true,
            },
        }
    );
    gsap.from(".about-statement .thumb", {
        scale: 0.4,
        duration: 0.9,
        ease: "back.out(1.6)",
        stagger: 0.12,
        scrollTrigger: { trigger: ".about-intro", start: "top 70%" },
    });
}

function animateFeatures() {
    gsap.from(".features-square", {
        scale: 0.7,
        duration: 1.3,
        ease: "power4.out",
        scrollTrigger: { trigger: ".features", start: "top 75%" },
    });
    gsap.from(".features-frame", {
        clipPath: "inset(100% 0% 0% 0%)",
        duration: 1.2,
        ease: "power4.inOut",
        scrollTrigger: { trigger: ".features", start: "top 70%" },
    });
    gsap.from(".features-index li", {
        ...RISE,
        x: -24,
        duration: 0.7,
        stagger: 0.06,
        // Trigger on the list: the wrapper has no box on phones.
        scrollTrigger: { trigger: ".features-index ul", start: "top 92%" },
    });
}

function animateDataFlow() {
    const onBar = () => ({ trigger: ".flow-bar", start: "top 80%" });
    gsap.from(".flow-segment", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1,
        ease: "power4.out",
        stagger: 0.14,
        scrollTrigger: onBar(),
    });
    gsap.from(".flow-stage p", {
        ...RISE,
        y: 16,
        duration: 0.7,
        stagger: 0.14,
        delay: 0.3,
        scrollTrigger: onBar(),
    });
}

function animatePerformance() {
    gsap.from(".practice", {
        ...RISE,
        y: 28,
        duration: 0.8,
        stagger: 0.1,
        scrollTrigger: { trigger: ".practices", start: "top 80%" },
    });
}

function animateDecisions() {
    gsap.set(".decision-row", { opacity: 0, y: 20 });
    ScrollTrigger.batch(".decision-row", {
        start: "top 92%",
        onEnter: (rows) =>
            gsap.to(rows, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: "power3.out",
                stagger: 0.05,
                overwrite: true,
            }),
    });
}

function animateFooter() {
    gsap.from(".dot-wordmark .on", {
        scale: 0,
        duration: 0.5,
        ease: "back.out(2)",
        stagger: { each: 0.004, from: "random" },
        scrollTrigger: { trigger: ".dot-wordmark", start: "top 85%" },
    });
}

export default function AboutPage() {
    const root = useRef<HTMLDivElement>(null);
    const { validators } = useContext(ValidatorsContext);
    const count = validators.length || 61;

    useGSAP(
        () => {
            // Phones and reduced motion get a static page.
            gsap.matchMedia().add(
                "(prefers-reduced-motion: no-preference) and (min-width: 761px)",
                () => {
                    animateHero();
                    animateIntro();
                    animateFeatures();
                    animateDataFlow();
                    animatePerformance();
                    animateDecisions();
                    animateFooter();
                }
            );
        },
        { scope: root }
    );

    return (
        <SmoothScroll>
            <div className="about" ref={root}>
                <section className="about-hero" aria-labelledby="about-title">
                    <div className="about-hero-head">
                        <h1 id="about-title" aria-label="IOTA Globe">
                            <Letters text="IOTA Globe" />
                        </h1>
                        <p className="about-hero-lede">
                            A live observatory for the IOTA network: {count}{" "}
                            validators on a planet drawn off the main thread,
                            and every checkpoint the moment it is certified.
                        </p>
                        <div className="about-hero-actions">
                            <Link href="/" className="motif-button is-accent">
                                Open the observatory
                            </Link>
                            <a href={REPO} className="hero-link">
                                Source on GitHub
                            </a>
                        </div>
                    </div>
                    <nav className="folders" aria-label="On this page">
                        {FOLDERS.map((folder, index) => (
                            <div
                                className={`folder folder-${index + 1}`}
                                key={folder.href}
                            >
                                <a className="folder-tab" href={folder.href}>
                                    {folder.name}
                                </a>
                            </div>
                        ))}
                    </nav>
                </section>

                <section className="about-intro" aria-labelledby="intro-title">
                    <h2 id="intro-title" className="sr-only">
                        What it is
                    </h2>
                    <p className="about-statement">
                        <Words text="It reads mainnet" />
                        <span
                            className="thumb thumb-globe"
                            aria-hidden="true"
                        />
                        <Words text="through its own API, streams each checkpoint" />
                        <span
                            className="thumb thumb-chain"
                            aria-hidden="true"
                        />
                        <Words
                            text={`as it lands and pins ${count} validators`}
                        />
                        <span
                            className="thumb thumb-marker"
                            aria-hidden="true"
                        />
                        <Words text="to a planet drawn in a worker." />
                    </p>
                </section>

                <section
                    id="features"
                    className="about-features"
                    aria-labelledby="features-title"
                >
                    <Features />
                </section>

                <section
                    id="data-flow"
                    className="about-flow"
                    aria-labelledby="flow-title"
                >
                    <h2 id="flow-title">From chain to pixel</h2>
                    <DataFlow />
                </section>

                <section
                    id="performance"
                    className="about-performance"
                    aria-labelledby="performance-title"
                >
                    <div className="about-performance-head">
                        <h2 id="performance-title">Light on the main thread</h2>
                        <p>
                            The overview runs a turning planet, a live chain and
                            a dozen panels at once, and still leaves the page
                            free to scroll, type and click.
                        </p>
                    </div>
                    <ul className="practices">
                        {PRACTICES.map((practice) => (
                            <li className="practice" key={practice.title}>
                                <h3>{practice.title}</h3>
                                <p>{practice.body}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section
                    id="decisions"
                    className="about-decisions"
                    aria-labelledby="decisions-title"
                >
                    <h2 id="decisions-title" className="sr-only">
                        Decisions
                    </h2>
                    <div
                        className="decisions"
                        role="table"
                        aria-labelledby="decisions-title"
                    >
                        <div className="decision-row is-head" role="row">
                            <span role="columnheader">Decision</span>
                            <span role="columnheader">Why</span>
                            <span role="columnheader">How</span>
                            <span role="columnheader">Where</span>
                        </div>
                        {DECISIONS.map(({ part, rows }) => (
                            <div
                                className="decision-part"
                                role="rowgroup"
                                aria-label={part}
                                key={part}
                            >
                                {/* Visual only; the rowgroup label is read out. */}
                                <h3 aria-hidden="true">{part}</h3>
                                {rows.map(([what, why, how, where]) => (
                                    <div
                                        className="decision-row"
                                        role="row"
                                        key={what}
                                    >
                                        <span role="cell">{what}</span>
                                        <span role="cell">{why}</span>
                                        <span role="cell">{how}</span>
                                        <span role="cell">{where}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                <footer
                    id="run"
                    className="about-footer"
                    aria-labelledby="run-title"
                >
                    <DotWordmark />
                    <div className="about-footer-grid">
                        <div>
                            <h3>Pages</h3>
                            <ul>
                                <li>
                                    <Link href="/">Overview</Link>
                                </li>
                                <li>
                                    <Link href="/validators">Validators</Link>
                                </li>
                                <li>
                                    <Link href="/transactions">
                                        Transactions
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/epochs">Epochs</Link>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h3>Source</h3>
                            <ul>
                                <li>
                                    <a href={REPO}>Repository</a>
                                </li>
                                <li>
                                    <a href={`${REPO}#architecture`}>
                                        Architecture
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href={`${REPO}/blob/main/features/globe/globe.worker.ts`}
                                    >
                                        Globe worker
                                    </a>
                                </li>
                                <li>
                                    <a href={`${REPO}/tree/main/tests`}>
                                        Tests
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <div>
                            <h3>Built with</h3>
                            <ul>
                                <li>Next.js 16, React 19</li>
                                <li>Three.js in a Web Worker</li>
                                <li>Tailwind CSS 4, Recharts</li>
                                <li>IOTA SDK, GSAP, Lenis</li>
                            </ul>
                        </div>
                        <div className="about-run">
                            <h3 id="run-title">Run it</h3>
                            <pre>
                                <code>{`pnpm install
echo "MAINNET_URL=…" > .env.local
pnpm dev`}</code>
                            </pre>
                            <p>
                                Add <code>TESTNET_URL</code> to switch networks
                                from the selector.
                            </p>
                        </div>
                    </div>
                    <div className="about-footer-last">
                        <span>
                            © 2026 Jakub Pniewski. Validator locations are IP
                            estimates; globe arcs are illustrative.
                        </span>
                        <a href="#top" className="motif-button is-small">
                            Back to top
                        </a>
                    </div>
                </footer>
            </div>
        </SmoothScroll>
    );
}
