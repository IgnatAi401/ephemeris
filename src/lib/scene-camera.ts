// The orbit view's perspective camera. It looks at `target` (Earth's centre
// unless a mission replay follows the Moon or a spacecraft) from `distance`
// Earth radii away; `zoom` keeps the meaning it had under the old
// orthographic camera (Earth radii from the centre of the frame to its edge,
// measured at the target's distance), so the presets and tweens carry over.

export type Vec3 = [number, number, number];

export const FOV = (32 * Math.PI) / 180;
const TAN_HALF = Math.tan(FOV / 2);

export type Camera = {
  zoom: number;
  width: number;
  height: number;
  center: [number, number];
  /** Pixels per unit of tangent: focal length of the pinhole, in px. */
  focal: number;
  /** Pixels per Earth radius at the target's distance. */
  scale: number;
  distance: number;
  position: Vec3;
  /** Unit vectors: screen right, screen up, and from Earth toward the camera. */
  right: Vec3;
  up: Vec3;
  toward: Vec3;
  near: number;
};

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Half the frame, in px, that `zoom` Earth radii span. */
export const frameHalf = (width: number, height: number) =>
  Math.min(width / 1.6, height) / 2;
export const focalLength = (height: number) => height / 2 / TAN_HALF;

/** The camera orientation for a latitude `elevation` and an absolute
 * longitude `phi` of the viewing direction. */
export function basis(elevation: number, phi: number, roll = 0) {
  const toward: Vec3 = [
    Math.cos(elevation) * Math.cos(phi),
    Math.cos(elevation) * Math.sin(phi),
    Math.sin(elevation),
  ];
  const right: Vec3 = [-Math.sin(phi), Math.cos(phi), 0];
  const up: Vec3 = [
    toward[1] * right[2] - toward[2] * right[1],
    toward[2] * right[0] - toward[0] * right[2],
    toward[0] * right[1] - toward[1] * right[0],
  ];
  if (!roll) return { toward, right, up };
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return {
    toward,
    right: right.map((value, axis) => value * c + up[axis] * s) as Vec3,
    up: up.map((value, axis) => value * c - right[axis] * s) as Vec3,
  };
}

/** Re-express the displayed camera in a new reference frame, preserving
 * its position, aim and screen orientation (including roll). */
export function reframeCamera(
  camera: Camera,
  axes: readonly (readonly number[])[],
) {
  const toward = axes.map((axis) => dot(axis, camera.toward));
  const right = axes.map((axis) => dot(axis, camera.right));
  const elevation = Math.asin(Math.max(-1, Math.min(1, toward[2])));
  const azimuth = Math.atan2(toward[1], toward[0]);
  const local = basis(elevation, azimuth);
  const target = camera.position.map(
    (value, axis) => value - camera.toward[axis] * camera.distance,
  );
  return {
    zoom: camera.zoom,
    elevation,
    azimuth,
    roll: Math.atan2(dot(right, local.up), dot(right, local.right)),
    target: axes.map((axis) => dot(axis, target)),
  };
}

export function makeCamera(
  width: number,
  height: number,
  zoom: number,
  orientation: ReturnType<typeof basis>,
  target: readonly number[] = [0, 0, 0],
): Camera {
  const focal = focalLength(height);
  const scale = frameHalf(width, height) / zoom;
  const distance = focal / scale;
  const { toward, right, up } = orientation;
  return {
    zoom,
    width,
    height,
    center: [width / 2, height / 2],
    focal,
    scale,
    distance,
    position: [
      target[0] + toward[0] * distance,
      target[1] + toward[1] * distance,
      target[2] + toward[2] * distance,
    ],
    right,
    up,
    toward,
    near: 0.05,
  };
}

/** Screen px and depth of `p`; x and y are NaN behind the camera. */
export function project(camera: Camera, p: readonly number[]): Vec3 {
  const rel = [
    p[0] - camera.position[0],
    p[1] - camera.position[1],
    p[2] - camera.position[2],
  ];
  const z = -dot(rel, camera.toward);
  if (z < camera.near) return [Number.NaN, Number.NaN, z];
  const k = camera.focal / z;
  return [
    camera.center[0] + dot(rel, camera.right) * k,
    camera.center[1] - dot(rel, camera.up) * k,
    z,
  ];
}

/** 0: in clear view; 1: behind (or inside) a sphere of `radius` at
 * `center` (the origin by default); 2: in front of that sphere's disc. */
export function earthCover(
  camera: Camera,
  point: readonly number[],
  radius: number,
  center?: readonly number[],
) {
  const p = center
    ? [point[0] - center[0], point[1] - center[1], point[2] - center[2]]
    : point;
  const r2 = radius * radius;
  if (dot(p, p) < r2) return 1;
  const o = center
    ? [
        camera.position[0] - center[0],
        camera.position[1] - center[1],
        camera.position[2] - center[2],
      ]
    : camera.position;
  const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const length = Math.hypot(d[0], d[1], d[2]);
  const b = dot(o, d) / length;
  const disc = b * b - (dot(o, o) - r2);
  if (disc <= 0) return 0;
  const t = -b - Math.sqrt(disc);
  if (t < 0) return 0;
  return t < length ? 1 : 2;
}

/** The zoom that keeps the Moon (`moon`, Earth radii) inside the frame, at
 * least `minimum`: 35% of the width and 31% of the height from the centre. */
export function zoomToFit(
  width: number,
  height: number,
  moon: readonly number[],
  orientation: ReturnType<typeof basis>,
  minimum: number,
) {
  const focal = focalLength(height);
  const x = Math.abs(dot(moon, orientation.right));
  const y = Math.abs(dot(moon, orientation.up));
  const z = dot(moon, orientation.toward);
  // Projected offset x·f / (D − z) must stay within the margin.
  const distance = Math.max(
    z + (x * focal) / (0.35 * width),
    z + (y * focal) / (0.31 * height),
  );
  return Math.max(minimum, (distance * frameHalf(width, height)) / focal);
}
