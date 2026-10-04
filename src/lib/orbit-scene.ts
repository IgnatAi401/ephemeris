import {
  Geometry,
  Mesh,
  Program,
  Renderer,
  RenderTarget,
  Texture,
  Triangle,
} from 'ogl';
import {
  CONSTELLATIONS,
  EARTH_RADIUS_KM,
  MOON_RADIUS,
  elevation,
  groundPoint,
  moonPosition,
  period,
  positionAt,
  propagate,
  siderealAngle,
  sunDirection,
  type ConstellationKey,
  type Fleet,
} from '@/lib/orbits';
import {
  DEEP_SPACECRAFT,
  LUNAR_ORBITERS,
  lunarAt,
  lunarPeriod,
  vectorAt,
  type SpacecraftSnapshot,
} from '@/lib/ephemeris';
import { orbitPoint, trueAnomaly, type Elements } from '@/lib/kepler';
import type { MissionTrack } from '@/lib/mission-track';
import type { FrameId } from '@/lib/missions';
import {
  basis,
  earthCover,
  makeCamera,
  project,
  zoomToFit,
  type Camera,
  type Vec3,
} from '@/lib/scene-camera';
import {
  INSET_MOON,
  blurFragment,
  brightFragment,
  compositeFragment,
  fullscreenVertex,
  pathFragment,
  pathVertex,
  pointFragment,
  pointVertex,
  skyFragment,
  trailFragment,
  trailVertex,
} from '@/lib/scene-shaders';

/** One frame of the orbit view. Distances are in Earth radii, angles in
 * radians, layer weights 0–1. */
export type SceneView = {
  time: number;
  /** Earth radii from the centre of the frame to its edge, at Earth's
   * distance (see lib/scene-camera.ts). */
  zoom: number;
  /** Camera latitude above the equator. */
  elevation: number;
  /** Camera longitude measured from the Sun's meridian (or, with
   * `cameraAxes`, from their x axis); the Sun keeps its side of the frame
   * while Earth turns underneath. */
  azimuth: number;
  /** What the camera looks at, as weights: 0 for both is Earth's centre;
   * `aimMoon` 1 the Moon, `aimCraft` 1 the replayed mission's spacecraft. */
  aimMoon: number;
  aimCraft: number;
  /** Added to the aim: Earth radii along `cameraAxes` (or the equatorial
   * axes without them). */
  aimX: number;
  aimY: number;
  aimZ: number;
  leo: number;
  gnss: number;
  /** Meteor trails behind GNSS, Iridium, ORBCOMM and the stations. */
  trails: number;
  receiver: number;
  /** The Moon's month-long path around Earth. */
  moonPath: number;
  /** Sun–Earth line, L1/L2 and the spacecraft there. */
  deep: number;
  /** GNSS main-lobe signal spilling past Earth's limb (a layer switch). */
  spill: number;
  /** The lunar close-up with LRO and Danuri. */
  lunar: number;
  /** 1 frames the Moon wherever it projects, overriding `zoom`. */
  fitMoon: number;
  /** Per-group visibility (layer switches and the opening sequence), in
   * CONSTELLATIONS order. */
  groups: readonly number[];
  /** Night-side city lights. */
  lights: number;
  /** The pulse on satellites launched in the last 30 days. */
  recent: number;
  /** The glow around the Starlink shells. */
  halo: number;
  /** Bloom strength; 0 skips the post-processing passes entirely. */
  bloom: number;
  /** The satellite picked in the info card, drawn from SGP4. */
  selected?: Selection | null;
  /** The satellite under the pointer. */
  hovered?: { index: number; label: string } | null;
  /** CSS px on the right covered by panels; the lunar close-up moves left. */
  insetRight?: number;
  /** Teaching mode: how strongly the satellites in the focus mask (see
   * `setFocus`) stand out from the rest, 0–1. */
  focus?: number;
  /** Axes `elevation` and `azimuth` are measured in (rows x, y, z), for a
   * camera that turns with a mission's reference frame; Sun-relative
   * equatorial when absent. */
  cameraAxes?: readonly (readonly number[])[];
  /** A historical mission being replayed (lib/missions.ts). */
  mission?: MissionView | null;
  /** An orbit drawn from classical elements (the learn panel). */
  example?: {
    elements: Elements;
    label: string;
    color: string;
    /** A trip to the Moon: only the outbound half is drawn, the spacecraft
     * leaves perigee at `depart` and meets the Moon at apogee at `arrive`,
     * then circles it. `arrival` labels the meeting point until then. */
    transfer?: { depart: number; arrive: number; arrival: string };
  } | null;
};
export type MissionView = {
  track: MissionTrack;
  frame: FrameId;
  /** Fades the mission's drawing in, 0–1. */
  weight: number;
  /** Label and colour per spacecraft, in track order. */
  craft: readonly { label: string; color: string }[];
  events: readonly { time: number; label: string }[];
};
export type Selection = {
  index: number;
  color: string;
  label: string;
  /** Earth radii, scene frame; null where SGP4 fails. */
  position: (time: number) => readonly number[] | null;
  /** Orbital period, ms. */
  period: number;
};
export type SceneText = {
  sun: string;
  moon: string;
  earth: string;
  zh: boolean;
  l1: string;
  l2: string;
  spill: (count: number) => string;
  closeUp: string;
  phase: (percent: number, waxing: boolean) => string;
};

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hex = (color: string) =>
  [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16) / 255);
const COLORS = CONSTELLATIONS.map(({ color }) => hex(color));
const GROUPS = CONSTELLATIONS.length;
const IS_GNSS = CONSTELLATIONS.map(({ kind }) => kind === 'gnss');
// Groups that live in low orbit and collapse into the planet when far out.
const IS_LOW = CONSTELLATIONS.map(
  ({ kind }) => kind !== 'gnss' && kind !== 'geo',
);
// Per group: screen-pixel point size (Starlink is eleven thousand strong and
// stays fine), trail length as a fraction of each satellite's own orbit (0 for
// none), and trail width in pixels.
const STYLE: Record<
  ConstellationKey,
  [size: number, trail: number, width: number]
> = {
  starlink: [1.35, 0, 0],
  iridium: [2.4, 0.07, 2.6],
  orbcomm: [2.4, 0.07, 2.6],
  gps: [2.7, 0.09, 3.4],
  glonass: [2.7, 0.09, 3.4],
  galileo: [2.7, 0.09, 3.4],
  beidou: [2.7, 0.09, 3.4],
  stations: [3.2, 0.06, 3],
  qianfan: [1.8, 0, 0],
  guowang: [1.8, 0, 0],
  geo: [2.2, 0, 0],
  debrisFy1c: [1.1, 0, 0],
  debrisCosmos2251: [1.1, 0, 0],
  debrisIridium33: [1.1, 0, 0],
  recent: [2.4, 0, 0],
};
const TRAIL_SAMPLES = 40;
const POINT_SIZE = CONSTELLATIONS.map(({ key }) => STYLE[key][0]);
const TRAIL_SPAN = CONSTELLATIONS.map(({ key }) => STYLE[key][1]);
const TRAIL_WIDTH = CONSTELLATIONS.map(({ key }) => STYLE[key][2]);
const STARLINK = CONSTELLATIONS.findIndex(({ key }) => key === 'starlink');
// Ground receivers spread in longitude, roughly 60° apart, so one always
// faces the camera as Earth turns.
const RECEIVERS = [
  { en: 'San Francisco', zh: '旧金山', latitude: 37.77, longitude: -122.42 },
  { en: 'São Paulo', zh: '圣保罗', latitude: -23.55, longitude: -46.63 },
  { en: 'London', zh: '伦敦', latitude: 51.51, longitude: -0.13 },
  { en: 'Nairobi', zh: '内罗毕', latitude: -1.29, longitude: 36.82 },
  { en: 'Shanghai', zh: '上海', latitude: 31.23, longitude: 121.47 },
  { en: 'Sydney', zh: '悉尼', latitude: -33.87, longitude: 151.21 },
];
const MASK = (10 * Math.PI) / 180;
const DAY_MS = 86400000;
const MOON_KM = 1737.4;
// Sun–Earth collinear points, km from Earth along the Sun line.
const L1_KM = 1.4915e6;
const L2_KM = 1.5015e6;
// Approximate main-lobe half-angles of the navigation antennas (degrees);
// beyond Earth's limb this is the signal that spills into cislunar space.
const BEAM = {
  gps: 23.5,
  glonass: 20,
  galileo: 20.5,
  beidou: 21,
  beidouHigh: 10,
};

