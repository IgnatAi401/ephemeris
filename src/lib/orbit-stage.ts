// Loads the snapshots and the land texture, builds the WebGL scene once, and
// keeps its canvases for the whole visit. The view attaches them on mount and
// only detaches them on unmount, so a remount never rebuilds.
import type { OrbitScene } from '@/lib/orbit-scene';
// Static: the legend needs the group table on first paint anyway.
import { createFleet, type Fleet, type OrbitSnapshot } from '@/lib/orbits';
import type { SpacecraftSnapshot } from '@/lib/ephemeris';
import { paintLand, type LandTopology } from '@/lib/orbit-land';

/** Yield to the browser between the few-millisecond build steps, so the first
 * frames of the page are never held up by parsing. */
const idle = () =>
  new Promise<void>((resolve) =>
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(() => resolve(), { timeout: 200 })
      : setTimeout(resolve, 0),
  );

export type OrbitStage = {
  /** The WebGL scene's canvas; replaced if a lost GPU context is restored. */
  canvas: HTMLCanvasElement;
  /** Labels drawn over the scene. */
  overlay: HTMLCanvasElement;
  scene: OrbitScene;
  /** Every satellite's elements, as propagated by the scene. */
  fleet: Fleet;
  counts: number[];
  fetched: string;
  /** Notified after a restored GPU context has been given a new scene. */
  rebuilt: Set<() => void>;
};

const LAND_URL = '/maps/countries-50m.json';
const LIGHTS_URL = '/textures/night-lights.webp';
let built: OrbitStage | null = null;
let pending: Promise<OrbitStage> | null = null;
// Without WebGL 2 the view cannot be built at all; do not retry every visit.
let unsupported = false;

/** The stage, if it has already been built. */
export const readyOrbitStage = () => built;
/** True once building failed because the browser has no WebGL 2. */
export const orbitStageUnsupported = () => unsupported;

export function loadOrbitStage() {
  // `?nowebgl` previews the fallback poster on any browser.
  if (new URLSearchParams(location.search).has('nowebgl')) unsupported = true;
  if (unsupported) return Promise.reject(new Error('WebGL 2 is unavailable'));
  pending ??= build().then(
    (stage) => (built = stage),
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

const makeCanvas = (className: string) => {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
};

/** Paint the land texture in a worker; null where workers cannot paint. */
function paintLandInWorker(): Promise<HTMLCanvasElement | null> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
    return Promise.resolve(null);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./orbit-land.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      resolve(null);
      return;
    }
    const finish = (bitmap: ImageBitmap | null) => {
      worker.terminate();
      if (!bitmap) return resolve(null);
      // WebGL ignores its flip-Y setting for bitmaps; copy into a canvas so the
      // scene uploads exactly the source it always has.
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      bitmap.close();
      resolve(canvas);
    };
    worker.onmessage = (event: MessageEvent<ImageBitmap | null>) =>
      finish(event.data);
    worker.onerror = () => finish(null);
    worker.postMessage(new URL(LAND_URL, document.baseURI).href);
  });
}

async function paintLandHere() {
  const response = await fetch(LAND_URL);
  if (!response.ok) throw new Error('Map unavailable');
  const topology = await response.text();
  await idle();
  return paintLand(
    JSON.parse(topology) as LandTopology,
    document.createElement('canvas'),
  );
}

/** The night-lights texture, or null: the scene works without it. */
function loadLights() {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = LIGHTS_URL;
  });
}

async function build(): Promise<OrbitStage> {
  // The L1/L2 and lunar spacecraft are optional: the map works without them.
  const spacecraft = fetch('/data/spacecraft.json')
    .then((response) =>
      response.ok ? (response.json() as Promise<SpacecraftSnapshot>) : null,
    )
    .catch(() => null);
  const nightLights = loadLights();
  const land = paintLandInWorker().then((canvas) => canvas ?? paintLandHere());
  land.catch(() => {});
  const [{ createOrbitScene }, orbits] = await Promise.all([
    import('@/lib/orbit-scene'),
    fetch('/data/orbits.json').then((response) => {
      if (!response.ok) throw new Error('Orbits unavailable');
      return response.text();
    }),
  ]);
  // Each remaining step is a few milliseconds of main-thread work. Each gets
  // its own idle slot.
  await idle();
  const snapshot = JSON.parse(orbits) as OrbitSnapshot;
  const fleet = createFleet(snapshot);
  const landCanvas = await land;
  const craft = await spacecraft;
  await idle();
  const overlay = makeCanvas('orbit-canvas orbit-overlay');
  const create = () => {
    const canvas = makeCanvas('orbit-canvas');
    let scene: OrbitScene;
    try {
      scene = createOrbitScene(canvas, overlay);
    } catch (error) {
      unsupported = true;
      throw error;
    }
    scene.setFleet(fleet);
    if (craft) scene.setSpacecraft(craft);
    return { canvas, scene };
  };
  const { canvas, scene } = create();
  await idle();
  // Uploads the textures now, not on the first visible frame.
  scene.setLand(landCanvas);
  const lightsImage = await nightLights;
  if (lightsImage) scene.setLights(lightsImage);
  const stage: OrbitStage = {
    canvas,
    overlay,
    scene,
    fleet,
    counts: fleet.counts,
    fetched: snapshot.fetched.slice(0, 10),
    rebuilt: new Set(),
  };
  // A released WebGL context stays lost on its canvas, so a GPU reset gets a
  // fresh canvas and scene in place of the old one.
  const watch = (target: HTMLCanvasElement) =>
    target.addEventListener(
      'webglcontextrestored',
      () => {
        stage.scene.dispose();
        const next = create();
        next.scene.setLand(landCanvas);
        if (lightsImage) next.scene.setLights(lightsImage);
        target.replaceWith(next.canvas);
        stage.canvas = next.canvas;
        stage.scene = next.scene;
        watch(next.canvas);
        stage.rebuilt.forEach((listener) => listener());
      },
      { once: true },
    );
  watch(canvas);
  return stage;
}
