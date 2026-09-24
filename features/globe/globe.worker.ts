// Rendering, map projection and asset preparation run exclusively in this worker.
import * as THREE from "three";
import { feature } from "topojson-client";
import landTopology from "@/assets/land_10m.json";
import type {
    GlobeFrame,
    GlobePoint,
    MapMode,
    PointOfView,
    ProjectedCluster,
    WorkerInput,
    WorkerOutput,
} from "./workerTypes";

const send = (message: WorkerOutput) => self.postMessage(message);
const spherePoint = (lat: number, lng: number, radius = 1) => {
    const phi = THREE.MathUtils.degToRad(lat),
        theta = THREE.MathUtils.degToRad(lng);
    return new THREE.Vector3(
        radius * Math.cos(phi) * Math.sin(theta),
        radius * Math.sin(phi),
        radius * Math.cos(phi) * Math.cos(theta)
    );
};
let renderer: THREE.WebGLRenderer | null = null;
let globeScene: THREE.Scene;
let mapScene: THREE.Scene;
let globeCamera: THREE.PerspectiveCamera;
let mapCamera: THREE.OrthographicCamera;
let globeLinks: THREE.Group;
let mapLinks: THREE.Group;
let width = 1,
    height = 1,
    mode: MapMode = "globe";
let reducedMotion = false,
    rotating = true,
    visible = true;
let points: GlobePoint[] = [],
    clusters: ProjectedCluster[] = [];
const globeView: PointOfView = { lat: 22, lng: 8, altitude: 2.4 };
const mapView: PointOfView = { lat: 0, lng: 0, altitude: 2.1 };
let transition: {
    from: PointOfView;
    to: PointOfView;
    start: number;
    duration: number;
} | null = null;
let lastFrame = 0,
    lastProjection = 0,
    scheduled: number | null = null;
// Workers that render to an OffscreenCanvas get animation frames in modern
// browsers; older ones fall back to a timer.
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
let arcPaths: THREE.Vector3[][] = [];
// Until when the user counts as interacting (drag, zoom, keyboard).
let interacting = 0;
let urgent = true;
const AMBIENT_FRAME_MS = 1000 / 30;
let stars: THREE.Group;
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
const pulses: Pulse[] = [];
const PULSE_TRAIL = 9;
const PULSE_MS = 1200;
const PING_MS = 900;
let dirty = true;
let mapHalfWidth = 2.15,
    mapHalfHeight = 1.15;
const currentView = () => (mode === "globe" ? globeView : mapView);
// The flat map shows the inhabited band only, and fits it whole at the
// widest zoom.
const MAP_SOUTH = -58;
const MAP_NORTH = 84;
const MAP_FIT_ALTITUDE = 2.1;
const altitudeRange = () =>
    mode === "globe"
        ? ([0.55, 5] as const)
        : ([0.35, MAP_FIT_ALTITUDE] as const);
// Rendering resolution: the device's, capped, and lowered further when
// frames come in late.
let devicePixelRatio = 1;
let qualityScale = 1;
const PIXEL_RATIO_CAP = 1.5;
let lateFrames = 0,
    goodFrames = 0;
// Momentum after a drag is released, in pixels per millisecond.
let velocity = { x: 0, y: 0 };
let lastDragAt = 0;

// Land is rasterised once into an equirectangular mask that both views
// read: the globe bakes it into a dot texture, the flat map samples it per
// pixel in a shader.
const MASK_W = 2048,
    MASK_H = 1024;
function makeLandMask() {
    const mask = new OffscreenCanvas(MASK_W, MASK_H);
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    if (!maskCtx) throw new Error("Map texture could not be prepared");
    const land = feature(
        landTopology as unknown as Parameters<typeof feature>[0],
        landTopology.objects.land as unknown as Parameters<typeof feature>[1]
    ) as unknown as {
        features: { geometry: { type: string; coordinates: number[][][][] } }[];
    };
    maskCtx.fillStyle = "#fff";
    for (const item of land.features) {
        const polygons =
            item.geometry.type === "Polygon"
                ? [item.geometry.coordinates as unknown as number[][][]]
                : item.geometry.coordinates;
        for (const polygon of polygons) {
            for (const offset of [-MASK_W, 0, MASK_W]) {
                maskCtx.beginPath();
                for (const ring of polygon) {
                    let previousLng = ring[0]?.[0] ?? 0;
                    ring.forEach(([lng, lat], index) => {
                        while (lng - previousLng > 180) lng -= 360;
                        while (lng - previousLng < -180) lng += 360;
                        previousLng = lng;
                        const x = ((lng + 180) / 360) * MASK_W + offset,
                            y = ((90 - lat) / 180) * MASK_H;
                        if (index === 0) maskCtx.moveTo(x, y);
                        else maskCtx.lineTo(x, y);
                    });
                    maskCtx.closePath();
                }
                maskCtx.fill("evenodd");
            }
        }
    }
    const rgba = maskCtx.getImageData(0, 0, MASK_W, MASK_H).data;
    const alpha = new Uint8Array(MASK_W * MASK_H);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    return alpha;
}

