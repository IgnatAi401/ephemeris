import { precession } from './horizons.mjs';
import { siderealAngle } from '../../src/lib/orbits.ts';

// Orbital mechanics for scripts/reconstruct-missions.mjs: the force model,
// an adaptive Dormand–Prince 5(4) integrator, coordinate conversions, the
// Moon's and Mars' orientation, a least-norm Newton solver for targeting
// burns, and a Lambert solver. Units: km, s; times handed in and out are
// UTC milliseconds. Positions are ICRF (J2000 equatorial), geocentric unless
// stated.

export const MU_EARTH = 398600.4418;
export const MU_MOON = 4902.800066;
export const MU_SUN = 1.32712440018e11;
export const MU_MARS = 42828.37;
export const EARTH_R = 6378.137;
export const MOON_R = 1737.4;
export const MARS_R = 3389.5;
const J2_EARTH = 1.08262668e-3;
const FLATTENING = 1 / 298.257;
const DEG = Math.PI / 180;
const DAY = 86400000;

export const add = (a, b) => a.map((value, k) => value + b[k]);
export const sub = (a, b) => a.map((value, k) => value - b[k]);
export const scale = (a, k) => a.map((value) => value * k);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => scale(a, 1 / norm(a));
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const mulT = (m, v) =>
  [0, 1, 2].map((k) => m[0][k] * v[0] + m[1][k] * v[1] + m[2][k] * v[2]);
/** Rotate `v` about unit axis `k` by `angle` (Rodrigues). */
export const rotateAbout = (v, k, angle) => {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + k[i] * kd);
};

// --- Frames ----------------------------------------------------------------

/** Earth's spin axis in ICRF at `time`. */
export const earthPole = (time) => mulT(precession(time), [0, 0, 1]);

/** ICRF position (km) of a point on the rotating Earth: geocentric latitude
 * and east longitude (degrees), height above the reference ellipsoid. */
export function earthSite(lat, lon, height, time) {
  const phi = lat * DEG;
  const r = EARTH_R * (1 - FLATTENING * Math.sin(phi) ** 2) + height;
  const angle = siderealAngle(time) + lon * DEG;
  const ofDate = [
    r * Math.cos(phi) * Math.cos(angle),
    r * Math.cos(phi) * Math.sin(angle),
    r * Math.sin(phi),
  ];
  return mulT(precession(time), ofDate);
}
/** As `earthSite`, with the site's inertial velocity (Earth's spin). */
export function earthSiteState(lat, lon, height, time) {
  const r = earthSite(lat, lon, height, time);
  const r2 = earthSite(lat, lon, height, time + 1000);
  return [...r, ...sub(r2, r)];
}

/** Inertial state from what Apollo tables give: geocentric latitude,
 * longitude, altitude (km), space-fixed speed (km/s), flight-path angle
 * above the local horizontal and heading east of north (degrees). */
export function stateFromLocal({ lat, lon, alt, speed, fpa, heading }, time) {
  const r = earthSite(lat, lon, alt, time);
  const up = unit(r);
  const east = unit(cross(earthPole(time), up));
  const north = cross(up, east);
  const [g, h] = [fpa * DEG, heading * DEG];
  const v = [0, 1, 2].map(
    (k) =>
      speed *
      (Math.sin(g) * up[k] +
        Math.cos(g) * Math.cos(h) * north[k] +
        Math.cos(g) * Math.sin(h) * east[k]),
  );
  return [...r, ...v];
}

