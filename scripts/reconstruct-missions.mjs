import { mkdir, writeFile } from 'node:fs/promises';
import { SOURCE } from './lib/horizons.mjs';
import {
  DAY,
  HOUR,
  MINUTE,
  MOON_STEP,
  interpolator,
  ofDate,
  packed,
  round,
  stamp,
  stateAt,
  thin,
  vectors,
} from './lib/mission-data.mjs';
import {
  EARTH_R,
  MARS_R,
  MOON_R,
  MU_EARTH,
  MU_MARS,
  MU_MOON,
  MU_SUN,
  add,
  apsides,
  blend,
  bodySite,
  cross,
  dot,
  earthPole,
  earthSiteState,
  geoAccel,
  integrate,
  kepler,
  lambert,
  marsAxes,
  moonAxes,
  norm,
  propagate,
  rotateAbout,
  scale,
  solve,
  stateFromLocal,
  sub,
  unit,
} from './lib/dynamics.mjs';

// Missions with no trajectory of their own in JPL Horizons, rebuilt from
// published figures and written to public/missions/<id>.json in the same
// format as scripts/fetch-missions.mjs (with `reconstructed: true`).
//
//   pnpm missions:reconstruct            every mission
//   pnpm missions:reconstruct apollo11   just these
//
// The spacecraft is integrated under Earth (with J2), the Moon and the Sun,
// the Moon and the Sun taken from Horizons. Each burn is impulsive at the
// middle of the real one, its velocity change solved so the path after it
// meets the published numbers (an orbit's apsides, the closest approach to
// the Moon and its time, the entry altitude and angle). What is not coasting
// (powered ascent and descent, rendezvous, atmospheric flight) is a smooth
// blend between the states either side. Every result is a picture of the
// mission, faithful to a few km in orbit and a few tens of km in transit,
// not a navigation solution.

const NMI = 1.852;
const DEG = Math.PI / 180;
const FPS = 0.0003048;
const OUT = new URL('../public/missions/', import.meta.url);
const at = (iso) => Date.parse(iso);

/** Moon and Sun from Horizons around [start, stop], and the force model. */
async function environment(start, stop) {
  const moonRows = await vectors(
    '301',
    Math.floor(start / HOUR) * HOUR - DAY,
    Math.ceil(stop / HOUR) * HOUR + DAY,
    HOUR,
  );
  const sunRows = await vectors(
    '10',
    Math.floor(start / DAY) * DAY - 2 * DAY,
    Math.ceil(stop / DAY) * DAY + 2 * DAY,
    DAY,
  );
  const moonPosition = interpolator(moonRows);
  const moonState = stateAt(moonRows);
  const sunPosition = interpolator(sunRows);
  const env = {
    moon: (time) => [...moonPosition(time)],
    moonState: (time) => [...moonState(time)],
    sun: (time) => [...sunPosition(time)],
    pole: earthPole((start + stop) / 2),
  };
  const accel = (r, time) => geoAccel(r, time, env);
  // Without the Moon's pull: a smooth problem for the first guess of a
  // burn aimed at the Moon (its gravity makes the miss swing wildly).
  const far = [1e12, 0, 0];
  const moonless = { ...env, moon: () => far };
  accel.moonless = (r, time) => geoAccel(r, time, moonless);
  // Below the surface of Earth or the Moon: a trial path that has crashed.
  const inside = (state, time) =>
    norm(state.slice(0, 3)) < EARTH_R - 50 ||
    norm(sub(state.slice(0, 3), env.moon(time))) < MOON_R - 50;
  accel.inside = inside;
  return { env, accel };
}

/** A spacecraft's history: rows [time, x, y, z, vx, vy, vz], built leg by
 * leg from its current state. */
function journey(accel, state, time) {
  const rows = [[time, ...state]];
  const self = {
    state,
    time,
    rows,
    /** Coast to `until`. */
    coast(until, options) {
      const leg = integrate(self.state, self.time, until, accel, options);
      rows.push(...leg.slice(1));
      self.state = leg.at(-1).slice(1);
      self.time = until;
      return self;
    },
    /** An impulsive burn now. */
    burn(dv) {
      self.state = [...self.state.slice(0, 3), ...add(self.state.slice(3), dv)];
      rows.push([self.time, ...self.state]);
      return self;
    },
    /** A blended leg to `state` at `until` (see dynamics.blend). */
    blendTo(state, until, center, options) {
      const leg = blend(
        self.state,
        state,
        self.time,
        until,
        center,
        20000,
        options,
      );
      rows.push(...leg.slice(1));
      self.state = state.slice(0, 6);
      self.time = until;
      return self;
    },
    /** Sit on a moving surface point until `until`. */
    stay(site, until, step = 10 * MINUTE) {
      for (let t = self.time + step; t < until; t += step)
        rows.push([t, ...site(t)]);
      self.state = site(until);
      self.time = until;
      rows.push([until, ...self.state]);
      return self;
    },
  };
  return self;
}

/** Velocity change frame at a state: along-track, radial, normal. */
function frameOf(state, centre = [0, 0, 0, 0, 0, 0]) {
  const r = sub(state.slice(0, 3), centre.slice(0, 3));
  const v = sub(state.slice(3, 6), centre.slice(3, 6));
  const t = unit(v);
  const n = unit(cross(r, v));
  return { t, n, r: cross(t, n) };
}
const inFrame = (frame, [a, b, c]) =>
  add(add(scale(frame.t, a), scale(frame.r, b)), scale(frame.n, c));

/** Closest approach to the Moon over `rows`: time, altitude, selenocentric
 * state, direction of the closest point. With `accel`, the path is run
 * again in 5 s steps between the samples either side of the nearest and a
 * parabola fitted there (smooth in a burn being solved for, unlike the
 * samples themselves); without it, from the two-body orbit about the Moon
 * at the nearest sample (good enough in low lunar orbit). */
function perilune(rows, env, accel) {
  const d = rows.map((row) => norm(sub(row.slice(1, 4), env.moon(row[0]))));
  let best = 0;
  for (let k = 1; k < d.length; k++) if (d[k] < d[best]) best = k;
  if (!accel || best === 0 || best === rows.length - 1) {
    const selene = sub(rows[best].slice(1), env.moonState(rows[best][0]));
    const pass = periapsis(selene, rows[best][0], MU_MOON);
    return {
      time: pass.time,
      altitude: pass.radius - MOON_R,
      direction: pass.direction,
      selene,
    };
  }
  const dense = integrate(
    rows[best - 1].slice(1),
    rows[best - 1][0],
    rows[best + 1][0],
    accel,
    { maxStep: 5 },
  );
  const e = dense.map((row) => norm(sub(row.slice(1, 4), env.moon(row[0]))));
  let low = 0;
  for (let k = 1; k < e.length; k++) if (e[k] < e[low]) low = k;
  const k = Math.min(e.length - 2, Math.max(1, low));
  // Seconds relative to the middle sample; d(x) = A x² + B x + e1.
  const [x0, x2] = [
    (dense[k - 1][0] - dense[k][0]) / 1000,
    (dense[k + 1][0] - dense[k][0]) / 1000,
  ];
  const [e0, e1, e2] = [e[k - 1], e[k], e[k + 1]];
  const A = ((e0 - e1) / x0 - (e2 - e1) / x2) / (x0 - x2);
  const B = (e0 - e1) / x0 - A * x0;
  const vertex = A > 0 ? Math.min(x2, Math.max(x0, -B / (2 * A))) : 0;
  const selene = sub(dense[k].slice(1), env.moonState(dense[k][0]));
  return {
    time: dense[k][0] + vertex * 1000,
    altitude: A * vertex * vertex + B * vertex + e1 - MOON_R,
    direction: rotateAbout(
      unit(selene.slice(0, 3)),
      unit(cross(selene.slice(0, 3), selene.slice(3, 6))),
      (vertex * norm(selene.slice(3, 6))) / norm(selene.slice(0, 3)),
    ),
    selene,
  };
}

/** The closest approach to the Moon predicted from the two-body orbit
 * about it where `rows` first come within `radius` km of it (or at their
 * nearest): time and altitude. */
function incoming(rows, env, radius = 40000) {
  let row = rows[0];
  let low = Infinity;
  for (const r of rows) {
    const d = norm(sub(r.slice(1, 4), env.moon(r[0])));
    if (d < low) [row, low] = [r, d];
    if (d < radius) break;
  }
  const pass = periapsis(
    sub(row.slice(1), env.moonState(row[0])),
    row[0],
    MU_MOON,
  );
  return { time: pass.time, altitude: pass.radius - MOON_R };
}

/** The Earth entry conditions at `time` of a state: altitude above the
 * equatorial radius and flight-path angle (degrees). */
function entry(state) {
  const r = state.slice(0, 3);
  const v = state.slice(3, 6);
  return {
    altitude: norm(r) - EARTH_R,
    fpa: (Math.asin(dot(r, v) / (norm(r) * norm(v))) * 180) / Math.PI,
  };
}

/** Residuals for hitting the entry corridor: the path should cross
 * 121.9 km at `time` at −6.5°. A path that misses Earth is scored by its
 * osculating perigee (height and time) from its lowest point, so the
 * solver can still steer it in. */
function corridor(rows, time, angle = -6.5) {
  for (let k = 1; k < rows.length; k++) {
    const altitude = norm(rows[k].slice(1, 4)) - EARTH_R;
    if (altitude > 121.9) continue;
    const before = norm(rows[k - 1].slice(1, 4)) - EARTH_R;
    const u = (before - 121.9) / (before - altitude);
    const t = rows[k - 1][0] + u * (rows[k][0] - rows[k - 1][0]);
    const fpa =
      entry(rows[k - 1].slice(1)).fpa * (1 - u) +
      entry(rows[k].slice(1)).fpa * u;
    return [(t - time) / 60000, (fpa - angle) / 0.2];
  }
  let low = rows[0];
  for (const row of rows)
    if (norm(row.slice(1, 4)) < norm(low.slice(1, 4))) low = row;
  const perigee = periapsis(low.slice(1), low[0], MU_EARTH);
  return [
    (perigee.time - time) / 60000,
    10 + (perigee.radius - EARTH_R - 121.9) / 5,
  ];
}

/** The next (or, outbound, the last) periapsis of a two-body orbit about
 * a body of `mu` from `state` at `time`: radius, time and direction. */
