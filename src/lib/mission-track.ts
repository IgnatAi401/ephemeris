// A mission's trajectory (public/missions/<id>.json, see
// scripts/fetch-missions.mjs), interpolated with cubic Hermite splines.
// Earth–Moon missions: thinned geocentric state vectors for each spacecraft
// and three-hourly ones for the Moon. Interplanetary missions: heliocentric
// vectors for the spacecraft and for every body they meet (the other planets
// come from mean elements, lib/planets.ts). Everything handed to the scene is
// in Earth radii, around Earth or the Sun respectively.
import { EARTH_RADIUS_KM, sunDirection } from '@/lib/orbits';
import type { FrameId, MissionId } from '@/lib/missions';
import {
  BODIES,
  ECLIPTIC_AXES,
  bodyByKey,
  meanPosition,
  type BodyKey,
} from '@/lib/planets';

type Vec3 = [number, number, number];
type Series = { key: string; t: number[]; s: number[] };
type TrackFile =
  | {
      kind?: 'geo';
      start: number;
      stop: number;
      craft: Series[];
      moon: { start: number; step: number; s: number[] };
    }
  | {
      kind: 'helio';
      start: number;
      stop: number;
      craft: Series[];
      bodies: Series[];
    };
const KM = 1 / EARTH_RADIUS_KM;
// The Moon's mean distance, Earth radii: the Earth–Moon rotating frame
// scales every distance by this over the Moon's distance at the time, so
// the Moon stays put while its orbit swings 40,000 km in and out.
const MOON_MEAN = 384400 * KM;
const HOUR = 3600000;
// The ecliptic pole in the equatorial frame (obliquity 23.44°).
const OBLIQUITY = (23.4393 * Math.PI) / 180;
const POLE: Vec3 = [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)];

/** Hermite position (and, if asked, velocity) between state vectors at
 * offsets `a` and `b` of `s`, `h` seconds apart, at fraction `u`. */
function hermite(
  s: ArrayLike<number>,
  a: number,
  b: number,
  h: number,
  u: number,
  out: number[],
  velocity?: number[],
) {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  for (let axis = 0; axis < 3; axis++) {
    const pa = s[a + axis];
    const pb = s[b + axis];
    const va = s[a + 3 + axis] * h;
    const vb = s[b + 3 + axis] * h;
    out[axis] = h00 * pa + h10 * va + h01 * pb + h11 * vb;
    if (velocity)
      velocity[axis] =
        ((6 * u2 - 6 * u) * pa +
          (3 * u2 - 4 * u + 1) * va +
          (-6 * u2 + 6 * u) * pb +
          (3 * u2 - 2 * u) * vb) /
        h;
  }
}

export type CraftTrack = {
  key: string;
  start: number;
  stop: number;
  /** Position (Earth radii, around Earth or the Sun) and, optionally,
   * velocity (km/s) at `time`; false outside the track. */
  at: (time: number, out: number[], velocity?: number[]) => boolean;
};

/** A thinned series of state vectors, interpolated. */
function series(start: number, { key, t, s }: Series): CraftTrack {
  const times = Float64Array.from(t, (value) => start + value * 1000);
  const states = Float64Array.from(s);
  const first = times[0];
  const last = times[times.length - 1];
  let hint = 0;
  return {
    key,
    start: first,
    stop: last,
    at(time, out, velocity) {
      if (!(time >= first && time <= last)) return false;
      // Frames ask for nearby times in turn: start from the last interval.
      let index = hint;
      if (!(times[index] <= time && time <= times[index + 1])) {
        let lo = 0;
        let hi = times.length - 1;
        while (hi - lo > 1) {
          const middle = (lo + hi) >> 1;
          if (times[middle] <= time) lo = middle;
          else hi = middle;
        }
        index = lo;
        hint = lo;
      }
      const h = (times[index + 1] - times[index]) / 1000;
      hermite(
        states,
        index * 6,
        index * 6 + 6,
        h,
        (time - times[index]) / (times[index + 1] - times[index]),
        out,
        velocity,
      );
      for (let axis = 0; axis < 3; axis++) out[axis] *= KM;
      return true;
    },
  };
}