/** Body-fixed axes (rows x, y, z in ICRF) from IAU pole and prime meridian. */
function bodyAxes(alpha, delta, w) {
  const [a, d] = [alpha * DEG, delta * DEG];
  const pole = [
    Math.cos(d) * Math.cos(a),
    Math.cos(d) * Math.sin(a),
    Math.sin(d),
  ];
  // The node of the body equator on the ICRF equator.
  const node = [-Math.sin(a), Math.cos(a), 0];
  const x = rotateAbout(node, pole, w * DEG);
  return [x, cross(pole, x), pole];
}
/** The Moon's IAU orientation (WGCCRE 2009, with its main libration terms). */
export function moonAxes(time) {
  const d = (time - Date.UTC(2000, 0, 1, 12)) / DAY;
  const T = d / 36525;
  const E = [
    125.045 - 0.0529921 * d,
    250.089 - 0.1059842 * d,
    260.008 + 13.0120009 * d,
    176.625 + 13.3407154 * d,
    357.529 + 0.9856003 * d,
    311.589 + 26.4057084 * d,
    134.963 + 13.064993 * d,
    276.617 + 0.3287146 * d,
    34.226 + 1.7484877 * d,
    15.134 - 0.1589763 * d,
    119.743 + 0.0036096 * d,
    239.961 + 0.1643573 * d,
    25.053 + 12.9590088 * d,
  ].map((value) => value * DEG);
  const s = (k) => Math.sin(E[k - 1]);
  const c = (k) => Math.cos(E[k - 1]);
  const alpha =
    269.9949 +
    0.0031 * T -
    3.8787 * s(1) -
    0.1204 * s(2) +
    0.07 * s(3) -
    0.0172 * s(4) +
    0.0072 * s(6) -
    0.0052 * s(10) +
    0.0043 * s(13);
  const delta =
    66.5392 +
    0.013 * T +
    1.5419 * c(1) +
    0.0239 * c(2) -
    0.0278 * c(3) +
    0.0068 * c(4) -
    0.0029 * c(6) +
    0.0009 * c(7) +
    0.0008 * c(10) -
    0.0009 * c(13);
  const w =
    38.3213 +
    13.17635815 * d -
    1.4e-12 * d * d +
    3.561 * s(1) +
    0.1208 * s(2) -
    0.0642 * s(3) +
    0.0158 * s(4) +
    0.0252 * s(5) -
    0.0066 * s(6) -
    0.0047 * s(7) -
    0.0046 * s(8) +
    0.0028 * s(9) +
    0.0052 * s(10) +
    0.004 * s(11) +
    0.0019 * s(12) -
    0.0044 * s(13);
  return bodyAxes(alpha, delta, w);
}
/** Mars' IAU orientation (WGCCRE 2009). */
export function marsAxes(time) {
  const d = (time - Date.UTC(2000, 0, 1, 12)) / DAY;
  const T = d / 36525;
  return bodyAxes(
    317.68143 - 0.1061 * T,
    52.8865 - 0.0609 * T,
    176.63 + 350.89198226 * d,
  );
}
/** Body-centred ICRF offset of a surface point (latitude, east longitude,
 * height above `radius`) for body axes `axes`. */
export function bodySite(axes, radius, lat, lon, height = 0) {
  const [phi, lambda] = [lat * DEG, lon * DEG];
  const local = [
    Math.cos(phi) * Math.cos(lambda),
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
  ];
  return mulT(axes, local).map((value) => value * (radius + height));
}

// --- Forces and integration ------------------------------------------------

/** Acceleration (km/s²) at geocentric `r`, `time` ms: Earth with J2, and
 * the Moon and the Sun as third bodies from `env` (functions of time giving
 * geocentric ICRF positions). */
export function geoAccel(r, time, env) {
  const [x, y, z] = r;
  const r2 = x * x + y * y + z * z;
  const rr = Math.sqrt(r2);
  const a = scale(r, -MU_EARTH / (r2 * rr));
  // J2 about the spin axis of the day.
  const pole = env.pole;
  const zk = dot(r, pole);
  const k = (1.5 * J2_EARTH * MU_EARTH * EARTH_R * EARTH_R) / (r2 * r2 * rr);
  const s = (5 * zk * zk) / r2;
  for (let i = 0; i < 3; i++) a[i] += k * (r[i] * (s - 1) - 2 * zk * pole[i]);
  for (const [body, mu] of [
    [env.moon(time), MU_MOON],
    [env.sun(time), MU_SUN],
  ]) {
    const d = sub(body, r);
    const dn = norm(d);
    const bn = norm(body);
    for (let i = 0; i < 3; i++)
      a[i] += mu * (d[i] / dn ** 3 - body[i] / bn ** 3);
  }
  return a;
}

// Dormand–Prince 5(4) coefficients.
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const B4 = [
  5179 / 57600,
  0,
  7571 / 16695,
  393 / 640,
  -92097 / 339200,
  187 / 2100,
  1 / 40,
];

