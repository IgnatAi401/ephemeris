// Two-body orbits from classical elements, for the teaching views: the
// six-element demo and the example orbits drawn in the scene. Distances in
// Earth radii, angles in radians, in the scene's inertial frame (x toward
// the vernal equinox, z toward the north pole).

export type Elements = {
  /** Semi-major axis, Earth radii. */
  a: number;
  e: number;
  /** Inclination. */
  i: number;
  /** Right ascension of the ascending node, from the vernal equinox. */
  raan: number;
  /** Argument of perigee, from the ascending node. */
  argp: number;
  /** Mean anomaly. */
  M: number;
};

const MU = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;

/** True anomaly for mean anomaly `M` (Kepler's equation by Newton). */
export function trueAnomaly(M: number, e: number) {
  let E = e < 0.8 ? M : Math.PI;
  for (let step = 0; step < 12; step++)
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return (
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    )
  );
}

/** Position at true anomaly `nu`. */
export function orbitPoint(el: Elements, nu: number): [number, number, number] {
  const r = (el.a * (1 - el.e * el.e)) / (1 + el.e * Math.cos(nu));
  const u = el.argp + nu;
  const [cO, sO, cu, su, ci, si] = [
    Math.cos(el.raan),
    Math.sin(el.raan),
    Math.cos(u),
    Math.sin(u),
    Math.cos(el.i),
    Math.sin(el.i),
  ];
  return [
    r * (cO * cu - sO * su * ci),
    r * (sO * cu + cO * su * ci),
    r * su * si,
  ];
}

/** Unit vector of the ascending node. */
export const nodeDirection = (el: Elements): [number, number, number] => [
  Math.cos(el.raan),
  Math.sin(el.raan),
  0,
];

/** Orbital period, minutes. */
export const periodMinutes = (a: number) =>
  (2 * Math.PI * Math.sqrt((a * EARTH_RADIUS_KM) ** 3 / MU)) / 60;

/** Perigee and apogee altitudes, km. */
export const apsides = (el: Pick<Elements, 'a' | 'e'>) => [
  el.a * (1 - el.e) * EARTH_RADIUS_KM - EARTH_RADIUS_KM,
  el.a * (1 + el.e) * EARTH_RADIUS_KM - EARTH_RADIUS_KM,
];