export type MissionTrack = ReturnType<typeof createTrack>;

const cache = new Map<MissionId, Promise<MissionTrack>>();
/** Fetch a mission's trajectory once per visit. */
export function loadMissionTrack(id: MissionId) {
  let pending = cache.get(id);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}missions/${id}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<TrackFile>;
      })
      .then(createTrack);
    pending.catch(() => cache.delete(id));
    cache.set(id, pending);
  }
  return pending;
}

function createTrack(file: TrackFile) {
  const craft = file.craft.map((item) => series(file.start, item));
  const helio = file.kind === 'helio';

  const moonFile = file.kind === 'helio' ? null : file.moon;
  const moonStates = Float64Array.from(moonFile?.s ?? [0, 0, 0, 0, 0, 0]);
  const moonStep = (moonFile?.step ?? 1) * 1000;
  const moonCount = moonStates.length / 6;
  /** The Moon (Earth radii; velocity in km/s), clamped to the data; Earth's
   * centre in a heliocentric mission, which has no Moon of its own. */
  const moon = (time: number, out: number[], velocity?: number[]) => {
    if (!moonFile) {
      body('earth', time, out);
      return out;
    }
    const u = (time - moonFile.start) / moonStep;
    const index = Math.min(moonCount - 2, Math.max(0, Math.floor(u)));
    hermite(
      moonStates,
      index * 6,
      index * 6 + 6,
      moonFile.step,
      Math.min(1, Math.max(0, u - index)),
      out,
      velocity,
    );
    for (let axis = 0; axis < 3; axis++) out[axis] *= KM;
    return out;
  };

  // Heliocentric missions: the bodies met, exact; the rest from mean
  // elements.
  const met = new Map(
    (file.kind === 'helio' ? file.bodies : []).map((item) => [
      item.key,
      series(file.start, item),
    ]),
  );
  /** Heliocentric position of `key` (Earth radii); false if unknown. A
   * geocentric mission knows only Earth (the origin) and the Moon. */
  const body = (key: string, time: number, out: number[]) => {
    if (!helio) {
      if (key === 'moon') {
        moon(time, out);
        return true;
      }
      out[0] = out[1] = out[2] = 0;
      return key === 'earth';
    }
    if (met.get(key)?.at(time, out)) return true;
    const known = bodyByKey(key);
    if (!known || !meanPosition(known, time, out)) return false;
    for (let axis = 0; axis < 3; axis++) out[axis] *= KM;
    return true;
  };

  /** Origin, axes and scale of `frame` at `time`: a point's local
   * coordinates are its offset from the origin along the axes, times the
   * scale. */
  const basis = (frame: FrameId, time: number): Basis => {
    const origin: Vec3 = [0, 0, 0];
    // Around the Sun everything is measured in ecliptic axes, from the Sun
    // or from the body the frame is named after.
    if (helio) {
      if (frame !== 'sun') body(frame, time, origin);
      return { origin, axes: ECLIPTIC_AXES, scale: 1 };
    }
    if (frame === 'earth') return { origin, axes: IDENTITY, scale: 1 };
    if (frame === 'moon') {
      moon(time, origin);
      return { origin, axes: IDENTITY, scale: 1 };
    }
    if (frame === 'earthMoon') {
      const position = [0, 0, 0];
      const velocity = [0, 0, 0];
      moon(time, position, velocity);
      const x = unit(position);
      const z = unit(cross(position, velocity));
      return {
        origin,
        axes: [x, cross(z, x), z],
        scale: MOON_MEAN / Math.hypot(position[0], position[1], position[2]),
      };
    }
    const x = unit(sunDirection(time));
    return { origin, axes: [x, cross(POLE, x), POLE], scale: 1 };
  };

  /** Times along each craft's path, close enough that straight segments
   * look smooth: about 3° of arc around whatever is nearest (Earth or the
   * Moon; the Sun or a body met), and at least every three hours (ten days
   * around the Sun) so rotating frames bend the path too. */
  const longest = helio ? 240 * HOUR : 3 * HOUR;
  const centres = helio ? [...met.keys()] : ['moon'];
  const samples = craft.map((track) => {
    const times: number[] = [];
    const here = [0, 0, 0];
    const velocity = [0, 0, 0];
    const other = [0, 0, 0];
    let time = track.start;
    while (time < track.stop) {
      times.push(time);
      track.at(time, here, velocity);
      let near = Math.hypot(here[0], here[1], here[2]);
      for (const key of centres) {
        body(key, time, other);
        near = Math.min(
          near,
          Math.hypot(
            here[0] - other[0],
            here[1] - other[1],
            here[2] - other[2],
          ),
        );
      }
      const speed = Math.hypot(velocity[0], velocity[1], velocity[2]) * KM;
      const step = Math.min(
        longest,
        Math.max(10000, ((near * 0.05) / Math.max(speed, 1e-9)) * 1000),
      );
      time = Math.min(track.stop, time + step);
    }
    times.push(track.stop);
    return Float64Array.from(times);
  });

  // Local coordinates of every path sample, per frame, made on first use.
  const local = new Map<string, Float64Array>();
  const localPath = (index: number, frame: FrameId) => {
    const key = `${index}:${frame}`;
    let path = local.get(key);
    if (path) return path;
    const times = samples[index];
    path = new Float64Array(times.length * 3);
    const at = [0, 0, 0];
    for (let k = 0; k < times.length; k++) {
      craft[index].at(times[k], at);
      toLocal(basis(frame, times[k]), at, path, k * 3);
    }
    local.set(key, path);
    return path;
  };

  return {
    helio,
    start: Math.min(...craft.map((track) => track.start)),
    stop: Math.max(...craft.map((track) => track.stop)),
    craft,
    moon,
    body,
    /** Keys of the bodies the mission's file covers. */
    met: [...met.keys()] as BodyKey[],
    /** Bodies drawn in the heliocentric view. */
    bodies: helio
      ? BODIES.filter((item) => item.elements || met.has(item.key))
      : [],
    basis,
    /** Sample times of craft `index`'s drawn path. */
    times: (index: number) => samples[index],
    localPath,
    /** Where a geocentric point `p` at `time` is drawn at `now` in `frame`. */
    shift(frame: FrameId, time: number, now: number, p: readonly number[]) {
      const out = new Float64Array(3);
      toLocal(basis(frame, time), p, out, 0);
      return fromLocal(basis(frame, now), out, 0, [0, 0, 0]);
    },
  };
}

const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
] as const;
export type Basis = {
  origin: readonly number[];
  axes: readonly (readonly number[])[];
  scale: number;
};
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v: readonly number[]): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};
function toLocal(
  { origin, axes, scale }: Basis,
  p: readonly number[],
  out: Float64Array,
  at: number,
) {
  const d = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
  for (let axis = 0; axis < 3; axis++)
    out[at + axis] =
      (d[0] * axes[axis][0] + d[1] * axes[axis][1] + d[2] * axes[axis][2]) *
      scale;
}
/** Local coordinates at `at` in `path`, back in the scene frame. */
export function fromLocal(
  { origin, axes, scale }: Basis,
  path: ArrayLike<number>,
  at: number,
  out: number[],
) {
  const [a, b, c] = [
    path[at] / scale,
    path[at + 1] / scale,
    path[at + 2] / scale,
  ];
  for (let axis = 0; axis < 3; axis++)
    out[axis] =
      origin[axis] + a * axes[0][axis] + b * axes[1][axis] + c * axes[2][axis];
  return out;
}