/** Integrate `state` (km, km/s) from `t0` to `t1` (ms; either direction)
 * under `accel(r, time)`. Returns rows [time, x, y, z, vx, vy, vz] at every
 * accepted step, first and last included. `maxStep` caps a step (s);
 * `inside(state, time)` true stops early (the path hit a body). */
export function integrate(
  state,
  t0,
  t1,
  accel,
  { tolerance = 1e-10, maxStep = 3600, inside = accel.inside } = {},
) {
  const f = (t, y) => [y[3], y[4], y[5], ...accel(y.slice(0, 3), t)];
  let steps = 0;
  const direction = Math.sign(t1 - t0) || 1;
  let t = t0;
  let y = state.slice(0, 6);
  let h = direction * Math.min(60, Math.abs(t1 - t0) / 1000);
  const rows = [[t, ...y]];
  while (direction * (t1 - t) > 1e-3) {
    if (direction * (t + h * 1000 - t1) > 0) h = (t1 - t) / 1000;
    const k = [];
    for (let stage = 0; stage < 7; stage++) {
      const yi = y.slice();
      for (let j = 0; j < stage; j++)
        for (let i = 0; i < 6; i++) yi[i] += h * A[stage][j] * k[j][i];
      k.push(f(t + C[stage] * h * 1000, yi));
    }
    const y5 = y.map(
      (value, i) => value + h * B5.reduce((s, b, j) => s + b * k[j][i], 0),
    );
    const y4 = y.map(
      (value, i) => value + h * B4.reduce((s, b, j) => s + b * k[j][i], 0),
    );
    // Error relative to the size of the position and velocity.
    const scaleP = Math.max(1, norm(y5));
    const scaleV = Math.max(1e-3, norm(y5.slice(3)));
    let error = 0;
    for (let i = 0; i < 6; i++)
      error = Math.max(
        error,
        Math.abs(y5[i] - y4[i]) / (i < 3 ? scaleP : scaleV),
      );
    // A non-finite state (a wild trial) ends the path rather than looping.
    if (!Number.isFinite(error) || ++steps > 400000) break;
    if (error <= tolerance || Math.abs(h) < 1e-3) {
      t += h * 1000;
      y = y5;
      rows.push([t, ...y]);
      // A trial path that dives into a body (or never settles) ends there:
      // the targeting sees a miss, not a hang.
      if (inside?.(y, t)) break;
    }
    const factor = error > 0 ? 0.9 * (tolerance / error) ** 0.2 : 4;
    h *= Math.min(4, Math.max(0.2, factor));
    if (Math.abs(h) > maxStep) h = direction * maxStep;
  }
  return rows;
}
/** The state at `t1` only. */
export const propagate = (state, t0, t1, accel, options) =>
  integrate(state, t0, t1, accel, options).at(-1).slice(1);

/** Two-body apsides (km from the centre) and specific angular momentum of
 * `state` relative to a body of `mu`. */
export function apsides(state, mu) {
  const r = state.slice(0, 3);
  const v = state.slice(3, 6);
  const h = cross(r, v);
  const energy = dot(v, v) / 2 - mu / norm(r);
  const a = -mu / (2 * energy);
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * dot(h, h)) / (mu * mu)));
  return { peri: a * (1 - e), apo: a * (1 + e), a, e, h };
}
/** Closest approach of `rows` to a body at `center(time)`: time and
 * distance, refined between samples by a golden-section search on the
 * re-integrated path if `refine` is given. */
export function closest(rows, center) {
  let best = null;
  for (const row of rows) {
    const d = norm(sub(row.slice(1, 4), center(row[0])));
    if (!best || d < best.distance) best = { time: row[0], distance: d, row };
  }
  return best;
}

// --- Targeting ---------------------------------------------------------------

/** Solve linear system (small, dense) by Gaussian elimination. */
function linear(M, b) {
  const n = b.length;
  const a = M.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}
/** Least-norm Newton: find x near `x0` with `residual(x)` ≈ 0 (each
 * component already scaled to "1 = unacceptable"). Finite-difference
 * Jacobian with steps `step`, step halving when the residual grows. */
