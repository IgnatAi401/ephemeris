// JPL Horizons snapshots for spacecraft beyond the constellations, written by
// scripts/fetch-orbits.mjs: state vectors for the Sun–Earth L1/L2 spacecraft
// and osculating elements for the lunar orbiters.

const DEG = Math.PI / 180;

export type SpacecraftSnapshot = {
  fetched: string;
  start: number;
  stop: number;
  /** Tracks whose Horizons ephemeris ends before `stop`. */
  stops?: Record<string, number>;
  vectors: { step: number; tracks: Record<string, number[]> };
  lunar: { step: number; tracks: Record<string, number[]> };
};

export const DEEP_SPACECRAFT = [
  { key: 'soho', en: 'SOHO', zh: 'SOHO', color: '#ffc37a' },
  { key: 'jwst', en: 'JWST', zh: '韦伯望远镜', color: '#d9b8ff' },
  { key: 'euclid', en: 'Euclid', zh: '欧几里得', color: '#8fe3ff' },
] as const;
export const LUNAR_ORBITERS = [
  { key: 'lro', en: 'LRO', zh: 'LRO', color: '#ffe08a' },
  { key: 'danuri', en: 'Danuri', zh: 'Danuri', color: '#8ff0c8' },
] as const;

/** Geocentric position (km, mean equator of date) at `time`, by cubic
 * Hermite interpolation of the 6-hourly state vectors; false outside the
 * snapshot. */
export function vectorAt(
  snapshot: SpacecraftSnapshot,
  key: string,
  time: number,
  out: number[],
) {
  const track = snapshot.vectors.tracks[key];
  const step = snapshot.vectors.step;
  if (!track) return false;
  const u = (time - snapshot.start) / step;
  const index = Math.floor(u);
  if (index < 0 || (index + 1) * 6 >= track.length) return false;
  const t = u - index;
  const [h00, h10, h01, h11] = [
    2 * t ** 3 - 3 * t ** 2 + 1,
    t ** 3 - 2 * t ** 2 + t,
    -2 * t ** 3 + 3 * t ** 2,
    t ** 3 - t ** 2,
  ];
  const seconds = step / 1000;
  for (let axis = 0; axis < 3; axis++) {
    const a = track[index * 6 + axis];
    const b = track[(index + 1) * 6 + axis];
    const va = track[index * 6 + 3 + axis] * seconds;
    const vb = track[(index + 1) * 6 + 3 + axis] * seconds;
    out[axis] = h00 * a + h10 * va + h01 * b + h11 * vb;
  }
  return true;
}

/** Moon-centred position (km) at `time`: two-body motion from the nearest
 * osculating element set, at most an hour away; false outside the snapshot. */
export function lunarAt(
  snapshot: SpacecraftSnapshot,
  key: string,
  time: number,
  out: number[],
) {
  const track = snapshot.lunar.tracks[key];
  const step = snapshot.lunar.step;
  if (!track) return false;
  const index = Math.round((time - snapshot.start) / step);
  if (index < 0 || index * 7 >= track.length) return false;
  const [a, e, inclination, node, argp, anomaly, motion] = track.slice(
    index * 7,
    index * 7 + 7,
  );
  const mean =
    (anomaly + motion * ((time - snapshot.start - index * step) / 1000)) * DEG;
  let E = mean + e * Math.sin(mean);
  for (let iteration = 0; iteration < 4; iteration++)
    E -= (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(argp * DEG);
  const sw = Math.sin(argp * DEG);
  const cn = Math.cos(node * DEG);
  const sn = Math.sin(node * DEG);
  const ci = Math.cos(inclination * DEG);
  const si = Math.sin(inclination * DEG);
  const x1 = xp * cw - yp * sw;
  const y1 = xp * sw + yp * cw;
  out[0] = x1 * cn - y1 * ci * sn;
  out[1] = x1 * sn + y1 * ci * cn;
  out[2] = y1 * si;
  return true;
}

/** Orbital period (ms) of a lunar orbiter near `time`. */
export function lunarPeriod(
  snapshot: SpacecraftSnapshot,
  key: string,
  time: number,
) {
  const track = snapshot.lunar.tracks[key];
  const index = Math.min(
    track.length / 7 - 1,
    Math.max(0, Math.round((time - snapshot.start) / snapshot.lunar.step)),
  );
  return (360 / track[index * 7 + 6]) * 1000;
}
