// All rendering, projection and texture prep for the map happens here.
import * as THREE from "three";
import { feature } from "topojson-client";
import landTopology from "@/assets/land_10m.json";
import { HOME_VIEW, MAX_ALTITUDE, MIN_ALTITUDE } from "./view";
import type {
    GlobeFrame,
    GlobePoint,
    MapMode,
    PointOfView,
    ProjectedCluster,
    WorkerInput,
    WorkerOutput,
} from "./workerTypes";

type Pulse = {
    trail: THREE.Line;
    head: THREE.Mesh;
    ping: THREE.Mesh;
    path: THREE.Vector3[];
    start: number;
    duration: number;
    load: number;
    active: boolean;
};

const AMBIENT_FRAME_MS = 1000 / 30;
const INTERACT_MS = 400;
const MAX_LAT = 80;
const PIXEL_RATIO_CAP = 1.5;
const PULSE_COUNT = 14;
const PULSE_TRAIL = 9;
const PULSE_MS = 1200;
const PING_MS = 900;
const MASK_W = 2048;
const MASK_H = 1024;
const DOT_PITCH = 7;
// The flat map only shows this latitude band.
const MAP_SOUTH = -58;
const MAP_NORTH = 84;
const MAP_FIT_ALTITUDE = HOME_VIEW.map.altitude;

let renderer: THREE.WebGLRenderer | null = null;
let globeScene: THREE.Scene;
let mapScene: THREE.Scene;
let globeCamera: THREE.PerspectiveCamera;
let mapCamera: THREE.OrthographicCamera;
let globeLinks: THREE.Group;
let stars: THREE.Group;
const pulses: Pulse[] = [];
let arcPaths: THREE.Vector3[][] = [];

let width = 1;
let height = 1;
let mode: MapMode = "globe";
let reducedMotion = false;
let rotating = true;
let visible = true;
let points: GlobePoint[] = [];
let clusters: ProjectedCluster[] = [];

const globeView: PointOfView = { ...HOME_VIEW.globe };
const mapView: PointOfView = { ...HOME_VIEW.map };
let mapHalfWidth = 2.15;
let mapHalfHeight = 1.15;
let transition: {
    from: PointOfView;
    to: PointOfView;
    start: number;
    duration: number;
} | null = null;

let lastFrame = 0;
let lastProjection = 0;
let scheduled: number | null = null;
let dirty = true;
let urgent = true;
// Timestamp until which we keep rendering at full rate.
let interacting = 0;

let devicePixelRatio = 1;
let qualityScale = 1;
let lateFrames = 0;
let goodFrames = 0;

// Drag momentum, in px per ms.
let velocity = { x: 0, y: 0 };
let lastDragAt = 0;

const send = (message: WorkerOutput) => self.postMessage(message);

// Not every worker has rAF; fall back to a timer (ids stored negative).
const frameApi = self as unknown as {
    requestAnimationFrame?: (callback: () => void) => number;
    cancelAnimationFrame?: (id: number) => void;
};
const schedule = (callback: () => void, delay = 0) =>
    frameApi.requestAnimationFrame && delay === 0
        ? frameApi.requestAnimationFrame(callback)
        : -(setTimeout(callback, delay || 16) as unknown as number);
const cancel = (id: number) => {
    if (id < 0) clearTimeout(-id);
    else frameApi.cancelAnimationFrame?.(id);
};

const currentView = () => (mode === "globe" ? globeView : mapView);
const altitudeRange = () =>
    mode === "globe"
        ? ([MIN_ALTITUDE, MAX_ALTITUDE] as const)
        : ([0.35, MAP_FIT_ALTITUDE] as const);
const markInteraction = () => {
    interacting = performance.now() + INTERACT_MS;
};

function spherePoint(lat: number, lng: number, radius = 1) {
    const phi = THREE.MathUtils.degToRad(lat);
    const theta = THREE.MathUtils.degToRad(lng);
    return new THREE.Vector3(
        radius * Math.cos(phi) * Math.sin(theta),
        radius * Math.sin(phi),
        radius * Math.cos(phi) * Math.cos(theta)
    );
}