function periapsis(state, time, mu) {
  const r = state.slice(0, 3);
  const v = state.slice(3, 6);
  const rn = norm(r);
  const energy = dot(v, v) / 2 - mu / rn;
  const a = -mu / (2 * energy);
  const h = norm(cross(r, v));
  const e = Math.sqrt(Math.max(0, 1 - (h * h) / (mu * a)));
  const radius = a * (1 - e);
  const rv = dot(r, v);
  const direction = unit(sub(scale(r, dot(v, v) - mu / rn), scale(v, rv)));
  if (a > 0) {
    const E = Math.atan2(rv / Math.sqrt(mu * a), 1 - rn / a);
    const n = Math.sqrt(mu / a ** 3);
    // Mean anomaly since perigee in (−π, π]: inbound the perigee is ahead.
    const M = E - e * Math.sin(E);
    return { radius, direction, time: time - (M / n) * 1000 };
  }
  const F = Math.asinh(rv / (e * Math.sqrt(-mu * a)));
  const n = Math.sqrt(-mu / a ** 3);
  return {
    radius,
    direction,
    time: time - ((e * Math.sinh(F) - F) / n) * 1000,
  };
}

/** Selenocentric apsides altitudes (km) of a state. */
function lunarOrbit(state, time, env) {
  const { peri, apo } = apsides(sub(state, env.moonState(time)), MU_MOON);
  return { peri: peri - MOON_R, apo: apo - MOON_R };
}

/** Coast to the moment within `window` ms either side of `time` where
 * `score(state, time)` is least (the burn point a reconstruction drifting a
 * little from the real orbit should use). */
function coastToBest(craft, accel, time, window, score) {
  const rows = integrate(craft.state, craft.time, time + window, accel, {
    maxStep: 30,
  });
  let best = null;
  for (const row of rows) {
    if (row[0] < time - window) continue;
    const value = score(row.slice(1), row[0]);
    if (!best || value < best.value) best = { value, time: row[0] };
  }
  craft.coast(best.time);
}
/** Coast to the moment near `time` whose lunar altitude is nearest one of
 * the target apsides, and burn there into that orbit. */
function lunarBurnNear(
  craft,
  accel,
  env,
  time,
  peri,
  apo,
  label,
  window = 40 * MINUTE,
  quiet = false,
) {
  coastToBest(craft, accel, time, window, (state, t) => {
    const altitude = norm(sub(state.slice(0, 3), env.moon(t))) - MOON_R;
    return Math.min(Math.abs(altitude - peri), Math.abs(altitude - apo));
  });
  lunarBurn(craft, env, peri, apo, label, quiet);
}

/** Solve the burn now that puts the lunar orbit's apsides at the given
 * altitudes (in-plane: along-track and radial). */
function lunarBurn(craft, env, peri, apo, label, quiet = false) {
  const frame = frameOf(craft.state, env.moonState(craft.time));
  const guess = (() => {
    const s = sub(craft.state, env.moonState(craft.time));
    const r = norm(s.slice(0, 3));
    const a = MOON_R + (peri + apo) / 2;
    const v = Math.sqrt(MU_MOON * (2 / r - 1 / a));
    return [v - norm(s.slice(3, 6)), 0];
  })();
  const [along, radial] = solve(
    ([a, b]) => {
      const s = add(craft.state, [0, 0, 0, ...inFrame(frame, [a, b, 0])]);
      const o = lunarOrbit(s, craft.time, env);
      return [(o.peri - peri) / 1, (o.apo - apo) / 1];
    },
    guess,
    { step: [1e-4, 1e-4], tolerance: 0.5, label, quiet },
  );
  const dv = inFrame(frame, [along, radial, 0]);
  if (!quiet) console.log(`  ${label}: ${(norm(dv) * 1000).toFixed(1)} m/s`);
  craft.burn(dv);
}

/** The point on the Moon at latitude/longitude, as a full state (ICRF,
 * geocentric) at `time`. */
function moonSite(env, lat, lon, height = 0) {
  return (time) => {
    const p = add(
      env.moon(time),
      bodySite(moonAxes(time), MOON_R, lat, lon, height),
    );
    const q = add(
      env.moon(time + 1000),
      bodySite(moonAxes(time + 1000), MOON_R, lat, lon, height),
    );
    return [...p, ...sub(q, p)];
  };
}
const earthCentre = () => [0, 0, 0, 0, 0, 0];

/** Solve a burn now (3 components, least norm from `guess`, km/s) so that
 * `residual(path rows after the burn up to `until`)` is within `tolerance`. */
function targetBurn(
  craft,
  accel,
  until,
  residual,
  guess,
  label,
  tolerance = 0.05,
) {
  const frame = frameOf(craft.state);
  const dv = solve(
    (x) => {
      const s = add(craft.state, [0, 0, 0, ...inFrame(frame, x)]);
      const rows = integrate(s, craft.time, until, accel, { maxStep: 1800 });
      return residual(rows);
    },
    guess,
    { step: [1e-5, 1e-5, 1e-5], tolerance, label, limit: 0.3 },
  );
  const vector = inFrame(frame, dv);
  console.log(`  ${label}: ${(norm(vector) * 1000).toFixed(1)} m/s`);
  craft.burn(vector);
}

/** A burn home from lunar orbit near `time`, aimed at the entry corridor
 * (121.9 km, `angle`) at `entryTime`: tried every 4 minutes for an hour either
 * side, the cheapest kept. */
function homeward(craft, accel, time, entryTime, guess, label, angle = -6.5) {
  const aim = (rows) => corridor(rows, entryTime, angle);
  craft.coast(time - HOUR);
  let best = null;
  for (let t = time - HOUR; t <= time + HOUR; t += 4 * MINUTE) {
    const trial = journey(accel, craft.state, craft.time).coast(t);
    const frame = frameOf(trial.state);
    const x = solve(
      (dv) => {
        const s = add(trial.state, [0, 0, 0, ...inFrame(frame, dv)]);
        return aim(integrate(s, t, entryTime + HOUR, accel, { maxStep: 1800 }));
      },
      [guess, 0, 0],
      {
        step: [1e-5, 1e-5, 1e-5],
        tolerance: 0.05,
        iterations: 25,
        label: `${label} trial`,
      },
    );
    const dv = inFrame(frame, x);
    const s = add(trial.state, [0, 0, 0, ...dv]);
    const miss = Math.hypot(
      ...aim(integrate(s, t, entryTime + HOUR, accel, { maxStep: 1800 })),
    );
    if (miss < 0.1 && (!best || norm(dv) < norm(best.dv))) best = { t, dv };
  }
  craft.coast(best.t);
  console.log(
    `  ${label}: ${(norm(best.dv) * 1000).toFixed(1)} m/s at ${stamp(best.t)}`,
  );
  craft.burn(best.dv);
}

/** Angle (radians, −π…π) about `n` from `from` to `to`. */
function angleIn(n, from, to) {
  const f = unit(sub(from, scale(n, dot(from, n))));
  return Math.atan2(dot(cross(f, unit(to)), n), dot(f, unit(to)));
}

/** How far round its orbit (radians) a craft at selenocentric state `c` is
 * from the point opposite the start of a powered descent `uprange` km
 * before the site (selenocentric `site`): where the descent orbit burn
 * belongs, half an orbit earlier. */
function descentPhase(c, site, uprange) {
  const n = unit(cross(c.slice(0, 3), c.slice(3, 6)));
  const start = rotateAbout(
    unit(sub(site, scale(n, dot(site, n)))),
    n,
    -uprange / MOON_R,
  );
  return angleIn(n, scale(start, -1), c.slice(0, 3));
}

/** A root of `f` by the secant method from x0, x1, kept within [min, max]:
 * [x, f(x)]. */
function secant(
  f,
  x0,
  x1,
  { min = -Infinity, max = Infinity, tolerance = 0.002 } = {},
) {
  let [m0, m1] = [f(x0), f(x1)];
  for (let k = 0; k < 12 && Math.abs(m1) > tolerance; k++) {
    const x2 = x1 - (m1 * (x1 - x0)) / (m1 - m0);
    [x0, m0] = [x1, m1];
    x1 = Math.min(max, Math.max(min, x2));
    m1 = f(x1);
  }
  return [x1, m1];
}

/** A root of `f` between `from` and `to`: scanned in steps of `step` for
 * the first change of sign (not an angle wrapping through ±π), then
 * refined by the secant method: [x, f(x)]. */
function scanRoot(f, from, to, step) {
  let previous = null;
  for (let x = from; step > 0 ? x <= to : x >= to; x += step) {
    const value = f(x);
    if (
      previous &&
      Math.sign(value) !== Math.sign(previous.value) &&
      Math.abs(value - previous.value) < Math.PI
    )
      return secant(f, previous.x, x, {
        min: Math.min(previous.x, x),
        max: Math.max(previous.x, x),
      });
    previous = { x, value };
  }
  throw new Error(`No root between ${from} and ${to}`);
}

/** The lunar orbit's inclination to the Moon's equator, for the log
 * (above 90°: retrograde, as every Apollo orbit was). */
function inclination(label, craft, env) {
  const c = sub(craft.state, env.moonState(craft.time));
  const h = unit(cross(c.slice(0, 3), c.slice(3, 6)));
  const pole = moonAxes(craft.time)[2];
  console.log(
    `  ${label}: inclination ${((Math.acos(dot(h, pole)) * 180) / Math.PI).toFixed(1)}°`,
  );
}

/** Altitude above the Moon and arc to a surface point (a state at the
 * craft's own time), for the log. */
function report(label, craft, env, target) {
  const moon = env.moon(craft.time);
  const r = sub(craft.state.slice(0, 3), moon);
  const t = sub(target.slice(0, 3), moon);
  const arc = Math.acos(dot(unit(r), unit(t))) * MOON_R;
  console.log(
    `  ${label}: ${(norm(r) - MOON_R).toFixed(1)} km up, ${Math.round(arc)} km from the site`,
  );
}

// --- Apollo 11 ------------------------------------------------------------------