export function solve(
  residual,
  x0,
  {
    step,
    tolerance = 1e-3,
    iterations = 40,
    label = '',
    quiet = false,
    limit = Infinity,
  } = {},
) {
  let x = x0.slice();
  // A residual that cannot be computed counts as infinitely bad.
  const size = (v) => {
    const value = Math.hypot(...v);
    return Number.isFinite(value) ? value : Infinity;
  };
  let r = residual(x);
  for (
    let iteration = 0;
    iteration < iterations && size(r) > tolerance;
    iteration++
  ) {
    const J = r.map(() => []);
    x.forEach((_, j) => {
      const dx = step?.[j] ?? 1e-4;
      const xp = x.slice();
      xp[j] += dx;
      const rp = residual(xp);
      rp.forEach((value, i) => (J[i][j] = (value - r[i]) / dx));
    });
    // dx = Jᵀ (J Jᵀ)⁻¹ (−r) when under-determined, else normal equations.
    let delta;
    if (r.length <= x.length) {
      const JJt = J.map((ri) => J.map((rk) => dot6(ri, rk)));
      const y = linear(
        JJt,
        r.map((value) => -value),
      );
      delta = x.map((_, j) => J.reduce((s, row, i) => s + row[j] * y[i], 0));
    } else {
      const JtJ = x.map((_, a) =>
        x.map((__, b) => J.reduce((s, row) => s + row[a] * row[b], 0)),
      );
      const Jtr = x.map(
        (_, a) => -J.reduce((s, row, i) => s + row[a] * r[i], 0),
      );
      delta = linear(JtJ, Jtr);
    }
    if (process.env.DEBUG)
      console.error(
        `    ${label} #${iteration} |r|=${size(r).toFixed(4)} r=${r.map((v) => v.toFixed(2))} x=${x.map((v) => v.toFixed(5))}`,
      );
    // No step longer than `limit`; then halve until the residual shrinks,
    // and give up when it won't.
    const length = Math.hypot(...delta);
    if (!Number.isFinite(length)) break;
    let lambda = Math.min(1, limit / length);
    let improved = false;
    while (lambda >= 1 / 1024) {
      const candidate = x.map((value, j) => value + lambda * delta[j]);
      const rc = residual(candidate);
      if (size(rc) < size(r)) {
        x = candidate;
        r = rc;
        improved = true;
        break;
      }
      lambda /= 2;
    }
    if (!improved) break;
  }
  if (size(r) > tolerance && !quiet)
    console.warn(
      `  ${label}: targeting left residual ${size(r).toFixed(4)} (${r.map((value) => value.toFixed(2))})`,
    );
  return x;
}
const dot6 = (a, b) => a.reduce((s, value, i) => s + value * b[i], 0);

/** Lambert's problem (universal variables, short way, prograde when
 * `prograde`): velocities at r1 and r2 for a flight of `tof` seconds. */
export function lambert(r1, r2, tof, mu, prograde = true) {
  const [n1, n2] = [norm(r1), norm(r2)];
  let cosDnu = dot(r1, r2) / (n1 * n2);
  cosDnu = Math.max(-1, Math.min(1, cosDnu));
  let dnu = Math.acos(cosDnu);
  const z12 = cross(r1, r2)[2];
  if ((prograde && z12 < 0) || (!prograde && z12 >= 0)) dnu = 2 * Math.PI - dnu;
  const A = Math.sin(dnu) * Math.sqrt((n1 * n2) / (1 - Math.cos(dnu)));
  const stumpC = (z) =>
    z > 1e-6
      ? (1 - Math.cos(Math.sqrt(z))) / z
      : z < -1e-6
        ? (Math.cosh(Math.sqrt(-z)) - 1) / -z
        : 1 / 2 - z / 24;
  const stumpS = (z) =>
    z > 1e-6
      ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / z ** 1.5
      : z < -1e-6
        ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / (-z) ** 1.5
        : 1 / 6 - z / 120;
  const yOf = (z) => n1 + n2 + (A * (z * stumpS(z) - 1)) / Math.sqrt(stumpC(z));
  const timeOf = (z) => {
    const y = yOf(z);
    return (
      ((y / stumpC(z)) ** 1.5 * stumpS(z) + A * Math.sqrt(y)) / Math.sqrt(mu)
    );
  };
  // Bisection on z, after bracketing.
  let lo = -4 * Math.PI ** 2;
  let hi = 4 * Math.PI ** 2;
  while (yOf(lo) < 0) lo += 0.1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (yOf(mid) < 0 || timeOf(mid) < tof) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  const y = yOf(z);
  const f = 1 - y / n1;
  const g = A * Math.sqrt(y / mu);
  const gdot = 1 - y / n2;
  const v1 = scale(sub(r2, scale(r1, f)), 1 / g);
  const v2 = scale(sub(scale(r2, gdot), r1), 1 / g);
  return { v1, v2 };
}