// Equirectangular land mask (alpha per pixel), shared by both views.
function makeLandMask() {
    const mask = new OffscreenCanvas(MASK_W, MASK_H);
    const ctx = mask.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Map texture could not be prepared");
    const land = feature(
        landTopology as unknown as Parameters<typeof feature>[0],
        landTopology.objects.land as unknown as Parameters<typeof feature>[1]
    ) as unknown as {
        features: { geometry: { type: string; coordinates: number[][][][] } }[];
    };
    ctx.fillStyle = "#fff";
    for (const item of land.features) {
        const polygons =
            item.geometry.type === "Polygon"
                ? [item.geometry.coordinates as unknown as number[][][]]
                : item.geometry.coordinates;
        for (const polygon of polygons) {
            // Drawn three times so shapes crossing the antimeridian wrap.
            for (const offset of [-MASK_W, 0, MASK_W]) {
                ctx.beginPath();
                for (const ring of polygon) traceRing(ctx, ring, offset);
                ctx.fill("evenodd");
            }
        }
    }
    const rgba = ctx.getImageData(0, 0, MASK_W, MASK_H).data;
    const alpha = new Uint8Array(MASK_W * MASK_H);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    return alpha;
}

function traceRing(
    ctx: OffscreenCanvasRenderingContext2D,
    ring: number[][],
    offset: number
) {
    let previousLng = ring[0]?.[0] ?? 0;
    ring.forEach(([lng, lat], index) => {
        // Keep consecutive points continuous instead of jumping 360°.
        while (lng - previousLng > 180) lng -= 360;
        while (lng - previousLng < -180) lng += 360;
        previousLng = lng;
        const x = ((lng + 180) / 360) * MASK_W + offset;
        const y = ((90 - lat) / 180) * MASK_H;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
}

// Dot-matrix texture for the globe.
function makeGlobeTexture(mask: Uint8Array) {
    const W = MASK_W;
    const H = MASK_H;
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Map texture could not be prepared");
    ctx.fillStyle = "#040a0f";
    ctx.fillRect(0, 0, W, H);
    // 15° graticule
    ctx.strokeStyle = "rgba(57, 225, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let lng = 0; lng <= 360; lng += 15) {
        const x = (lng / 360) * W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    for (let lat = 0; lat <= 180; lat += 15) {
        const y = (lat / 180) * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
    const isLand = (x: number, y: number) =>
        mask[Math.floor(y) * W + ((Math.floor(x) + W) % W)] > 127;
    for (let y = DOT_PITCH / 2; y < H; y += DOT_PITCH) {
        const lat = 90 - (y / H) * 180;
        // Wider spacing towards the poles keeps dots round on the sphere.
        const stepX =
            DOT_PITCH / Math.max(Math.cos((lat * Math.PI) / 180), 0.18);
        for (let x = stepX / 2; x < W; x += stepX) {
            if (!isLand(x, y)) continue;
            const coast = !isLand(x - stepX, y) || !isLand(x + stepX, y);
            ctx.fillStyle = coast ? "#7fe9ff" : "#3a9fb2";
            ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

// Flat map dots are computed per pixel from the mask, so they stay sharp
// at any zoom. Antarctica is cut off below MAP_SOUTH.
function makeFlatMaterial(mask: Uint8Array) {
    const maskTexture = new THREE.DataTexture(
        mask,
        MASK_W,
        MASK_H,
        THREE.RedFormat,
        THREE.UnsignedByteType
    );
    maskTexture.flipY = true;
    maskTexture.wrapS = THREE.RepeatWrapping;
    maskTexture.magFilter = THREE.NearestFilter;
    maskTexture.minFilter = THREE.NearestFilter;
    maskTexture.generateMipmaps = false;
    maskTexture.needsUpdate = true;
    return new THREE.ShaderMaterial({
        uniforms: {
            uMask: { value: maskTexture },
            uCells: {
                value: new THREE.Vector2(
                    MASK_W / DOT_PITCH,
                    MASK_H / DOT_PITCH
                ),
            },
            uSouth: { value: (MAP_SOUTH + 90) / 180 },
        },
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = vec2(uv.x * 3.0, uv.y);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        // Colours are sRGB, same as the globe texture.
        fragmentShader: /* glsl */ `
            uniform sampler2D uMask;
            uniform vec2 uCells;
            uniform float uSouth;
            varying vec2 vUv;
            float land(vec2 uv) {
                return step(0.5, texture2D(uMask, uv).r);
            }
            void main() {
                vec2 g = vUv * uCells;
                vec2 center = (floor(g) + 0.5) / uCells;
                float here = land(center) * step(uSouth, center.y);
                float step1 = 1.0 / uCells.x;
                float coast = here * (1.0 - land(center - vec2(step1, 0.0)) * land(center + vec2(step1, 0.0)));
                // rounded square dot, antialiased over 1px
                vec2 q = abs(fract(g) - 0.5) - 0.17;
                float sdf = length(max(q, 0.0)) - 0.06;
                float aa = max(fwidth(g.x), 1e-4);
                float dotMask = 1.0 - smoothstep(-0.5 * aa, 0.5 * aa, sdf);
                // 15° graticule, 1px wide
                vec2 gr = vUv * vec2(24.0, 12.0);
                vec2 gd = abs(fract(gr - 0.5) - 0.5) / max(fwidth(gr), vec2(1e-4));
                float line = 1.0 - min(min(gd.x, gd.y), 1.0);
                vec3 color = vec3(0.0157, 0.0392, 0.0588) + vec3(0.2235, 0.8824, 1.0) * 0.06 * line;
                vec3 dotColor = mix(vec3(0.2275, 0.6235, 0.698), vec3(0.498, 0.9137, 1.0), coast);
                gl_FragColor = vec4(mix(color, dotColor, dotMask * here), 1.0);
            }
        `,
    });
}

const GLOW_VERTEX = `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
        vec4 world = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-world.xyz);
        gl_Position = projectionMatrix * world;
    }`;

// Additive sphere shell; the fragment shader gets vNormal and vView.
function glowShell(
    radius: number,
    fragmentShader: string,
    side: THREE.Side = THREE.FrontSide
) {
    return new THREE.Mesh(
        new THREE.SphereGeometry(radius, 64, 40),
        new THREE.ShaderMaterial({
            side,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: GLOW_VERTEX,
            fragmentShader,
        })
    );
}

// Rim light on the planet's edge.
const makeLimb = () =>
    glowShell(
        1.002,
        `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
            float rim = 1.0 - max(dot(vNormal, vView), 0.0);
            float glow = pow(rim, 3.2);
            gl_FragColor = vec4(vec3(0.22, 0.88, 1.0) * glow * 0.85, glow);
        }`
    );

// Halo just outside the planet.
const makeAtmosphere = () =>
    glowShell(
        1.2,
        `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
            float facing = dot(vNormal, vView);
            float glow = pow(clamp(facing - 0.12, 0.0, 1.0) * 1.35, 4.0);
            gl_FragColor = vec4(vec3(0.20, 0.82, 1.0), glow * 0.9);
        }`,
        THREE.BackSide
    );

// Seeded so the star field is stable between visits.
function makeStars() {
    let seed = 7;
    const random = () =>
        ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const group = new THREE.Group();
    const layers = [
        { count: 1400, size: 1.1, opacity: 0.55 },
        { count: 380, size: 1.8, opacity: 0.8 },
        { count: 60, size: 2.8, opacity: 0.95 },
    ];
    const tints = [
        new THREE.Color(0xffffff),
        new THREE.Color(0xbfefff),
        new THREE.Color(0x8fdcff),
        new THREE.Color(0xffd2b8),
    ];
    for (const layer of layers) {
        const positions = new Float32Array(layer.count * 3);
        const colors = new Float32Array(layer.count * 3);
        for (let i = 0; i < layer.count; i++) {
            const u = random() * 2 - 1;
            const theta = random() * Math.PI * 2;
            const r = 22 + random() * 10;
            const s = Math.sqrt(1 - u * u);
            positions.set(
                [r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)],
                i * 3
            );
            const tint = tints[Math.floor(random() * tints.length)];
            const fade = 0.55 + random() * 0.45;
            colors.set([tint.r * fade, tint.g * fade, tint.b * fade], i * 3);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        group.add(
            new THREE.Points(
                geometry,
                new THREE.PointsMaterial({
                    size: layer.size,
                    sizeAttenuation: false,
                    vertexColors: true,
                    transparent: true,
                    opacity: layer.opacity,
                    depthWrite: false,
                })
            )
        );
    }
    return group;
}

function makePulse(): Pulse {
    const glow = {
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    };
    const trail = new THREE.Line(
        new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(PULSE_TRAIL * 3), 3)
        ),
        new THREE.LineBasicMaterial({ ...glow, color: 0xffb08a, opacity: 0 })
    );
    trail.frustumCulled = false;
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 10, 8),
        new THREE.MeshBasicMaterial({ ...glow, color: 0xfff1e6 })
    );
    const ping = new THREE.Mesh(
        new THREE.RingGeometry(0.018, 0.024, 40),
        new THREE.MeshBasicMaterial({
            ...glow,
            color: 0xff6a2c,
            side: THREE.DoubleSide,
        })
    );
    trail.visible = head.visible = ping.visible = false;
    return {
        trail,
        head,
        ping,
        path: [],
        start: 0,
        duration: PULSE_MS,
        load: 0,
        active: false,
    };
}

function buildGlobeScene(landMask: Uint8Array) {
    const scene = new THREE.Scene();
    const geometry = new THREE.SphereGeometry(1, 64, 40);
    geometry.rotateY(-Math.PI / 2);
    scene.add(
        new THREE.Mesh(
            geometry,
            new THREE.MeshPhongMaterial({
                map: makeGlobeTexture(landMask),
                shininess: 8,
                specular: 0x0a2a33,
            })
        )
    );
    scene.add(makeLimb(), makeAtmosphere());
    scene.add(new THREE.AmbientLight(0xd6f6ff, 1.7));
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(-3, 4, 5);
    scene.add(light);
    stars = makeStars();
    scene.add(stars);
    for (let i = 0; i < PULSE_COUNT; i++) pulses.push(makePulse());
    globeLinks = new THREE.Group();
    scene.add(globeLinks);
    for (const pulse of pulses) scene.add(pulse.trail, pulse.head, pulse.ping);
    return scene;
}

function buildMapScene(landMask: Uint8Array) {
    const scene = new THREE.Scene();
    // Three copies of the world side by side, for wrapping.
    scene.add(
        new THREE.Mesh(
            new THREE.PlaneGeometry(12, 2),
            makeFlatMaterial(landMask)
        )
    );
    const grid: THREE.Vector3[] = [];
    for (let x = -6; x <= 6; x += 1 / 3)
        grid.push(
            new THREE.Vector3(x, -1, 0.01),
            new THREE.Vector3(x, 1, 0.01)
        );
    for (let y = -1; y <= 1; y += 1 / 3)
        grid.push(
            new THREE.Vector3(-6, y, 0.01),
            new THREE.Vector3(6, y, 0.01)
        );
    scene.add(
        new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(grid),
            new THREE.LineBasicMaterial({
                color: 0x39e1ff,
                transparent: true,
                opacity: 0.05,
            })
        )
    );
    return scene;
}

function applyPixelRatio() {
    renderer?.setPixelRatio(
        Math.max(1, Math.min(devicePixelRatio, PIXEL_RATIO_CAP) * qualityScale)
    );
    renderer?.setSize(width, height, false);
}

// Adaptive resolution: drop it after a run of late frames, never below
// CSS pixels, and raise it again after a long run of good ones.
function trackFrame(delta: number, expected: number) {
    if (delta > expected * 1.6) {
        lateFrames += 1;
        goodFrames = 0;
    } else {
        goodFrames += 1;
        if (goodFrames > 30) lateFrames = 0;
    }
    if (lateFrames > 20 && qualityScale > 0.67) {
        qualityScale = Math.max(0.67, qualityScale - 0.15);
        lateFrames = 0;
        applyPixelRatio();
    } else if (goodFrames > 900 && qualityScale < 1) {
        qualityScale = Math.min(1, qualityScale + 0.15);
        goodFrames = 0;
        applyPixelRatio();
    }
}

function resize(
    nextWidth: number,
    nextHeight: number,
    pixelRatio: number,
    frame?: GlobeFrame
) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    devicePixelRatio = pixelRatio;
    applyPixelRatio();
    globeCamera.aspect = width / height;
    // Size and centre the planet in the area not covered by panels.
    const top = frame?.top ?? 0;
    const bottom = frame?.bottom ?? 0;
    const left = frame?.left ?? 0;
    const right = frame?.right ?? 0;
    const openWidth = Math.max(width / 3, width - left - right);
    const openHeight = Math.max(height / 2, height - top - bottom);
    // 42° vertical fov, or 42° horizontal when the open area is portrait.
    const halfTan =
        (Math.tan(THREE.MathUtils.degToRad(21)) /
            Math.min(1, openWidth / openHeight)) *
        (height / openHeight);
    globeCamera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfTan));
    const offsetX = width / 2 - (left + (width - right)) / 2;
    const offsetY = height / 2 - (top + (height - bottom)) / 2;
    if (offsetX || offsetY)
        globeCamera.setViewOffset(
            width,
            height,
            offsetX,
            offsetY,
            width,
            height
        );
    else globeCamera.clearViewOffset();
    globeCamera.updateProjectionMatrix();
    dirty = true;
}