async function apollo11() {
  const launch = at('1969-07-16T13:32:00Z');
  const end = at('1969-07-24T16:50:35Z');
  const { env, accel } = await environment(launch, end);
  const site = moonSite(env, 0.67416, 23.47314);
  const landing = at('1969-07-20T20:17:40Z');

  // Parking orbit from the S-IVB's first cutoff (Apollo by the Numbers).
  const cutoff1 = at('1969-07-16T13:43:39.33Z');
  const parked = stateFromLocal(
    {
      lat: 32.4865,
      lon: -53.4588,
      alt: 103.202 * NMI,
      speed: 25561.6 * FPS,
      fpa: 0.011,
      heading: 88.414,
    },
    cutoff1,
  );
  // After TLI: the S-IVB's own trajectory from Horizons, run back to the end
  // of the burn.
  const sivb = await vectors(
    '-399110',
    at('1969-07-16T16:40Z'),
    at('1969-07-16T16:46Z'),
    MINUTE,
  );
  const tliEnd = at('1969-07-16T16:22:03Z');
  const afterTli = propagate(
    sivb.at(-1).slice(1),
    sivb.at(-1)[0],
    tliEnd,
    accel,
  );

  const pad = (time) => earthSiteState(28.447, -80.6041, 0, time);
  const csm = journey(accel, pad(launch), launch);
  csm.blendTo(parked, cutoff1, earthCentre);
  csm.coast(at('1969-07-16T16:16:16Z'));
  const check = norm(
    sub(
      csm.state.slice(0, 3),
      propagate(afterTli, tliEnd, csm.time, accel).slice(0, 3),
    ),
  );
  console.log(
    `  parking orbit vs TLI start: ${Math.round(check)} km apart (expected ~2,000–3,000 along track)`,
  );
  csm.blendTo(afterTli, tliEnd, earthCentre);

  // Translunar coast: one correction aimed at a 111 km closest approach at
  // the LOI cutoff time, in an orbit plane over the landing site.
  csm.coast(at('1969-07-17T16:17:00Z'));
  const siteNow = sub(site(landing).slice(0, 3), env.moon(landing));
  targetBurn(
    csm,
    accel,
    at('1969-07-19T19:00Z'),
    (rows) => {
      const p = perilune(rows, env, accel);
      const h = unit(cross(p.selene.slice(0, 3), p.selene.slice(3, 6)));
      return [
        (p.altitude - 111) / 5,
        (p.time - at('1969-07-19T17:27:30Z')) / 120000,
        dot(h, unit(siteNow)) / 0.01,
      ];
    },
    [0, 0, 0],
    'MCC-2',
  );
  csm.coast(at('1969-07-19T17:24:49Z'));
  lunarBurn(csm, env, 60.0 * NMI, 169.7 * NMI, 'LOI-1');
  inclination('Apollo 11 orbit', csm, env);
  // The circularisation's apolune, within a few km of the published one,
  // sets the period so that Columbia is opposite the start of the powered
  // descent (480 km uprange of the site) at the published DOI time: the
  // reconstruction then keeps the real timing on the Moon.
  const doiTime = at('1969-07-20T19:08:29Z');
  const phaseMiss = (apo) => {
    const craft = journey(accel, csm.state, csm.time);
    lunarBurnNear(
      craft,
      accel,
      env,
      at('1969-07-19T21:43:45Z'),
      54.5 * NMI,
      apo,
      '',
      40 * MINUTE,
      true,
    );
    craft.coast(doiTime);
    return descentPhase(sub(craft.state, env.moonState(doiTime)), siteNow, 480);
  };
  const [a1, m1] = secant(phaseMiss, 66.1 * NMI, 66.1 * NMI + 5, {
    min: 54.5 * NMI + 2,
    max: 250,
  });
  console.log(
    `  LOI-2 apolune ${a1.toFixed(1)} km (published ${(66.1 * NMI).toFixed(1)}), phase off ${((m1 * 180) / Math.PI).toFixed(2)}°`,
  );
  lunarBurnNear(
    csm,
    accel,
    env,
    at('1969-07-19T21:43:45Z'),
    54.5 * NMI,
    a1,
    'LOI-2',
  );

  // Undocking: Eagle starts from Columbia's state.
  const undock = at('1969-07-20T17:44:00Z');
  csm.coast(undock);
  const lm = journey(accel, csm.state.slice(), undock);
  // DOI at its published time, where Columbia's orbit now puts it: the
  // point opposite the descent start becomes the new orbit's apolune.
  lm.coast(doiTime);
  const here = norm(sub(lm.state.slice(0, 3), env.moon(doiTime))) - MOON_R;
  lunarBurn(lm, env, 7.8 * NMI, here, 'DOI');
  lm.coast(at('1969-07-20T20:05:05Z'));
  report('PDI', lm, env, site(lm.time));
  lm.blendTo(site(landing), landing, env.moonState);
  const liftoff = at('1969-07-21T17:54:00Z');
  lm.stay(site, liftoff);
  // Ascent into a 17 × 89 km orbit in Columbia's plane, some 300 km on.
  csm.coast(at('1969-07-21T18:01:15Z'));
  const insertion = (() => {
    const time = csm.time;
    const moon = env.moonState(time);
    const c = sub(csm.state, moon);
    const n = unit(cross(c.slice(0, 3), c.slice(3, 6)));
    const s = sub(site(time).slice(0, 3), moon.slice(0, 3));
    const inPlane = unit(sub(s, scale(n, dot(s, n))));
    const dir = add(
      scale(inPlane, Math.cos(0.17)),
      scale(cross(n, inPlane), Math.sin(0.17)),
    );
    const r = MOON_R + 9.4 * NMI;
    const a = MOON_R + (9.4 * NMI + 48.0 * NMI) / 2;
    const v = Math.sqrt(MU_MOON * (2 / r - 1 / a));
    return add(moon, [...scale(dir, r), ...scale(cross(n, dir), v)]);
  })();
  lm.blendTo(insertion, csm.time, env.moonState);
  lunarBurnNear(
    lm,
    accel,
    env,
    at('1969-07-21T18:51:58Z'),
    45.7 * NMI,
    49.3 * NMI,
    'CSI',
    20 * MINUTE,
  );
  lunarBurnNear(
    lm,
    accel,
    env,
    at('1969-07-21T19:50:00Z'),
    42.1 * NMI,
    47.4 * NMI,
    'CDH',
    20 * MINUTE,
  );
  lm.coast(at('1969-07-21T20:36:03Z'));
  const docking = at('1969-07-21T21:35:00Z');
  csm.coast(docking);
  lm.blendTo(csm.state, docking, env.moonState);

  // Home: TEI aimed at the entry corridor at the published entry time, at
  // whichever point of the orbit near the real burn costs least.
  const entryTime = at('1969-07-24T16:35:05Z');
  homeward(csm, accel, at('1969-07-22T04:56:58Z'), entryTime, 1.0, 'TEI');
  csm.coast(entryTime);
  const splash = (time) => earthSiteState(13.3, -169.15, 0, time);
  csm.blendTo(splash(end), end, earthCentre, { settle: true });
  return {
    start: launch,
    stop: end,
    craft: [
      { key: 'columbia', rows: csm.rows },
      { key: 'eagle', rows: lm.rows },
    ],
  };
}

/** Launch from Kennedy Space Center to an Apollo parking orbit given by
 * its tabulated state (Apollo by the Numbers: geocentric latitude and
 * longitude, altitude, space-fixed speed, flight-path angle, heading). */
function apolloLaunch(accel, launch, insertion, local) {
  const pad = earthSiteState(28.447, -80.6041, 0, launch);
  const craft = journey(accel, pad, launch);
  craft.blendTo(stateFromLocal(local, insertion), insertion, earthCentre);
  return craft;
}

// --- Apollo 8 -------------------------------------------------------------------

async function apollo8() {
  const launch = at('1968-12-21T12:51:00Z');
  const end = at('1968-12-27T15:51:42Z');
  const { env, accel } = await environment(launch, end);
  const csm = apolloLaunch(accel, launch, at('1968-12-21T13:02:24.98Z'), {
    lat: 32.4541,
    lon: -54.0565,
    alt: 103.324 * NMI,
    speed: 25562.43 * FPS,
    fpa: -0.001,
    heading: 88.098,
  });
  // After TLI, the S-IVB's trajectory from Horizons, run back to cutoff.
  const sivb = await vectors(
    '-399080',
    at('1968-12-21T16:05Z'),
    at('1968-12-21T16:10Z'),
    MINUTE,
  );
  const tliEnd = at('1968-12-21T15:46:55Z');
  const afterTli = propagate(
    sivb.at(-1).slice(1),
    sivb.at(-1)[0],
    tliEnd,
    accel,
  );
  csm.coast(at('1968-12-21T15:41:38Z'));
  csm.blendTo(afterTli, tliEnd, earthCentre);
  // The first correction aims at a 111 km closest approach at the end of
  // the LOI burn, in a retrograde orbit 12° from the Moon's equator.
  csm.coast(at('1968-12-21T23:51:00Z'));
  targetBurn(
    csm,
    accel,
    at('1968-12-24T12:00Z'),
    (rows) => {
      const p = perilune(rows, env, accel);
      const h = unit(cross(p.selene.slice(0, 3), p.selene.slice(3, 6)));
      const pole = moonAxes(p.time)[2];
      return [
        (p.altitude - 111) / 5,
        (p.time - at('1968-12-24T10:04:00Z')) / 120000,
        (dot(h, pole) - Math.cos((168 * Math.PI) / 180)) / 0.005,
      ];
    },
    [0, 0, 0],
    'MCC-1',
  );
  csm.coast(at('1968-12-24T10:01:24Z'));
  lunarBurn(csm, env, 60.0 * NMI, 168.5 * NMI, 'LOI');
  inclination('Apollo 8 orbit', csm, env);
  lunarBurnNear(
    csm,
    accel,
    env,
    at('1968-12-24T14:26:11Z'),
    59.7 * NMI,
    60.7 * NMI,
    'Circularisation',
  );
  const entryTime = at('1968-12-27T15:37:12Z');
  homeward(csm, accel, at('1968-12-25T06:11:58Z'), entryTime, 1.07, 'TEI');
  csm.coast(entryTime);
  csm.blendTo(earthSiteState(8.125, -165.02, 0, end), end, earthCentre, {
    settle: true,
  });
  return { start: launch, stop: end, craft: [{ key: 'csm', rows: csm.rows }] };
}

// --- Apollo 13 ------------------------------------------------------------------

