// GLSL for the orbit view (lib/orbit-scene.ts). Everything is drawn under the
// perspective camera of lib/scene-camera.ts; distances are in Earth radii.
import { CONSTELLATIONS } from '@/lib/orbits';

const GROUPS = CONSTELLATIONS.length;
/** Moon radius as a fraction of the lunar close-up lens. */
export const INSET_MOON = 0.74;

// Galactic north pole and centre (J2000 equatorial unit vectors): the Milky
// Way band and its bright bulge sit where they are in the real sky.
const NGP = 'vec3(-0.8677, -0.1981, 0.4560)';
const GC = 'vec3(-0.0549, -0.8735, -0.4839)';

const noise = /* glsl */ `
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
`;

// Camera uniforms and helpers shared by every pass.
const camera = /* glsl */ `
uniform vec2 uSize;
uniform vec2 uCenter;
uniform float uFocal;
uniform vec3 uCam;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uToward;
uniform float uNear;
uniform float uEarthR;
// Screen px and depth.
vec3 toScreen(vec3 p) {
  vec3 rel = p - uCam;
  float z = -dot(rel, uToward);
  return vec3(uCenter + vec2(dot(rel, uRight), -dot(rel, uUp)) * uFocal / max(z, 1e-6), z);
}
vec4 clipFromPx(vec2 px) {
  return vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
}
// 0: in clear view; 1: behind or inside Earth; 2: in front of Earth's disc.
float earthCover(vec3 p) {
  float r2 = uEarthR * uEarthR;
  if (dot(p, p) < r2) return 1.0;
  vec3 d = p - uCam;
  float len = length(d);
  d /= len;
  float b = dot(uCam, d);
  float disc = b * b - (dot(uCam, uCam) - r2);
  if (disc <= 0.0) return 0.0;
  float t = -b - sqrt(disc);
  if (t < 0.0) return 0.0;
  return t < len ? 1.0 : 2.0;
}
`;