// Visible half width of the flat map at this altitude. At the fit altitude
// the whole band is in view.
function mapHalfWidthAt(altitude: number) {
    const fit = Math.max(
        2,
        ((MAP_NORTH - MAP_SOUTH) / 90 / 2) * (width / height)
    );
    return fit / (MAP_FIT_ALTITUDE / altitude);
}

function positionGlobeCamera(view: PointOfView) {
    globeCamera.position.copy(
        spherePoint(view.lat, view.lng, 1 + view.altitude)
    );
    globeCamera.lookAt(0, 0, 0);
    globeCamera.updateMatrixWorld();
}

function positionMapCamera(view: PointOfView) {
    const south = MAP_SOUTH / 90;
    const north = MAP_NORTH / 90;
    mapHalfWidth = mapHalfWidthAt(view.altitude);
    mapHalfHeight = mapHalfWidth / (width / height);
    // Wrap longitude so the camera stays over the middle copy.
    view.lng = ((((view.lng + 180) % 360) + 360) % 360) - 180;
    const x = view.lng / 90;
    const y =
        north - south <= mapHalfHeight * 2
            ? (north + south) / 2
            : THREE.MathUtils.clamp(
                  view.lat / 90,
                  south + mapHalfHeight,
                  north - mapHalfHeight
              );
    // Write the clamp back so dragging past the edge doesn't accumulate.
    view.lat = y * 90;
    mapCamera.left = -mapHalfWidth;
    mapCamera.right = mapHalfWidth;
    mapCamera.top = mapHalfHeight;
    mapCamera.bottom = -mapHalfHeight;
    mapCamera.position.set(x, y, 5);
    mapCamera.lookAt(x, y, 0);
    mapCamera.updateProjectionMatrix();
    mapCamera.updateMatrixWorld();
}