async function apollo13() {
  const launch = at('1970-04-11T19:13:00Z');
  const end = at('1970-04-17T18:07:41Z');
  const { env, accel } = await environment(launch, end);
  const csm = apolloLaunch(accel, launch, at('1970-04-11T19:25:39.83Z'), {
    lat: 32.5249,
    lon: -50.4902,
    alt: 103.472 * NMI,
    speed: 25566.1 * FPS,
    fpa: 0.005,
    heading: 90.148,
  });
  // No Horizons track: TLI (impulsive, mid-burn) is aimed at the planned
  // free return, 389 km past the Moon around 00:21 on the 15th, and drawn as
  // a blend over the real burn.
  const ignition = at('1970-04-11T21:48:46Z');
  const tliEnd = at('1970-04-11T21:54:37Z');
  const middle = at('1970-04-11T21:51:42Z');
  csm.coast(ignition);
  const atMiddle = propagate(csm.state, ignition, middle, accel);
  const frame = frameOf(atMiddle);
  const flyby = at('1970-04-15T00:21:00Z');
  // First aim at a point behind the Moon at the flyby (smooth, three
  // equations), then refine for the closest approach itself.
  const behind = add(
    env.moon(flyby),
    scale(unit(env.moon(flyby)), MOON_R + 389),
  );
  const aimed = solve(
    (x) => {
      const s = add(atMiddle, [0, 0, 0, ...inFrame(frame, x)]);
      const end = propagate(s, middle, flyby, accel.moonless);
      return sub(end.slice(0, 3), behind).map((value) => value / 50);
    },
    [3.1, 0, 0],
    { step: [1e-5, 1e-5, 1e-5], tolerance: 1, label: 'TLI aim', limit: 0.1 },
  );
  const tli = solve(
    (x) => {
      const s = add(atMiddle, [0, 0, 0, ...inFrame(frame, x)]);
      const rows = integrate(s, middle, at('1970-04-15T06:00Z'), accel, {
        maxStep: 1800,
      });
      const p = perilune(rows, env, accel);
      return [(p.altitude - 389) / 5, (p.time - flyby) / 120000];
    },
    aimed,
    { step: [1e-5, 1e-5, 1e-5], tolerance: 0.05, label: 'TLI', limit: 0.05 },
  );
  const afterTli = propagate(
    add(atMiddle, [0, 0, 0, ...inFrame(frame, tli)]),
    middle,
    tliEnd,
    accel,
  );
  console.log(`  TLI: ${(norm(tli) * 1000).toFixed(0)} m/s`);
  csm.blendTo(afterTli, tliEnd, earthCentre);
  // The hybrid transfer: closest approach lowered to 109 km.
  csm.coast(at('1970-04-13T01:53:51Z'));
  targetBurn(
    csm,
    accel,
    at('1970-04-15T06:00Z'),
    (rows) => {
      const p = perilune(rows, env, accel);
      return [(p.altitude - 109) / 5, (p.time - flyby) / 120000];
    },
    [0, 0, 0],
    'Hybrid transfer',
  );
  // After the explosion the LM's descent engine puts them back on a free
  // return: 254 km past the far side at 00:21 on the 15th.
  csm.coast(at('1970-04-14T08:43:00Z'));
  targetBurn(
    csm,
    accel,
    at('1970-04-19T12:00Z'),
    (rows) => {
      const p = perilune(rows, env, accel);
      // A free return: after the Moon, a vacuum perigee in the entry
      // corridor (~40 km). Loosely (this burn leaves it ~450 km up): PC+2
      // retargets the entry two hours after the Moon, so only the path up
      // to then is drawn from this burn.
      // (From the osculating orbit near closest approach: smooth, unlike
      // the nearest sample.)
      let low = rows.at(-1);
      for (const row of rows)
        if (row[0] > p.time && norm(row.slice(1, 4)) < norm(low.slice(1, 4)))
          low = row;
      const perigee = apsides(low.slice(1), MU_EARTH).peri - EARTH_R;
      return [
        (p.altitude - 254) / 5,
        (p.time - flyby) / 1200000,
        (perigee - 40) / 1000,
      ];
    },
    [0, 0, 0],
    'DPS-1',
    1,
  );
  // PC+2: two hours after the Moon, a burn to come home sooner, aimed at the
  // entry corridor at the published entry time.
  csm.coast(at('1970-04-15T02:42:51Z'));
  const entryTime = at('1970-04-17T17:53:45Z');
  targetBurn(
    csm,
    accel,
    entryTime + HOUR,
    (rows) => corridor(rows, entryTime),
    [0.26, 0, 0],
    'PC+2',
  );
  csm.coast(entryTime);
  csm.blendTo(earthSiteState(-21.633, -165.367, 0, end), end, earthCentre, {
    settle: true,
  });
  return {
    start: launch,
    stop: end,
    craft: [{ key: 'stack', rows: csm.rows }],
  };
}

// --- Early orbits -----------------------------------------------------------------

const BAIKONUR = [45.92, 63.342];

/** The point `distance` km from (lat, lon) along azimuth `azimuth` (degrees
 * east of north) on a sphere: where a rocket's ascent ends. */
function downrange([lat, lon], azimuth, distance) {
  const [p, a, d] = [lat * DEG, azimuth * DEG, distance / EARTH_R];
  const p2 = Math.asin(
    Math.sin(p) * Math.cos(d) + Math.cos(p) * Math.sin(d) * Math.cos(a),
  );
  const l2 =
    lon * DEG +
    Math.atan2(
      Math.sin(a) * Math.sin(d) * Math.cos(p),
      Math.cos(d) - Math.sin(p) * Math.sin(p2),
    );
  return [p2 / DEG, l2 / DEG];
}
/** Northbound heading (degrees) at latitude `lat` on an orbit of
 * inclination `inclination`. */
const heading = (lat, inclination) =>
  Math.asin(Math.cos(inclination * DEG) / Math.cos(lat * DEG)) / DEG;

/** A launch from `pad` into an orbit of the published perigee and apogee
 * altitudes and inclination, entered at perigee `distance` km downrange
 * at `insertion` (heading north-east, as from Baikonur). */
function launchToOrbit(accel, pad, launch, insertion, orbit) {
  const { peri, apo, inclination, distance } = orbit;
  const azimuth = heading(pad[0], inclination);
  const [lat, lon] = downrange(pad, azimuth, distance);
  const rp = EARTH_R + peri;
  const a = EARTH_R + (peri + apo) / 2;
  const state = stateFromLocal(
    {
      lat,
      lon,
      alt: peri,
      speed: Math.sqrt(MU_EARTH * (2 / rp - 1 / a)),
      fpa: 0,
      heading: heading(lat, inclination),
    },
    insertion,
  );
  const craft = journey(accel, earthSiteState(...pad, 0, launch), launch);
  craft.blendTo(state, insertion, earthCentre);
  return craft;
}

async function sputnik1() {
  const launch = at('1957-10-04T19:28:34Z');
  const end = at('1957-10-05T19:30Z');
  const { accel } = await environment(launch, end);
  // Separation 314.5 s after liftoff into a 215 × 939 km orbit at 65.1°
  // (96.2 minutes): the first day of its three months in orbit.
  const sputnik = launchToOrbit(
    accel,
    BAIKONUR,
    launch,
    at('1957-10-04T19:33:48.5Z'),
    { peri: 215, apo: 939, inclination: 65.1, distance: 1000 },
  );
  sputnik.coast(end);
  const { peri, apo } = apsides(sputnik.state, MU_EARTH);
  console.log(
    `  after a day: ${Math.round(peri - EARTH_R)} × ${Math.round(apo - EARTH_R)} km`,
  );
  return {
    start: launch,
    stop: end,
    craft: [{ key: 'sputnik', rows: sputnik.rows }],
  };
}

async function vostok1() {
  const launch = at('1961-04-12T06:07:00Z');
  const end = at('1961-04-12T07:55:00Z');
  const { accel } = await environment(launch, end);
  // Into a 181 × 327 km orbit at 64.95° about 11 minutes after liftoff.
  const vostok = launchToOrbit(
    accel,
    BAIKONUR,
    launch,
    at('1961-04-12T06:17:00Z'),
    { peri: 181, apo: 327, inclination: 64.95, distance: 2000 },
  );
  // Retrofire over Africa at 07:25 (impulsive, mid-burn), aimed so the
  // path reaches 100 km a few minutes after the descent module separated
  // (07:35).
  const retro = at('1961-04-12T07:25:20Z');
  const entryTime = at('1961-04-12T07:38:00Z');
  vostok.coast(retro);
  const frame = frameOf(vostok.state);
  const [dv] = solve(
    ([along]) => {
      const s = add(vostok.state, [0, 0, 0, ...inFrame(frame, [along, 0, 0])]);
      const rows = integrate(s, retro, at('1961-04-12T07:50Z'), accel);
      return [corridor100(rows, entryTime)];
    },
    [-0.15],
    { step: [1e-5], tolerance: 0.01, label: 'Retrofire' },
  );
  console.log(`  Retrofire: ${(-dv * 1000).toFixed(0)} m/s`);
  vostok.burn(inFrame(frame, [dv, 0, 0]));
  vostok.coast(entryTime);
  const site = earthSiteState(51.2706, 45.9972, 0, end);
  const arc =
    Math.acos(dot(unit(vostok.state.slice(0, 3)), unit(site))) * EARTH_R;
  const n = unit(cross(vostok.state.slice(0, 3), vostok.state.slice(3, 6)));
  const off = Math.asin(dot(n, unit(site))) * EARTH_R;
  console.log(
    `  at 100 km: ${Math.round(arc)} km from the landing site, ${Math.round(off)} km off the track`,
  );
  // Ejection at 7 km and parachute: the landing near Smelovka, Saratov.
  vostok.blendTo(site, end, earthCentre, { settle: true });
  return {
    start: launch,
    stop: end,
    craft: [{ key: 'vostok', rows: vostok.rows }],
  };
}

/** Minutes between `time` and when the path first gets down to 100 km. */
function corridor100(rows, time) {
  for (let k = 1; k < rows.length; k++) {
    const altitude = norm(rows[k].slice(1, 4)) - EARTH_R;
    if (altitude > 100) continue;
    const before = norm(rows[k - 1].slice(1, 4)) - EARTH_R;
    const u = (before - 100) / (before - altitude);
    return (rows[k - 1][0] + u * (rows[k][0] - rows[k - 1][0]) - time) / 60000;
  }
  return 1000;
}

// --- Chang'e ----------------------------------------------------------------------

const WENCHANG = [19.614, 110.951];
const XICHANG = [28.246, 102.027];

/** A launch into a 200 km parking orbit whose plane holds the pad and the
 * point opposite the Moon at `arrival` (no published parking orbit: the
 * plane a translunar injection needs), then the injection (impulsive at
 * mid-burn, drawn as a blend over the burn) aimed at a closest approach
 * `altitude` km above the Moon at `arrival`. */