/** Two-body propagation (universal Kepler) of `state` by `dt` seconds. */
export function kepler(state, dt, mu) {
  const r0 = state.slice(0, 3);
  const v0 = state.slice(3, 6);
  const rn = norm(r0);
  const vr = dot(r0, v0) / rn;
  const alpha = 2 / rn - dot(v0, v0) / mu;
  // Whole revolutions of an ellipse change nothing: over dozens of them the
  // iteration below can settle on a wrong root (a parking orbit sample
  // thrown millions of km out), so keep within half a period.
  if (alpha > 1e-12) {
    const period = 2 * Math.PI * Math.sqrt(1 / (alpha ** 3 * mu));
    dt -= Math.round(dt / period) * period;
  }
  // Starting guess (Vallado): elliptic, or for a hyperbola from its
  // asymptotic growth (the elliptic guess diverges over days).
  let chi = Math.sqrt(mu) * Math.abs(alpha) * dt;
  if (alpha < -1e-12) {
    const a = 1 / alpha;
    const sign = Math.sign(dt) || 1;
    chi =
      sign *
      Math.sqrt(-a) *
      Math.log(
        (-2 * mu * alpha * dt) /
          (dot(r0, v0) + sign * Math.sqrt(-mu * a) * (1 - rn * alpha)),
      );
  }
  const C2 = (z) =>
    z > 1e-8
      ? (1 - Math.cos(Math.sqrt(z))) / z
      : z < -1e-8
        ? (Math.cosh(Math.sqrt(-z)) - 1) / -z
        : 0.5;
  const C3 = (z) =>
    z > 1e-8
      ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / z ** 1.5
      : z < -1e-8
        ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / (-z) ** 1.5
        : 1 / 6;
  // F(χ) − √μ·dt, increasing in χ (its slope is the radius): Newton's
  // method, falling back to bisection inside a bracket whenever a step
  // leaves it (plain Newton can wander on a very eccentric orbit).
  const timeOf = (x) => {
    const z = alpha * x * x;
    return (
      ((rn * vr) / Math.sqrt(mu)) * x * x * C2(z) +
      (1 - alpha * rn) * x ** 3 * C3(z) +
      rn * x -
      Math.sqrt(mu) * dt
    );
  };
  // Within half a period of an ellipse |Δχ| ≤ 2π√a; a hyperbola's bracket
  // grows from the guess until it holds the root.
  let [lo, hi] =
    alpha > 1e-12
      ? [(-2 * Math.PI) / Math.sqrt(alpha), (2 * Math.PI) / Math.sqrt(alpha)]
      : [Math.min(0, 2 * chi), Math.max(0, 2 * chi)];
  for (let k = 0; k < 200 && timeOf(lo) > 0; k++) lo = 2 * lo - 1;
  for (let k = 0; k < 200 && timeOf(hi) < 0; k++) hi = 2 * hi + 1;
  if (!(chi > lo && chi < hi)) chi = (lo + hi) / 2;
  let converged = false;
  for (let k = 0; k < 200; k++) {
    const z = alpha * chi * chi;
    const F = timeOf(chi);
    if (F < 0) lo = chi;
    else hi = chi;
    const dF =
      ((rn * vr) / Math.sqrt(mu)) * chi * (1 - z * C3(z)) +
      (1 - alpha * rn) * chi * chi * C2(z) +
      rn;
    let next = chi - F / dF;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    const step = next - chi;
    chi = next;
    if (Math.abs(step) < 1e-10 * Math.max(1, Math.abs(chi))) {
      converged = true;
      break;
    }
  }
  if (!converged)
    throw new Error(`Kepler propagation did not converge (dt ${dt} s)`);
  const z = alpha * chi * chi;
  const f = 1 - (chi * chi * C2(z)) / rn;
  const g = dt - (chi ** 3 * C3(z)) / Math.sqrt(mu);
  const r = add(scale(r0, f), scale(v0, g));
  const nr = norm(r);
  const fdot = (Math.sqrt(mu) / (nr * rn)) * (z * chi * C3(z) - chi);
  const gdot = 1 - (chi * chi * C2(z)) / nr;
  return [...r, ...add(scale(r0, fdot), scale(v0, gdot))];
}