function positionCamera() {
    if (mode === "globe") positionGlobeCamera(globeView);
    else positionMapCamera(mapView);
}

function render() {
    positionCamera();
    if (mode === "globe") renderer?.render(globeScene, globeCamera);
    else renderer?.render(mapScene, mapCamera);
}

// The flat map zooms about the cursor, the globe about its centre.
function zoomBy(factor: number, x?: number, y?: number) {
    const view = currentView();
    const [min, max] = altitudeRange();
    const altitude = THREE.MathUtils.clamp(view.altitude * factor, min, max);
    transition = null;
    if (mode === "globe" || x == null || y == null) {
        view.altitude = altitude;
        return;
    }
    positionCamera();
    const nx = (x / width) * 2 - 1;
    const ny = 1 - (y / height) * 2;
    const wx = mapCamera.position.x + nx * mapHalfWidth;
    const wy = mapCamera.position.y + ny * mapHalfHeight;
    view.altitude = altitude;
    const halfWidth = mapHalfWidthAt(altitude);
    const halfHeight = (halfWidth * height) / width;
    view.lng = (wx - nx * halfWidth) * 90;
    view.lat = (wy - ny * halfHeight) * 90;
}

// Drag in screen px. Globe rotation scales with altitude so the surface
// keeps up with the pointer at any zoom.
function dragBy(dx: number, dy: number) {
    const view = currentView();
    if (mode === "globe") {
        const scale = view.altitude / 2.4;
        view.lng -= dx * 0.3 * scale;
        view.lat = THREE.MathUtils.clamp(
            view.lat + dy * 0.26 * scale,
            -MAX_LAT,
            MAX_LAT
        );
    } else {
        view.lng -= (dx / width) * mapHalfWidth * 180;
        view.lat += (dy / height) * mapHalfHeight * 180;
    }
}