function lunarDeparture(accel, env, trip) {
  const { pad, launch, insertion, ignition, cutoff, arrival, altitude } = trip;
  const middle = (ignition + cutoff) / 2;
  const pad0 = earthSiteState(...pad, 0, launch);
  // A parking orbit through the pad, its plane turned by `psi` about the
  // pad, and the burn at its middle aimed at a point behind the Moon at
  // `aim` without the Moon's pull (smooth; from a two-body Lambert guess).
  const plan = (psi, aim, quiet = true) => {
    const away = scale(unit(env.moon(aim)), -1);
    let n0 = unit(cross(pad0.slice(0, 3), away));
    if (dot(n0, earthPole(launch)) < 0) n0 = scale(n0, -1);
    const behind = add(
      env.moon(aim),
      scale(unit(env.moon(aim)), MOON_R + altitude),
    );
    const n = rotateAbout(n0, unit(pad0.slice(0, 3)), psi);
    // 2° past the point opposite the Moon: a transfer of about 178°
    // (180° exactly leaves the plane undefined).
    const point = rotateAbout(
      unit(sub(away, scale(n, dot(away, n)))),
      n,
      2 * DEG,
    );
    const r = EARTH_R + 200;
    const parked = [
      ...scale(point, r),
      ...scale(cross(n, point), Math.sqrt(MU_EARTH / r)),
    ];
    const inserted = propagate(parked, middle, insertion, accel);
    const atMiddle = propagate(
      propagate(inserted, insertion, ignition, accel),
      ignition,
      middle,
      accel,
    );
    const frame = frameOf(atMiddle);
    const { v1 } = lambert(
      atMiddle.slice(0, 3),
      behind,
      (aim - middle) / 1000,
      MU_EARTH,
    );
    const dv0 = sub(v1, atMiddle.slice(3, 6));
    const aimed = solve(
      (x) => {
        const s = add(atMiddle, [0, 0, 0, ...inFrame(frame, x)]);
        const end = propagate(s, middle, aim, accel.moonless);
        return sub(end.slice(0, 3), behind).map((value) => value / 50);
      },
      [dot(dv0, frame.t), dot(dv0, frame.r), dot(dv0, frame.n)],
      {
        step: [1e-5, 1e-5, 1e-5],
        tolerance: 1,
        label: 'TLI aim',
        limit: 0.1,
        quiet,
      },
    );
    return { n, inserted, atMiddle, frame, aimed };
  };
  // Near 180° a path's plane barely reaches the far end: the Sun's pull
  // over five days would cost a big sideways burn. Turn the parking orbit
  // instead (the launch azimuth) until the injection is all in its plane.
  // The Moon's pull brings a slow arrival hours early: aim that much later,
  // until the closest approach (seen from 40,000 km out) is within 20
  // minutes of the time wanted.
  let aim = arrival;
  let psi = 0;
  let best;
  for (let k = 0; k < 6; k++) {
    [psi] = secant((value) => plan(value, aim).aimed[2], psi, psi + 0.01, {
      min: -0.5,
      max: 0.5,
      tolerance: 1e-4,
    });
    best = plan(psi, aim, false);
    const s = add(best.atMiddle, [0, 0, 0, ...inFrame(best.frame, best.aimed)]);
    const rows = integrate(s, middle, aim + 6 * HOUR, accel, { maxStep: 1800 });
    const late = incoming(rows, env).time - arrival;
    if (Math.abs(late) < 20 * MINUTE) break;
    aim -= late;
  }
  console.log(
    `  aimed ${((aim - arrival) / HOUR).toFixed(2)} h late without the Moon`,
  );
  const { n, inserted, atMiddle, frame, aimed } = best;
  const downrange =
    angleIn(n, pad0.slice(0, 3), inserted.slice(0, 3)) * EARTH_R;
  console.log(
    `  parking orbit turned ${(psi / DEG).toFixed(2)}°, entered ${Math.round(downrange)} km downrange`,
  );
  const craft = journey(accel, pad0, launch);
  craft.blendTo(inserted, insertion, earthCentre);
  craft.coast(ignition);
  // Then with the Moon: first the two-body hyperbola about the Moon from
  // where the path comes within 40,000 km of it (smooth, and no trial
  // path crashing into it), then the closest approach itself.
  let tli = aimed;
  for (const [estimate, label] of [
    [(rows) => incoming(rows, env), 'TLI (incoming)'],
    [(rows) => perilune(rows, env, accel), 'TLI'],
  ])
    tli = solve(
      (x) => {
        const s = add(atMiddle, [0, 0, 0, ...inFrame(frame, x)]);
        const rows = integrate(s, middle, arrival + 6 * HOUR, accel, {
          maxStep: 1800,
        });
        const p = estimate(rows);
        return [(p.altitude - altitude) / 5, (p.time - arrival) / 120000];
      },
      tli,
      { step: [1e-5, 1e-5, 1e-5], tolerance: 0.05, label, limit: 0.05 },
    );
  console.log(`  TLI: ${(norm(tli) * 1000).toFixed(0)} m/s`);
  craft.blendTo(
    propagate(
      add(atMiddle, [0, 0, 0, ...inFrame(frame, tli)]),
      middle,
      cutoff,
      accel,
    ),
    cutoff,
    earthCentre,
  );
  return craft;
}

/** A correction now aimed at a closest approach `altitude` km up at about
 * `arrival`, in a plane over the (selenocentric) `sites`; with `descent`
 * ({ site, uprange }), also opposite the start of the powered descent
 * (braking there makes it the high point of the final low orbit). Returns
 * the time of the closest approach. */
function lunarApproach(
  craft,
  accel,
  env,
  arrival,
  altitude,
  sites,
  label,
  descent,
) {
  const until = arrival + 6 * HOUR;
  targetBurn(
    craft,
    accel,
    until,
    (rows) => {
      const p = perilune(rows, env, accel);
      const h = unit(cross(p.selene.slice(0, 3), p.selene.slice(3, 6)));
      const low = [...p.direction, ...p.selene.slice(3, 6)];
      return [
        (p.altitude - altitude) / 5,
        (p.time - arrival) / 600000,
        ...sites.map((site) => dot(h, unit(site)) / 0.01),
        ...(descent
          ? [descentPhase(low, descent.site, descent.uprange) / 0.01]
          : []),
      ];
    },
    [0, 0, 0],
    label,
    0.5,
  );
  const rows = integrate(craft.state, craft.time, until, accel, {
    maxStep: 1800,
  });
  const time = perilune(rows, env, accel).time;
  console.log(
    `  closest approach ${((time - arrival) / MINUTE).toFixed(1)} min from the published time`,
  );
  return time;
}

/** Closest approaches to the Moon (times) over `rows`. */
function perilunes(rows, env) {
  const d = rows.map((row) => norm(sub(row.slice(1, 4), env.moon(row[0]))));
  const times = [];
  for (let k = 1; k < d.length - 1; k++)
    if (d[k] < d[k - 1] && d[k] <= d[k + 1])
      times.push(perilune(rows.slice(k - 1, k + 2), env).time);
  return times;
}

/** A burn now into a `peri` × `apo` km lunar orbit (`peri` null: the
 * current height), `apo` chosen (from `guess`) so that a closest approach
 * falls at `next`, where the next burn is published. */
function lunarBurnFor(craft, accel, env, peri, guess, next, label) {
  if (peri === null)
    peri = norm(sub(craft.state.slice(0, 3), env.moon(craft.time))) - MOON_R;
  const miss = (apo) => {
    const trial = journey(accel, craft.state.slice(), craft.time);
    lunarBurn(trial, env, peri, apo, '', true);
    const rows = integrate(trial.state, trial.time, next + 6 * HOUR, accel, {
      maxStep: 60,
    });
    const times = perilunes(rows, env);
    let best = times[0];
    for (const t of times)
      if (Math.abs(t - next) < Math.abs(best - next)) best = t;
    return (best - next) / HOUR;
  };
  const [apo, off] = secant(miss, guess, guess * 1.01, {
    min: peri + 10,
    tolerance: 0.01,
  });
  console.log(
    `  ${label} apolune ${apo.toFixed(0)} km (${(off * 60).toFixed(1)} min off)`,
  );
  lunarBurn(craft, env, peri, apo, label);
}

/** Where in its orbit (`craft` now, in lunar orbit) a burn home at `time`
 * should be, to reach the entry corridor (121.9 km, `angle`) at
 * `entryTime` from a hyperbola `altitude` km above the Moon: the Moon's
 * velocity change needed (solved from the Moon's centre without its pull),
 * turned back to the hyperbola's low point. Returns the selenocentric
 * direction of that point and the hyperbolic excess speed. */
function departurePoint(craft, accel, env, time, entryTime, angle, altitude) {
  const moon = env.moonState(time);
  const back = scale(unit(moon.slice(3, 6)), -0.95);
  const vinf = solve(
    (x) =>
      corridor(
        integrate(
          [...moon.slice(0, 3), ...add(moon.slice(3, 6), x)],
          time,
          entryTime + HOUR,
          accel.moonless,
          { maxStep: 1800 },
        ),
        entryTime,
        angle,
      ),
    back,
    { step: [1e-5, 1e-5, 1e-5], tolerance: 0.05, label: 'Departure' },
  );
  const c = sub(craft.state, env.moonState(craft.time));
  const h = unit(cross(c.slice(0, 3), c.slice(3, 6)));
  const v = norm(vinf);
  const e = 1 + ((MOON_R + altitude) * v * v) / MU_MOON;
  const along = unit(sub(vinf, scale(h, dot(vinf, h))));
  console.log(
    `  departure: v∞ ${(v * 1000).toFixed(0)} m/s, ${((Math.asin(dot(unit(vinf), h)) * 180) / Math.PI).toFixed(1)}° out of the orbit plane`,
  );
  return {
    point: rotateAbout(along, h, -Math.acos(-1 / e)),
    speed: v,
  };
}

/** The point to enter a `peri` × `apo` orbit in `orbiter`'s plane after an
 * ascent from `site` at `time`, `ahead` km on from the site. */
function ascentInsertion(orbiter, env, site, time, peri, apo, ahead) {
  const moon = env.moonState(time);
  const c = sub(orbiter.state, moon);
  const n = unit(cross(c.slice(0, 3), c.slice(3, 6)));
  const s = sub(site(time).slice(0, 3), moon.slice(0, 3));
  const inPlane = unit(sub(s, scale(n, dot(s, n))));
  const dir = rotateAbout(inPlane, n, ahead / MOON_R);
  const r = MOON_R + peri;
  const a = MOON_R + (peri + apo) / 2;
  const v = Math.sqrt(MU_MOON * (2 / r - 1 / a));
  return add(moon, [...scale(dir, r), ...scale(cross(n, dir), v)]);
}

