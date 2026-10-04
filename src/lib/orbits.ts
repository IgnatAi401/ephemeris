// Orbital mechanics for the orbit view. Everything is in an Earth-
// centred inertial frame (TEME ≈ true equator of date) measured in Earth radii,
// with z toward the north pole. Accuracy targets a picture where one pixel is
// tens of kilometres, not orbit determination.

const MU = 398600.4418; // km³/s²
export const EARTH_RADIUS_KM = 6378.137;
export const MOON_RADIUS = 1737.4 / EARTH_RADIUS_KM;
const J2 = 1.08262668e-3;
// sqrt(μ / R³) in 1/min: SGP4's canonical mean-motion unit.
const XKE = 60 / Math.sqrt(EARTH_RADIUS_KM ** 3 / MU);
const DAY = 86400000;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** Every satellite group, in the order of the arrays in orbits.json. `group`
 * is the CelesTrak GP group it is downloaded from (scripts/fetch-orbits.mjs);
 * the first seven keep the order the scene was designed around. */
export const CONSTELLATIONS = [
  {
    key: 'starlink',
    kind: 'leo',
    group: 'starlink',
    en: 'Starlink',
    zh: '星链',
    color: '#9ec5ff',
  },
  {
    key: 'iridium',
    kind: 'leo',
    group: 'iridium-NEXT',
    en: 'Iridium',
    zh: '铱星',
    color: '#6ef0d2',
  },
  {
    key: 'orbcomm',
    kind: 'leo',
    group: 'orbcomm',
    en: 'ORBCOMM',
    zh: '轨道通信',
    color: '#f7a8ff',
  },
  {
    key: 'gps',
    kind: 'gnss',
    group: 'gps-ops',
    en: 'GPS',
    zh: 'GPS',
    color: '#ffd166',
  },
  {
    key: 'glonass',
    kind: 'gnss',
    group: 'glo-ops',
    en: 'GLONASS',
    zh: '格洛纳斯',
    color: '#ff8a7a',
  },
  {
    key: 'galileo',
    kind: 'gnss',
    group: 'galileo',
    en: 'Galileo',
    zh: '伽利略',
    color: '#8fb0ff',
  },
  {
    key: 'beidou',
    kind: 'gnss',
    group: 'beidou',
    en: 'BeiDou',
    zh: '北斗',
    color: '#ff6f9f',
  },
  {
    key: 'stations',
    kind: 'station',
    group: 'stations',
    en: 'Space stations',
    zh: '空间站',
    color: '#ffffff',
  },
  {
    key: 'qianfan',
    kind: 'leo',
    group: 'qianfan',
    en: 'Qianfan',
    zh: '千帆',
    color: '#7fd8ff',
  },
  {
    key: 'guowang',
    kind: 'leo',
    group: 'hulianwang',
    en: 'Guowang',
    zh: '国网',
    color: '#ffb86b',
  },
  {
    key: 'geo',
    kind: 'geo',
    group: 'geo',
    en: 'Geostationary',
    zh: '地球静止轨道',
    color: '#c9b6ff',
  },
  {
    key: 'debrisFy1c',
    kind: 'debris',
    group: 'fengyun-1c-debris',
    en: 'Fengyun-1C debris',
    zh: '风云一号C碎片',
    color: '#ff8f6b',
  },
  {
    key: 'debrisCosmos2251',
    kind: 'debris',
    group: 'cosmos-2251-debris',
    en: 'Cosmos 2251 debris',
    zh: '宇宙2251碎片',
    color: '#f2a65a',
  },
  {
    key: 'debrisIridium33',
    kind: 'debris',
    group: 'iridium-33-debris',
    en: 'Iridium 33 debris',
    zh: '铱星33碎片',
    color: '#e0b07a',
  },
  {
    key: 'recent',
    kind: 'new',
    group: 'last-30-days',
    en: 'Other new launches',
    zh: '其他新发射',
    color: '#b8ff8a',
  },
] as const;
export type ConstellationKey = (typeof CONSTELLATIONS)[number]['key'];
export type ConstellationKind = (typeof CONSTELLATIONS)[number]['kind'];

/** public/data/orbits.json, written by scripts/fetch-orbits.mjs. Each group
 * is a flat array of seven numbers per satellite (see `fields`); `recent`
 * lists, per group, the indices of satellites launched in the last 30 days. */
export type OrbitSnapshot = {
  source: string;
  fetched: string;
  reference: number;
  groups: Partial<Record<ConstellationKey, number[]>>;
  recent?: Partial<Record<ConstellationKey, number[]>>;
};
const STRIDE = 7;

/** Mean elements plus J2 secular rates, one entry per satellite, laid out as
 * flat arrays so ten thousand of them propagate in a couple of milliseconds. */