function setView(next: Partial<PointOfView>, duration: number) {
    markInteraction();
    const from = { ...currentView() };
    const to = { ...from, ...next };
    const [low, high] = altitudeRange();
    to.lat = THREE.MathUtils.clamp(to.lat, -MAX_LAT, MAX_LAT);
    to.altitude = THREE.MathUtils.clamp(to.altitude, low, high);
    // Take the short way round.
    to.lng = from.lng + (((to.lng - from.lng + 540) % 360) - 180);
    if (duration > 0 && !reducedMotion) {
        transition = { from, to, start: performance.now(), duration };
    } else {
        Object.assign(currentView(), to);
        transition = null;
    }
}

function drag(dx: number, dy: number) {
    transition = null;
    const now = performance.now();
    interacting = now + INTERACT_MS;
    // Smoothed pointer velocity, used for momentum on release.
    const dt = Math.max(1, Math.min(100, now - lastDragAt));
    if (now - lastDragAt > 100) velocity = { x: 0, y: 0 };
    velocity = {
        x: velocity.x * 0.6 + (dx / dt) * 0.4,
        y: velocity.y * 0.6 + (dy / dt) * 0.4,
    };
    lastDragAt = now;
    dragBy(dx, dy);
}

function release() {
    // No momentum if the pointer stopped before lifting.
    if (performance.now() - lastDragAt > 80 || reducedMotion)
        velocity = { x: 0, y: 0 };
    markInteraction();
}

