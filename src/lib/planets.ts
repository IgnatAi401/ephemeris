// The planets for the solar-system view: sizes, looks, spin axes, and
// approximate positions from JPL's mean orbital elements (Standish,
// "Keplerian Elements for Approximate Positions of the Major Planets",
// Table 1, valid 1800–2050; good to about an arcminute for the inner planets
// and a few for the outer ones). A mission's own file gives the exact
// position of every body it meets; these fill in the rest and draw the
// orbits. Positions are heliocentric, ICRF (J2000 equatorial), in km.

export type BodyKey =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'arrokoth';

type Look = {
  /** Base colour and the colour of its bands or markings. */
  color: string;
  band: string;
  /** Latitude band frequency (0: none) and contrast; noise contrast. */
  bands: number;
  contrast: number;
  noise: number;
  rings?: boolean;
};
export type Body = Look & {
  key: BodyKey;
  en: string;
  zh: string;
  radius: number;
  /** North pole, J2000 right ascension and declination (degrees, IAU). */
  pole: [number, number];
  /** Mean elements at J2000 and their rates per Julian century: a (AU),
   * e, I, L, long. of perihelion, long. of ascending node (degrees). */
  elements?: readonly [number, number][];
};

export const AU_KM = 1.495978707e8;
export const SUN_RADIUS_KM = 695700;

export const BODIES: readonly Body[] = [
  {
    key: 'mercury',
    en: 'Mercury',
    zh: '水星',
    radius: 2439.7,
    pole: [281.01, 61.42],
    color: '#a29c94',
    band: '#6f6a64',
    bands: 0,
    contrast: 0,
    noise: 0.5,
    elements: [
      [0.38709927, 0.00000037],
      [0.20563593, 0.00001906],
      [7.00497902, -0.00594749],
      [252.2503235, 149472.67411175],
      [77.45779628, 0.16047689],
      [48.33076593, -0.12534081],
    ],
  },
  {
    key: 'venus',
    en: 'Venus',
    zh: '金星',
    radius: 6051.8,
    pole: [272.76, 67.16],
    color: '#e8d7a8',
    band: '#c9b27a',
    bands: 3,
    contrast: 0.15,
    noise: 0.15,
    elements: [
      [0.72333566, 0.0000039],
      [0.00677672, -0.00004107],
      [3.39467605, -0.0007889],
      [181.9790995, 58517.81538729],
      [131.60246718, 0.00268329],
      [76.67984255, -0.27769418],
    ],
  },
  {
    key: 'earth',
    en: 'Earth',
    zh: '地球',
    radius: 6378.137,
    pole: [0, 90],
    color: '#5b8fd6',
    band: '#ffffff',
    bands: 0,
    contrast: 0,
    noise: 0,
    // The Earth–Moon barycentre.
    elements: [
      [1.00000261, 0.00000562],
      [0.01671123, -0.00004392],
      [-0.00001531, -0.01294668],
      [100.46457166, 35999.37244981],
      [102.93768193, 0.32327364],
      [0, 0],
    ],
  },
  {
    key: 'mars',
    en: 'Mars',
    zh: '火星',
    radius: 3389.5,
    pole: [317.27, 54.43],
    color: '#c9653c',
    band: '#7c3a22',
    bands: 0,
    contrast: 0,
    noise: 0.55,
    elements: [
      [1.52371034, 0.00001847],
      [0.0933941, 0.00007882],
      [1.84969142, -0.00813131],
      [-4.55343205, 19140.30268499],
      [-23.94362959, 0.44441088],
      [49.55953891, -0.29257343],
    ],
  },
  {
    key: 'jupiter',
    en: 'Jupiter',
    zh: '木星',
    radius: 69911,
    pole: [268.06, 64.5],
    color: '#e3cfae',
    band: '#a5714a',
    bands: 9,
    contrast: 0.55,
    noise: 0.25,
    elements: [
      [5.202887, -0.00011607],
      [0.04838624, -0.00013253],
      [1.30439695, -0.00183714],
      [34.39644051, 3034.74612775],
      [14.72847983, 0.21252668],
      [100.47390909, 0.20469106],
    ],
  },
  {
    key: 'saturn',
    en: 'Saturn',
    zh: '土星',
    radius: 58232,
    pole: [40.59, 83.54],
    color: '#e6d3a3',
    band: '#b99a62',
    bands: 7,
    contrast: 0.3,
    noise: 0.12,
    rings: true,
    elements: [
      [9.53667594, -0.0012506],
      [0.05386179, -0.00050991],
      [2.48599187, 0.00193609],
      [49.95424423, 1222.49362201],
      [92.59887831, -0.41897216],
      [113.66242448, -0.28867794],
    ],
  },
  {
    key: 'uranus',
    en: 'Uranus',
    zh: '天王星',
    radius: 25362,
    pole: [257.31, -15.18],
    color: '#a9dde2',
    band: '#8cc5cc',
    bands: 3,
    contrast: 0.08,
    noise: 0.04,
    elements: [
      [19.18916464, -0.00196176],
      [0.04725744, -0.00004397],
      [0.77263783, -0.00242939],
      [313.23810451, 428.48202785],
      [170.9542763, 0.40805281],
      [74.01692503, 0.04240589],
    ],
  },
  {
    key: 'neptune',
    en: 'Neptune',
    zh: '海王星',
    radius: 24622,
    pole: [299.36, 43.46],
    color: '#4f7fe0',
    band: '#2f55b0',
    bands: 4,
    contrast: 0.25,
    noise: 0.15,
    elements: [
      [30.06992276, 0.00026291],
      [0.00859048, 0.00005105],
      [1.77004347, 0.00035372],
      [-55.12002969, 218.45945325],
      [44.96476227, -0.32241464],
      [131.78422574, -0.00508664],
    ],
  },
  {
    key: 'pluto',
    en: 'Pluto',
    zh: '冥王星',
    radius: 1188.3,
    pole: [132.99, -6.16],
    color: '#d8c3a5',
    band: '#8a6a52',
    bands: 0,
    contrast: 0,
    noise: 0.6,
    elements: [
      [39.48211675, -0.00031596],
      [0.2488273, 0.0000517],
      [17.14001206, 0.00004818],
      [238.92903833, 145.20780515],
      [224.06891629, -0.04062942],
      [110.30393684, -0.01183482],
    ],
  },
  {
    // A Kuiper-belt object: no mean elements, only New Horizons' own file.
    key: 'arrokoth',
    en: 'Arrokoth',
    zh: '阿罗科斯',
    radius: 18,
    pole: [317.5, -24.9],
    color: '#a8634a',
    band: '#6e3b2c',
    bands: 0,
    contrast: 0,
    noise: 0.5,
  },
];
export const bodyByKey = (key: string) =>
  BODIES.find((body) => body.key === key) ?? null;