/** A halo orbit about the Earth–Moon L2 point (linear model: in the frame
 * turning with the Moon, x away from Earth, z along the Moon's orbit pole;
 * x = −Ax cos τ, y = k·Ax sin τ, z = Az cos τ), as a geocentric state
 * function of time. Its phase is 0 at `epoch`. */
function haloOrbit(env, { epoch, period, ay, az, k = 2.9 }) {
  const position = (time) => {
    const m = env.moonState(time);
    const x = unit(m.slice(0, 3));
    const z = unit(cross(m.slice(0, 3), m.slice(3, 6)));
    const y = cross(z, x);
    // L2 sits 0.1678 Earth–Moon distances beyond the Moon.
    const d = norm(m.slice(0, 3));
    const tau = (2 * Math.PI * (time - epoch)) / period;
    const local = [
      0.1678 * d - (ay / k) * Math.cos(tau),
      ay * Math.sin(tau),
      az * Math.cos(tau),
    ];
    return add(
      m.slice(0, 3),
      add(add(scale(x, local[0]), scale(y, local[1])), scale(z, local[2])),
    );
  };
  return (time) => {
    const p = position(time);
    return [...p, ...sub(position(time + 1000), p)];
  };
}

async function change4() {
  const launch = at('2018-05-20T21:28:00Z');
  const end = at('2019-01-04T00:00:00Z');
  const { env, accel } = await environment(launch, end);

  // Queqiao: Long March 4C to a translunar orbit, a braking burn 100 km
  // above the Moon, then three weeks out to its halo orbit about L2.
  const queqiao = lunarDeparture(accel, env, {
    pad: XICHANG,
    launch,
    insertion: at('2018-05-20T21:39:00Z'),
    ignition: at('2018-05-20T21:46:00Z'),
    cutoff: at('2018-05-20T21:53:00Z'),
    arrival: at('2018-05-25T13:48:00Z'),
    altitude: 100,
  });
  queqiao.coast(at('2018-05-25T13:48:00Z'));
  // The braking leaves it slowly escaping the Moon (~300 m/s to spare);
  // the published transfer is not, so the next 18 days are a blend into
  // the halo orbit (period 14 days; 13,000 km north–south).
  const s = sub(queqiao.state, env.moonState(queqiao.time));
  const r = norm(s.slice(0, 3));
  const v = norm(s.slice(3, 6));
  const keep = Math.sqrt((2 * MU_MOON) / r + 0.3 ** 2);
  console.log(`  Queqiao braking: ${((v - keep) * 1000).toFixed(0)} m/s`);
  queqiao.burn(scale(unit(s.slice(3, 6)), keep - v));
  queqiao.coast(at('2018-05-27T13:48:00Z'));
  const haloStart = at('2018-06-14T03:06:00Z');
  const halo = haloOrbit(env, {
    epoch: haloStart,
    period: 14 * DAY,
    ay: 38000,
    az: 13000,
  });
  queqiao.blendTo(halo(haloStart), haloStart, env.moonState);
  queqiao.stay(halo, end, 2 * HOUR);

  // Chang'e 4: Long March 3B straight into a translunar orbit; braking
  // 100 km above the Moon into a 100 × ~400 km orbit over the landing site.
  const site = moonSite(env, -45.4446, 177.5991);
  const landing = at('2019-01-03T02:26:00Z');
  const siteAt = (time) => sub(site(time).slice(0, 3), env.moon(time));
  const arrival = at('2018-12-12T08:42:00Z');
  const lander = lunarDeparture(accel, env, {
    pad: XICHANG,
    launch: at('2018-12-07T18:23:34Z'),
    insertion: at('2018-12-07T18:34:00Z'),
    ignition: at('2018-12-07T18:37:00Z'),
    cutoff: at('2018-12-07T18:42:00Z'),
    arrival,
    altitude: 100,
  });
  // One correction aims the closest approach, in a plane over the landing
  // site.
  lander.coast(at('2018-12-09T00:00:00Z'));
  const brake = lunarApproach(
    lander,
    accel,
    env,
    arrival,
    100,
    [siteAt(landing)],
    'Correction',
  );
  lander.coast(brake);
  lunarBurn(lander, env, 100, 400, 'Braking');
  inclination('Chang’e 4 orbit', lander, env);
  // Eighteen days in lunar orbit. The real adjustments are not published:
  // here one, on 20 December, into a near-circular ~100 km orbit whose
  // period brings the lander, on 30 December, opposite the start of the
  // powered descent (420 km uprange); the burn there into 15 × 100 km is
  // timed for the low point to come round at 02:15 on 3 January.
  const pdi = at('2019-01-03T02:15:00Z');
  const half = Math.PI * Math.sqrt((MOON_R + 57.5) ** 3 / MU_MOON) * 1000;
  const lowered =
    pdi -
    half -
    Math.round((pdi - half - at('2018-12-30T00:55:00Z')) / (2 * half)) *
      2 *
      half;
  const adjust = at('2018-12-20T00:00:00Z');
  const phaseMiss = (apo) => {
    const craft = journey(accel, lander.state.slice(), lander.time);
    lunarBurnNear(craft, accel, env, adjust, 100, apo, '', 70 * MINUTE, true);
    craft.coast(lowered);
    return descentPhase(
      sub(craft.state, env.moonState(lowered)),
      siteAt(landing),
      420,
    );
  };
  // (The phase wraps every ~20 km of apolune.)
  const [apo, phase] = scanRoot(phaseMiss, 101, 141, 2);
  console.log(
    `  adjustment apolune ${apo.toFixed(1)} km, phase off ${((phase * 180) / Math.PI).toFixed(2)}°`,
  );
  lunarBurnNear(
    lander,
    accel,
    env,
    adjust,
    100,
    apo,
    'Adjustment',
    70 * MINUTE,
  );
  lander.coast(lowered);
  const here = norm(sub(lander.state.slice(0, 3), env.moon(lowered))) - MOON_R;
  lunarBurn(lander, env, 15, here, 'Lowering');
  lander.coast(pdi);
  report('Powered descent', lander, env, site(pdi));
  lander.blendTo(site(landing), landing, env.moonState);
  lander.stay(site, end);
  return {
    start: launch,
    stop: end,
    craft: [
      { key: 'queqiao', rows: queqiao.rows },
      { key: 'lander', rows: lander.rows },
    ],
  };
}

async function change5() {
  const launch = at('2020-11-23T20:30:12Z');
  const end = at('2020-12-16T17:59:00Z');
  const { env, accel } = await environment(launch, end);
  const site = moonSite(env, 43.0576, -51.9161);
  const landing = at('2020-12-01T15:11:21Z');
  const liftoff = at('2020-12-03T15:10:21Z');
  const siteAt = (time) => sub(site(time).slice(0, 3), env.moon(time));
  // Long March 5: parking orbit, then the second stage's restart; the
  // spacecraft separated 36 minutes after liftoff. The braking burn began
  // 400 km up and lasted 17 minutes: closest approach taken as 200 km at
  // its middle.
  const arrival = at('2020-11-28T13:06:30Z');
  const orbiter = lunarDeparture(accel, env, {
    pad: WENCHANG,
    launch,
    insertion: at('2020-11-23T20:41:00Z'),
    ignition: at('2020-11-23T20:55:00Z'),
    cutoff: at('2020-11-23T21:06:00Z'),
    arrival,
    altitude: 200,
  });
  // Two corrections a day apart; the first does the aiming here, at the
  // closest approach and an orbit plane over the landing site both at
  // landing and at liftoff (so the ascender can reach the orbiter).
  orbiter.coast(at('2020-11-24T14:06:00Z'));
  lunarApproach(
    orbiter,
    accel,
    env,
    arrival,
    200,
    [siteAt(landing), siteAt(liftoff)],
    'Correction 1',
  );
  orbiter.coast(arrival);
  // Braking: into an ellipse whose closest point comes round at the time
  // of the second braking, which makes the orbit circular at 200 km.
  const brake2 = at('2020-11-29T12:26:00Z');
  lunarBurnFor(orbiter, accel, env, 200, 5500, brake2, 'Braking 1');
  inclination('Chang’e 5 orbit', orbiter, env);
  lunarBurnNear(orbiter, accel, env, brake2, 200, 200, 'Braking 2', 2 * HOUR);

  // Lander and ascender part from the orbiter and returner. Their own
  // orbit changes are not published: here a first one, a few hours on,
  // where the orbit passes opposite the start of the powered descent
  // (450 km uprange of the site), lowering the other side to whatever
  // height makes the period bring them back there half an orbit before
  // the descent; then the burn into 15 × 200 km.
  const separation = at('2020-11-29T20:40:00Z');
  orbiter.coast(separation);
  const lander = journey(accel, orbiter.state.slice(), separation);
  const pdi = at('2020-12-01T14:57:00Z');
  const doiTime = pdi - 3555 * 1000;
  coastToBest(
    lander,
    accel,
    at('2020-11-30T01:00:00Z'),
    70 * MINUTE,
    (state, t) =>
      Math.abs(
        descentPhase(sub(state, env.moonState(t)), siteAt(landing), 450),
      ),
  );
  const phaseMiss = (peri) => {
    const craft = journey(accel, lander.state.slice(), lander.time);
    lunarBurn(craft, env, peri, 200, '', true);
    craft.coast(doiTime);
    return descentPhase(
      sub(craft.state, env.moonState(doiTime)),
      siteAt(landing),
      450,
    );
  };
  const [peri, phase] = scanRoot(phaseMiss, 195, 20, -5);
  console.log(
    `  lander phasing orbit ${peri.toFixed(1)} × 200 km, phase off ${((phase * 180) / Math.PI).toFixed(2)}°`,
  );
  lunarBurn(lander, env, peri, 200, 'Lander phasing');
  lander.coast(doiTime);
  const here = norm(sub(lander.state.slice(0, 3), env.moon(doiTime))) - MOON_R;
  lunarBurn(lander, env, 15, here, 'Descent orbit');
  lander.coast(pdi);
  report('Powered descent', lander, env, site(pdi));
  lander.blendTo(site(landing), landing, env.moonState);
  lander.stay(site, liftoff);
  // The ascender: about six minutes to a 15 × 180 km orbit in the
  // orbiter's plane; then a circular orbit at whatever height brings it
  // just behind and below the orbiter half an hour before docking, and a
  // blend for the final approach (the real rendezvous: four burns by the
  // orbiter, two days of slowly closing in).
  const inserted = at('2020-12-03T15:16:21Z');
  orbiter.coast(inserted);
  lander.blendTo(
    ascentInsertion(orbiter, env, site, inserted, 15, 180, 250),
    inserted,
    env.moonState,
  );
  const docking = at('2020-12-05T21:42:00Z');
  const approach = docking - 30 * MINUTE;
  const lag = (height) => {
    const trial = journey(accel, lander.state.slice(), lander.time);
    lunarBurnNear(
      trial,
      accel,
      env,
      inserted + HOUR,
      height,
      height,
      '',
      50 * MINUTE,
      true,
    );
    trial.coast(approach);
    const target = journey(accel, orbiter.state.slice(), orbiter.time).coast(
      approach,
    );
    const moon = env.moonState(approach);
    const c = sub(trial.state, moon);
    const n = unit(cross(c.slice(0, 3), c.slice(3, 6)));
    // 0.5° behind.
    return (
      angleIn(n, sub(target.state, moon).slice(0, 3), c.slice(0, 3)) + 0.5 * DEG
    );
  };
  const [height, left] = scanRoot(lag, 195, 60, -5);
  console.log(
    `  ascender phasing orbit ${height.toFixed(1)} km (${((left * 180) / Math.PI).toFixed(2)}° off)`,
  );
  lunarBurnNear(
    lander,
    accel,
    env,
    inserted + HOUR,
    height,
    height,
    'Ascender circularisation',
    50 * MINUTE,
  );
  lander.coast(approach);
  orbiter.coast(docking);
  lander.blendTo(orbiter.state, docking, env.moonState);

  // Home: a first burn into an ellipse whose low point comes round a day
  // later, at the second burn, aimed at the entry corridor.
  // (The first burn where the orbit's low point will serve the second.)
  const tei2 = at('2020-12-13T01:51:00Z');
  const entryTime = at('2020-12-16T17:33:00Z');
  const tei1 = at('2020-12-12T01:54:00Z');
  orbiter.coast(tei1 - 90 * MINUTE);
  const { point, speed } = departurePoint(
    orbiter,
    accel,
    env,
    tei2,
    entryTime,
    -5.8,
    230,
  );
  coastToBest(orbiter, accel, tei1, 90 * MINUTE, (state, t) => {
    const c = sub(state.slice(0, 3), env.moon(t));
    return -dot(unit(c), point);
  });
  lunarBurnFor(orbiter, accel, env, null, 8600, tei2, 'Trans-Earth 1');
  const low = norm(sub(orbiter.state.slice(0, 3), env.moon(orbiter.time)));
  const guess =
    Math.sqrt(speed * speed + (2 * MU_MOON) / low) -
    norm(sub(orbiter.state, env.moonState(orbiter.time)).slice(3, 6));
  homeward(orbiter, accel, tei2, entryTime, guess, 'Trans-Earth 2', -5.8);
  orbiter.coast(entryTime);
  // Skip entry over the Arabian Sea, out and back in, to Siziwang Banner.
  const touchdown = earthSiteState(41.5, 111.7, 0, end);
  const arc =
    Math.acos(dot(unit(orbiter.state.slice(0, 3)), unit(touchdown))) * EARTH_R;
  console.log(`  entry ${Math.round(arc)} km from the landing site`);
  orbiter.blendTo(touchdown, end, earthCentre, { settle: true });
  return {
    start: launch,
    stop: end,
    craft: [
      { key: 'orbiter', rows: orbiter.rows },
      { key: 'lander', rows: lander.rows },
    ],
  };
}