/** A smooth path between two states around a moving centre, for what is
 * not modelled (powered descent and ascent, atmospheric entry, rendezvous):
 * radius and the angle swept about `axis` (by default the orbit normal of
 * the faster-turning end) are cubic Hermite in time, matched
 * to each end's radial and angular speed; `turns` adds whole revolutions.
 * `settle` (an atmospheric entry, slowing to a stop): where a cubic would
 * overshoot the end and come back, (1 − u)^k profiles instead, which keep
 * the start's speed and never pass the end. Returns rows every `step` ms,
 * endpoints included. */
export function blend(
  a,
  b,
  ta,
  tb,
  center,
  step,
  { axis, turns = 0, settle = false } = {},
) {
  const ca = center(ta);
  const cb = center(tb);
  const ra = sub(a.slice(0, 3), ca.slice(0, 3));
  const va = sub(a.slice(3, 6), ca.slice(3, 6));
  const rb = sub(b.slice(0, 3), cb.slice(0, 3));
  const vb = sub(b.slice(3, 6), cb.slice(3, 6));
  // About the orbit of whichever end is moving round the centre (not a
  // launch pad's or landing site's slow spin).
  const [ha, hb] = [cross(ra, va), cross(rb, vb)];
  const n = axis ?? unit(norm(ha) >= norm(hb) ? ha : hb);
  // Angle from ra to rb about n (0..2π) plus whole turns.
  const ua = unit(ra);
  const ub = unit(rb);
  let theta = Math.atan2(dot(cross(ua, ub), n), dot(ua, ub));
  if (theta < 0) theta += 2 * Math.PI;
  theta += 2 * Math.PI * turns;
  const T = (tb - ta) / 1000;
  const angular = (r, v) => dot(cross(r, v), n) / dot(r, r);
  const [wa, wb] = [angular(ra, va), angular(rb, vb)];
  const [da, db] = [norm(ra), norm(rb)];
  const [sa, sb] = [dot(ra, va) / da, dot(rb, vb) / db];
  const h = (p0, m0, p1, m1, u) => {
    // Start slope relative to the change: above 3 a cubic overshoots.
    const k = (m0 * T) / (p1 - p0);
    if (settle && k > 3) return p1 + (p0 - p1) * (1 - u) ** k;
    return (
      (2 * u ** 3 - 3 * u ** 2 + 1) * p0 +
      (u ** 3 - 2 * u ** 2 + u) * m0 * T +
      (-2 * u ** 3 + 3 * u ** 2) * p1 +
      (u ** 3 - u ** 2) * m1 * T
    );
  };
  // The out-of-plane part of the end direction, blended in linearly.
  const inPlaneB = rotateAbout(ua, n, theta);
  const tilt = sub(ub, inPlaneB);
  const position = (time) => {
    const u = (time - ta) / (tb - ta);
    const angle = h(0, wa, theta, wb, u);
    const radius = h(da, sa, db, sb, u);
    const dir = unit(
      add(rotateAbout(ua, n, angle), scale(tilt, u * u * (3 - 2 * u))),
    );
    return add(center(time).slice(0, 3), scale(dir, radius));
  };
  const rows = [];
  for (let time = ta; time < tb; time += step) {
    const p = position(time);
    const q = position(Math.min(tb, time + 1000));
    rows.push([
      time,
      ...p,
      ...sub(q, p).map((value) => value / Math.min(1, (tb - time) / 1000 || 1)),
    ]);
  }
  rows[0] = [ta, ...a.slice(0, 6)];
  rows.push([tb, ...b.slice(0, 6)]);
  return rows;
}