const DOT_PITCH = 7;

// The globe's dot matrix. The horizontal pitch widens towards the poles so
// dots stay round on the sphere.
function makeGlobeTexture(mask: Uint8Array) {
    const W = MASK_W,
        H = MASK_H;
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Map texture could not be prepared");
    ctx.fillStyle = "#040a0f";
    ctx.fillRect(0, 0, W, H);
    // Faint graticule every 15 degrees.
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
    const pitch = DOT_PITCH;
    const isLand = (x: number, y: number) =>
        mask[Math.floor(y) * W + ((Math.floor(x) + W) % W)] > 127;
    for (let y = pitch / 2; y < H; y += pitch) {
        const lat = 90 - (y / H) * 180;
        const stepX = pitch / Math.max(Math.cos((lat * Math.PI) / 180), 0.18);
        for (let x = stepX / 2; x < W; x += stepX) {
            if (!isLand(x, y)) continue;
            // Coastal dots read brighter than the interior, like a lit rim.
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

// The flat map draws its dot matrix per pixel from the land mask, so dots
// stay crisp at any zoom and no colour texture has to live on the GPU. It
// drops Antarctica, which only stretches into a band on a flat projection.
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
        // Colours are written as sRGB, matching the globe's texture.
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
                // A rounded square, 46% of the pitch, edged over one pixel.
                vec2 q = abs(fract(g) - 0.5) - 0.17;
                float sdf = length(max(q, 0.0)) - 0.06;
                float aa = max(fwidth(g.x), 1e-4);
                float dotMask = 1.0 - smoothstep(-0.5 * aa, 0.5 * aa, sdf);
                // Graticule every 15 degrees, one pixel wide at any zoom.
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

// Brightens the planet towards its edge, where the view grazes the surface.
function makeLimb() {
    return new THREE.Mesh(
        new THREE.SphereGeometry(1.002, 64, 40),
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    vec4 world = modelViewMatrix * vec4(position, 1.0);
                    vNormal = normalize(normalMatrix * normal);
                    vView = normalize(-world.xyz);
                    gl_Position = projectionMatrix * world;
                }`,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    float rim = 1.0 - max(dot(vNormal, vView), 0.0);
                    float glow = pow(rim, 3.2);
                    gl_FragColor = vec4(vec3(0.22, 0.88, 1.0) * glow * 0.85, glow);
                }`,
        })
    );
}

// The halo outside the planet, strongest just off the limb.
function makeAtmosphere() {
    return new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 64, 40),
        new THREE.ShaderMaterial({
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    vec4 world = modelViewMatrix * vec4(position, 1.0);
                    vNormal = normalize(normalMatrix * normal);
                    vView = normalize(-world.xyz);
                    gl_Position = projectionMatrix * world;
                }`,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    float facing = dot(vNormal, vView);
                    float glow = pow(clamp(facing - 0.12, 0.0, 1.0) * 1.35, 4.0);
                    gl_FragColor = vec4(vec3(0.20, 0.82, 1.0), glow * 0.9);
                }`,
        })
    );
}