// Great-circle arc lifted off the surface, higher for longer spans.
function arcPath(start: GlobePoint, end: GlobePoint) {
    const a = spherePoint(start.lat, start.lng);
    const b = spherePoint(end.lat, end.lng);
    const lift = Math.min(0.23, a.angleTo(b) * 0.1);
    const path: THREE.Vector3[] = [];
    for (let j = 0; j <= 32; j++) {
        const t = j / 32;
        // Normalised lerp, stable even for near-antipodal ends.
        path.push(
            a
                .clone()
                .lerp(b, t)
                .normalize()
                .multiplyScalar(1.015 + Math.sin(Math.PI * t) * lift)
        );
    }
    return path;
}

// ~22 decorative arcs. Sorted by address so they don't reshuffle on refresh.
function updateLinks() {
    while (globeLinks.children.length) {
        const child = globeLinks.children[0] as THREE.Line;
        globeLinks.remove(child);
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
    }
    arcPaths = [];
    const sorted = [...points].sort((a, b) =>
        a.iotaAddress.localeCompare(b.iotaAddress)
    );
    const step = Math.max(1, Math.ceil(sorted.length / 22));
    const skip = Math.max(1, Math.floor(sorted.length / 3));
    for (let i = 0; i < sorted.length && sorted.length > 1; i += step) {
        const start = sorted[i];
        const end = sorted[(i + skip) % sorted.length];
        if (Math.abs(start.lat - end.lat) + Math.abs(start.lng - end.lng) < 2)
            continue;
        const path = arcPath(start, end);
        arcPaths.push(path);
        globeLinks.add(
            new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(path),
                new THREE.LineBasicMaterial({
                    color: 0x39e1ff,
                    transparent: true,
                    opacity: 0.22,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            )
        );
    }
    dirty = true;
}

// Copy of x (on the repeating flat map) nearest to the camera.
function nearestCopy(x: number) {
    const camera = mapCamera.position.x;
    return x + Math.round((camera - x) / 4) * 4;
}

function projectMarkers() {
    const camera = mode === "globe" ? globeCamera : mapCamera;
    const cameraDirection = globeCamera.position.clone().normalize();
    const markers = clusters.map((cluster) => {
        const point =
            mode === "globe"
                ? spherePoint(cluster.lat, cluster.lng, 1.025)
                : new THREE.Vector3(
                      nearestCopy(cluster.lng / 90),
                      cluster.lat / 90,
                      0.025
                  );
        // With perspective, the horizon sits inside the facing hemisphere.
        const front =
            mode === "map" ||
            point.clone().normalize().dot(cameraDirection) >
                1 / globeCamera.position.length() + 0.025;
        point.project(camera);
        return {
            id: cluster.id,
            x: ((point.x + 1) * width) / 2,
            y: ((1 - point.y) * height) / 2,
            visible:
                front &&
                Math.abs(point.x) < 0.96 &&
                Math.abs(point.y) < 0.92 &&
                point.z < 1,
        };
    });
    send({ type: "frame", view: { ...currentView() }, markers });
}

// Advances transition, drag momentum or auto-rotation, at most one of them.
function moveView(now: number, dt: number) {
    const view = currentView();
    if (transition) {
        const t = Math.min(1, (now - transition.start) / transition.duration);
        const eased = 1 - Math.pow(1 - t, 3);
        for (const key of ["lat", "lng", "altitude"] as const)
            view[key] = THREE.MathUtils.lerp(
                transition.from[key],
                transition.to[key],
                eased
            );
        if (t === 1) transition = null;
    } else if (
        Math.hypot(velocity.x, velocity.y) > 0.01 &&
        now - lastDragAt > 30
    ) {
        // Coast, decaying over roughly half a second.
        dragBy(velocity.x * dt * 1000, velocity.y * dt * 1000);
        const decay = Math.exp(-dt * 5);
        velocity = { x: velocity.x * decay, y: velocity.y * decay };
        interacting = now + 100;
    } else if (mode === "globe" && rotating) {
        view.lng += dt * 2.4;
    } else {
        return;
    }
    dirty = true;
}

function tick() {
    scheduled = null;
    if (!renderer || !visible) return;
    const now = performance.now();
    const busy = urgent || !!transition || interacting >= now;
    // Idle scene (spin, pulses) runs at ~30 fps to save GPU.
    if (!busy && now - lastFrame < AMBIENT_FRAME_MS - 4) {
        scheduled = schedule(tick);
        return;
    }
    urgent = false;
    if (lastFrame)
        trackFrame(now - lastFrame, busy ? 1000 / 60 : AMBIENT_FRAME_MS);
    const dt = Math.min(0.06, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    moveView(now, dt);
    const animating = mode === "globe" && !reducedMotion;
    if (animating) {
        stars.rotation.y += dt * 0.004;
        stepPulses(now);
        dirty = true;
    }
    if (dirty) {
        render();
        if (now - lastProjection >= 66 || !rotating || mode === "map") {
            projectMarkers();
            lastProjection = now;
        }
        dirty = false;
    }
    // Stop the loop when nothing moves (hidden, reduced motion, still map).
    if (transition || animating || interacting >= now)
        scheduled = schedule(tick);
}

function wake() {
    dirty = true;
    urgent = true;
    if (scheduled === null && visible) scheduled = schedule(tick);
}

// Send a pulse along a random arc; brightness follows the checkpoint load.
function firePulse(load: number) {
    if (!arcPaths.length || mode !== "globe" || reducedMotion || !visible)
        return;
    const pulse = pulses.find((p) => !p.active) ?? pulses[0];
    const path = arcPaths[Math.floor(Math.random() * arcPaths.length)];
    pulse.path = Math.random() < 0.5 ? path : [...path].reverse();
    pulse.start = performance.now();
    pulse.duration = PULSE_MS * (0.8 + Math.random() * 0.4);
    pulse.load = load;
    pulse.active = true;
    const end = pulse.path[pulse.path.length - 1];
    pulse.ping.position.copy(end).multiplyScalar(1.004);
    pulse.ping.lookAt(end.clone().multiplyScalar(2));
}

function pointOnPath(path: THREE.Vector3[], t: number, target: THREE.Vector3) {
    const f = THREE.MathUtils.clamp(t, 0, 1) * (path.length - 1);
    const i = Math.min(Math.floor(f), path.length - 2);
    return target.copy(path[i]).lerp(path[i + 1], f - i);
}

function stepPulses(now: number) {
    for (const pulse of pulses) {
        if (!pulse.active) continue;
        const t = (now - pulse.start) / pulse.duration;
        const pingT = (now - pulse.start - pulse.duration) / PING_MS;
        if (pingT >= 1) {
            pulse.active = false;
            pulse.trail.visible =
                pulse.head.visible =
                pulse.ping.visible =
                    false;
            continue;
        }
        const strength = 0.55 + Math.min(1, pulse.load / 24) * 0.45;
        const eased = t < 1 ? 1 - Math.pow(1 - t, 2) : 1;
        const positions = pulse.trail.geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;
        const p = new THREE.Vector3();
        for (let k = 0; k < PULSE_TRAIL; k++) {
            pointOnPath(pulse.path, eased - k * 0.035, p);
            positions.setXYZ(k, p.x, p.y, p.z);
        }
        positions.needsUpdate = true;
        pulse.trail.visible = t < 1.15;
        (pulse.trail.material as THREE.LineBasicMaterial).opacity =
            strength * (t < 1 ? 1 : Math.max(0, 1 - (t - 1) * 6));
        pulse.head.visible = t < 1;
        pointOnPath(pulse.path, eased, pulse.head.position);
        (pulse.head.material as THREE.MeshBasicMaterial).opacity = strength;
        pulse.ping.visible = pingT >= 0;
        if (pingT >= 0) {
            pulse.ping.scale.setScalar(0.4 + pingT * 2.6);
            (pulse.ping.material as THREE.MeshBasicMaterial).opacity =
                strength * (1 - pingT) * 0.9;
        }
    }
}

function init(message: Extract<WorkerInput, { type: "init" }>) {
    mode = message.mode;
    reducedMotion = message.reducedMotion;
    rotating = !reducedMotion;
    renderer = new THREE.WebGLRenderer({
        canvas: message.canvas,
        alpha: true,
        // MSAA isn't worth the fill rate on high-dpi screens.
        antialias: message.pixelRatio < 2,
        powerPreference: "default",
    });
    renderer.setClearColor(0x000000, 0);
    globeCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    mapCamera = new THREE.OrthographicCamera(-2.15, 2.15, 1.15, -1.15, 0.1, 20);
    const landMask = makeLandMask();
    globeScene = buildGlobeScene(landMask);
    mapScene = buildMapScene(landMask);
    resize(message.width, message.height, message.pixelRatio, message.frame);
    updateLinks();
    render();
    projectMarkers();
    send({ type: "ready" });
    wake();
}

function handle(message: WorkerInput) {
    if (message.type === "init") return init(message);
    if (!renderer) return;
    switch (message.type) {
        case "resize":
            resize(
                message.width,
                message.height,
                message.pixelRatio,
                message.frame
            );
            break;
        case "data":
            points = message.points;
            clusters = message.clusters;
            updateLinks();
            break;
        case "mode":
            mode = message.mode;
            transition = null;
            break;
        case "rotate":
            rotating = message.enabled;
            break;
        case "view":
            setView(message.view, message.duration);
            break;
        case "drag":
            drag(message.dx, message.dy);
            break;
        case "release":
            release();
            break;
        case "zoom":
            markInteraction();
            zoomBy(message.factor, message.x, message.y);
            break;
        case "motion":
            reducedMotion = message.reduced;
            if (reducedMotion) rotating = false;
            break;
        case "pulse":
            firePulse(message.load);
            break;
        case "visibility":
            visible = message.visible;
            if (!visible && scheduled !== null) {
                cancel(scheduled);
                scheduled = null;
            }
            break;
    }
    wake();
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
    try {
        handle(event.data);
    } catch (error) {
        if (scheduled !== null) cancel(scheduled);
        scheduled = null;
        send({
            type: "error",
            message:
                error instanceof Error ? error.message : "Map rendering failed",
        });
    }
};