// --- Tianwen-1 ------------------------------------------------------------------

/** The periapsis state (body-centred) of a hyperbola `altitude` km above a
 * body of radius `radius`, with excess velocity `vinf`, in the plane of
 * normal `n` (perpendicular to `vinf`): leaving along `vinf`, or with
 * `arriving`, coming in along it. */
function hyperbola(vinf, n, radius, altitude, mu, arriving = false) {
  const v = norm(vinf);
  const rp = radius + altitude;
  const e = 1 + (rp * v * v) / mu;
  const turn = Math.acos(-1 / e);
  const p = arriving
    ? rotateAbout(scale(unit(vinf), -1), n, turn)
    : rotateAbout(unit(vinf), n, -turn);
  const speed = Math.sqrt(v * v + (2 * mu) / rp);
  return [...scale(p, rp), ...scale(cross(n, p), speed)];
}

/** The unit normal perpendicular to `direction` closest to inclination
 * `inclination` (degrees) from `pole` (the least possible if that is out of
 * reach), on the prograde side. */
function planeNormal(direction, pole, inclination) {
  const d = unit(direction);
  const a = unit(sub(pole, scale(d, dot(pole, d))));
  const b = cross(d, a);
  // n = cos α a + sin α b makes cos(i) = cos α · |pole ⊥ d|.
  const reach = norm(sub(pole, scale(d, dot(pole, d))));
  const c = Math.min(1, Math.cos(inclination * DEG) / reach);
  return add(scale(a, c), scale(b, Math.sqrt(1 - c * c)));
}

/** A new two-body orbit through the current position with the given
 * periapsis and apoapsis altitudes (apoapsis null: here; 'keep': as it
 * was) and, if given, a
 * new inclination to the body's `pole` (degrees), turning about the
 * position: the velocity (body-centred) after a burn at `state`. */
function reshape(state, { peri, apo, inclination, pole, radius, mu }) {
  const r = state.slice(0, 3);
  const v = state.slice(3, 6);
  const rn = norm(r);
  const ra =
    apo === null ? rn : apo === 'keep' ? apsides(state, mu).apo : radius + apo;
  const rp = Math.min(radius + peri, rn);
  const a = (rp + ra) / 2;
  const speed = Math.sqrt(mu * (2 / rn - 1 / a));
  const h = Math.sqrt(mu * a * (1 - ((ra - rp) / (ra + rp)) ** 2));
  const across = Math.min(speed, h / rn);
  const radial =
    Math.sign(dot(r, v) || 1) * Math.sqrt(speed * speed - across * across);
  let n = unit(cross(r, v));
  if (inclination !== undefined) {
    // Turn the plane about r to the inclination (the nearer of the two).
    const u = unit(r);
    const e1 = unit(sub(pole, scale(u, dot(pole, u))));
    const e2 = cross(u, e1);
    const c = Math.min(
      1,
      Math.cos(inclination * DEG) / norm(sub(pole, scale(u, dot(pole, u)))),
    );
    const options = [1, -1].map((sign) =>
      add(scale(e1, c), scale(e2, sign * Math.sqrt(1 - c * c))),
    );
    n = dot(options[0], n) > dot(options[1], n) ? options[0] : options[1];
  }
  const u = unit(r);
  return [...r, ...add(scale(u, radial), scale(cross(n, u), across))];
}