const DEG = Math.PI / 180;
const OBLIQUITY = 23.43928 * DEG;
const DAY = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12);

/** Heliocentric position (km, ICRF) from mean elements at `time`, or false
 * for a body without them. `out` receives x, y, z. */
export function meanPosition(body: Body, time: number, out: number[]) {
  const elements = body.elements;
  if (!elements) return false;
  const T = (time - J2000) / DAY / 36525;
  const [a, e, I, L, perihelion, node] = elements.map(
    ([value, rate]) => value + rate * T,
  );
  const omega = (perihelion - node) * DEG;
  let M = ((L - perihelion) % 360) * DEG;
  if (M > Math.PI) M -= 2 * Math.PI;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 6; k++)
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  orbitToIcrf(x, y, omega, I * DEG, node * DEG, out);
  return true;
}

/** Points of the mean orbit around `time` (km, ICRF), `count` of them,
 * the last closing the ellipse. */
export function meanOrbit(body: Body, time: number, count: number) {
  const elements = body.elements;
  if (!elements) return [];
  const T = (time - J2000) / DAY / 36525;
  const [a, e, I, , perihelion, node] = elements.map(
    ([value, rate]) => value + rate * T,
  );
  const points: number[][] = [];
  for (let k = 0; k <= count; k++) {
    const E = (k / count) * 2 * Math.PI;
    const out = [0, 0, 0];
    orbitToIcrf(
      a * (Math.cos(E) - e),
      a * Math.sqrt(1 - e * e) * Math.sin(E),
      (perihelion - node) * DEG,
      I * DEG,
      node * DEG,
      out,
    );
    points.push(out);
  }
  return points;
}

/** In-plane (x toward perihelion) AU → heliocentric km, ICRF. */
function orbitToIcrf(
  x: number,
  y: number,
  omega: number,
  inclination: number,
  node: number,
  out: number[],
) {
  const [co, so] = [Math.cos(omega), Math.sin(omega)];
  const [ci, si] = [Math.cos(inclination), Math.sin(inclination)];
  const [cn, sn] = [Math.cos(node), Math.sin(node)];
  // Ecliptic J2000.
  const ex = (co * cn - so * sn * ci) * x + (-so * cn - co * sn * ci) * y;
  const ey = (co * sn + so * cn * ci) * x + (-so * sn + co * cn * ci) * y;
  const ez = so * si * x + co * si * y;
  const [ce, se] = [Math.cos(OBLIQUITY), Math.sin(OBLIQUITY)];
  out[0] = ex * AU_KM;
  out[1] = (ey * ce - ez * se) * AU_KM;
  out[2] = (ey * se + ez * ce) * AU_KM;
}

/** Unit north pole (ICRF) of `body`. */
export function poleOf(body: Body): [number, number, number] {
  const [ra, dec] = body.pole.map((value) => value * DEG);
  return [
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec),
  ];
}

/** The ecliptic J2000 axes in ICRF: the heliocentric view's camera turns in
 * these, so "up" is ecliptic north. */
export const ECLIPTIC_AXES = [
  [1, 0, 0],
  [0, Math.cos(OBLIQUITY), Math.sin(OBLIQUITY)],
  [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)],
] as const;
