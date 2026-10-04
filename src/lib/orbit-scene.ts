import { Geometry, Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import {
  CONSTELLATIONS,
  EARTH_RADIUS_KM,
  MOON_RADIUS,
  elevation,
  groundPoint,
  moonPhase,
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

/** One frame of the orbit map. Distances are in Earth radii, angles in
 * radians, layer weights 0–1. */
export type SceneView = {
  time: number;
  /** Earth radii from the centre of the frame to its top edge. */
  zoom: number;
  /** Camera latitude above the equator. */
  elevation: number;
  /** Camera longitude measured from the Sun's meridian; the Sun keeps its
   * side of the frame while Earth turns underneath. */
  azimuth: number;
  leo: number;
  gnss: number;
  /** Meteor trails behind GNSS, Iridium and ORBCOMM satellites. */
  trails: number;
  receiver: number;
  /** The Moon's month-long path around Earth. */
  moonPath: number;
  /** Sun–Earth line, L1/L2 and the spacecraft there. */
  deep: number;
  /** GNSS main-lobe signal spilling past Earth's limb. */
  spill: number;
  /** The lunar close-up with LRO and Danuri. */
  lunar: number;
  /** 1 frames the Moon wherever it projects, overriding `zoom`. */
  fitMoon: number;
};
export type SceneText = {
  sun: string;
  moon: string;
  earth: string;
  zh: boolean;
  l1: string;
  l2: string;
  spill: (count: number) => string;
  lugre: string;
  closeUp: string;
  phase: (percent: number, waxing: boolean) => string;
};

type Vec3 = [number, number, number];
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
// Moon radius as a fraction of the lunar close-up lens, leaving room for the
// orbiters' ~100 km altitude.
const INSET_MOON = 0.74;
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

const skyVertex = /* glsl */ `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Earth, Moon, Sun glow and stars in one pass. Each body is ray-cast as a
// sphere under an orthographic camera; Earth is lit by the real Sun and turned
// to the real sidereal angle, so the terminator and the coastlines under it
// match the chosen instant.
const skyFragment = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uDpr;
uniform vec2 uCenter;
uniform float uScale;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uToward;
uniform vec3 uSun;
uniform float uGmst;
uniform float uEarthR;
uniform float uStarZoom;
uniform sampler2D uLand;
uniform float uLandReady;
uniform vec3 uMoon;
uniform vec3 uMoonLook;
uniform mat3 uMoonFrame;
uniform vec2 uSunGlow;
uniform vec3 uInset;
uniform float uInsetAlpha;
out vec4 fragColor;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1) * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise3(p);
    p = p * 2.07 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}
float stars(vec2 p, float cell, float density, float r, float seed) {
  vec2 id = floor(p / cell);
  if (hash(id + seed) > density) return 0.0;
  vec2 at = (id + 0.2 + 0.6 * vec2(hash(id + seed + 3.7), hash(id + seed + 9.1))) * cell;
  float d = length(p - at);
  float size = r * (0.6 + 0.8 * hash(id + seed + 5.3));
  return exp(-d * d / (size * size)) * (0.3 + 0.7 * hash(id + seed + 7.9));
}
vec4 over(vec4 top, vec4 under) {
  return vec4(top.rgb + under.rgb * (1.0 - top.a), top.a + under.a * (1.0 - top.a));
}
// A unit disc point to a world-space normal on the camera-facing hemisphere.
vec3 sphereNormal(vec2 q) {
  float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  return normalize(uRight * q.x + uUp * q.y + uToward * z);
}
float gridLine(float value, float spacing) {
  float d = abs(fract(value / spacing + 0.5) - 0.5) * spacing;
  return 1.0 - smoothstep(0.0, fwidth(value) * 1.3, d);
}

vec4 earth(vec2 p) {
  float radius = uEarthR * uScale;
  vec2 q = (p - uCenter) / radius * vec2(1.0, -1.0);
  float r = length(q);
  float aa = 1.0 / radius;
  vec3 limb = normalize(uRight * q.x + uUp * q.y);
  float sunSide = dot(limb, uSun);
  float dusk = exp(-sunSide * sunSide * 10.0);
  vec3 air = mix(vec3(0.3, 0.52, 1.0), vec3(1.0, 0.56, 0.36), dusk * 0.7);

  // Scattered light around the limb, strongest on the day side.
  float fall = max(radius * 0.07, 2.2);
  float halo = exp(-max(r - 1.0, 0.0) * radius / fall) * smoothstep(1.0 - aa, 1.0 + aa, r);
  vec4 glow = vec4(air * halo * (0.08 + 0.9 * smoothstep(-0.35, 0.45, sunSide)), 0.0);
  glow.a = clamp(max(glow.r, max(glow.g, glow.b)), 0.0, 1.0);
  if (r > 1.0 + aa) return glow;

  vec3 n = sphereNormal(q);
  float c = cos(uGmst);
  float s = sin(uGmst);
  vec3 e = vec3(c * n.x + s * n.y, -s * n.x + c * n.y, n.z);
  float lon = atan(e.y, e.x);
  float lat = asin(clamp(e.z, -1.0, 1.0));
  vec2 uv = vec2(lon / TAU + 0.5, 0.5 + lat / PI);
  // Take derivatives from whichever longitude parametrisation has no seam
  // here, so mipmapping does not draw a line down the antimeridian.
  float shifted = fract(uv.x + 0.5);
  float dxu = abs(dFdx(uv.x)) < abs(dFdx(shifted)) ? dFdx(uv.x) : dFdx(shifted);
  float dyu = abs(dFdy(uv.x)) < abs(dFdy(shifted)) ? dFdy(uv.x) : dFdy(shifted);
  vec4 tex = textureGrad(uLand, uv, vec2(dxu, dFdx(uv.y)), vec2(dyu, dFdy(uv.y))) * uLandReady;
  float land = tex.r;
  float lines = tex.g;
  float shelf = tex.b;

  float alat = abs(lat) * 180.0 / PI;
  float n1 = fbm(e * 3.2);
  float n2 = fbm(e * 11.0 + 4.0);
  vec3 forest = vec3(0.13, 0.27, 0.19);
  vec3 grass = vec3(0.33, 0.39, 0.23);
  vec3 desert = vec3(0.69, 0.57, 0.41);
  vec3 tundra = vec3(0.42, 0.44, 0.41);
  vec3 ice = vec3(0.9, 0.94, 1.0);
  float dry = exp(-pow((alat - 23.0) / 10.0, 2.0)) * smoothstep(0.38, 0.62, n1 + 0.12);
  vec3 ground = mix(forest, grass, smoothstep(0.3, 0.7, n1));
  ground = mix(ground, desert, dry);
  ground = mix(ground, tundra, smoothstep(48.0, 64.0, alat + n2 * 6.0));
  ground = mix(ground, ice, smoothstep(63.0, 72.0, alat + n2 * 10.0));
  ground *= 0.84 + 0.32 * n2;
  vec3 ocean = mix(vec3(0.015, 0.06, 0.19), vec3(0.04, 0.2, 0.36), shelf * (1.0 - land) * 0.85);
  ocean = mix(ocean, ice * 0.85, smoothstep(76.0, 82.0, alat + n2 * 6.0));
  vec3 surface = mix(ocean, ground, land);

  float mu = dot(n, uSun);
  float day = smoothstep(-0.1, 0.22, mu);
  vec3 lit = surface * (0.18 + 1.05 * pow(max(mu, 0.0), 0.8));
  vec3 halfway = normalize(uSun + uToward);
  lit += vec3(1.0, 0.9, 0.78) * pow(max(dot(n, halfway), 0.0), 70.0) * (1.0 - land) * 0.7;
  // Night: coastlines and borders glow faintly, like a chart under a lamp.
  vec3 dark = vec3(0.01, 0.016, 0.04) + surface * 0.05 + vec3(0.36, 0.42, 0.95) * lines * 0.3;
  vec3 color = mix(dark, lit, day);
  float grid = max(gridLine(lat * 180.0 / PI, 30.0), gridLine(lon * 180.0 / PI, 30.0));
  color += vec3(0.55, 0.62, 1.0) * grid * mix(0.09, 0.035, day);
  color += vec3(0.95, 0.42, 0.2) * exp(-mu * mu * 90.0) * 0.1;
  // Looking through more air toward the limb.
  float z = sqrt(max(0.0, 1.0 - r * r));
  float rim = pow(1.0 - z, 2.4);
  color = mix(color, air * (0.12 + 0.9 * day), rim * 0.65);

  float alpha = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
  return over(vec4(color * alpha, alpha), glow);
}

// A lit Moon disc at geom = (x, y, radius px); look = (edge blur px, opacity).
vec4 moonDisc(vec2 p, vec3 geom, vec2 look) {
  float radius = geom.z;
  float blur = look.x;
  vec2 q = (p - geom.xy) / radius * vec2(1.0, -1.0);
  float r = length(q);
  float soft = max(blur, 0.8) / radius;
  if (r > 1.0 + soft * 2.0 + blur * 0.25) return vec4(0.0);
  vec3 n = sphereNormal(q / max(r, 1.0));
  vec3 local = uMoonFrame * n;
  float maria = smoothstep(0.48, 0.62, fbm(local * 2.2 + 3.0));
  float grain = fbm(local * 9.0);
  vec3 albedo = mix(vec3(0.78, 0.77, 0.8), vec3(0.42, 0.42, 0.47), maria) * (0.82 + 0.3 * grain);
  float mu = dot(n, uSun);
  vec3 color = albedo * (smoothstep(-0.04, 0.12, mu) * (0.25 + 0.85 * max(mu, 0.0))) + albedo * 0.025;
  float alpha = 1.0 - smoothstep(1.0 - soft, 1.0 + soft, r);
  // As a backdrop the Moon is out of focus and haloed.
  float halo = exp(-max(r - 1.0, 0.0) * 3.0) * blur / 14.0 * 0.35;
  vec4 disc = vec4(color * alpha, alpha) * look.y;
  return over(disc, vec4(vec3(0.75, 0.74, 0.86) * halo, halo) * look.y);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
#ifdef INSET
  // The lunar close-up: a dark lens with the Moon filling most of it.
  float lens = 1.0 - smoothstep(uInset.z - 1.0, uInset.z + 0.5, length(p - uInset.xy));
  vec4 inset = over(moonDisc(p, vec3(uInset.xy, uInset.z * ${INSET_MOON}), vec2(0.0, 1.0)), vec4(vec3(0.018, 0.02, 0.04) * lens, lens * 0.94));
  fragColor = inset * uInsetAlpha;
  return;
#endif
  // Stars drift outward a little as the camera pulls back.
  vec2 sp = uCenter + (p - uCenter) * uStarZoom;
  float light = stars(sp, 4.0, 0.05, 0.6, 0.0) * 0.6
    + stars(sp, 9.0, 0.05, 0.8, 21.0) * 0.8
    + stars(sp, 23.0, 0.08, 1.05, 57.0);
  vec3 sky = vec3(0.82, 0.85, 1.0) * light * 0.5;
  float diagonal = length(uSize);
  float d = length(p - uSunGlow) / diagonal;
  sky += vec3(1.0, 0.72, 0.42) * (0.34 * exp(-d * 6.5) + 0.12 * exp(-d * 2.2));
  sky = 1.0 - exp(-sky * 1.15);
  vec4 color = vec4(sky, clamp(max(sky.r, max(sky.g, sky.b)), 0.0, 1.0));

  vec4 planet = earth(p);
  vec4 satellite = moonDisc(p, uMoon, uMoonLook.xy);
  if (uMoonLook.z > 0.5) color = over(satellite, over(planet, color));
  else color = over(planet, over(satellite, color));
  color.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = clamp(color, 0.0, 1.0);
}
`;

// Orthographic projection shared by the satellites and their trails. Anything
// behind the Earth disc (or inside an Earth drawn larger than life) is hidden.
const projection = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uScale;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uToward;
uniform float uEarthR;
float hiddenBehindEarth(vec3 p) {
  vec2 plane = vec2(dot(p, uRight), dot(p, uUp));
  float r2 = uEarthR * uEarthR;
  return (dot(p, uToward) < 0.0 && dot(plane, plane) < r2) || dot(p, p) < r2 ? 1.0 : 0.0;
}
vec4 project(vec3 p) {
  vec2 px = uCenter + vec2(dot(p, uRight), -dot(p, uUp)) * uScale;
  return vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}
`;

const pointVertex = /* glsl */ `#version 300 es
in vec3 position;
in float group;
uniform float uDpr;
uniform vec3 uSun;
uniform float uAlpha[${GROUPS}];
uniform vec3 uColor[${GROUPS}];
uniform float uPointSize[${GROUPS}];
uniform float uSizeScale;
out vec4 vColor;
${projection}
void main() {
  int g = int(group + 0.5);
  gl_Position = project(position);
  // Satellites inside Earth's shadow cylinder are in eclipse: dimmed.
  float along = dot(position, uSun);
  float eclipse = along < 0.0 && dot(position, position) - along * along < 1.0 ? 0.35 : 1.0;
  float alpha = uAlpha[g] * (1.0 - hiddenBehindEarth(position));
  // Starlink's shell in front of the planet reads as haze: keep the
  // continents visible through it.
  vec2 plane = vec2(dot(position, uRight), dot(position, uUp));
  if (g == 0 && dot(plane, plane) < uEarthR * uEarthR) alpha *= 0.42;
  vColor = vec4(uColor[g] * eclipse, alpha);
  gl_PointSize = alpha > 0.0 ? uPointSize[g] * uSizeScale * uDpr : 0.0;
}
`;
const pointFragment = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = vColor.a * (1.0 - smoothstep(0.55, 1.0, d));
  fragColor = vec4(vColor.rgb * a, a);
}
`;

// Meteor trails: a screen-space ribbon along the arc each satellite has
// just flown, widest and brightest at the satellite, thinning to nothing.
const trailVertex = /* glsl */ `#version 300 es
in vec3 position;
in vec3 next;
in float side;
in float fade;
in float group;
uniform float uAlpha[${GROUPS}];
uniform vec3 uColor[${GROUPS}];
uniform float uWidth[${GROUPS}];
out vec4 vColor;
out float vHidden;
out float vSide;
${projection}
vec2 toPx(vec3 p) {
  return uCenter + vec2(dot(p, uRight), -dot(p, uUp)) * uScale;
}
void main() {
  int g = int(group + 0.5);
  vec2 here = toPx(position);
  vec2 along = toPx(next) - here;
  float length2 = dot(along, along);
  along = length2 > 1e-8 ? along / sqrt(length2) : vec2(1.0, 0.0);
  float width = uWidth[g] * mix(1.0, 0.18, fade);
  vec2 px = here + vec2(-along.y, along.x) * side * width * 0.5;
  gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
  vHidden = hiddenBehindEarth(position);
  vSide = side;
  float head = pow(1.0 - fade, 5.0);
  vColor = vec4(mix(uColor[g], vec3(1.0), head * 0.55), uAlpha[g] * pow(1.0 - fade, 1.7));
}
`;
const trailFragment = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor;
in float vHidden;
in float vSide;
out vec4 fragColor;
void main() {
  if (vHidden > 0.5) discard;
  float a = vColor.a * (1.0 - smoothstep(0.25, 1.0, abs(vSide)));
  fragColor = vec4(vColor.rgb * a, a);
}
`;

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
  const shared = () => ({
    uSize: { value: [1, 1] },
    uDpr: { value: 1 },
    uCenter: { value: [0, 0] },
    uScale: { value: 1 },
    uRight: { value: [0, 1, 0] },
    uUp: { value: [0, 0, 1] },
    uToward: { value: [1, 0, 0] },
    uSun: { value: [1, 0, 0] },
    uEarthR: { value: 1 },
  });
  const land = new Texture(gl, {
    image: new Uint8Array(4),
    width: 1,
    height: 1,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
  });
  const sky = new Program(gl, {
    vertex: skyVertex,
    fragment: skyFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...shared(),
      uGmst: { value: 0 },
      uStarZoom: { value: 1 },
      uLand: { value: land },
      uLandReady: { value: 0 },
      uMoon: { value: [0, 0, 1] },
      uMoonLook: { value: [0, 0, 0] },
      uMoonFrame: { value: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      uSunGlow: { value: [0, 0] },
    },
  });
  const inset = new Program(gl, {
    vertex: skyVertex,
    fragment: skyFragment.replace(
      '#version 300 es\n',
      '#version 300 es\n#define INSET\n',
    ),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...shared(),
      uMoonFrame: { value: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      uInset: { value: [0, 0, 1] },
      uInsetAlpha: { value: 0 },
    },
  });
  const layerUniforms = () => ({
    ...shared(),
    uAlpha: { value: Array.from({ length: GROUPS }, () => 0) },
    uColor: { value: COLORS },
  });
  const points = new Program(gl, {
    vertex: pointVertex,
    fragment: pointFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...layerUniforms(),
      uPointSize: { value: POINT_SIZE },
      uSizeScale: { value: 1 },
    },
  });
  const trails = new Program(gl, {
    vertex: trailVertex,
    fragment: trailFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    cullFace: false,
    uniforms: { ...layerUniforms(), uWidth: { value: TRAIL_WIDTH } },
  });
  const skyMesh = new Mesh(gl, { geometry: new Triangle(gl), program: sky });
  const insetMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: inset,
  });
  let craft: SpacecraftSnapshot | null = null;
  let pointMesh: Mesh | null = null;
  let trailMesh: Mesh | null = null;
  let fleet: Fleet | null = null;
  let positions = new Float32Array(0);
  let samples = new Float32Array(0);
  let nexts = new Float32Array(0);
  const trailSatellites: number[] = [];
  const context = overlay.getContext('2d');
  // The spillover glow is painted here first, then revealed through a disc
  // that grows out of Earth as the Earth–Moon view opens.
  const hazeCanvas = document.createElement('canvas');
  const haze = hazeCanvas.getContext('2d');
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
    next.group.forEach((value, index) => (group[index] = value));
    pointMesh = new Mesh(gl, {
      mode: gl.POINTS,
      program: points,
      geometry: new Geometry(gl, {
        position: { size: 3, data: positions, usage: gl.DYNAMIC_DRAW },
        group: { size: 1, data: group },
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

  const setLand = (image: HTMLCanvasElement) => {
    land.generateMipmaps = true;
    land.minFilter = gl.LINEAR_MIPMAP_LINEAR;
    land.image = image;
    land.needsUpdate = true;
    // Upload now rather than on the first visible frame.
    land.update();
    sky.uniforms.uLandReady.value = 1;
  };

  const resize = (width: number, height: number, dpr: number) => {
    size = { width, height, dpr };
    renderer.dpr = dpr;
    renderer.setSize(width, height);
    overlay.width = Math.round(width * dpr);
    overlay.height = Math.round(height * dpr);
    hazeCanvas.width = overlay.width;
    hazeCanvas.height = overlay.height;
  };

  const render = (view: SceneView, clock: number, text: SceneText) => {
    if (gl.isContextLost()) return;
    const { width, height, dpr } = size;
    const { time } = view;
    const sun = sunDirection(time) as Vec3;
    const sunLongitude = Math.atan2(sun[1], sun[0]);
    const phi = sunLongitude + view.azimuth;
    const toward: Vec3 = [
      Math.cos(view.elevation) * Math.cos(phi),
      Math.cos(view.elevation) * Math.sin(phi),
      Math.sin(view.elevation),
    ];
    const right: Vec3 = [-Math.sin(phi), Math.cos(phi), 0];
    const up: Vec3 = [
      toward[1] * right[2] - toward[2] * right[1],
      toward[2] * right[0] - toward[0] * right[2],
      toward[0] * right[1] - toward[1] * right[0],
    ];
    const center: [number, number] = [width / 2, height / 2];
    const frameHalf = Math.min(width / 1.6, height) / 2;
    const moon = moonPosition(time);
    // Seen from the camera the Moon may project anywhere from beside Earth to
    // 64 Earth radii out; fitting it keeps the Earth–Moon view filled.
    const fit = Math.max(
      18,
      (Math.abs(dot(moon, right)) * frameHalf) / (0.7 * width * 0.5),
      (Math.abs(dot(moon, up)) * frameHalf) / (0.62 * height * 0.5),
    );
    const zoom = Math.exp(
      Math.log(view.zoom) * (1 - view.fitMoon) + Math.log(fit) * view.fitMoon,
    );
    const scale = frameHalf / zoom;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const earthR = Math.max(1, 5 / scale);
    const screen = (p: readonly number[]): [number, number] => [
      center[0] + dot(p, right) * scale,
      center[1] - dot(p, up) * scale,
    ];
    const hidden = (p: readonly number[]) => {
      const x = dot(p, right);
      const y = dot(p, up);
      return (
        (dot(p, toward) < 0 && x * x + y * y < earthR * earthR) ||
        dot(p, p) < earthR * earthR
      );
    };
    for (const program of [sky, inset, points, trails]) {
      const u = program.uniforms;
      u.uSize.value = [width, height];
      u.uDpr.value = dpr;
      u.uCenter.value = center;
      u.uScale.value = scale;
      u.uRight.value = right;
      u.uUp.value = up;
      u.uToward.value = toward;
      u.uSun.value = sun;
      u.uEarthR.value = earthR;
    }

    // The Moon: where it really is once the frame is wide enough, otherwise
    // pinned to the frame edge in its true direction as an out-of-focus
    // backdrop.
    const [mx, my] = screen(moon);
    const margin = 34;
    const reach = Math.max(
      Math.abs(mx - center[0]) / (center[0] - margin),
      Math.abs(my - center[1]) / (center[1] - margin),
    );
    const pinned = Math.min(1, Math.max(0, (reach - 1) / 1.4));
    const pull = reach > 1 ? 1 / reach : 1;
    const moonAt: [number, number] = [
      center[0] + (mx - center[0]) * pull,
      center[1] + (my - center[1]) * pull,
    ];
    const ease = pinned * pinned * (3 - 2 * pinned);
    const moonRadius =
      Math.max(MOON_RADIUS * scale, 6.5) * (1 - ease) + 24 * ease;
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
    u.uStarZoom.value = Math.pow(zoom / 3.7, -0.06);
    u.uMoon.value = [moonAt[0], moonAt[1], moonRadius];
    u.uMoonLook.value = [
      ease * 10,
      1 - ease * 0.45,
      dot(moon, toward) > 0 ? 1 : 0,
    ];
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
    const lensAt: [number, number] = [width - lens - 20, lens + 20];
    const lensWeight = view.lunar * (1 - ease) * (craft ? 1 : 0);
    inset.uniforms.uInset.value = [lensAt[0], lensAt[1], lens];
    inset.uniforms.uInsetAlpha.value = lensWeight;
    const sunPlane = [dot(sun, right), -dot(sun, up)];
    const sunLength = Math.hypot(sunPlane[0], sunPlane[1]) || 1;
    const sunReach = Math.hypot(width, height) * 0.56;
    u.uSunGlow.value = [
      center[0] + (sunPlane[0] / sunLength) * sunReach,
      center[1] + (sunPlane[1] / sunLength) * sunReach,
    ];

    const alpha = CONSTELLATIONS.map((_, index) =>
      IS_LOW[index] ? view.leo : view.gnss,
    );
    // Far out, the LEO shells collapse into the planet and would only smear it.
    const far = Math.min(1, Math.max(0, (zoom - 12) / 18));
    points.uniforms.uAlpha.value = alpha.map(
      (value, index) =>
        value * (IS_LOW[index] ? 1 - far : 1) * (index === 0 ? 0.82 : 1),
    );
    points.uniforms.uSizeScale.value =
      1 + 0.25 * Math.min(1, Math.max(0, (3.7 - zoom) / 2.2)) - 0.2 * far;
    trails.uniforms.uAlpha.value = CONSTELLATIONS.map((_, index) =>
      TRAIL_SPAN[index] === 0
        ? 0
        : !IS_LOW[index]
          ? view.trails * view.gnss * 0.9
          : view.trails * view.leo * 0.75 * (1 - far),
    );

    renderer.render({ scene: skyMesh });
    if (fleet && pointMesh && trailMesh) {
      propagate(fleet, time, positions);
      pointMesh.geometry.attributes.position.needsUpdate = true;
      if (view.trails > 0.01) {
        // Sample the arc behind each satellite; each vertex also gets the
        // next sample toward the tail so the ribbon can be widened on screen.
        trailSatellites.forEach((satellite, slot) => {
          const span =
            period(fleet!, satellite) * TRAIL_SPAN[fleet!.group[satellite]];
          const base = slot * TRAIL_SAMPLES * 6;
          for (let k = 0; k < TRAIL_SAMPLES; k++) {
            positionAt(
              fleet!,
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
        renderer.render({ scene: trailMesh, clear: false });
      }
      renderer.render({ scene: pointMesh, clear: false });
    }
    if (lensWeight > 0.01) renderer.render({ scene: insetMesh, clear: false });

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
      if (opacity <= 0.01) return;
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
        let tracked = 0;
        for (let index = 0; index < fleet.count; index++) {
          if (
            !IS_GNSS[fleet.group[index]] ||
            elevation(site, positions, index * 3) < MASK
          )
            continue;
          tracked++;
          const target = [
            positions[index * 3],
            positions[index * 3 + 1],
            positions[index * 3 + 2],
          ];
          if (links <= 0.01 || hidden(target)) continue;
          const [tx, ty] = screen(target);
          if (!Number.isFinite(tx + ty + sx + sy)) continue;
          const [r, g, b] = COLORS[fleet.group[index]];
          const gradient = context.createLinearGradient(sx, sy, tx, ty);
          gradient.addColorStop(
            0,
            `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${0.03 * links})`,
          );
          gradient.addColorStop(
            1,
            `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${0.3 * links})`,
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
      for (let step = 0; step <= 96; step++) {
        const [x, y] = screen(
          moonPosition(time + (step / 96 - 0.5) * 27.32 * DAY_MS),
        );
        if (step) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      context.stroke();
      context.setLineDash([]);
    }

    const { illuminated, waxing, distance } = moonPhase(time);
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
    label(
      moonText,
      moonAt[0] + (moonAlign === 'right' ? -1 : 1) * (moonRadius + 8),
      moonAt[1] - moonRadius * 0.4 - 4,
      (0.55 + 0.45 * (1 - ease)) * (1 - view.deep),
      moonAlign,
    );
    label(
      text.earth,
      center[0] + earthPx + 9,
      center[1] + earthPx + 12,
      Math.min(1, Math.max(0, (zoom - 20) / 20)),
    );

    // The Sun, always far off: a label where its glow meets the frame.
    const sunGlow = u.uSunGlow.value as number[];
    const sunDx = sunGlow[0] - center[0];
    const sunDy = sunGlow[1] - center[1];
    const sunPull =
      1 /
      Math.max(
        Math.abs(sunDx) / (center[0] - 44),
        Math.abs(sunDy) / (center[1] - 26),
      );
    label(
      `☉ ${text.sun}`,
      center[0] + sunDx * sunPull,
      center[1] + sunDy * sunPull,
      0.7,
      sunDx < 0 ? 'left' : 'right',
    );

    const rgba = (color: string, alpha: number) => {
      const [r, g, b] = hex(color);
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
    };
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
      const along = [sunPlane[0] / sunLength, sunPlane[1] / sunLength];
      const reachPx = Math.hypot(width, height);
      context.setLineDash([2, 6]);
      context.strokeStyle = `rgba(255, 214, 160, ${0.22 * weight})`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(
        center[0] - along[0] * reachPx,
        center[1] - along[1] * reachPx,
      );
      context.lineTo(
        center[0] + along[0] * reachPx,
        center[1] + along[1] * reachPx,
      );
      context.stroke();
      context.setLineDash([]);
      for (const [distance, name, sign] of [
        [L1_KM, text.l1, 1],
        [L2_KM, text.l2, -1],
      ] as const) {
        const [lx, ly] = screen(
          sun.map((value) => (sign * value * distance) / EARTH_RADIUS_KM),
        );
        context.strokeStyle = `rgba(255, 224, 190, ${0.7 * weight})`;
        context.beginPath();
        context.moveTo(lx - 4, ly);
        context.lineTo(lx + 4, ly);
        context.moveTo(lx, ly - 4);
        context.lineTo(lx, ly + 4);
        context.stroke();
        label(name, lx, ly + 16, 0.8 * weight, 'center');
      }
      if (craft) {
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
            if (previous) {
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
      haze?.setTransform(1, 0, 0, 1, 0, 0);
      haze?.clearRect(0, 0, hazeCanvas.width, hazeCanvas.height);
      haze?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (haze) haze.globalCompositeOperation = 'lighter';
      const far = Math.hypot(width, height);
      // Cone length in Earth radii: comfortably past the frame edge.
      const reach = (far / scale) * 1.2;
      const beams: { from: [number, number]; color: string }[] = [];
      for (let index = 0; index < fleet.count; index++) {
        const group = fleet.group[index];
        if (!IS_GNSS[group]) continue;
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
        if (offAxis > limb && offAxis < beam) {
          reaching++;
          beams.push({ from: apex, color });
        }
        // The cone's outline: apex plus the rim circle at `reach`, projected.
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
        const along = reach * Math.cos(beam);
        const across = reach * Math.sin(beam);
        const rim = Array.from({ length: 24 }, (_, step) => {
          const angle = (step / 24) * Math.PI * 2;
          const [c, s] = [Math.cos(angle) * across, Math.sin(angle) * across];
          return screen(
            [0, 1, 2].map(
              (i) => p[i] + axis[i] * along + e1[i] * c + e2[i] * s,
            ),
          );
        });
        // A projected cone is the convex hull of its apex and projected rim.
        const outline = convexHull([apex, ...rim]);
        if (!haze) continue;
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
          far,
        );
        const toEarth = Math.hypot(center[0] - apex[0], center[1] - apex[1]);
        glow.addColorStop(0, rgba(color, 0));
        glow.addColorStop(
          Math.min(0.9, toEarth / far + 0.02),
          rgba(color, 0.009 * weight),
        );
        glow.addColorStop(1, rgba(color, 0));
        haze.fillStyle = glow;
        haze.fill();
      }
      // Reveal the glow through a soft-edged disc centred on Earth. Its
      // radius follows the view weight on an ease-out curve, so the signal
      // spreads out from the planet on the way in and draws back into it on
      // the way out.
      if (haze) {
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
        context.drawImage(hazeCanvas, 0, 0, width, height);
      }
      // Beams: a narrow, tapering glow from each counted satellite through
      // the Moon, fading a little beyond it.
      for (const { from, color } of beams) {
        const dx = moonAt[0] - from[0];
        const dy = moonAt[1] - from[1];
        const distance = Math.hypot(dx, dy);
        if (distance < 1) continue;
        const [ux, uy] = [dx / distance, dy / distance];
        const length = distance * 1.25;
        const half = Math.max(3, length * 0.02);
        const tip = [from[0] + ux * length, from[1] + uy * length];
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
    // leader from the Moon itself.
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
    // Cislunar captions, right-aligned above the scale bar, where the Moon
    // and its label never go in this view.
    if (spillCount >= 0) {
      const weight = view.spill;
      const bottom = height - 40;
      label(
        text.spill(spillCount),
        width - 14,
        narrow ? bottom : bottom - 14,
        weight,
        'right',
      );
      if (!narrow)
        label(text.lugre, width - 14, bottom, 0.55 * weight, 'right');
    }

    // Scale bar on a 1–2–5 ladder.
    const kmPerPx = EARTH_RADIUS_KM / scale;
    const target = kmPerPx * 90;
    const magnitude = 10 ** Math.floor(Math.log10(target));
    const step =
      [1, 2, 5, 10].find((factor) => factor * magnitude >= target / 1.6)! *
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
    setSpacecraft(next: SpacecraftSnapshot) {
      craft = next;
    },
    resize,
    render,
    dispose() {
      canvas.removeEventListener('webglcontextlost', lost);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