export const fullscreenVertex = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Sky, Earth and Moon in one pass. Each pixel casts a ray from the camera:
// stars and the Milky Way are fixed on the celestial sphere, Earth is a
// sphere lit by the real Sun and turned to the real sidereal angle (so the
// terminator, coastlines and city lights match the chosen instant), wrapped in
// a thin scattering shell. The Moon is a small disc placed by the CPU, which
// pins it to the frame edge as an out-of-focus backdrop when it is off-screen.
export const skyFragment = /* glsl */ `#version 300 es
precision highp float;
uniform float uDpr;
uniform vec3 uSun;
uniform float uGmst;
uniform sampler2D uLand;
uniform float uLandReady;
uniform sampler2D uLights;
uniform float uNight;
uniform vec3 uMoon;
uniform vec3 uMoonLook;
uniform mat3 uMoonFrame;
uniform vec3 uInset;
uniform float uInsetAlpha;
out vec4 fragColor;
${camera}
#define PI 3.14159265359
#define TAU 6.28318530718
${noise}
vec4 over(vec4 top, vec4 under) {
  return vec4(top.rgb + under.rgb * (1.0 - top.a), top.a + under.a * (1.0 - top.a));
}
vec3 viewRay(vec2 p) {
  return normalize(-uToward * uFocal + uRight * (p.x - uCenter.x) - uUp * (p.y - uCenter.y));
}
// A unit disc point to a normal on the camera-facing hemisphere.
vec3 sphereNormal(vec2 q) {
  float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  return normalize(uRight * q.x + uUp * q.y + uToward * z);
}
float gridLine(float value, float spacing) {
  float d = abs(fract(value / spacing + 0.5) - 0.5) * spacing;
  return 1.0 - smoothstep(0.0, fwidth(value) * 1.3, d);
}
// One layer of stars on the celestial sphere: at most one per cell of a 3D
// grid, cellPx pixels across at the centre of the frame.
float stars(vec3 dir, float cellPx, float density, float sizePx, float seed) {
  float scale = uFocal / cellPx;
  vec3 id = floor(dir * scale);
  if (hash3(id + seed) > density) return 0.0;
  vec3 jitter = vec3(hash3(id + seed + 1.7), hash3(id + seed + 5.3), hash3(id + seed + 9.1));
  vec3 star = normalize(id + 0.25 + 0.5 * jitter);
  float radius = sizePx / uFocal * (0.6 + 0.8 * hash3(id + seed + 3.1));
  vec3 d = dir - star;
  return exp(-dot(d, d) / (radius * radius)) * (0.25 + 0.75 * hash3(id + seed + 7.9));
}

vec3 sky(vec3 dir) {
  float latitude = dot(dir, ${NGP});
  float band = exp(-latitude * latitude / 0.022);
  float bulge = exp(-(1.0 - dot(dir, ${GC})) * 3.5);
  float clouds = fbm(dir * 4.6 + 2.0);
  float rift = smoothstep(0.5, 0.72, fbm(dir * 8.0 + 7.0)) * exp(-latitude * latitude / 0.004);
  vec3 milky = vec3(0.6, 0.64, 0.86) * band * (0.25 + 0.75 * clouds) * (0.55 + 1.6 * bulge) * (1.0 - 0.75 * rift);
  float light = stars(dir, 5.0, 0.04 + 0.08 * band, 0.55, 0.0) * 0.55
    + stars(dir, 11.0, 0.06, 0.8, 21.0) * 0.8
    + stars(dir, 27.0, 0.1, 1.1, 57.0);
  vec3 color = vec3(0.82, 0.85, 1.0) * light * 0.5 + milky * 0.075;
  // The Sun: a wide warm glow and its disc (half a degree, drawn a little
  // larger so it reads at screen resolution).
  float angle = acos(clamp(dot(dir, uSun), -1.0, 1.0));
  color += vec3(1.0, 0.72, 0.42) * (0.3 * exp(-angle * 4.0) + 0.1 * exp(-angle * 1.3));
  color += vec3(1.0, 0.95, 0.86) * (1.0 - smoothstep(0.0085, 0.011, angle)) * 2.5;
  return 1.0 - exp(-color * 1.15);
}

vec4 earth(vec3 dir) {
  float R = uEarthR;
  float b = dot(uCam, dir);
  float closest = -b;
  if (closest <= 0.0) return vec4(0.0);
  // Distance of the ray from Earth's centre, and one pixel there.
  float miss = sqrt(max(dot(uCam, uCam) - b * b, 0.0));
  float pixel = closest / uFocal;
  vec3 limb = normalize(uCam + dir * closest);
  float sunSide = dot(limb, uSun);
  float dusk = exp(-sunSide * sunSide * 10.0);
  vec3 air = mix(vec3(0.3, 0.52, 1.0), vec3(1.0, 0.56, 0.36), dusk * 0.7);

  // Scattered light around the limb: a bright thin shell, strongest on the
  // day side and reddened along the terminator, over a wide faint haze.
  float outside = smoothstep(R - pixel, R + pixel, miss);
  float shell = exp(-max(miss - R, 0.0) / max(R * 0.045, 2.0 * pixel));
  float haze = exp(-max(miss - R, 0.0) / (R * 0.22));
  vec3 glowColor = air * (shell * (0.08 + 0.95 * smoothstep(-0.35, 0.45, sunSide))
    + haze * 0.1 * smoothstep(-0.25, 0.6, sunSide)) * outside;
  vec4 glow = vec4(glowColor, clamp(max(glowColor.r, max(glowColor.g, glowColor.b)), 0.0, 1.0));
  if (miss > R + pixel) return glow;

  float t = closest - sqrt(max(R * R - miss * miss, 0.0));
  vec3 n = normalize(uCam + dir * t);
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
  vec2 gx = vec2(dxu, dFdx(uv.y));
  vec2 gy = vec2(dyu, dFdy(uv.y));
  vec4 tex = textureGrad(uLand, uv, gx, gy) * uLandReady;
  float land = tex.r;
  float lines = tex.g;
  float shelf = tex.b;
  float city = textureGrad(uLights, uv, gx, gy).r;

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
  vec3 halfway = normalize(uSun - dir);
  lit += vec3(1.0, 0.9, 0.78) * pow(max(dot(n, halfway), 0.0), 70.0) * (1.0 - land) * 0.7;
  // Night: coastlines and borders glow faintly, like a chart under a lamp,
  // and the cities light up.
  vec3 dark = vec3(0.01, 0.016, 0.04) + surface * 0.05 + vec3(0.36, 0.42, 0.95) * lines * mix(0.3, 0.12, uNight);
  vec3 color = mix(dark, lit, day);
  float night = 1.0 - smoothstep(-0.14, 0.06, mu);
  color += vec3(1.0, 0.72, 0.4) * city * city * 1.7 * night * uNight;
  float grid = max(gridLine(lat * 180.0 / PI, 30.0), gridLine(lon * 180.0 / PI, 30.0));
  color += vec3(0.55, 0.62, 1.0) * grid * mix(0.09, 0.035, day);
  color += vec3(0.95, 0.42, 0.2) * exp(-mu * mu * 90.0) * 0.1;
  // Looking through more air toward the limb.
  float facing = max(dot(n, -dir), 0.0);
  float rim = pow(1.0 - facing, 2.4);
  color = mix(color, air * (0.12 + 0.9 * day), rim * 0.65);

  float alpha = 1.0 - smoothstep(R - pixel, R + pixel, miss);
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
  vec3 dir = viewRay(p);
  vec3 background = sky(dir);
  vec4 color = vec4(background, clamp(max(background.r, max(background.g, background.b)), 0.0, 1.0));
  vec4 planet = earth(dir);
  vec4 satellite = moonDisc(p, uMoon, uMoonLook.xy);
  if (uMoonLook.z > 0.5) color = over(satellite, over(planet, color));
  else color = over(planet, over(satellite, color));
  color.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = clamp(color, 0.0, 1.0);
}
`;