// Fixed stars on a far shell. Seeded so the sky is the same on every visit.
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
            const u = random() * 2 - 1,
                theta = random() * Math.PI * 2,
                r = 22 + random() * 10,
                s = Math.sqrt(1 - u * u);
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
    const trail = new THREE.Line(
        new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(PULSE_TRAIL * 3), 3)
        ),
        new THREE.LineBasicMaterial({
            color: 0xffb08a,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
    );
    trail.frustumCulled = false;
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 10, 8),
        new THREE.MeshBasicMaterial({
            color: 0xfff1e6,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        })
    );
    const ping = new THREE.Mesh(
        new THREE.RingGeometry(0.018, 0.024, 40),
        new THREE.MeshBasicMaterial({
            color: 0xff6a2c,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
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

function applyPixelRatio() {
    renderer?.setPixelRatio(
        Math.max(1, Math.min(devicePixelRatio, PIXEL_RATIO_CAP) * qualityScale)
    );
    renderer?.setSize(width, height, false);
}

// Late frames mean the GPU cannot keep up at this resolution: step it down
// (never below CSS pixels). Long stretches of on-time frames step it back.
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
    // The canvas runs under the panels round the stage, but the planet is
    // framed for the area they leave free: sized to it and centred in it.
    const top = frame?.top ?? 0,
        bottom = frame?.bottom ?? 0,
        left = frame?.left ?? 0,
        right = frame?.right ?? 0;
    const openWidth = Math.max(width / 3, width - left - right);
    const openHeight = Math.max(height / 2, height - top - bottom);
    // On a portrait area, hold the horizontal field at 42° instead so the
    // planet fits the narrow side.
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

function positionCamera() {
    const view = currentView();
    if (mode === "globe") {
        globeCamera.position.copy(
            spherePoint(view.lat, view.lng, 1 + view.altitude)
        );
        globeCamera.lookAt(0, 0, 0);
        globeCamera.updateMatrixWorld();
    } else {
        const aspect = width / height;
        const zoom = MAP_FIT_ALTITUDE / view.altitude;
        const south = MAP_SOUTH / 90,
            north = MAP_NORTH / 90;
        // At the widest zoom the whole band fits: all longitudes, and the
        // band's height if the canvas is relatively tall.
        const fitHalfWidth = Math.max(2, ((north - south) / 2) * aspect);
        mapHalfWidth = fitHalfWidth / zoom;
        mapHalfHeight = mapHalfWidth / aspect;
        // The world repeats sideways, so longitude wraps instead of
        // stopping at an edge; the camera stays on the middle copy.
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
        // Write the clamp back so a drag past the edge does not build up.
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
}

// Zoom by a factor, keeping the point under the cursor in place on the
// flat map. The globe zooms about its centre.
function zoomBy(factor: number, x?: number, y?: number) {
    const view = currentView();
    const [min, max] = altitudeRange();
    transition = null;
    if (mode === "globe" || x == null || y == null) {
        view.altitude = THREE.MathUtils.clamp(view.altitude * factor, min, max);
        return;
    }
    positionCamera();
    const nx = (x / width) * 2 - 1,
        ny = 1 - (y / height) * 2;
    const wx = mapCamera.position.x + nx * mapHalfWidth,
        wy = mapCamera.position.y + ny * mapHalfHeight;
    view.altitude = THREE.MathUtils.clamp(view.altitude * factor, min, max);
    const zoom = MAP_FIT_ALTITUDE / view.altitude;
    const halfWidth =
        Math.max(2, (((MAP_NORTH - MAP_SOUTH) / 90 / 2) * width) / height) /
        zoom;
    const halfHeight = (halfWidth * height) / width;
    view.lng = (wx - nx * halfWidth) * 90;
    view.lat = (wy - ny * halfHeight) * 90;
}

// One drag step, in screen pixels. Rotation scales with altitude so the
// surface follows the pointer whether zoomed out or in close.
function dragBy(dx: number, dy: number) {
    const view = currentView();
    if (mode === "globe") {
        const scale = view.altitude / 2.4;
        view.lng -= dx * 0.3 * scale;
        view.lat = THREE.MathUtils.clamp(view.lat + dy * 0.26 * scale, -80, 80);
    } else {
        view.lng -= (dx / width) * mapHalfWidth * 180;
        view.lat += (dy / height) * mapHalfHeight * 180;
    }
}

function updateLinks() {
    for (const group of [globeLinks, mapLinks]) {
        while (group.children.length) {
            const child = group.children[0] as THREE.Line;
            group.remove(child);
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
        }
    }
    arcPaths = [];
    const sorted = [...points].sort((a, b) =>
        a.iotaAddress.localeCompare(b.iotaAddress)
    );
    const step = Math.max(1, Math.ceil(sorted.length / 22));
    for (let i = 0; i < sorted.length && sorted.length > 1; i += step) {
        const start = sorted[i],
            end =
                sorted[
                    (i + Math.max(1, Math.floor(sorted.length / 3))) %
                        sorted.length
                ];
        if (Math.abs(start.lat - end.lat) + Math.abs(start.lng - end.lng) < 2)
            continue;
        const a = spherePoint(start.lat, start.lng),
            b = spherePoint(end.lat, end.lng);
        const positions: THREE.Vector3[] = [];
        const angle = a.angleTo(b);
        for (let j = 0; j <= 32; j++) {
            const t = j / 32;
            // Interpolation stays stable even for nearly antipodal endpoints.
            const p = a
                .clone()
                .lerp(b, t)
                .normalize()
                .multiplyScalar(
                    1.015 + Math.sin(Math.PI * t) * Math.min(0.23, angle * 0.1)
                );
            positions.push(p);
        }
        arcPaths.push(positions);
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(positions),
            new THREE.LineBasicMaterial({
                color: 0x39e1ff,
                transparent: true,
                opacity: 0.22,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
        );
        globeLinks.add(line);
    }
    dirty = true;
}

// On the repeating flat map, the copy of an x closest to the camera.
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
        // A perspective camera's horizon is inside the hemisphere facing it.
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

function tick() {
    scheduled = null;
    if (!renderer || !visible) return;
    const frameNow = performance.now();
    // Full frame rate while something is being moved; the ambient scene
    // (slow spin, pulses) reads the same at half the GPU cost, so
    // every other display frame is skipped then. Messages force a frame.
    if (
        !urgent &&
        !transition &&
        interacting < frameNow &&
        frameNow - lastFrame < AMBIENT_FRAME_MS - 4
    ) {
        scheduled = schedule(tick);
        return;
    }
    const full = urgent || !!transition || interacting >= frameNow;
    urgent = false;
    if (lastFrame)
        trackFrame(frameNow - lastFrame, full ? 1000 / 60 : AMBIENT_FRAME_MS);
    const now = frameNow,
        dt = Math.min(0.06, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const view = currentView();
    if (transition) {
        const t = Math.min(1, (now - transition.start) / transition.duration),
            eased = 1 - Math.pow(1 - t, 3);
        view.lat = THREE.MathUtils.lerp(
            transition.from.lat,
            transition.to.lat,
            eased
        );
        view.lng = THREE.MathUtils.lerp(
            transition.from.lng,
            transition.to.lng,
            eased
        );
        view.altitude = THREE.MathUtils.lerp(
            transition.from.altitude,
            transition.to.altitude,
            eased
        );
        if (t === 1) transition = null;
        dirty = true;
    } else if (
        Math.hypot(velocity.x, velocity.y) > 0.01 &&
        now - lastDragAt > 30
    ) {
        // Coast after release, easing out over about half a second.
        dragBy(velocity.x * dt * 1000, velocity.y * dt * 1000);
        const decay = Math.exp(-dt * 5);
        velocity = { x: velocity.x * decay, y: velocity.y * decay };
        interacting = now + 100;
        dirty = true;
    } else if (mode === "globe" && rotating) {
        view.lng += dt * 2.4;
        dirty = true;
    }
    const animating = mode === "globe" && !reducedMotion;
    if (animating) {
        stars.rotation.y += dt * 0.004;
        if (stepPulses(now)) dirty = true;
        dirty = true;
    }
    if (dirty) {
        positionCamera();
        renderer.render(
            mode === "globe" ? globeScene : mapScene,
            mode === "globe" ? globeCamera : mapCamera
        );
        if (now - lastProjection >= 66 || !rotating || mode === "map") {
            projectMarkers();
            lastProjection = now;
        }
        dirty = false;
    }
    // No continuous GPU loop when offscreen, under reduced motion or in a
    // static 2D view.
    // Full frame rate while something is being moved; the ambient scene
    // (slow spin, pulses) reads the same at half the GPU cost.
    if (transition || animating || interacting >= now)
        scheduled = schedule(tick);
}
function wake() {
    dirty = true;
    urgent = true;
    if (scheduled === null && visible) scheduled = schedule(tick);
}

// A checkpoint runs along one of the arcs as a bright head with a short
// tail, then rings out where it lands. Brightness follows its load.
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
    let any = false;
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
        any = true;
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
            const scale = 0.4 + pingT * 2.6;
            pulse.ping.scale.setScalar(scale);
            (pulse.ping.material as THREE.MeshBasicMaterial).opacity =
                strength * (1 - pingT) * 0.9;
        }
    }
    return any;
}

function init(message: Extract<WorkerInput, { type: "init" }>) {
    mode = message.mode;
    reducedMotion = message.reducedMotion;
    rotating = !reducedMotion;
    renderer = new THREE.WebGLRenderer({
        canvas: message.canvas,
        alpha: true,
        // Multisampling a dense screen buys nothing visible and costs fill
        // rate on every frame.
        antialias: message.pixelRatio < 2,
        powerPreference: "default",
    });
    renderer.setClearColor(0x000000, 0);
    globeScene = new THREE.Scene();
    mapScene = new THREE.Scene();
    globeCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    mapCamera = new THREE.OrthographicCamera(-2.15, 2.15, 1.15, -1.15, 0.1, 20);
    const landMask = makeLandMask();
    const texture = makeGlobeTexture(landMask);
    const geometry = new THREE.SphereGeometry(1, 64, 40);
    geometry.rotateY(-Math.PI / 2);
    globeScene.add(
        new THREE.Mesh(
            geometry,
            new THREE.MeshPhongMaterial({
                map: texture,
                shininess: 8,
                specular: 0x0a2a33,
            })
        )
    );
    globeScene.add(makeLimb(), makeAtmosphere());
    globeScene.add(new THREE.AmbientLight(0xd6f6ff, 1.7));
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(-3, 4, 5);
    globeScene.add(light);
    stars = makeStars();
    globeScene.add(stars);
    for (let i = 0; i < 14; i++) pulses.push(makePulse());
    mapScene.add(
        new THREE.Mesh(
            // Three copies of the world side by side, for wrapping.
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
    mapScene.add(
        new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(grid),
            new THREE.LineBasicMaterial({
                color: 0x39e1ff,
                transparent: true,
                opacity: 0.05,
            })
        )
    );
    globeLinks = new THREE.Group();
    mapLinks = new THREE.Group();
    globeScene.add(globeLinks);
    mapScene.add(mapLinks);
    for (const pulse of pulses)
        globeScene.add(pulse.trail, pulse.head, pulse.ping);
    resize(message.width, message.height, message.pixelRatio, message.frame);
    updateLinks();
    positionCamera();
    renderer.render(
        mode === "globe" ? globeScene : mapScene,
        mode === "globe" ? globeCamera : mapCamera
    );
    projectMarkers();
    send({ type: "ready" });
    wake();
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
    try {
        const message = event.data;
        if (message.type === "init") {
            init(message);
            return;
        }
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
            case "view": {
                interacting = performance.now() + 400;
                const from = { ...currentView() },
                    to = { ...from, ...message.view };
                to.lat = THREE.MathUtils.clamp(to.lat, -80, 80);
                const [low, high] = altitudeRange();
                to.altitude = THREE.MathUtils.clamp(to.altitude, low, high);
                const delta = ((to.lng - from.lng + 540) % 360) - 180;
                to.lng = from.lng + delta;
                if (message.duration > 0 && !reducedMotion)
                    transition = {
                        from,
                        to,
                        start: performance.now(),
                        duration: message.duration,
                    };
                else {
                    Object.assign(currentView(), to);
                    transition = null;
                }
                break;
            }
            case "drag": {
                transition = null;
                const now = performance.now();
                interacting = now + 400;
                // Smoothed pointer velocity, for momentum on release.
                const dt = Math.max(1, Math.min(100, now - lastDragAt));
                if (now - lastDragAt > 100) velocity = { x: 0, y: 0 };
                velocity = {
                    x: velocity.x * 0.6 + (message.dx / dt) * 0.4,
                    y: velocity.y * 0.6 + (message.dy / dt) * 0.4,
                };
                lastDragAt = now;
                dragBy(message.dx, message.dy);
                break;
            }
            case "release":
                // A pointer that stopped before lifting carries no momentum.
                if (performance.now() - lastDragAt > 80 || reducedMotion)
                    velocity = { x: 0, y: 0 };
                interacting = performance.now() + 400;
                break;
            case "zoom":
                interacting = performance.now() + 400;
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