export type Fleet = ReturnType<typeof createFleet>;

export function createFleet(snapshot: OrbitSnapshot) {
  const rows = CONSTELLATIONS.map(({ key }) => snapshot.groups[key] ?? []);
  const count = rows.reduce((sum, row) => sum + row.length / STRIDE, 0);
  const make = () => new Float64Array(count);
  const fleet = {
    count,
    fetched: Date.parse(snapshot.fetched),
    counts: rows.map((row) => row.length / STRIDE),
    group: new Uint8Array(count),
    /** 1 for satellites launched in the last 30 days. */
    recent: new Uint8Array(count),
    /** The element sets as fetched, seven per satellite (orbits.json
     * `fields`, epoch as Unix ms), for SGP4 on a selected satellite. */
    elements: new Float64Array(count * STRIDE),
    /** Index of each group's first satellite. */
    starts: [] as number[],
    epoch: make(),
    a: make(),
    e: make(),
    root: make(),
    cosI: make(),
    sinI: make(),
    raan: make(),
    raanDot: make(),
    argp: make(),
    argpDot: make(),
    anomaly: make(),
    anomalyDot: make(),
  };
  let index = 0;
  rows.forEach((row, group) => {
    const first = index;
    fleet.starts.push(first);
    for (const at of snapshot.recent?.[CONSTELLATIONS[group].key] ?? [])
      fleet.recent[first + at] = 1;
    for (let offset = 0; offset < row.length; offset += STRIDE, index++) {
      const [days, motion, e, inclination, raan, argp, anomaly] = row.slice(
        offset,
        offset + STRIDE,
      );
      fleet.elements.set(
        [
          snapshot.reference + days * DAY,
          motion,
          e,
          inclination,
          raan,
          argp,
          anomaly,
        ],
        index * STRIDE,
      );
      const i = inclination * DEG;
      const cos = Math.cos(i);
      const beta2 = 1 - e * e;
      // Recover the Brouwer mean motion and semi-major axis from the Kozai
      // mean motion in the element set, as SGP4 does on initialisation.
      let n = (motion * TAU) / 1440;
      const d1 = (0.75 * J2 * (3 * cos * cos - 1)) / beta2 ** 1.5;
      const a1 = (XKE / n) ** (2 / 3);
      let del = d1 / (a1 * a1);
      const a0 = a1 * (1 - del * del - del * (1 / 3 + (134 * del * del) / 81));
      del = d1 / (a0 * a0);
      n /= 1 + del;
      const a = (XKE / n) ** (2 / 3);
      const p = a * beta2;
      const k = (n * J2) / (p * p);
      fleet.group[index] = group;
      fleet.epoch[index] = snapshot.reference + days * DAY;
      fleet.a[index] = a;
      fleet.e[index] = e;
      fleet.root[index] = Math.sqrt(beta2);
      fleet.cosI[index] = cos;
      fleet.sinI[index] = Math.sin(i);
      fleet.raan[index] = raan * DEG;
      fleet.argp[index] = argp * DEG;
      fleet.anomaly[index] = anomaly * DEG;
      // Rates per millisecond.
      fleet.raanDot[index] = (-1.5 * k * cos) / 60000;
      fleet.argpDot[index] = (0.75 * k * (5 * cos * cos - 1)) / 60000;
      fleet.anomalyDot[index] =
        (n + 0.75 * k * Math.sqrt(beta2) * (3 * cos * cos - 1)) / 60000;
    }
  });
  return fleet;
}

/** One satellite at `time` (Unix ms), written as xyz at `out[offset]`. */
export function positionAt(
  fleet: Fleet,
  index: number,
  time: number,
  out: Float32Array,
  offset: number,
) {
  const dt = time - fleet.epoch[index];
  const ecc = fleet.e[index];
  const mean = fleet.anomaly[index] + fleet.anomalyDot[index] * dt;
  let E = mean + ecc * Math.sin(mean);
  for (let step = 0; step < 3; step++)
    E -= (E - ecc * Math.sin(E) - mean) / (1 - ecc * Math.cos(E));
  const xp = fleet.a[index] * (Math.cos(E) - ecc);
  const yp = fleet.a[index] * fleet.root[index] * Math.sin(E);
  const w = fleet.argp[index] + fleet.argpDot[index] * dt;
  const node = fleet.raan[index] + fleet.raanDot[index] * dt;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(node);
  const sn = Math.sin(node);
  const x1 = xp * cw - yp * sw;
  const y1 = xp * sw + yp * cw;
  out[offset] = x1 * cn - y1 * fleet.cosI[index] * sn;
  out[offset + 1] = x1 * sn + y1 * fleet.cosI[index] * cn;
  out[offset + 2] = y1 * fleet.sinI[index];
}