// Satellites as screen-sized sprites, slightly larger when nearer. The same
// program draws a second, faint pass of wide sprites for the Starlink shell
// glow (uHalo = 1).
export const pointVertex = /* glsl */ `#version 300 es
in vec3 position;
in float group;
in float recent;
in float shade;
uniform float uDpr;
uniform vec3 uSun;
uniform float uAlpha[${GROUPS}];
uniform vec3 uColor[${GROUPS}];
uniform float uPointSize[${GROUPS}];
uniform float uSizeScale;
uniform float uDistance;
uniform float uRecent;
uniform float uClock;
uniform float uHalo;
uniform float uHaloAlpha;
out vec4 vColor;
${camera}
void main() {
  int g = int(group + 0.5);
  vec3 screen = toScreen(position);
  gl_Position = clipFromPx(screen.xy);
  float cover = earthCover(position);
  float alpha = screen.z < uNear || (cover > 0.5 && cover < 1.5) ? 0.0 : uAlpha[g];
  // Satellites inside Earth's shadow cylinder are in eclipse: dimmed.
  float along = dot(position, uSun);
  float eclipse = along < 0.0 && dot(position, position) - along * along < 1.0 ? 0.35 : 1.0;
  // Starlink's shell in front of the planet reads as haze: keep the
  // continents visible through it.
  if (g == 0 && cover > 1.5) alpha *= 0.42;
  float near = clamp(sqrt(uDistance / max(screen.z, 1e-3)), 0.7, 1.8);
  vec3 color = uColor[g] * eclipse;
  float size = uPointSize[g] * uSizeScale * near;
  // Launched in the last 30 days: a slow pulse in spring green.
  if (recent > 0.5 && uRecent > 0.0) {
    float pulse = 0.5 + 0.5 * sin(uClock * 0.0042 + position.x * 37.0);
    size *= 1.0 + uRecent * (0.35 + 0.8 * pulse);
    color = mix(color, vec3(0.78, 1.0, 0.55) * eclipse, uRecent * 0.75);
    alpha = min(1.0, alpha * (1.0 + 0.6 * uRecent));
  }
  if (uHalo > 0.5) {
    if (g != 0) alpha = 0.0;
    // Tinted by shell: blue at mid inclinations, violet toward polar.
    color = mix(vec3(0.42, 0.64, 1.0), vec3(0.72, 0.52, 1.0), shade) * eclipse;
    alpha *= uHaloAlpha;
    size = 16.0 * near;
  }
  vColor = vec4(color, alpha);
  gl_PointSize = alpha > 0.0 ? size * uDpr : 0.0;
}
`;
export const pointFragment = /* glsl */ `#version 300 es
precision highp float;
uniform float uHalo;
in vec4 vColor;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = uHalo > 0.5
    ? vColor.a * exp(-d * d * 3.5) * (1.0 - smoothstep(0.85, 1.0, d))
    : vColor.a * (1.0 - smoothstep(0.55, 1.0, d));
  fragColor = vec4(vColor.rgb * a, a);
}
`;