/** Convex hull of 2D points (Andrew's monotone chain), counter-clockwise. */
function convexHull(points: [number, number][]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const chain: [number, number][] = [];
    for (const point of list) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0
      )
        chain.pop();
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export type OrbitScene = ReturnType<typeof createOrbitScene>;

export function createOrbitScene(
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
) {
  const renderer = new Renderer({
    canvas,
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    webgl: 2,
  });
  // The shaders are GLSL ES 3.00 (textureGrad, derivatives without extensions).
  if (!renderer.isWebgl2) throw new Error('WebGL 2 is unavailable');
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const cameraUniforms = () => ({
    uSize: { value: [1, 1] },
    uDpr: { value: 1 },
    uCenter: { value: [0, 0] },
    uFocal: { value: 1 },
    uCam: { value: [10, 0, 0] },
    uRight: { value: [0, 1, 0] },
    uUp: { value: [0, 0, 1] },
    uToward: { value: [1, 0, 0] },
    uNear: { value: 0.05 },
    uSun: { value: [1, 0, 0] },
    uEarthR: { value: 1 },
  });
  const blank = () =>
    new Texture(gl, {
      image: new Uint8Array(4),
      width: 1,
      height: 1,
      generateMipmaps: false,
      minFilter: gl.LINEAR,
    });
  const land = blank();
  const lights = blank();
  const passOptions = {
    transparent: true,
    depthTest: false,
    depthWrite: false,
  };
  const sky = new Program(gl, {
    vertex: fullscreenVertex,
    fragment: skyFragment,
    ...passOptions,
    uniforms: {
      ...cameraUniforms(),
      uGmst: { value: 0 },
      uLand: { value: land },
      uLandReady: { value: 0 },
      uLights: { value: lights },
      uNight: { value: 0 },
      uMoon: { value: [0, 0, 1] },
      uMoonLook: { value: [0, 0, 0] },
      uMoonFrame: { value: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    },
  });
  const inset = new Program(gl, {
    vertex: fullscreenVertex,
    fragment: skyFragment.replace(
      '#version 300 es\n',
      '#version 300 es\n#define INSET\n',
    ),
    ...passOptions,
    uniforms: {
      ...cameraUniforms(),
      uMoonFrame: { value: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      uInset: { value: [0, 0, 1] },
      uInsetAlpha: { value: 0 },
    },
  });
  const layerUniforms = () => ({
    ...cameraUniforms(),
    uAlpha: { value: Array.from({ length: GROUPS }, () => 0) },
    uColor: { value: COLORS },
  });
  const points = new Program(gl, {
    vertex: pointVertex,
    fragment: pointFragment,
    ...passOptions,
    uniforms: {
      ...layerUniforms(),
      uPointSize: { value: POINT_SIZE },
      uSizeScale: { value: 1 },
      uDistance: { value: 1 },
      uRecent: { value: 0 },
      uClock: { value: 0 },
      uHalo: { value: 0 },
      uHaloAlpha: { value: 0 },
      uFocus: { value: 0 },
    },
  });
  const trails = new Program(gl, {
    vertex: trailVertex,
    fragment: trailFragment,
    ...passOptions,
    cullFace: false,
    uniforms: { ...layerUniforms(), uWidth: { value: TRAIL_WIDTH } },
  });
  const path = new Program(gl, {
    vertex: pathVertex,
    fragment: pathFragment,
    ...passOptions,
    cullFace: false,
    uniforms: {
      ...cameraUniforms(),
      uOrigin: { value: [0, 0, 0] },
      uAxes: { value: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      uScale: { value: 1 },
      uNow: { value: 0 },
      uMoonAt: { value: [0, 0, 0] },
      uMoonR: { value: MOON_RADIUS },
      uColor: { value: [1, 1, 1] },
      uAlpha: { value: 1 },
    },
  });
  // Ribbon meshes of each mission path, per spacecraft and frame, built on
  // first use: two vertices per sample, one either side.
  const pathMeshes = new WeakMap<MissionTrack, Map<string, Mesh>>();
  const pathMesh = (track: MissionTrack, index: number, frame: FrameId) => {
    let meshes = pathMeshes.get(track);
    if (!meshes) pathMeshes.set(track, (meshes = new Map()));
    const key = `${index}:${frame}`;
    const cached = meshes.get(key);
    if (cached) return cached;
    const local = track.localPath(index, frame);
    const times = track.times(index);
    const count = times.length;
    const position = new Float32Array(count * 6);
    const next = new Float32Array(count * 6);
    const side = new Float32Array(count * 2);
    const time = new Float32Array(count * 2);
    const indices = new Uint32Array(Math.max(0, count - 1) * 6);
    for (let k = 0; k < count; k++) {
      // The last sample looks back along its incoming segment.
      const ahead = k < count - 1 ? k + 1 : k - 1;
      const sign = k < count - 1 ? 1 : -1;
      for (let axis = 0; axis < 3; axis++) {
        const here = local[k * 3 + axis];
        const toward =
          sign > 0
            ? local[ahead * 3 + axis]
            : 2 * here - local[ahead * 3 + axis];
        position[k * 6 + axis] = position[k * 6 + 3 + axis] = here;
        next[k * 6 + axis] = next[k * 6 + 3 + axis] = toward;
      }
      side.set([-1, 1], k * 2);
      time.fill((times[k] - track.start) / 1000, k * 2, k * 2 + 2);
      if (k < count - 1)
        indices.set(
          [k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2],
          k * 6,
        );
    }
    const mesh = new Mesh(gl, {
      program: path,
      geometry: new Geometry(gl, {
        position: { size: 3, data: position },
        next: { size: 3, data: next },
        side: { size: 1, data: side },
        time: { size: 1, data: time },
        index: { data: indices },
      }),
    });
    meshes.set(key, mesh);
    return mesh;
  };
  const triangle = new Triangle(gl);
  const skyMesh = new Mesh(gl, { geometry: triangle, program: sky });
  const insetMesh = new Mesh(gl, { geometry: triangle, program: inset });

  // Bloom: the scene renders into `scene`; its bright parts are blurred at
  // half resolution through `half` and `swap`, then composited to the canvas.
  const target = (width = 1, height = 1) =>
    new RenderTarget(gl, { width, height, depth: false });
  const post = { scene: target(), half: target(), swap: target() };
  const bright = new Program(gl, {
    vertex: fullscreenVertex,
    fragment: brightFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tMap: { value: post.scene.texture },
      uTexel: { value: [1, 1] },
      uThreshold: { value: 0.42 },
    },
  });
  const blur = new Program(gl, {
    vertex: fullscreenVertex,
    fragment: blurFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: { tMap: { value: post.half.texture }, uStep: { value: [0, 0] } },
  });
  const composite = new Program(gl, {
    vertex: fullscreenVertex,
    fragment: compositeFragment,
    ...passOptions,
    uniforms: {
      tScene: { value: post.scene.texture },
      tBloom: { value: post.half.texture },
      uStrength: { value: 0 },
    },
  });
  const brightMesh = new Mesh(gl, { geometry: triangle, program: bright });
  const blurMesh = new Mesh(gl, { geometry: triangle, program: blur });
  const compositeMesh = new Mesh(gl, {
    geometry: triangle,
    program: composite,
  });

  let craft: SpacecraftSnapshot | null = null;
  let pointMesh: Mesh | null = null;
  let trailMesh: Mesh | null = null;
  let fleet: Fleet | null = null;
  let positions = new Float32Array(0);
  let samples = new Float32Array(0);
  let nexts = new Float32Array(0);
  const trailSatellites: number[] = [];
  let camera: Camera | null = null;
  // Each group's point opacity in the last frame: hidden groups cannot be
  // picked.
  let pickAlpha: number[] = Array.from({ length: GROUPS }, () => 0);
  const context = overlay.getContext('2d');
  // The spillover glow is painted here first, then revealed through a disc
  // that grows out of Earth as its layer switch fades in. It is soft enough
  // to paint at half a CSS pixel per pixel: a sixteenth of the work at 2×.
  const HAZE_SCALE = 0.5;
  const hazeCanvas = document.createElement('canvas');
  const haze = hazeCanvas.getContext('2d');
  // The cones are the costliest thing on screen and barely move between
  // frames, so they are repainted when the camera or layers change and
  // otherwise at most ten times a second.
  let hazeKey = '';
  let hazeAt = Number.NEGATIVE_INFINITY;
  let size = { width: 1, height: 1, dpr: 1 };
  // The scene may be built before its overlay joins the page (lib/orbit-stage.ts).
  const font =
    getComputedStyle(overlay.isConnected ? overlay : document.documentElement)
      .getPropertyValue('--font-mono')
      .trim() || 'monospace';

  const setFleet = (next: Fleet) => {
    fleet = next;
    positions = new Float32Array(next.count * 3);
    const group = new Float32Array(next.count);
    const shade = new Float32Array(next.count);
    next.group.forEach((value, index) => {
      group[index] = value;
      // Starlink shells by inclination: 33–53° blue through 70° and 97.6°
      // polar shells toward violet.
      if (value === STARLINK) {
        const inclination = (Math.acos(next.cosI[index]) * 180) / Math.PI;
        shade[index] = Math.min(1, Math.max(0, (inclination - 43) / 50));
      }
    });
    pointMesh = new Mesh(gl, {
      mode: gl.POINTS,
      program: points,
      geometry: new Geometry(gl, {
        position: { size: 3, data: positions, usage: gl.DYNAMIC_DRAW },
        group: { size: 1, data: group },
        recent: { size: 1, data: Float32Array.from(next.recent) },
        shade: { size: 1, data: shade },
        focus: { size: 1, data: new Float32Array(next.count) },
      }),
    });
    trailSatellites.length = 0;
    for (let index = 0; index < next.count; index++)
      if (TRAIL_SPAN[next.group[index]] > 0) trailSatellites.push(index);
    // Two vertices per sample, one either side of the ribbon.
    const vertices = trailSatellites.length * TRAIL_SAMPLES * 2;
    samples = new Float32Array(vertices * 3);
    nexts = new Float32Array(vertices * 3);
    const side = new Float32Array(vertices);
    const fade = new Float32Array(vertices);
    const trailGroup = new Float32Array(vertices);
    const index = new Uint16Array(
      trailSatellites.length * (TRAIL_SAMPLES - 1) * 6,
    );
    trailSatellites.forEach((satellite, slot) => {
      for (let k = 0; k < TRAIL_SAMPLES; k++) {
        const v = (slot * TRAIL_SAMPLES + k) * 2;
        side.set([-1, 1], v);
        fade.fill(k / (TRAIL_SAMPLES - 1), v, v + 2);
        trailGroup.fill(next.group[satellite], v, v + 2);
        if (k === TRAIL_SAMPLES - 1) continue;
        index.set(
          [v, v + 1, v + 2, v + 1, v + 3, v + 2],
          (slot * (TRAIL_SAMPLES - 1) + k) * 6,
        );
      }
    });
    trailMesh = new Mesh(gl, {
      program: trails,
      geometry: new Geometry(gl, {
        position: { size: 3, data: samples, usage: gl.DYNAMIC_DRAW },
        next: { size: 3, data: nexts, usage: gl.DYNAMIC_DRAW },
        side: { size: 1, data: side },
        fade: { size: 1, data: fade },
        group: { size: 1, data: trailGroup },
        index: { data: index },
      }),
    });
  };

  const upload = (
    texture: Texture,
    image: HTMLCanvasElement | HTMLImageElement,
  ) => {
    texture.generateMipmaps = true;
    texture.minFilter = gl.LINEAR_MIPMAP_LINEAR;
    texture.image = image;
    texture.needsUpdate = true;
    // Upload now rather than on the first visible frame.
    texture.update();
  };
  const setLand = (image: HTMLCanvasElement) => {
    upload(land, image);
    sky.uniforms.uLandReady.value = 1;
  };
  const setLights = (image: HTMLImageElement) => upload(lights, image);

  const resize = (width: number, height: number, dpr: number) => {
    size = { width, height, dpr };
    renderer.dpr = dpr;
    renderer.setSize(width, height);
    overlay.width = Math.round(width * dpr);
    overlay.height = Math.round(height * dpr);
    hazeCanvas.width = Math.max(1, Math.round(width * HAZE_SCALE));
    hazeCanvas.height = Math.max(1, Math.round(height * HAZE_SCALE));
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    post.scene.setSize(w, h);
    post.half.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    post.swap.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
  };

  /** A replayed mission on the overlay: the events along the lead
   * spacecraft's path and the spacecraft themselves (the paths are drawn
   * on the GPU, see `pathMesh`). */
  const drawMission = (
    mission: MissionView,
    craftNow: (number[] | null)[],
    frame: {
      cam: Camera;
      moon: readonly number[];
      earthR: number;
      time: number;
      screen: (p: readonly number[]) => [number, number];
      label: (
        value: string,
        x: number,
        y: number,
        opacity: number,
        align?: CanvasTextAlign,
      ) => void;
      rgba: (color: string, alpha: number) => string;
    },
  ) => {
    if (!context) return;
    const { cam, moon, earthR, time, screen, label, rgba } = frame;
    const { track, weight } = mission;
    const hidden = (p: readonly number[]) =>
      earthCover(cam, p, earthR) === 1 ||
      earthCover(cam, p, MOON_RADIUS, moon) === 1;
    const point = [0, 0, 0];
    // Events on the lead spacecraft's path: done ones filled, the rest open.
    // Only the next event, and the last one for six hours, are labelled.
    const lead = track.craft[0];
    let next = -1;
    let last = -1;
    mission.events.forEach((event, index) => {
      if (event.time > time && next < 0) next = index;
      if (event.time <= time) last = index;
    });
    // Screen spots already labelled: the spacecraft first.
    const labelled: [number, number][] = [];
    for (const at of craftNow) {
      if (!at) continue;
      const [x, y] = screen(at);
      if (Number.isFinite(x + y)) labelled.push([x, y - 20]);
    }
    mission.events.forEach((event, index) => {
      if (!lead.at(event.time, point)) return;
      const p = track.shift(mission.frame, event.time, time, point);
      if (hidden(p)) return;
      const [x, y] = screen(p);
      if (!Number.isFinite(x + y)) return;
      const done = event.time <= time;
      context.fillStyle = rgba('#ffffff', (done ? 0.85 : 0) * weight);
      context.strokeStyle = rgba('#ffffff', 0.85 * weight);
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(x, y - 4.5);
      context.lineTo(x + 4.5, y);
      context.lineTo(x, y + 4.5);
      context.lineTo(x - 4.5, y);
      context.closePath();
      context.fill();
      context.stroke();
      const recent = index === last && time - event.time < 6 * 3600000;
      // Right by the spacecraft or another label, the name would collide:
      // the side panel lists it anyway.
      const crowded = labelled.some(
        ([lx, ly]) => Math.abs(lx - x) < 120 && Math.abs(ly - y) < 18,
      );
      if ((index === next || recent) && !crowded) {
        label(event.label, x + 9, y + 14, (recent ? 0.75 : 0.95) * weight);
        labelled.push([x, y]);
      }
    });

    // The spacecraft themselves.
    craftNow.forEach((at, index) => {
      if (!at) return;
      const [x, y] = screen(at);
      if (!Number.isFinite(x + y)) return;
      const behind = hidden(at);
      const { color, label: name } = mission.craft[index];
      const alpha = (behind ? 0.4 : 1) * weight;
      context.shadowColor = rgba(color, 0.9 * alpha);
      context.shadowBlur = 10;
      context.fillStyle = rgba(color, alpha);
      context.beginPath();
      context.arc(x, y, 3.4, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = rgba(color, 0.7 * alpha);
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(x, y, 8, 0, Math.PI * 2);
      context.stroke();
      label(name, x + 12, y - 10, alpha);
    });
  };

  const render = (view: SceneView, clock: number, text: SceneText) => {
    if (gl.isContextLost()) return;
    const { width, height, dpr } = size;
    const { time } = view;
    const sun = sunDirection(time) as Vec3;
    const axes = view.cameraAxes;
    const orientation = axes
      ? (() => {
          const local = basis(view.elevation, view.azimuth);
          const map = (v: readonly number[]) =>
            [0, 1, 2].map(
              (i) => v[0] * axes[0][i] + v[1] * axes[1][i] + v[2] * axes[2][i],
            ) as Vec3;
          return {
            toward: map(local.toward),
            right: map(local.right),
            up: map(local.up),
          };
        })()
      : basis(view.elevation, Math.atan2(sun[1], sun[0]) + view.azimuth);
    const { toward, right, up } = orientation;
    const mission = view.mission ?? null;
    // A replayed mission brings its own Moon, from the same JPL ephemeris as
    // the spacecraft; the analytic one is ~2000 km off, more than its radius.
    const moon = mission
      ? mission.track.moon(time, [0, 0, 0])
      : moonPosition(time);
    // The mission's spacecraft now, for the camera and the markers.
    const craftNow = mission
      ? mission.track.craft.map((track) => {
          const at = [0, 0, 0];
          return track.at(time, at) ? at : null;
        })
      : [];
    const lead = craftNow.find((at) => at !== null) ?? null;
    const offset = [view.aimX, view.aimY, view.aimZ];
    const target = [0, 1, 2].map(
      (axis) =>
        moon[axis] * view.aimMoon +
        (lead ? lead[axis] * view.aimCraft : 0) +
        (axes
          ? offset[0] * axes[0][axis] +
            offset[1] * axes[1][axis] +
            offset[2] * axes[2][axis]
          : offset[axis]),
    );
    // Seen from the camera the Moon may project anywhere from beside Earth to
    // 64 Earth radii out; fitting it keeps the Earth–Moon view filled.
    const fit = zoomToFit(width, height, moon, orientation, 18);
    const zoom = Math.exp(
      Math.log(view.zoom) * (1 - view.fitMoon) + Math.log(fit) * view.fitMoon,
    );
    if (!Number.isFinite(zoom) || zoom <= 0) return;
    const cam = makeCamera(width, height, zoom, orientation, target);
    camera = cam;
    const { center, scale } = cam;
    // Far out, Earth is drawn at least five pixels across.
    const earthR = Math.max(1, 5 / scale);
    const screen = (p: readonly number[]): [number, number] => {
      const [x, y] = project(cam, p);
      return [x, y];
    };
    const hidden = (p: readonly number[]) => earthCover(cam, p, earthR) === 1;
    for (const program of [sky, inset, points, trails, path]) {
      const u = program.uniforms;
      u.uSize.value = [width, height];
      u.uDpr.value = dpr;
      u.uCenter.value = center;
      u.uFocal.value = cam.focal;
      u.uCam.value = cam.position;
      u.uRight.value = right;
      u.uUp.value = up;
      u.uToward.value = toward;
      u.uNear.value = cam.near;
      u.uSun.value = sun;
      u.uEarthR.value = earthR;
    }

    // The Moon: where it really is once the frame is wide enough, otherwise
    // pinned to the frame edge in its true direction as an out-of-focus
    // backdrop.
    const [mx, my, mz] = project(cam, moon);
    const margin = 34;
    // Behind the camera, take its direction across the screen plane.
    const [dx, dy] = Number.isFinite(mx)
      ? [mx - center[0], my - center[1]]
      : [dot(moon, right) * 1e4, -dot(moon, up) * 1e4];
    const reach = Math.max(
      Math.abs(dx) / (center[0] - margin),
      Math.abs(dy) / (center[1] - margin),
    );
    const pinned = Math.min(1, Math.max(0, (reach - 1) / 1.4));
    const pull = reach > 1 ? 1 / reach : 1;
    const moonAt: [number, number] = [
      center[0] + dx * pull,
      center[1] + dy * pull,
    ];
    const ease = pinned * pinned * (3 - 2 * pinned);
    const trueRadius = mz > cam.near ? (MOON_RADIUS * cam.focal) / mz : 0;
    const moonRadius = Math.max(trueRadius, 6.5) * (1 - ease) + 24 * ease;
    const toEarth = moon.map((value) => -value / Math.hypot(...moon)) as Vec3;
    const side = [-toEarth[1], toEarth[0], 0].map(
      (value) => value / Math.hypot(toEarth[0], toEarth[1]),
    ) as Vec3;
    const top: Vec3 = [
      toEarth[1] * side[2] - toEarth[2] * side[1],
      toEarth[2] * side[0] - toEarth[0] * side[2],
      toEarth[0] * side[1] - toEarth[1] * side[0],
    ];
    const u = sky.uniforms;
    u.uGmst.value = siderealAngle(time);
    u.uNight.value = view.lights;
    u.uMoon.value = [moonAt[0], moonAt[1], moonRadius];
    u.uMoonLook.value = [ease * 10, 1 - ease * 0.45, mz < cam.distance ? 1 : 0];
    // Rows of a mat3 in column-major order: world → Moon-fixed frame.
    u.uMoonFrame.value = [
      toEarth[0],
      side[0],
      top[0],
      toEarth[1],
      side[1],
      top[1],
      toEarth[2],
      side[2],
      top[2],
    ];
    inset.uniforms.uMoonFrame.value = u.uMoonFrame.value;
    // The lunar close-up sits in the top-right corner of the Earth–Moon view.
    const lens = Math.min(68, height * 0.17, width * 0.15);
    const lensAt: [number, number] = [
      width - (view.insetRight ?? 0) - lens - 20,
      lens + 20,
    ];
    const lensWeight = view.lunar * (1 - ease) * (craft && !mission ? 1 : 0);
    inset.uniforms.uInset.value = [lensAt[0], lensAt[1], lens];
    inset.uniforms.uInsetAlpha.value = lensWeight;

    // Far out, the LEO shells collapse into the planet and would only smear it.
    const far = Math.min(1, Math.max(0, (zoom - 12) / 18));
    pickAlpha = CONSTELLATIONS.map(
      (_, index) =>
        (IS_LOW[index] ? view.leo * (1 - far) : view.gnss) *
        view.groups[index] *
        (index === STARLINK ? 0.82 : 1),
    );
    points.uniforms.uAlpha.value = pickAlpha;
    points.uniforms.uSizeScale.value =
      1 + 0.25 * Math.min(1, Math.max(0, (3.7 - zoom) / 2.2)) - 0.2 * far;
    points.uniforms.uDistance.value = cam.distance;
    points.uniforms.uRecent.value = view.recent;
    points.uniforms.uClock.value = clock % 1e6;
    const focus = view.focus ?? 0;
    points.uniforms.uFocus.value = focus;
    trails.uniforms.uAlpha.value = CONSTELLATIONS.map(
      (_, index) =>
        (1 - 0.85 * focus) *
        view.groups[index] *
        (TRAIL_SPAN[index] === 0
          ? 0
          : !IS_LOW[index]
            ? view.trails * view.gnss * 0.9
            : view.trails * view.leo * 0.75 * (1 - far)),
    );
    const haloAlpha =
      view.halo * view.leo * view.groups[STARLINK] * (1 - far) * 0.05;

    const bloom = view.bloom > 0.01;
    const into = bloom ? post.scene : undefined;
    renderer.render({ scene: skyMesh, target: into });
    // Nothing to propagate while every group is hidden (a mission replay).
    const anyGroup = pickAlpha.some((alpha) => alpha > 0.001);
    if (fleet && pointMesh && trailMesh && anyGroup) {
      propagate(fleet, time, positions);
      pointMesh.geometry.attributes.position.needsUpdate = true;
      if (view.trails > 0.01) {
        // Sample the arc behind each satellite; each vertex also gets the
        // next sample toward the tail so the ribbon can be widened on screen.
        const current = fleet;
        trailSatellites.forEach((satellite, slot) => {
          const span =
            period(current, satellite) * TRAIL_SPAN[current.group[satellite]];
          const base = slot * TRAIL_SAMPLES * 6;
          for (let k = 0; k < TRAIL_SAMPLES; k++) {
            positionAt(
              current,
              satellite,
              time - (span * k) / (TRAIL_SAMPLES - 1),
              samples,
              base + k * 6,
            );
            samples.copyWithin(
              base + k * 6 + 3,
              base + k * 6,
              base + k * 6 + 3,
            );
          }
          for (let k = 0; k < TRAIL_SAMPLES; k++) {
            const at = base + k * 6;
            const from = k < TRAIL_SAMPLES - 1 ? at + 6 : at - 6;
            const sign = k < TRAIL_SAMPLES - 1 ? 1 : -1;
            for (let axis = 0; axis < 3; axis++) {
              // The tail end extrapolates away from its neighbour.
              const value =
                sign > 0
                  ? samples[from + axis]
                  : 2 * samples[at + axis] - samples[from + axis];
              nexts[at + axis] = value;
              nexts[at + 3 + axis] = value;
            }
          }
        });
        trailMesh.geometry.attributes.position.needsUpdate = true;
        trailMesh.geometry.attributes.next.needsUpdate = true;
        renderer.render({ scene: trailMesh, target: into, clear: false });
      }
      if (haloAlpha > 0.001) {
        points.uniforms.uHalo.value = 1;
        points.uniforms.uHaloAlpha.value = haloAlpha;
        renderer.render({ scene: pointMesh, target: into, clear: false });
        points.uniforms.uHalo.value = 0;
      }
      renderer.render({ scene: pointMesh, target: into, clear: false });
    }
    if (mission && mission.weight > 0.01) {
      const { track, frame } = mission;
      const shown = track.basis(frame, time);
      const u = path.uniforms;
      u.uOrigin.value = [...shown.origin];
      u.uAxes.value = shown.axes.flatMap((axis) => [...axis]);
      u.uScale.value = shown.scale;
      u.uNow.value = (time - track.start) / 1000;
      u.uMoonAt.value = [...moon];
      track.craft.forEach((craftTrack, index) => {
        // A spacecraft that has not split off yet is not drawn.
        if (time < craftTrack.start) return;
        u.uColor.value = hex(mission.craft[index].color);
        u.uAlpha.value = mission.weight;
        renderer.render({
          scene: pathMesh(track, index, frame),
          target: into,
          clear: false,
        });
      });
    }
    if (lensWeight > 0.01)
      renderer.render({ scene: insetMesh, target: into, clear: false });
    if (bloom) {
      const halfSize = [post.half.width, post.half.height];
      bright.uniforms.uTexel.value = [
        1 / post.scene.width,
        1 / post.scene.height,
      ];
      renderer.render({ scene: brightMesh, target: post.half });
      // Two blur rounds, the second twice as wide.
      for (const spread of [1, 2]) {
        blur.uniforms.tMap.value = post.half.texture;
        blur.uniforms.uStep.value = [spread / halfSize[0], 0];
        renderer.render({ scene: blurMesh, target: post.swap });
        blur.uniforms.tMap.value = post.swap.texture;
        blur.uniforms.uStep.value = [0, spread / halfSize[1]];
        renderer.render({ scene: blurMesh, target: post.half });
      }
      composite.uniforms.uStrength.value = view.bloom;
      renderer.render({ scene: compositeMesh });
    }

    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round';
    const label = (
      value: string,
      x: number,
      y: number,
      opacity: number,
      align: CanvasTextAlign = 'left',
    ) => {
      if (opacity <= 0.01 || !Number.isFinite(x + y)) return;
      context.font = `500 10px ${font}`;
      const content = value.toUpperCase();
      // Keep every label inside the frame whatever its anchor.
      const span = context.measureText(content).width;
      const start =
        align === 'left' ? x : align === 'right' ? x - span : x - span / 2;
      const shift =
        Math.min(0, width - 10 - (start + span)) + Math.max(0, 10 - start);
      context.textAlign = align;
      context.fillStyle = `rgba(223, 218, 245, ${0.78 * opacity})`;
      context.fillText(
        content,
        x + shift,
        Math.min(height - 8, Math.max(14, y)),
      );
    };
    const earthPx = earthR * scale;
    const rgba = (color: string, alpha: number) => {
      const [r, g, b] = hex(color);
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
    };

    // The selected satellite: its orbit over one period around now, its
    // ground track from half an orbit back to one and a half ahead (on the
    // turning Earth, so the track lies under the right ground), and a marker
    // at its SGP4 position.
    const selected = view.selected;
    if (selected) {
      const color = selected.color;
      const span = Math.min(selected.period, DAY_MS);
      const gmstNow = siderealAngle(time);
      const strokeTrack = (
        from: number,
        to: number,
        alpha: number,
        dash: number[],
      ) => {
        context.setLineDash(dash);
        context.strokeStyle = rgba(color, alpha);
        context.lineWidth = 1.1;
        context.beginPath();
        let drawing = false;
        const steps = 120;
        for (let step = 0; step <= steps; step++) {
          const t = from + ((to - from) * step) / steps;
          const p = selected.position(t);
          if (!p) {
            drawing = false;
            continue;
          }
          // Where the ground under the satellite at t is now.
          const turn = gmstNow - siderealAngle(t);
          const [c, s] = [Math.cos(turn), Math.sin(turn)];
          const length = Math.hypot(p[0], p[1], p[2]) || 1;
          const ground = [
            ((c * p[0] - s * p[1]) / length) * earthR * 1.004,
            ((s * p[0] + c * p[1]) / length) * earthR * 1.004,
            (p[2] / length) * earthR * 1.004,
          ];
          const facing =
            dot(ground, [
              cam.position[0] - ground[0],
              cam.position[1] - ground[1],
              cam.position[2] - ground[2],
            ]) > 0;
          const [x, y] = screen(ground);
          if (!facing || !Number.isFinite(x + y)) {
            drawing = false;
            continue;
          }
          if (drawing) context.lineTo(x, y);
          else context.moveTo(x, y);
          drawing = true;
        }
        context.stroke();
        context.setLineDash([]);
      };
      strokeTrack(time - span / 2, time, 0.28, [2, 3]);
      strokeTrack(time, time + span * 1.5, 0.6, []);
      // The orbit itself, broken where Earth hides it.
      context.strokeStyle = rgba(color, 0.75);
      context.lineWidth = 1.3;
      context.beginPath();
      let drawing = false;
      for (let step = 0; step <= 180; step++) {
        const p = selected.position(time + (step / 180 - 0.5) * span);
        const point = p && !hidden(p) ? screen(p) : null;
        if (!point || !Number.isFinite(point[0] + point[1])) {
          drawing = false;
          continue;
        }
        if (drawing) context.lineTo(point[0], point[1]);
        else context.moveTo(point[0], point[1]);
        drawing = true;
      }
      context.stroke();
      const now = selected.position(time);
      if (now) {
        const [x, y] = screen(now);
        const behind = hidden(now);
        if (Number.isFinite(x + y)) {
          context.strokeStyle = rgba(color, behind ? 0.35 : 0.95);
          context.lineWidth = 1.5;
          context.beginPath();
          context.arc(x, y, 8, 0, Math.PI * 2);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            context.moveTo(x + dx * 11, y + dy * 11);
            context.lineTo(x + dx * 16, y + dy * 16);
          }
          context.stroke();
          label(selected.label, x + 14, y - 12, behind ? 0.5 : 1);
        }
      }
    }
    // An example orbit from the learn panel: the ellipse (broken where Earth
    // hides it), its perigee, and the satellite at its mean anomaly. A
    // transfer stops at the Moon and shows where it meets it.
    const example = view.example;
    if (example) {
      const { elements, color, transfer } = example;
      const sweep = transfer ? Math.PI : Math.PI * 2;
      context.strokeStyle = rgba(color, 0.9);
      context.lineWidth = 1.6;
      context.setLineDash([6, 4]);
      context.beginPath();
      let drawing = false;
      for (let step = 0; step <= 240; step++) {
        const p = orbitPoint(elements, (step / 240) * sweep);
        const point = hidden(p) ? null : screen(p);
        if (!point || !Number.isFinite(point[0] + point[1])) {
          drawing = false;
          continue;
        }
        if (drawing) context.lineTo(point[0], point[1]);
        else context.moveTo(point[0], point[1]);
        drawing = true;
      }
      context.stroke();
      context.setLineDash([]);
      const perigee = orbitPoint(elements, 0);
      const [px, py] = screen(perigee);
      if (elements.e > 0.02 && !hidden(perigee) && Number.isFinite(px + py)) {
        context.fillStyle = rgba(color, 0.9);
        context.beginPath();
        context.arc(px, py, 2.5, 0, Math.PI * 2);
        context.fill();
      }
      const progress = transfer
        ? (time - transfer.depart) / (transfer.arrive - transfer.depart)
        : 0;
      let body: [number, number];
      let behind = false;
      // The Moon's own label sits beside it, so a captured spacecraft is
      // labelled below its ring.
      let tag: [number, number, CanvasTextAlign] | null = null;
      if (transfer && progress >= 1) {
        // Captured: a small lunar orbit, about two hours a lap.
        const ring = moonRadius + 7;
        const angle = ((time - transfer.arrive) / 7200000) * Math.PI * 2;
        context.strokeStyle = rgba(color, 0.55);
        context.lineWidth = 1;
        context.setLineDash([3, 3]);
        context.beginPath();
        context.arc(moonAt[0], moonAt[1], ring, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        body = [
          moonAt[0] + Math.cos(angle) * ring,
          moonAt[1] - Math.sin(angle) * ring,
        ];
        tag = [moonAt[0], moonAt[1] + ring + 16, 'center'];
      } else {
        if (transfer) {
          // Where the Moon will be on arrival.
          const meet = orbitPoint(elements, Math.PI);
          const [qx, qy] = screen(meet);
          if (Number.isFinite(qx + qy)) {
            context.strokeStyle = rgba(color, 0.75);
            context.lineWidth = 1.2;
            context.beginPath();
            context.arc(qx, qy, 9, 0, Math.PI * 2);
            context.stroke();
            label(transfer.arrival, qx, qy + 24, 0.9, 'center');
          }
        }
        const M = transfer
          ? Math.PI * Math.min(1, Math.max(0, progress))
          : elements.M;
        const p = orbitPoint(elements, trueAnomaly(M, elements.e));
        body = screen(p);
        behind = hidden(p);
      }
      const [bx, by] = body;
      if (Number.isFinite(bx + by)) {
        context.fillStyle = rgba(color, behind ? 0.35 : 1);
        context.beginPath();
        context.arc(bx, by, 4, 0, Math.PI * 2);
        context.fill();
        const [lx, ly, align] = tag ?? [bx + 9, by - 8, 'left'];
        label(example.label, lx, ly, behind ? 0.5 : 1, align);
      }
    }
    if (mission && mission.weight > 0.01)
      drawMission(mission, craftNow, {
        cam,
        moon,
        earthR,
        time,
        screen,
        label,
        rgba,
      });
    const hovered = view.hovered;
    if (
      hovered &&
      hovered.index !== selected?.index &&
      hovered.index < positions.length / 3
    ) {
      const at = hovered.index * 3;
      const p = [positions[at], positions[at + 1], positions[at + 2]];
      const [x, y] = screen(p);
      if (Number.isFinite(x + y)) {
        context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        context.lineWidth = 1.2;
        context.setLineDash([2, 2]);
        context.beginPath();
        context.arc(x, y, 7, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        if (hovered.label) label(hovered.label, x + 11, y - 9, 0.95);
      }
    }

    // Ground receivers: each counts the GNSS satellites above a 10° mask.
    // Only the one facing the camera most squarely draws its links; the
    // hand-over to the next city is a crossfade as Earth turns.
    if (fleet) {
      const layer = view.receiver * view.gnss * (1 - far);
      const ping = (clock % 2200) / 2200;
      const names: {
        text: string;
        x: number;
        y: number;
        opacity: number;
        rank: number;
      }[] = [];
      context.lineWidth = 0.8;
      for (const city of RECEIVERS) {
        const site = groundPoint(city.latitude, city.longitude, time);
        const facing = dot(site, toward);
        const shown = layer * Math.min(1, Math.max(0, facing * 5));
        if (shown <= 0.01) continue;
        const links = layer * Math.max(0, facing) ** 8;
        const [sx, sy] = screen(site);
        if (!Number.isFinite(sx + sy)) continue;
        let tracked = 0;
        for (let index = 0; index < fleet.count; index++) {
          const group = fleet.group[index];
          if (!IS_GNSS[group] || elevation(site, positions, index * 3) < MASK)
            continue;
          tracked++;
          const visible = view.groups[group];
          const target = [
            positions[index * 3],
            positions[index * 3 + 1],
            positions[index * 3 + 2],
          ];
          if (links * visible <= 0.01 || hidden(target)) continue;
          const [tx, ty] = screen(target);
          if (!Number.isFinite(tx + ty)) continue;
          const [r, g, b] = COLORS[group];
          const strength = links * visible;
          const gradient = context.createLinearGradient(sx, sy, tx, ty);
          gradient.addColorStop(
            0,
            `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${0.03 * strength})`,
          );
          gradient.addColorStop(
            1,
            `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${0.3 * strength})`,
          );
          context.strokeStyle = gradient;
          context.beginPath();
          context.moveTo(sx, sy);
          context.lineTo(tx, ty);
          context.stroke();
        }
        context.fillStyle = `rgba(143, 240, 210, ${shown})`;
        context.beginPath();
        context.arc(sx, sy, 2.2, 0, Math.PI * 2);
        context.fill();
        if (links > 0.05) {
          context.strokeStyle = `rgba(143, 240, 210, ${links * (1 - ping)})`;
          context.beginPath();
          context.arc(sx, sy, 2.2 + ping * 9, 0, Math.PI * 2);
          context.stroke();
        }
        const name = text.zh ? city.zh : city.en;
        names.push({
          text: links > 0.05 ? `${name} · ${tracked} SV` : name,
          x: sx + 8,
          y: sy - 6,
          opacity: shown * (0.45 + 0.55 * Math.min(1, links * 3)),
          rank: links,
        });
      }
      // The featured city labels first; any other label that would collide
      // with one already placed is dropped.
      context.font = `500 10px ${font}`;
      const placed: number[][] = [];
      for (const entry of names.sort((a, b) => b.rank - a.rank)) {
        const box = [
          entry.x - 2,
          entry.y - 11,
          entry.x + context.measureText(entry.text.toUpperCase()).width + 2,
          entry.y + 3,
        ];
        if (
          placed.some(
            ([l, t, r, b]) =>
              box[0] < r && box[2] > l && box[1] < b && box[3] > t,
          )
        )
          continue;
        placed.push(box);
        label(entry.text, entry.x, entry.y, entry.opacity);
      }
    }

    // The Moon's path over one sidereal month, faint and dashed.
    const pathWeight = view.moonPath * (1 - ease);
    if (pathWeight > 0.01) {
      context.setLineDash([1.5, 5]);
      context.strokeStyle = `rgba(200, 189, 255, ${0.35 * pathWeight})`;
      context.lineWidth = 1;
      context.beginPath();
      let drawing = false;
      for (let step = 0; step <= 96; step++) {
        const [x, y] = screen(
          moonPosition(time + (step / 96 - 0.5) * 27.32 * DAY_MS),
        );
        if (!Number.isFinite(x + y)) {
          drawing = false;
          continue;
        }
        if (drawing) context.lineTo(x, y);
        else context.moveTo(x, y);
        drawing = true;
      }
      context.stroke();
      context.setLineDash([]);
    }

    // Phase from the Moon actually drawn (the mission's own, if any).
    const distance = Math.hypot(moon[0], moon[1], moon[2]);
    const illuminated = (1 - dot(sun, moon) / distance) / 2;
    // Waxing while the Moon runs east of the Sun: the cross product points north.
    const waxing = sun[0] * moon[1] - sun[1] * moon[0] > 0;
    // Phone-width frames get the short form of every label.
    const narrow = width < 460;
    const phase = text.phase(Math.round(illuminated * 100), waxing);
    const moonText =
      ease > 0.5 || zoom > 150
        ? text.moon
        : narrow
          ? `${text.moon} · ${phase}`
          : `${text.moon} · ${Math.round(distance * EARTH_RADIUS_KM).toLocaleString('en-US')} KM · ${phase}`;
    // With the close-up open in the top-right, label the Moon on its left.
    const moonAlign: CanvasTextAlign =
      moonAt[0] > width * (lensWeight > 0.01 ? 0.3 : 0.62) ? 'right' : 'left';
    const moonLabel = {
      x: moonAt[0] + (moonAlign === 'right' ? -1 : 1) * (moonRadius + 8),
      y: moonAt[1] - moonRadius * 0.4 - 4,
    };
    label(
      moonText,
      moonLabel.x,
      moonLabel.y,
      (0.55 + 0.45 * (1 - ease)) * (1 - view.deep),
      moonAlign,
    );
    const [earthX, earthY] = screen([0, 0, 0]);
    label(
      text.earth,
      earthX + earthPx + 9,
      earthY + earthPx + 12,
      Math.min(1, Math.max(0, (zoom - 20) / 20)),
    );

    // The Sun: a label where it is, or where its direction meets the frame.
    const sunAhead = -dot(sun, toward);
    const sunX = dot(sun, right);
    const sunY = -dot(sun, up);
    const sunDir =
      sunAhead > 0.05
        ? [(sunX / sunAhead) * cam.focal, (sunY / sunAhead) * cam.focal]
        : [sunX * 1e4, sunY * 1e4];
    const sunPull = Math.min(
      1,
      1 /
        Math.max(
          Math.abs(sunDir[0]) / (center[0] - 44),
          Math.abs(sunDir[1]) / (center[1] - 26),
        ),
    );
    label(
      `☉ ${text.sun}`,
      center[0] + sunDir[0] * sunPull,
      center[1] + sunDir[1] * sunPull,
      0.7,
      sunDir[0] < 0 ? 'left' : 'right',
    );

    const dotAt = (
      x: number,
      y: number,
      radius: number,
      color: string,
      alpha: number,
    ) => {
      context.shadowColor = rgba(color, 0.9 * alpha);
      context.shadowBlur = 8;
      context.fillStyle = rgba(color, alpha);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    };

    // Sun–Earth L1 and L2: the Sun line, both points, and the spacecraft
    // stationed there with their last three weeks of halo orbit.
    if (view.deep > 0.01) {
      const weight = view.deep;
      const l1 = screen(sun.map((value) => (value * L1_KM) / EARTH_RADIUS_KM));
      const l2 = screen(sun.map((value) => (-value * L2_KM) / EARTH_RADIUS_KM));
      if (Number.isFinite(l1[0] + l1[1] + l2[0] + l2[1])) {
        const span = Math.hypot(l1[0] - l2[0], l1[1] - l2[1]) || 1;
        const along = [(l1[0] - l2[0]) / span, (l1[1] - l2[1]) / span];
        const reachPx = Math.hypot(width, height);
        context.setLineDash([2, 6]);
        context.strokeStyle = `rgba(255, 214, 160, ${0.22 * weight})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(l2[0] - along[0] * reachPx, l2[1] - along[1] * reachPx);
        context.lineTo(l1[0] + along[0] * reachPx, l1[1] + along[1] * reachPx);
        context.stroke();
        context.setLineDash([]);
      }
      for (const [[lx, ly], name] of [
        [l1, text.l1],
        [l2, text.l2],
      ] as const) {
        if (!Number.isFinite(lx + ly)) continue;
        context.strokeStyle = `rgba(255, 224, 190, ${0.7 * weight})`;
        context.beginPath();
        context.moveTo(lx - 4, ly);
        context.lineTo(lx + 4, ly);
        context.moveTo(lx, ly - 4);
        context.lineTo(lx, ly + 4);
        context.stroke();
        label(name, lx, ly + 16, 0.8 * weight, 'center');
      }
      // Today's spacecraft have no place in a replayed mission.
      if (craft && !mission) {
        const at = [0, 0, 0];
        for (const { key, en, zh, color } of DEEP_SPACECRAFT) {
          if (!vectorAt(craft, key, time, at)) continue;
          // Path: twelve-hourly back to three weeks ago, fading out.
          context.lineWidth = 1.2;
          let previous: [number, number] | null = null;
          for (let step = 0; step <= 42; step++) {
            const sample = [0, 0, 0];
            if (!vectorAt(craft, key, time - step * 12 * 3600000, sample))
              break;
            const point = screen(
              sample.map((value) => value / EARTH_RADIUS_KM),
            );
            if (previous && Number.isFinite(point[0] + point[1])) {
              context.strokeStyle = rgba(
                color,
                0.55 * weight * (1 - step / 42),
              );
              context.beginPath();
              context.moveTo(previous[0], previous[1]);
              context.lineTo(point[0], point[1]);
              context.stroke();
            }
            previous = point;
          }
          const [cx, cy] = screen(at.map((value) => value / EARTH_RADIUS_KM));
          if (!Number.isFinite(cx + cy)) continue;
          dotAt(cx, cy, 2.6, color, weight);
          const km = Math.round(Math.hypot(at[0], at[1], at[2])).toLocaleString(
            'en-US',
          );
          label(
            narrow ? (text.zh ? zh : en) : `${text.zh ? zh : en} · ${km} KM`,
            cx + 8,
            cy - 6,
            weight,
            'left',
          );
        }
      }
    }

    let spillCount = -1;
    // GNSS spillover: each navigation antenna's main lobe is wider than the
    // Earth it points at, and the ring between Earth's limb and the lobe edge
    // carries on into cislunar space. A satellite counts when the Moon lies in
    // that ring, judged in 3D. The drawing is 3D too: every lobe is shown as
    // the true projection of its cone (a faint glow; rays tilted toward or
    // away from the camera land anywhere inside it, so the ring cannot be
    // drawn flat), and each counted satellite gets a beam along its actual
    // line to the Moon.
    if (fleet && view.spill > 0.01) {
      const weight = view.spill * view.gnss;
      let reaching = 0;
      context.save();
      // Keep the glow off Earth's disc and out of the lunar close-up.
      context.beginPath();
      context.rect(0, 0, width, height);
      context.moveTo(center[0] + earthPx + 1, center[1]);
      context.arc(center[0], center[1], earthPx + 1, 0, Math.PI * 2);
      if (lensWeight > 0.01) {
        context.moveTo(lensAt[0] + lens + 3, lensAt[1]);
        context.arc(lensAt[0], lensAt[1], lens + 3, 0, Math.PI * 2);
      }
      context.clip('evenodd');
      context.globalCompositeOperation = 'lighter';
      const key = [
        ...cam.position.map((value) => value.toFixed(3)),
        width,
        height,
        view.spill.toFixed(3),
        view.gnss.toFixed(3),
        ...view.groups.map((value) => value.toFixed(2)),
      ].join();
      const repaint =
        !!haze &&
        (key !== hazeKey || clock === 0 || Math.abs(clock - hazeAt) > 100);
      if (repaint) {
        hazeKey = key;
        hazeAt = clock;
        haze.setTransform(1, 0, 0, 1, 0, 0);
        haze.clearRect(0, 0, hazeCanvas.width, hazeCanvas.height);
        haze.setTransform(HAZE_SCALE, 0, 0, HAZE_SCALE, 0, 0);
        haze.globalCompositeOperation = 'lighter';
      }
      const diagonal = Math.hypot(width, height);
      // Cone length in Earth radii: past the frame edge, but short of the
      // camera so every rim point projects.
      const coneLength = Math.min((diagonal / scale) * 1.2, cam.distance * 0.7);
      const beams: { from: [number, number]; color: string }[] = [];
      for (let index = 0; index < fleet.count; index++) {
        const group = fleet.group[index];
        if (!IS_GNSS[group] || view.groups[group] < 0.01) continue;
        const p = [
          positions[index * 3],
          positions[index * 3 + 1],
          positions[index * 3 + 2],
        ];
        const radius = Math.hypot(p[0], p[1], p[2]);
        const key = CONSTELLATIONS[group].key as
          | 'gps'
          | 'glonass'
          | 'galileo'
          | 'beidou';
        const beam =
          (key === 'beidou' && radius > 6 ? BEAM.beidouHigh : BEAM[key]) *
          (Math.PI / 180);
        const limb = Math.asin(1 / radius);
        const toMoon = [moon[0] - p[0], moon[1] - p[1], moon[2] - p[2]];
        const offAxis = Math.acos(
          -dot(toMoon, p) /
            (Math.hypot(toMoon[0], toMoon[1], toMoon[2]) * radius),
        );
        const color = CONSTELLATIONS[group].color;
        const apex = screen(p);
        if (!Number.isFinite(apex[0] + apex[1])) continue;
        if (offAxis > limb && offAxis < beam) {
          reaching++;
          beams.push({ from: apex, color });
        }
        if (!repaint) continue;
        // The cone's outline: apex plus the rim circle at `coneLength`.
        const axis = p.map((value) => -value / radius);
        const helper = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        const e1 = [
          axis[1] * helper[2] - axis[2] * helper[1],
          axis[2] * helper[0] - axis[0] * helper[2],
          axis[0] * helper[1] - axis[1] * helper[0],
        ];
        const n1 = Math.hypot(e1[0], e1[1], e1[2]);
        e1.forEach((_, i) => (e1[i] /= n1));
        const e2 = [
          axis[1] * e1[2] - axis[2] * e1[1],
          axis[2] * e1[0] - axis[0] * e1[2],
          axis[0] * e1[1] - axis[1] * e1[0],
        ];
        const along = coneLength * Math.cos(beam);
        const across = coneLength * Math.sin(beam);
        const rim = Array.from({ length: 24 }, (_, step) => {
          const angle = (step / 24) * Math.PI * 2;
          const [c, s] = [Math.cos(angle) * across, Math.sin(angle) * across];
          return screen(
            [0, 1, 2].map(
              (i) => p[i] + axis[i] * along + e1[i] * c + e2[i] * s,
            ),
          );
        });
        if (!haze || rim.some(([x, y]) => !Number.isFinite(x + y))) continue;
        // A projected cone is the convex hull of its apex and projected rim.
        const outline = convexHull([apex, ...rim]);
        haze.beginPath();
        outline.forEach(([x, y], step) =>
          step ? haze.lineTo(x, y) : haze.moveTo(x, y),
        );
        haze.closePath();
        const glow = haze.createRadialGradient(
          apex[0],
          apex[1],
          0,
          apex[0],
          apex[1],
          diagonal,
        );
        const toEarth = Math.hypot(center[0] - apex[0], center[1] - apex[1]);
        glow.addColorStop(0, rgba(color, 0));
        glow.addColorStop(
          Math.min(0.9, toEarth / diagonal + 0.02),
          rgba(color, 0.009 * weight * view.groups[group]),
        );
        glow.addColorStop(1, rgba(color, 0));
        haze.fillStyle = glow;
        haze.fill();
      }
      // Reveal the glow through a soft-edged disc centred on Earth. Its
      // radius follows the view weight on an ease-out curve, so the signal
      // spreads out from the planet on the way in and draws back into it on
      // the way out.
      if (haze && repaint) {
        const grow = 1 - (1 - Math.min(1, view.spill)) ** 3;
        const corner = Math.hypot(
          Math.max(center[0], width - center[0]),
          Math.max(center[1], height - center[1]),
        );
        const radius = Math.max(1, corner * 1.15 * grow);
        const disc = haze.createRadialGradient(
          center[0],
          center[1],
          0,
          center[0],
          center[1],
          radius,
        );
        disc.addColorStop(0, 'rgba(0, 0, 0, 1)');
        disc.addColorStop(0.72, 'rgba(0, 0, 0, 1)');
        disc.addColorStop(1, 'rgba(0, 0, 0, 0)');
        haze.globalCompositeOperation = 'destination-in';
        haze.fillStyle = disc;
        haze.fillRect(0, 0, width, height);
        haze.globalCompositeOperation = 'source-over';
      }
      if (haze) context.drawImage(hazeCanvas, 0, 0, width, height);
      // Beams: a narrow, tapering glow from each counted satellite through
      // the Moon, fading a little beyond it.
      for (const { from, color } of beams) {
        const bx = moonAt[0] - from[0];
        const by = moonAt[1] - from[1];
        const length = Math.hypot(bx, by);
        if (length < 1) continue;
        const [ux, uy] = [bx / length, by / length];
        const reachLength = length * 1.25;
        const half = Math.max(3, reachLength * 0.02);
        const tip = [from[0] + ux * reachLength, from[1] + uy * reachLength];
        const light = context.createLinearGradient(
          from[0],
          from[1],
          tip[0],
          tip[1],
        );
        light.addColorStop(0, rgba(color, 0));
        light.addColorStop(0.3, rgba(color, 0.1 * weight));
        light.addColorStop(0.8, rgba(color, 0.32 * weight));
        light.addColorStop(1, rgba(color, 0));
        context.fillStyle = light;
        context.beginPath();
        context.moveTo(from[0], from[1]);
        context.lineTo(tip[0] - uy * half, tip[1] + ux * half);
        context.lineTo(tip[0] + uy * half, tip[1] - ux * half);
        context.closePath();
        context.fill();
      }
      context.restore();
      spillCount = reaching;
    }

    // Lunar close-up: LRO and Danuri on their two-hour orbits, with a
    // leader from the Moon itself. The lens keeps a flat (orthographic) view.
    if (craft && lensWeight > 0.01) {
      const k = (lens * INSET_MOON) / MOON_KM;
      const toLens = [lensAt[0] - moonAt[0], lensAt[1] - moonAt[1]];
      const gap = Math.hypot(toLens[0], toLens[1]);
      if (gap > lens + moonRadius + 12) {
        const ux = toLens[0] / gap;
        const uy = toLens[1] / gap;
        context.setLineDash([2, 4]);
        context.strokeStyle = `rgba(200, 189, 255, ${0.35 * lensWeight})`;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(
          moonAt[0] + ux * (moonRadius + 4),
          moonAt[1] + uy * (moonRadius + 4),
        );
        context.lineTo(
          lensAt[0] - ux * (lens + 4),
          lensAt[1] - uy * (lens + 4),
        );
        context.stroke();
        context.setLineDash([]);
      }
      context.strokeStyle = `rgba(200, 189, 255, ${0.4 * lensWeight})`;
      context.beginPath();
      context.arc(lensAt[0], lensAt[1], lens + 0.5, 0, Math.PI * 2);
      context.stroke();
      const place = (p: number[]) => {
        const x = dot(p, right);
        const y = dot(p, up);
        return {
          x: lensAt[0] + x * k,
          y: lensAt[1] - y * k,
          hidden: dot(p, toward) < 0 && x * x + y * y < MOON_KM * MOON_KM,
        };
      };
      for (const { key, en, zh, color } of LUNAR_ORBITERS) {
        const at = [0, 0, 0];
        if (!lunarAt(craft, key, time, at)) continue;
        const span = lunarPeriod(craft, key, time) * 0.45;
        let previous = place(at);
        context.lineWidth = 2;
        for (let step = 1; step <= 36; step++) {
          const sample = [0, 0, 0];
          if (!lunarAt(craft, key, time - (span * step) / 36, sample)) break;
          const point = place(sample);
          if (!point.hidden && !previous.hidden) {
            context.strokeStyle = rgba(
              color,
              0.8 * lensWeight * (1 - step / 36),
            );
            context.beginPath();
            context.moveTo(previous.x, previous.y);
            context.lineTo(point.x, point.y);
            context.stroke();
          }
          previous = point;
        }
        const head = place(at);
        if (head.hidden) continue;
        dotAt(head.x, head.y, 3, color, lensWeight);
        label(text.zh ? zh : en, head.x + 6, head.y - 5, 0.9 * lensWeight);
      }
      label(
        text.closeUp,
        lensAt[0],
        lensAt[1] + lens + 15,
        0.7 * lensWeight,
        'center',
      );
    }
    // The spillover count, on the line under the Moon's label.
    if (spillCount >= 0)
      label(
        text.spill(spillCount),
        moonLabel.x,
        moonLabel.y + 14,
        view.spill,
        moonAlign,
      );

    // Scale bar on a 1–2–5 ladder, true at Earth's distance.
    const kmPerPx = EARTH_RADIUS_KM / scale;
    const targetKm = kmPerPx * 90;
    const magnitude = 10 ** Math.floor(Math.log10(targetKm));
    const step =
      [1, 2, 5, 10].find((factor) => factor * magnitude >= targetKm / 1.6)! *
      magnitude;
    const barPx = step / kmPerPx;
    const bx = width - 18 - barPx;
    const by = height - 18;
    context.strokeStyle = 'rgba(223, 218, 245, 0.55)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(bx, by - 4);
    context.lineTo(bx, by);
    context.lineTo(bx + barPx, by);
    context.lineTo(bx + barPx, by - 4);
    context.stroke();
    label(
      `${step.toLocaleString('en-US')} KM`,
      bx + barPx,
      by - 8,
      0.8,
      'right',
    );
  };

  const lost = (event: Event) => event.preventDefault();
  canvas.addEventListener('webglcontextlost', lost);
  return {
    setFleet,
    setLand,
    setLights,
    setSpacecraft(next: SpacecraftSnapshot) {
      craft = next;
    },
    resize,
    render,
    /** The camera of the last frame, for picking. */
    camera: () => camera,
    /** Teaching mode's satellites (1 = stand out), or null for none. */
    setFocus(mask: Uint8Array | null) {
      const attribute = pointMesh?.geometry.attributes.focus;
      if (!attribute) return;
      const data = attribute.data as Float32Array;
      if (mask)
        for (let index = 0; index < data.length; index++)
          data[index] = mask[index];
      else data.fill(0);
      attribute.needsUpdate = true;
    },
    /** The visible satellite nearest to (x, y) CSS px within `radius`, or
     * -1. Screen-space search over the last frame's positions: about a
     * millisecond for fifteen thousand satellites, with no GPU read-back. */
    pick(x: number, y: number, radius = 14) {
      const cam = camera;
      if (!cam || !fleet) return -1;
      const earthR = Math.max(1, 5 / cam.scale);
      const [ox, oy, oz] = cam.position;
      const { right, up, toward, focal, center, near } = cam;
      let best = -1;
      let bestDistance = radius * radius;
      for (let index = 0; index < fleet.count; index++) {
        if (pickAlpha[fleet.group[index]] < 0.05) continue;
        const px = positions[index * 3] - ox;
        const py = positions[index * 3 + 1] - oy;
        const pz = positions[index * 3 + 2] - oz;
        const z = -(px * toward[0] + py * toward[1] + pz * toward[2]);
        if (z < near) continue;
        const k = focal / z;
        const dx =
          center[0] + (px * right[0] + py * right[1] + pz * right[2]) * k - x;
        const dy = center[1] - (px * up[0] + py * up[1] + pz * up[2]) * k - y;
        const distance = dx * dx + dy * dy;
        if (distance >= bestDistance) continue;
        const p = [
          positions[index * 3],
          positions[index * 3 + 1],
          positions[index * 3 + 2],
        ];
        if (earthCover(cam, p, earthR) === 1) continue;
        best = index;
        bestDistance = distance;
      }
      return best;
    },
    /** Positions (Earth radii) of every satellite at the last frame. */
    positions: () => positions,
    dispose() {
      canvas.removeEventListener('webglcontextlost', lost);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