/** Positions of every satellite at `time`, written as xyz triples. */
export function propagate(fleet: Fleet, time: number, out: Float32Array) {
  for (let index = 0; index < fleet.count; index++)
    positionAt(fleet, index, time, out, index * 3);
}

/** Orbital period in milliseconds. */
export const period = (fleet: Fleet, index: number) =>
  (2 * Math.PI) / fleet.anomalyDot[index];

const julianDays = (time: number) => time / DAY + 2440587.5 - 2451545;
const mod = (value: number, range: number) => ((value % range) + range) % range;

/** Greenwich mean sidereal time (IAU 1982), radians: how far the prime
 * meridian has turned from the vernal equinox. */
export function siderealAngle(time: number) {
  const d = julianDays(time);
  const T = d / 36525;
  return (
    mod(
      280.46061837 +
        360.98564736629 * d +
        0.000387933 * T * T -
        (T * T * T) / 38710000,
      360,
    ) * DEG
  );
}

const obliquity = (d: number) => (23.439 - 0.0000004 * d) * DEG;
function fromEcliptic(
  longitude: number,
  latitude: number,
  distance: number,
  d: number,
): [number, number, number] {
  const e = obliquity(d);
  const x = Math.cos(latitude) * Math.cos(longitude);
  const y = Math.cos(latitude) * Math.sin(longitude);
  const z = Math.sin(latitude);
  return [
    distance * x,
    distance * (y * Math.cos(e) - z * Math.sin(e)),
    distance * (y * Math.sin(e) + z * Math.cos(e)),
  ];
}

/** Unit vector toward the Sun (Astronomical Almanac low-precision, ~0.01°). */
export function sunDirection(time: number) {
  const d = julianDays(time);
  const L = (280.46 + 0.9856474 * d) * DEG;
  const g = (357.528 + 0.9856003 * d) * DEG;
  return fromEcliptic(
    L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG,
    0,
    1,
    d,
  );
}

/** Geocentric Moon in Earth radii (Astronomical Almanac low-precision series,
 * ~0.3° in direction and ~0.2% in distance). */
export function moonPosition(time: number) {
  const d = julianDays(time);
  const T = d / 36525;
  const s = (a: number, b: number) => Math.sin((a + b * T) * DEG);
  const c = (a: number, b: number) => Math.cos((a + b * T) * DEG);
  const longitude =
    218.32 +
    481267.881 * T +
    6.29 * s(135, 477198.87) -
    1.27 * s(259.3, -413335.36) +
    0.66 * s(235.7, 890534.22) +
    0.21 * s(269.9, 954397.74) -
    0.19 * s(357.5, 35999.05) -
    0.11 * s(186.5, 966404.03);
  const latitude =
    5.13 * s(93.3, 483202.02) +
    0.28 * s(228.2, 960400.89) -
    0.28 * s(318.3, 6003.15) -
    0.17 * s(217.6, -407332.21);
  const parallax =
    0.9508 +
    0.0518 * c(135, 477198.87) +
    0.0095 * c(259.3, -413335.36) +
    0.0078 * c(235.7, 890534.22) +
    0.0028 * c(269.9, 954397.74);
  return fromEcliptic(
    longitude * DEG,
    latitude * DEG,
    1 / Math.sin(parallax * DEG),
    d,
  );
}

/** A point on the surface (spherical Earth) in the inertial frame. */
export function groundPoint(
  latitude: number,
  longitude: number,
  time: number,
): [number, number, number] {
  const lon = longitude * DEG + siderealAngle(time);
  const lat = latitude * DEG;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
}

/** Elevation (radians) of `target` above the horizon of ground point `site`. */
export function elevation(
  site: readonly number[],
  target: ArrayLike<number>,
  offset = 0,
) {
  const dx = target[offset] - site[0];
  const dy = target[offset + 1] - site[1];
  const dz = target[offset + 2] - site[2];
  return Math.asin(
    (dx * site[0] + dy * site[1] + dz * site[2]) / Math.hypot(dx, dy, dz),
  );
}

/** Illuminated fraction of the Moon's disc as seen from Earth, and whether it
 * is waxing. */
export function moonPhase(time: number) {
  const sun = sunDirection(time);
  const moon = moonPosition(time);
  const distance = Math.hypot(...moon);
  const elongation = Math.acos(
    (sun[0] * moon[0] + sun[1] * moon[1] + sun[2] * moon[2]) / distance,
  );
  // Waxing while the Moon runs east of the Sun: the cross product points north.
  const waxing = sun[0] * moon[1] - sun[1] * moon[0] > 0;
  return { illuminated: (1 - Math.cos(elongation)) / 2, waxing, distance };
}
