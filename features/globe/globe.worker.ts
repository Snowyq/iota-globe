// Rendering, map projection and asset preparation run exclusively in this worker.
import * as THREE from "three";
import { feature } from "topojson-client";
import landTopology from "@/assets/land_10m.json";
import type {
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
const globeView: PointOfView = { lat: 26, lng: 8, altitude: 2.1 };
const mapView: PointOfView = { lat: 0, lng: 0, altitude: 2.1 };
let transition: {
    from: PointOfView;
    to: PointOfView;
    start: number;
    duration: number;
} | null = null;
let lastFrame = 0,
    lastProjection = 0,
    scheduled: ReturnType<typeof setTimeout> | null = null;
let dirty = true;
let mapHalfWidth = 2.15,
    mapHalfHeight = 1.15;
const currentView = () => (mode === "globe" ? globeView : mapView);

function makeTexture() {
    const canvas = new OffscreenCanvas(2048, 1024);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Map texture could not be prepared");
    ctx.fillStyle = "#0b1b30";
    ctx.fillRect(0, 0, 2048, 1024);
    const land = feature(
        landTopology as unknown as Parameters<typeof feature>[0],
        landTopology.objects.land as unknown as Parameters<typeof feature>[1]
    ) as unknown as {
        features: { geometry: { type: string; coordinates: number[][][][] } }[];
    };
    ctx.fillStyle = "#47759a";
    ctx.strokeStyle = "#6190b0";
    ctx.lineWidth = 0.65;
    for (const item of land.features) {
        const polygons =
            item.geometry.type === "Polygon"
                ? [item.geometry.coordinates as unknown as number[][][]]
                : item.geometry.coordinates;
        for (const polygon of polygons) {
            for (const offset of [-2048, 0, 2048]) {
                ctx.beginPath();
                for (const ring of polygon) {
                    let previousLng = ring[0]?.[0] ?? 0;
                    ring.forEach(([lng, lat], index) => {
                        while (lng - previousLng > 180) lng -= 360;
                        while (lng - previousLng < -180) lng += 360;
                        previousLng = lng;
                        const x = ((lng + 180) / 360) * 2048 + offset,
                            y = ((90 - lat) / 180) * 1024;
                        if (index === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });
                    ctx.closePath();
                }
                ctx.fill("evenodd");
                ctx.stroke();
            }
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    return texture;
}

function resize(nextWidth: number, nextHeight: number, pixelRatio: number) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    renderer?.setPixelRatio(Math.min(pixelRatio, 1.75));
    renderer?.setSize(width, height, false);
    globeCamera.aspect = width / height;
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
        const zoom = 2.1 / view.altitude;
        mapHalfWidth = Math.max(2.15, 1.14 * aspect) / zoom;
        mapHalfHeight = mapHalfWidth / aspect;
        // Keep the map inside the viewport while permitting panning when zoomed.
        const maxX = Math.max(0, 2 - mapHalfWidth),
            maxY = Math.max(0, 1 - mapHalfHeight);
        const x = THREE.MathUtils.clamp(view.lng / 90, -maxX, maxX);
        const y = THREE.MathUtils.clamp(view.lat / 90, -maxY, maxY);
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

function updateLinks() {
    for (const group of [globeLinks, mapLinks]) {
        while (group.children.length) {
            const child = group.children[0] as THREE.Line;
            group.remove(child);
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
        }
    }
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
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(positions),
            new THREE.LineBasicMaterial({
                color: 0x88bbd9,
                transparent: true,
                opacity: 0.22,
            })
        );
        globeLinks.add(line);
    }
    dirty = true;
}

function projectMarkers() {
    const camera = mode === "globe" ? globeCamera : mapCamera;
    const cameraDirection = globeCamera.position.clone().normalize();
    const markers = clusters.map((cluster) => {
        const point =
            mode === "globe"
                ? spherePoint(cluster.lat, cluster.lng, 1.025)
                : new THREE.Vector3(cluster.lng / 90, cluster.lat / 90, 0.025);
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
    const now = performance.now(),
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
    } else if (mode === "globe" && rotating) {
        view.lng += dt * 2.4;
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
    // No continuous GPU loop when paused, offscreen or in a static 2D view.
    if (transition || (mode === "globe" && rotating))
        scheduled = setTimeout(tick, 1000 / 30);
}
function wake() {
    dirty = true;
    if (scheduled === null && visible) scheduled = setTimeout(tick, 0);
}

function init(message: Extract<WorkerInput, { type: "init" }>) {
    mode = message.mode;
    reducedMotion = message.reducedMotion;
    rotating = !reducedMotion;
    renderer = new THREE.WebGLRenderer({
        canvas: message.canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);
    globeScene = new THREE.Scene();
    mapScene = new THREE.Scene();
    globeCamera = new THREE.PerspectiveCamera(42, 1, 0.1, 30);
    mapCamera = new THREE.OrthographicCamera(-2.15, 2.15, 1.15, -1.15, 0.1, 20);
    const texture = makeTexture();
    const geometry = new THREE.SphereGeometry(1, 64, 40);
    geometry.rotateY(-Math.PI / 2);
    globeScene.add(
        new THREE.Mesh(
            geometry,
            new THREE.MeshPhongMaterial({
                map: texture,
                shininess: 12,
                specular: 0x192c40,
            })
        )
    );
    globeScene.add(
        new THREE.Mesh(
            new THREE.SphereGeometry(1.035, 48, 32),
            new THREE.MeshBasicMaterial({
                color: 0x668db0,
                transparent: true,
                opacity: 0.17,
                side: THREE.BackSide,
            })
        )
    );
    globeScene.add(new THREE.AmbientLight(0xc3d5ef, 1.65));
    const light = new THREE.DirectionalLight(0xffffff, 1.35);
    light.position.set(-3, 4, 5);
    globeScene.add(light);
    mapScene.add(
        new THREE.Mesh(
            new THREE.PlaneGeometry(4, 2),
            new THREE.MeshBasicMaterial({ map: texture })
        )
    );
    const grid: THREE.Vector3[] = [];
    for (let x = -2; x <= 2; x += 1 / 3)
        grid.push(
            new THREE.Vector3(x, -1, 0.01),
            new THREE.Vector3(x, 1, 0.01)
        );
    for (let y = -1; y <= 1; y += 1 / 3)
        grid.push(
            new THREE.Vector3(-2, y, 0.01),
            new THREE.Vector3(2, y, 0.01)
        );
    mapScene.add(
        new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(grid),
            new THREE.LineBasicMaterial({
                color: 0x83a8c6,
                transparent: true,
                opacity: 0.1,
            })
        )
    );
    globeLinks = new THREE.Group();
    mapLinks = new THREE.Group();
    globeScene.add(globeLinks);
    mapScene.add(mapLinks);
    resize(message.width, message.height, message.pixelRatio);
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
                resize(message.width, message.height, message.pixelRatio);
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
                const from = { ...currentView() },
                    to = { ...from, ...message.view };
                to.lat = THREE.MathUtils.clamp(to.lat, -80, 80);
                to.altitude = THREE.MathUtils.clamp(to.altitude, 0.55, 5);
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
                const view = currentView();
                if (mode === "globe") {
                    view.lng -= message.dx * 0.32;
                    view.lat = THREE.MathUtils.clamp(
                        view.lat + message.dy * 0.28,
                        -80,
                        80
                    );
                } else {
                    view.lng -= (message.dx / width) * mapHalfWidth * 180;
                    view.lat += (message.dy / height) * mapHalfHeight * 180;
                }
                break;
            }
            case "motion":
                reducedMotion = message.reduced;
                if (reducedMotion) rotating = false;
                break;
            case "visibility":
                visible = message.visible;
                if (!visible && scheduled !== null) {
                    clearTimeout(scheduled);
                    scheduled = null;
                }
                break;
        }
        wake();
    } catch (error) {
        if (scheduled !== null) clearTimeout(scheduled);
        scheduled = null;
        send({
            type: "error",
            message:
                error instanceof Error ? error.message : "Map rendering failed",
        });
    }
};