async function tianwen1() {
  const launch = at('2020-07-23T04:41:15Z');
  const end = at('2021-05-15T00:00:00Z');
  const day0 = Math.floor(launch / DAY) * DAY - DAY;
  const day1 = Math.ceil(end / DAY) * DAY + DAY;
  const moi = at('2021-02-10T12:00:00Z');
  // Earth and Mars about the Sun (ICRF): daily, hourly near launch and
  // around Mars.
  const earthRows = merged(
    await vectors('399', day0, day1, DAY, '10'),
    await vectors('399', launch - HOUR, launch + 5 * DAY, HOUR, '10'),
  );
  const marsRows = merged(
    await vectors('499', day0, day1, DAY, '10'),
    await vectors('499', moi - 5 * DAY, end + HOUR, HOUR, '10'),
  );
  const earthAt = stateAt(earthRows);
  const marsAt = stateAt(marsRows);
  const earth = (time) => [...earthAt(time)];
  const mars = (time) => [...marsAt(time)];
  const pole = marsAxes(moi)[2];

  // Patched conics: a hyperbola leaving Earth (perigee 200 km at the end of
  // the Long March 5's last burn), a two-body arc round the Sun, a
  // hyperbola into Mars (periapsis 400 km at the middle of the braking burn,
  // 10° from Mars' equator). The arc joins the craft's positions three
  // days from either planet; their excess velocities are solved together.
  const injected = at('2020-07-23T05:15:00Z');
  const t0 = injected + 3 * DAY;
  const t1 = moi - 3 * DAY;
  let vOut = sub(
    lambert(
      earth(t0).slice(0, 3),
      mars(t1).slice(0, 3),
      (t1 - t0) / 1000,
      MU_SUN,
    ).v1,
    earth(t0).slice(3, 6),
  );
  let vIn = null;
  let leave;
  let arrive;
  let arc;
  const padAt = earthSiteState(...WENCHANG, 0, injected);
  for (let k = 0; k < 6; k++) {
    let n = unit(cross(padAt.slice(0, 3), vOut));
    if (dot(n, earthPole(injected)) < 0) n = scale(n, -1);
    leave = hyperbola(vOut, n, EARTH_R, 200, MU_EARTH);
    const start = add(
      earth(t0),
      kepler(leave, (t0 - injected) / 1000, MU_EARTH),
    );
    const goal = vIn
      ? add(mars(t1), kepler(arrive, (t1 - moi) / 1000, MU_MARS))
      : mars(t1);
    const { v1, v2 } = lambert(
      start.slice(0, 3),
      goal.slice(0, 3),
      (t1 - t0) / 1000,
      MU_SUN,
    );
    arc = [...start.slice(0, 3), ...v1];
    // The excess velocities that the arc's ends imply (the hyperbolas'
    // own speeds there carry the planets' pull, three days out).
    vOut = add(vOut, sub(v1, start.slice(3, 6)));
    vIn = sub(v2, mars(t1).slice(3, 6));
    arrive = hyperbola(
      vIn,
      planeNormal(vIn, pole, 10),
      MARS_R,
      400,
      MU_MARS,
      true,
    );
  }
  console.log(
    `  departure v∞ ${norm(vOut).toFixed(2)} km/s, arrival v∞ ${norm(vIn).toFixed(2)} km/s`,
  );
  const downrange =
    Math.acos(dot(unit(padAt.slice(0, 3)), unit(leave.slice(0, 3)))) * EARTH_R;
  console.log(`  injection ${Math.round(downrange)} km from the pad`);

  const rows = [
    [launch, ...add(earth(launch), earthSiteState(...WENCHANG, 0, launch))],
  ];
  const push = (time, state) => rows.push([time, ...state]);
  // Ascent: a blend about Earth (geocentric), drawn heliocentric.
  for (const row of blend(
    earthSiteState(...WENCHANG, 0, launch),
    leave,
    launch,
    injected,
    earthCentre,
    20000,
  ).slice(1))
    push(row[0], add(earth(row[0]), row.slice(1)));
  for (
    let t = injected + 10 * MINUTE;
    t < t0;
    t += t < injected + DAY ? 10 * MINUTE : HOUR
  )
    push(t, add(earth(t), kepler(leave, (t - injected) / 1000, MU_EARTH)));
  for (let t = t0; t < t1; t += 6 * HOUR)
    push(t, kepler(arc, (t - t0) / 1000, MU_SUN));
  for (let t = t1; t < moi; t += t < moi - DAY ? HOUR : 10 * MINUTE)
    push(t, add(mars(t), kepler(arrive, (t - moi) / 1000, MU_MARS)));

  // Around Mars (two-body, Mars-centred): braking into 400 × 180,000 km
  // at 10°; at apoapsis, the turn to a near-polar orbit with periapsis
  // 280 km; then apoapsis down to 84,600 km and, two periapses later, to
  // the parking orbit of two Martian days (apoapsis tuned near 59,000 km
  // so a periapsis falls at the landing).
  const orbit = { pole, radius: MARS_R, mu: MU_MARS };
  let state = reshape(arrive, { ...orbit, peri: 400, apo: 180000 });
  let time = moi;
  const coastTo = (until, record = true) => {
    for (let t = time + 10 * MINUTE; record && t < until; t += 10 * MINUTE)
      push(t, add(mars(t), kepler(state, (t - time) / 1000, MU_MARS)));
    state = kepler(state, (until - time) / 1000, MU_MARS);
    time = until;
  };
  const burn = (until, shape) => {
    coastTo(until);
    push(time, add(mars(time), state));
    state = reshape(state, { ...orbit, ...shape });
  };
  burn(at('2021-02-15T09:00:00Z'), { peri: 280, apo: null, inclination: 87.7 });
  burn(at('2021-02-20T11:00:00Z'), { peri: 280, apo: 84600 });
  const parked = at('2021-02-23T22:29:00Z');
  const entry = at('2021-05-14T23:09:00Z');
  const landing = at('2021-05-14T23:18:00Z');
  const deorbit = at('2021-05-14T17:00:00Z');
  coastTo(parked);
  const atParking = state.slice();
  // Time from `entry` to the nearest periapsis passage of the parking
  // orbit with apoapsis `apo`.
  const late = (apo) => {
    const s = reshape(atParking, { ...orbit, peri: 280, apo });
    return (periapsisNear(s, parked, entry) - entry) / HOUR;
  };
  const [apo] = scanRoot(
    (value) => {
      const hours = late(value);
      // As an angle (the period is ~49 h), so a wrap is not taken for a root.
      return (hours / 49.3) * 2 * Math.PI;
    },
    57000,
    61000,
    250,
  );
  console.log(`  parking orbit 280 × ${Math.round(apo)} km`);
  burn(parked, { peri: 280, apo });
  // Deorbit: periapsis lowered into the atmosphere; the lander leaves at
  // 20:20, the orbiter climbs back up.
  burn(deorbit, { peri: -30, apo: 'keep' });
  const separation = at('2021-05-14T20:20:00Z');
  coastTo(separation);
  const landerState = state.slice();
  burn(separation + 30 * MINUTE, { peri: 280, apo: 'keep' });
  coastTo(end);
  const orbiter = rows;

  const lander = [];
  let s = landerState;
  for (let t = separation; t < entry; t += 5 * MINUTE)
    lander.push([
      t,
      ...add(mars(t), kepler(s, (t - separation) / 1000, MU_MARS)),
    ]);
  s = kepler(s, (entry - separation) / 1000, MU_MARS);
  const site = (t) => {
    const p = bodySite(marsAxes(t), MARS_R, 25.066, 109.925);
    const q = bodySite(marsAxes(t + 1000), MARS_R, 25.066, 109.925);
    return [...p, ...sub(q, p)];
  };
  const arcToSite =
    Math.acos(dot(unit(s.slice(0, 3)), unit(site(entry).slice(0, 3)))) * MARS_R;
  console.log(
    `  entry ${Math.round(norm(s.slice(0, 3)) - MARS_R)} km up, ${Math.round(arcToSite)} km from the site`,
  );
  for (const row of blend(
    s,
    site(landing),
    entry,
    landing,
    () => [0, 0, 0, 0, 0, 0],
    10000,
    { settle: true },
  ))
    lander.push([row[0], ...add(mars(row[0]), row.slice(1))]);
  for (let t = landing + 10 * MINUTE; t < end; t += 10 * MINUTE)
    lander.push([t, ...add(mars(t), site(t))]);
  lander.push([end, ...add(mars(end), site(end))]);
  return {
    kind: 'helio',
    start: launch,
    stop: end,
    craft: [
      { key: 'orbiter', rows: orbiter },
      { key: 'lander', rows: lander },
    ],
    bodies: [
      {
        key: 'earth',
        horizons: '399',
        rows: earthRows,
        near: [[launch, launch + 5 * DAY]],
      },
      {
        key: 'mars',
        horizons: '499',
        rows: marsRows,
        near: [[moi - 5 * DAY, end]],
      },
    ],
    near: { earth, mars },
  };
}

/** Daily rows with the finer ones put in their place. */
function merged(daily, fine) {
  const [a, b] = [fine[0][0], fine.at(-1)[0]];
  return [...daily.filter((row) => row[0] < a || row[0] > b), ...fine].sort(
    (x, y) => x[0] - y[0],
  );
}

/** The time of the periapsis passage nearest `target` of a two-body
 * orbit about Mars, from `state` at `time`. */
function periapsisNear(state, time, target) {
  const r = state.slice(0, 3);
  const v = state.slice(3, 6);
  const a = 1 / (2 / norm(r) - dot(v, v) / MU_MARS);
  const period = 2 * Math.PI * Math.sqrt(a ** 3 / MU_MARS) * 1000;
  const pass = periapsis(state, time, MU_MARS).time;
  return pass + Math.round((target - pass) / period) * period;
}

// --- Output -------------------------------------------------------------------

const BUILDERS = {
  sputnik1,
  vostok1,
  apollo8,
  apollo11,
  apollo13,
  change4,
  change5,
  tianwen1,
};

async function write(id, built) {
  if (built.kind === 'helio') return writeHelio(id, built);
  const { start, stop } = built;
  const moonStart = Math.floor(start / MOON_STEP) * MOON_STEP;
  const moonStop = Math.ceil(stop / MOON_STEP) * MOON_STEP;
  const moon = await vectors('301', moonStart, moonStop, MOON_STEP);
  const craft = built.craft.map(({ key, rows }) => {
    // Times to the millisecond (the integrator's steps end anywhere).
    const sorted = rows
      .map((row) => [Math.round(row[0]), ...row.slice(1)])
      .sort((a, b) => a[0] - b[0])
      .filter((row, index, all) => !index || row[0] > all[index - 1][0]);
    const kept = thin(sorted, (row) => 0.5 + norm(row.slice(1, 4)) * 2e-6).map(
      (index) => ofDate(sorted[index]),
    );
    console.log(
      `  ${key.padEnd(10)} ${sorted.length} rows → ${kept.length} kept`,
    );
    // 0.1 km and 1 cm/s: finer than the reconstruction itself.
    return { key, ...packed(kept, start, 1, 5) };
  });
  const data = {
    id,
    reconstructed: true,
    source: `Reconstructed from published figures; Moon and Sun: ${SOURCE}`,
    fetched: new Date().toISOString(),
    start,
    stop,
    frame: 'geocentric, mean equator and equinox of date',
    units: 'km, km/s; t in s from start',
    craft,
    moon: {
      start: moonStart,
      step: MOON_STEP / 1000,
      s: moon
        .map(ofDate)
        .flatMap((row) => [
          ...row.slice(1, 4).map((value) => round(value, 0)),
          ...row.slice(4, 7).map((value) => round(value, 5)),
        ]),
    },
  };
  const json = `${JSON.stringify(data)}\n`;
  await writeFile(new URL(`${id}.json`, OUT), json);
  console.log(
    `Wrote public/missions/${id}.json (${Math.round(json.length / 1024)} kB)`,
  );
}

/** A heliocentric reconstruction, in the format of the interplanetary
 * files from scripts/fetch-missions.mjs. */
async function writeHelio(id, built) {
  const { start, stop } = built;
  // Half a kilometre plus 2/10,000 of the distance to the Sun or the
  // nearest planet, as there.
  const nearest = (row) => {
    let d = norm(row.slice(1, 4));
    for (const body of Object.values(built.near))
      d = Math.min(d, norm(sub(row.slice(1, 4), body(row[0]).slice(0, 3))));
    return d;
  };
  const craft = built.craft.map(({ key, rows }) => {
    const sorted = rows
      .map((row) => [Math.round(row[0]), ...row.slice(1)])
      .sort((a, b) => a[0] - b[0])
      .filter((row, index, all) => !index || row[0] > all[index - 1][0]);
    const kept = thin(sorted, (row) => 0.5 + nearest(row) * 2e-4).map(
      (index) => sorted[index],
    );
    console.log(
      `  ${key.padEnd(10)} ${sorted.length} rows → ${kept.length} kept`,
    );
    return { key, ...packed(kept, start, 0, 4) };
  });
  // Planets within 50 km around the encounters, 8000 km elsewhere.
  const bodies = built.bodies.map(({ key, horizons, rows, near }) => {
    const kept = thin(rows, (row) =>
      near.some(([a, b]) => row[0] >= a - DAY && row[0] <= b + DAY) ? 50 : 8000,
    ).map((index) => rows[index]);
    return { key, horizons, ...packed(kept, start, 0, 4) };
  });
  const data = {
    id,
    kind: 'helio',
    reconstructed: true,
    source: `Reconstructed from published figures (patched conics); Earth and Mars: ${SOURCE}`,
    fetched: new Date().toISOString(),
    start,
    stop,
    frame: 'heliocentric, ICRF (J2000 equatorial)',
    units: 'km, km/s; t in s from start',
    craft,
    bodies,
  };
  const json = `${JSON.stringify(data)}\n`;
  await writeFile(new URL(`${id}.json`, OUT), json);
  console.log(
    `Wrote public/missions/${id}.json (${Math.round(json.length / 1024)} kB)`,
  );
}

const wanted = process.argv.slice(2);
for (const id of wanted)
  if (!BUILDERS[id]) throw new Error(`Unknown mission ${id}`);
await mkdir(OUT, { recursive: true });
for (const [id, build] of Object.entries(BUILDERS)) {
  if (wanted.length && !wanted.includes(id)) continue;
  console.log(`${id}:`);
  await write(id, await build());
}
console.log(stamp(Date.now()));
