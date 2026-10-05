import { cachedText } from './net.mjs';
import { precession, rotate } from './horizons.mjs';

// Shared by scripts/fetch-missions.mjs (Horizons trajectories) and
// scripts/reconstruct-missions.mjs (missions rebuilt from published
// figures): Horizons vector queries, Hermite interpolation, thinning and the
// packing of public/missions/<id>.json.
export const MINUTE = 60000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
// Horizons answers a few tens of thousands of rows comfortably.
const MAX_ROWS = 20000;
// Every three hours keeps the interpolated Moon within a kilometre.
export const MOON_STEP = 3 * HOUR;

export const stamp = (time) =>
  new Date(time).toISOString().slice(0, 19).replace('T', ' ');
export const round = (value, digits) => Number(value.toFixed(digits));

/** Vectors (km, km/s, ICRF) of `command` relative to `center` (Earth by
 * default) from `start` to `stop` every `step` ms, as rows [time, x, y, z,
 * vx, vy, vz]. Cached for good: Horizons' reconstructed trajectories of past
 * missions do not change. */
export async function vectors(command, start, stop, step, center = '399') {
  const rows = [];
  const span = step * (MAX_ROWS - 1);
  for (let from = start; from < stop; from += span) {
    const to = Math.min(stop, from + span);
    const query = new URLSearchParams({
      format: 'json',
      COMMAND: `'${command}'`,
      OBJ_DATA: 'NO',
      MAKE_EPHEM: 'YES',
      EPHEM_TYPE: 'VECTORS',
      CENTER: `'500@${center}'`,
      REF_PLANE: 'FRAME',
      VEC_TABLE: '2',
      CSV_FORMAT: 'YES',
      OUT_UNITS: 'KM-S',
      TIME_TYPE: 'UT',
      START_TIME: `'${stamp(from)}'`,
      STOP_TIME: `'${stamp(to)}'`,
      STEP_SIZE: `'${step / MINUTE} min'`,
    });
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${query}`;
    const label = `Horizons ${command} ${stamp(from)}`;
    const body = (text) =>
      JSON.parse(text).result.split('$$SOE')[1]?.split('$$EOE')[0];
    const { text, cached } = await cachedText(
      'horizons-missions',
      center === '399'
        ? `${command}-${from}-${to}-${step}`
        : `${command}@${center}-${from}-${to}-${step}`,
      url,
      {
        label,
        timeout: 180,
        maxAge: Number.POSITIVE_INFINITY,
        validate: (value) => {
          if (!body(value))
            throw new Error(
              `${label}: ${JSON.parse(value).result.slice(0, 400)}`,
            );
        },
      },
    );
    if (!cached) console.log(`  fetched ${label} (${step / MINUTE} min)`);
    const chunk = body(text)
      .trim()
      .split('\n')
      .map((line) => line.split(',').map((cell) => cell.trim()));
    const expected = Math.floor((to - from) / step) + 1;
    if (chunk.length !== expected)
      throw new Error(`${label}: ${chunk.length} rows, expected ${expected}`);
    for (const row of chunk) {
      const time = Math.round((Number(row[0]) - 2440587.5) * DAY);
      if (rows.length && time <= rows[rows.length - 1][0]) continue;
      rows.push([time, ...row.slice(2, 8).map(Number)]);
    }
  }
  return rows;
}

/** Cubic Hermite position between rows a and b at `time`. */
export function hermite(a, b, time, out) {
  const h = (b[0] - a[0]) / 1000;
  const t = (time - a[0]) / (b[0] - a[0]);
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
  const h10 = t ** 3 - 2 * t ** 2 + t;
  const h01 = -2 * t ** 3 + 3 * t ** 2;
  const h11 = t ** 3 - t ** 2;
  for (let axis = 0; axis < 3; axis++)
    out[axis] =
      h00 * a[1 + axis] +
      h10 * a[4 + axis] * h +
      h01 * b[1 + axis] +
      h11 * b[4 + axis] * h;
  return out;
}

/** Indices of the rows to keep: each span between kept rows reproduces every
 * dropped row within `tolerance(row)` km. Greedy, with a doubling search for
 * the longest span. */
export function thin(rows, tolerance) {
  const at = [0, 0, 0];
  const fits = (i, j) => {
    for (let k = i + 1; k < j; k++) {
      hermite(rows[i], rows[j], rows[k][0], at);
      const error = Math.hypot(
        at[0] - rows[k][1],
        at[1] - rows[k][2],
        at[2] - rows[k][3],
      );
      if (error > tolerance(rows[k])) return false;
    }
    return true;
  };
  const keep = [0];
  let i = 0;
  while (i < rows.length - 1) {
    let good = i + 1;
    let probe = 2;
    while (i + probe < rows.length && fits(i, i + probe)) {
      good = i + probe;
      probe *= 2;
    }
    // Longest span lies between `good` and the first failing probe.
    let bad = Math.min(rows.length, i + probe);
    while (bad - good > 1) {
      const middle = (good + bad) >> 1;
      if (fits(i, middle)) good = middle;
      else bad = middle;
    }
    keep.push(good);
    i = good;
  }
  return keep;
}

/** Hermite position of the Moon's hourly rows at `time`. */
export function moonAt(moon, start, time, out) {
  const index = Math.min(
    moon.length - 2,
    Math.max(0, Math.floor((time - start) / MOON_STEP)),
  );
  return hermite(moon[index], moon[index + 1], time, out);
}

/** Merged time ranges [from, to] where `near` holds for coarse rows, padded
 * by a coarse step either side and snapped to whole minutes. */
export function nearRanges(rows, near, step, start, stop) {
  const ranges = [];
  for (const row of rows) {
    if (!near(row)) continue;
    const from = Math.max(start, row[0] - step);
    const to = Math.min(stop, row[0] + step);
    const last = ranges[ranges.length - 1];
    if (last && from <= last[1]) last[1] = to;
    else ranges.push([from, to]);
  }
  return ranges.map(([from, to]) => [
    Math.ceil(from / MINUTE) * MINUTE,
    Math.floor(to / MINUTE) * MINUTE,
  ]);
}

/** Drop rows whose velocity disagrees with the positions either side (by
 * more than 100 m/s against the central difference; a burn bends the path far less within a minute). Horizons' files carry
 * the odd badly fitted stretch around small burns, where the velocity swings
 * by a kilometre a second from one minute to the next; interpolating through
 * them would throw the path tens of kilometres off. */
export function consistent(rows, label) {
  const dropped = [];
  const kept = rows.filter((row, index) => {
    if (index === 0 || index === rows.length - 1) return true;
    const [a, b] = [rows[index - 1], rows[index + 1]];
    const span = (b[0] - a[0]) / 1000;
    // Only minute-scale rows: over a day a curving path alone parts the
    // difference from the velocity.
    if (span > (2 * HOUR) / 1000) return true;
    const error = Math.hypot(
      ...[0, 1, 2].map(
        (axis) => row[4 + axis] - (b[1 + axis] - a[1 + axis]) / span,
      ),
    );
    // Braking in an atmosphere changes the velocity fast but steadily: the
    // row then still lies between its neighbours' on every axis. A bad
    // stretch swings back and forth.
    const jump = Math.hypot(
      ...[0, 1, 2].map((axis) => {
        const value = row[4 + axis];
        const [low, high] = [a[4 + axis], b[4 + axis]].sort((x, y) => x - y);
        return Math.max(0, value - high, low - value);
      }),
    );
    if (error <= 0.1 || jump <= 0.1) return true;
    dropped.push(row[0]);
    return false;
  });
  if (dropped.length)
    console.warn(
      `  ${label}: dropped ${dropped.length} inconsistent rows near ${[
        ...new Set(dropped.map((time) => stamp(time).slice(0, 13))),
      ].join(', ')} h`,
    );
  return kept;
}

// A seam is closed over this long either side of it.
const SEAM_RAMP = 2 * HOUR;

/** Close seams in the position. Horizons strings a spacecraft's trajectory
 * together from successive orbit determinations, which need not meet: where
 * one hands over to the next the position can jump by up to a hundred km
 * between two minute rows while the velocity runs on smoothly (Chandrayaan-3:
 * 131 km on 20 July 2023, 67 km on 7 August), so `consistent` keeps both rows.
 * A burn cannot do that: whatever the acceleration within a step, it moves
 * the next row off the trapezoid rule p₂ = p₁ + (v₁ + v₂)·Δt/2 by at most
 * |v₂ − v₁|·Δt/2. Each seam is split between its two sides and ramped in
 * linearly over two hours either way, adding a few m/s to the velocity there,
 * so the path is continuous and its positions still agree with its
 * velocities. */
export function mend(rows, label) {
  const ramp = SEAM_RAMP / 1000;
  const seams = [];
  for (let index = 0; index < rows.length - 1; index++) {
    const [a, b] = [rows[index], rows[index + 1]];
    const span = (b[0] - a[0]) / 1000;
    // Only minute-scale rows: over a longer step the path's curvature alone
    // parts the positions from the rule.
    if (span > 300) continue;
    const gap = [0, 1, 2].map(
      (axis) =>
        b[1 + axis] - a[1 + axis] - ((a[4 + axis] + b[4 + axis]) / 2) * span,
    );
    const bound =
      (Math.hypot(...[0, 1, 2].map((axis) => b[4 + axis] - a[4 + axis])) *
        span) /
      2;
    // A kilometre more than any burn could do: Horizons' own rows meet the
    // rule within tens of metres.
    if (Math.hypot(...gap) > bound + 1)
      seams.push({
        before: a[0],
        after: b[0],
        // The ramps lengthen the step the velocities predict as well.
        gap: gap.map((value) => value / (1 + span / (2 * ramp))),
      });
  }
  if (!seams.length) return rows;
  console.warn(
    `  ${label}: closed ${seams.length} seams (${seams
      .map(
        ({ before, gap }) =>
          `${Math.hypot(...gap).toFixed(1)} km at ${stamp(before).slice(0, 16)}`,
      )
      .join(', ')})`,
  );
  return rows.map((row) => {
    const out = [...row];
    for (const { before, after, gap } of seams) {
      // Up to half the gap forward before the seam, half back after it.
      const weight =
        row[0] <= before
          ? Math.max(0, 1 - (before - row[0]) / SEAM_RAMP) / 2
          : -Math.max(0, 1 - (row[0] - after) / SEAM_RAMP) / 2;
      if (!weight) continue;
      for (let axis = 0; axis < 3; axis++) {
        out[1 + axis] += weight * gap[axis];
        out[4 + axis] += gap[axis] / (2 * ramp);
      }
    }
    return out;
  });
}

/** Rotate a row from ICRF to the mean equator and equinox of its date. */
export function ofDate(row) {
  const matrix = precession(row[0]);
  return [
    row[0],
    ...rotate(matrix, row.slice(1, 4)),
    ...rotate(matrix, row.slice(4, 7)),
  ];
}

/** Index-aligned rows → Hermite position at `time`, for rows sorted by time;
 * `hint` remembers the last interval. */
export function interpolator(rows) {
  let hint = 0;
  const out = [0, 0, 0];
  return (time) => {
    if (!(rows[hint][0] <= time && time <= rows[hint + 1]?.[0])) {
      let lo = 0;
      let hi = rows.length - 1;
      while (hi - lo > 1) {
        const middle = (lo + hi) >> 1;
        if (rows[middle][0] <= time) lo = middle;
        else hi = middle;
      }
      hint = lo;
    }
    return hermite(rows[hint], rows[hint + 1], time, out);
  };
}
/** As `interpolator`, but the full state: position and velocity. */
export function stateAt(rows) {
  const position = interpolator(rows);
  return (time) => {
    let lo = 0;
    let hi = rows.length - 1;
    while (hi - lo > 1) {
      const middle = (lo + hi) >> 1;
      if (rows[middle][0] <= time) lo = middle;
      else hi = middle;
    }
    const [a, b] = [rows[lo], rows[hi]];
    const h = (b[0] - a[0]) / 1000;
    const u = (time - a[0]) / (b[0] - a[0]);
    const velocity = [0, 1, 2].map(
      (axis) =>
        ((6 * u * u - 6 * u) * a[1 + axis] +
          (3 * u * u - 4 * u + 1) * a[4 + axis] * h +
          (-6 * u * u + 6 * u) * b[1 + axis] +
          (3 * u * u - 2 * u) * b[4 + axis] * h) /
        h,
    );
    return [...position(time), ...velocity];
  };
}
export const distance = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Merge time ranges [from, to] that touch. */
export const merge = (ranges) =>
  ranges
    .sort((a, b) => a[0] - b[0])
    .reduce((list, range) => {
      const last = list[list.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else list.push([...range]);
      return list;
    }, []);
// Around the Sun velocities to 0.1 m/s: still well inside the tolerance of
// any span, and a quarter shorter.
export const packed = (rows, start, digits, speedDigits = 6) => ({
  // Seconds from the mission start, then state vectors in km and km/s.
  t: rows.map((row) => (row[0] - start) / 1000),
  s: rows.flatMap((row) => [
    ...row.slice(1, 4).map((value) => round(value, digits)),
    ...row.slice(4, 7).map((value) => round(value, speedDigits)),
  ]),
});