// Meteor trails: a screen-space ribbon along the arc each satellite has
// just flown, widest and brightest at the satellite, thinning to nothing.
export const trailVertex = /* glsl */ `#version 300 es
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
${camera}
void main() {
  int g = int(group + 0.5);
  vec3 here = toScreen(position);
  vec3 there = toScreen(next);
  vec2 along = there.xy - here.xy;
  float length2 = dot(along, along);
  along = length2 > 1e-8 ? along / sqrt(length2) : vec2(1.0, 0.0);
  float width = uWidth[g] * mix(1.0, 0.18, fade);
  gl_Position = clipFromPx(here.xy + vec2(-along.y, along.x) * side * width * 0.5);
  float cover = earthCover(position);
  vHidden = here.z < uNear || there.z < uNear || (cover > 0.5 && cover < 1.5) ? 1.0 : 0.0;
  vSide = side;
  float head = pow(1.0 - fade, 5.0);
  vColor = vec4(mix(uColor[g], vec3(1.0), head * 0.55), uAlpha[g] * pow(1.0 - fade, 1.7));
}
`;
export const trailFragment = /* glsl */ `#version 300 es
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

// Bloom: keep what is bright, blur it at half resolution, add it back.
export const brightFragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D tMap;
uniform vec2 uTexel;
uniform float uThreshold;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec4 c = 0.25 * (
    texture(tMap, vUv + uTexel * vec2(-0.5, -0.5)) + texture(tMap, vUv + uTexel * vec2(0.5, -0.5)) +
    texture(tMap, vUv + uTexel * vec2(-0.5, 0.5)) + texture(tMap, vUv + uTexel * vec2(0.5, 0.5)));
  float level = max(c.r, max(c.g, c.b));
  fragColor = vec4(c.rgb * smoothstep(uThreshold, uThreshold + 0.4, level), 1.0);
}
`;
export const blurFragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D tMap;
uniform vec2 uStep;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec3 sum = texture(tMap, vUv).rgb * 0.227027;
  sum += (texture(tMap, vUv + uStep * 1.3846).rgb + texture(tMap, vUv - uStep * 1.3846).rgb) * 0.316216;
  sum += (texture(tMap, vUv + uStep * 3.2308).rgb + texture(tMap, vUv - uStep * 3.2308).rgb) * 0.070270;
  fragColor = vec4(sum, 1.0);
}
`;
export const compositeFragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uStrength;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec4 scene = texture(tScene, vUv);
  vec3 bloom = texture(tBloom, vUv).rgb * uStrength;
  vec3 color = scene.rgb + bloom;
  fragColor = vec4(color, clamp(max(scene.a, max(bloom.r, max(bloom.g, bloom.b))), 0.0, 1.0));
}
`;
