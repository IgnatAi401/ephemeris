import { mkdir, writeFile } from 'node:fs/promises';
import { cachedText } from './lib/net.mjs';
import { SOURCE, precession, rotate } from './lib/horizons.mjs';

// Historical mission trajectories for the mission replay, written to
// public/missions/<id>.json. Unlike public/data these never change, so they
// are committed: run this by hand when a mission is added or its window
// changes, never from the scheduled workflow.
//
//   pnpm missions:fetch                 every mission
//   pnpm missions:fetch artemis1 jwst   just these
//
// Each spacecraft is fetched from JPL Horizons as geocentric state vectors:
// first coarsely over the whole window, then every minute wherever it is
// near Earth or the Moon. The merged series is thinned to the samples that
// cubic Hermite interpolation needs to stay within a fraction of a kilometre.
// The Moon comes from Horizons too (three-hourly), so the spacecraft meets the
// real Moon and not the page's analytic one, which is off by ~2000 km.
//
// Interplanetary missions (`kind: 'helio'`) are fetched around the Sun in
// ICRF (J2000 equatorial; no precession over their decades): daily, every
// 30 minutes near a planet or the Sun, every 2 minutes in a close flyby. The
// planets they meet come from Horizons as well, thinned finely around each
// encounter and coarsely elsewhere, so a flyby passes the planet where it was.
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Horizons answers a few tens of thousands of rows comfortably.
const MAX_ROWS = 20000;
// Within these distances (km) the spacecraft is sampled every minute.
const NEAR_EARTH = 60000;
const NEAR_MOON = 15000;
// Every three hours keeps the interpolated Moon within a kilometre.
const MOON_STEP = 3 * HOUR;

/** Times are UTC; each window starts and ends inside Horizons' coverage
 * (checked 2026-10-04). `coarse` is the step away from Earth and the Moon. */
const MISSIONS = [
  {
    id: 'artemis2',
    start: '2026-04-02T02:00Z',
    stop: '2026-04-10T23:53Z',
    coarse: 10 * MINUTE,
    craft: [{ key: 'orion', command: '-1024' }],
  },
  {
    id: 'artemis1',
    start: '2022-11-16T08:46Z',
    stop: '2022-12-11T17:19Z',
    coarse: 10 * MINUTE,
    craft: [{ key: 'orion', command: '-1023' }],
  },
  {
    id: 'chandrayaan3',
    start: '2023-07-14T09:22Z',
    stop: '2023-08-23T16:00Z',
    coarse: 10 * MINUTE,
    craft: [
      { key: 'lander', command: '-158' },
      // The propulsion module, its own craft once the lander separates.
      { key: 'module', command: '-169', from: '2023-08-17T07:00Z' },
    ],
  },
  {
    id: 'jwst',
    start: '2021-12-25T13:02Z',
    stop: '2022-07-12T15:00Z',
    coarse: 30 * MINUTE,
    craft: [{ key: 'jwst', command: '-170' }],
  },
  {
    id: 'capstone',
    start: '2022-06-28T10:07Z',
    stop: '2023-01-15T00:00Z',
    coarse: 30 * MINUTE,
    craft: [{ key: 'capstone', command: '-1176' }],
  },
];

const AU = 1.495978707e8;
/** Bodies a heliocentric mission may meet: Horizons command and radius (km).
 * Within `near` the spacecraft is sampled every 30 minutes, within `close`
 * every 2 minutes (both at least wide enough to be caught by daily rows). */
const BODIES = {
  venus: { command: '299', radius: 6051.8 },
  earth: { command: '399', radius: 6371 },
  mars: { command: '499', radius: 3389.5 },
  jupiter: { command: '599', radius: 69911 },
  saturn: { command: '699', radius: 58232 },
  uranus: { command: '799', radius: 25362 },
  neptune: { command: '899', radius: 24622 },
  pluto: { command: '999', radius: 1188 },
  arrokoth: { command: '2486958', radius: 18 },
};
for (const body of Object.values(BODIES)) {
  body.near = Math.max(3e6, 100 * body.radius);
  body.close = Math.max(1e5, 5 * body.radius);
}
// Inside a quarter of an AU the Sun bends a path (Parker's) within hours.
const SUN_NEAR = 0.25 * AU;

const HELIO = [
  {
    id: 'voyager2',
    start: '1977-08-20T15:33Z',
    stop: '2026-10-01T00:00Z',
    craft: [{ key: 'voyager2', command: '-32' }],
    bodies: ['earth', 'jupiter', 'saturn', 'uranus', 'neptune'],
  },
  {
    id: 'voyager1',
    start: '1977-09-05T14:00Z',
    stop: '2026-10-01T00:00Z',
    craft: [{ key: 'voyager1', command: '-31' }],
    bodies: ['earth', 'jupiter', 'saturn'],
  },
  {
    id: 'newhorizons',
    start: '2006-01-19T19:52Z',
    stop: '2026-10-01T00:00Z',
    craft: [{ key: 'newhorizons', command: '-98' }],
    bodies: ['earth', 'jupiter', 'pluto', 'arrokoth'],
  },
  {
    id: 'cassini',
    start: '1997-10-15T09:28Z',
    stop: '2017-09-15T10:30Z',
    craft: [{ key: 'cassini', command: '-82' }],
    bodies: ['venus', 'earth', 'jupiter', 'saturn'],
  },
  {
    id: 'parker',
    start: '2018-08-12T08:17Z',
    stop: '2025-07-01T00:00Z',
    craft: [{ key: 'parker', command: '-96' }],
    bodies: ['venus', 'earth'],
  },
  {
    id: 'mars2020',
    start: '2020-07-30T12:53Z',
    stop: '2021-02-18T21:00Z',
    craft: [{ key: 'perseverance', command: '-168' }],
    bodies: ['earth', 'mars'],
  },
].map((mission) => ({ ...mission, kind: 'helio' }));

const OUT = new URL('../public/missions/', import.meta.url);
const stamp = (time) =>
  new Date(time).toISOString().slice(0, 19).replace('T', ' ');
const round = (value, digits) => Number(value.toFixed(digits));

/** Vectors (km, km/s, ICRF) of `command` relative to `center` (Earth by
 * default) from `start` to `stop` every `step` ms, as rows [time, x, y, z,
 * vx, vy, vz]. Cached for good: Horizons' reconstructed trajectories of past
 * missions do not change. */
async function vectors(command, start, stop, step, center = '399') {
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
function hermite(a, b, time, out) {
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
function thin(rows, tolerance) {
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
function moonAt(moon, start, time, out) {
  const index = Math.min(
    moon.length - 2,
    Math.max(0, Math.floor((time - start) / MOON_STEP)),
  );
  return hermite(moon[index], moon[index + 1], time, out);
}

/** Merged time ranges [from, to] where `near` holds for coarse rows, padded
 * by a coarse step either side and snapped to whole minutes. */
function nearRanges(rows, near, step, start, stop) {
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
function consistent(rows, label) {
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

/** Rotate a row from ICRF to the mean equator and equinox of its date. */
function ofDate(row) {
  const matrix = precession(row[0]);
  return [
    row[0],
    ...rotate(matrix, row.slice(1, 4)),
    ...rotate(matrix, row.slice(4, 7)),
  ];
}

async function fetchMission(mission) {
  const start = Date.parse(mission.start);
  const stop = Date.parse(mission.stop);
  console.log(`${mission.id}: ${stamp(start)} → ${stamp(stop)} UTC`);
  // The Moon, a little beyond the window so interpolation reaches both ends.
  const moonStart = Math.floor(start / MOON_STEP) * MOON_STEP;
  const moonStop = Math.ceil(stop / MOON_STEP) * MOON_STEP;
  const moon = await vectors('301', moonStart, moonStop, MOON_STEP);
  const craft = [];
  for (const { key, command, from } of mission.craft) {
    const begin = from ? Date.parse(from) : start;
    const coarse = await vectors(command, begin, stop, mission.coarse);
    const position = [0, 0, 0];
    const near = (row) =>
      Math.hypot(row[1], row[2], row[3]) < NEAR_EARTH ||
      Math.hypot(
        ...moonAt(moon, moonStart, row[0], position).map(
          (value, axis) => value - row[1 + axis],
        ),
      ) < NEAR_MOON;
    const ranges = nearRanges(coarse, near, mission.coarse, begin, stop);
    let rows = coarse.filter(
      (row) => !ranges.some(([a, b]) => row[0] >= a && row[0] <= b),
    );
    for (const [a, b] of ranges)
      if (b > a) rows = rows.concat(await vectors(command, a, b, MINUTE));
    rows.sort((x, y) => x[0] - y[0]);
    rows = rows.filter((row, index) => !index || row[0] > rows[index - 1][0]);
    rows = consistent(rows, `${mission.id} ${key}`);
    // Half a kilometre near Earth, a little more far out.
    const kept = thin(
      rows,
      (row) => 0.5 + Math.hypot(row[1], row[2], row[3]) * 2e-6,
    ).map((index) => ofDate(rows[index]));
    console.log(
      `  ${key.padEnd(9)} ${rows.length} rows → ${kept.length} kept` +
        ` (${ranges.length} near passes)`,
    );
    craft.push({
      key,
      horizons: command,
      // Seconds from the mission start, then state vectors in km and km/s.
      t: kept.map((row) => (row[0] - start) / 1000),
      s: kept.flatMap((row) => [
        ...row.slice(1, 4).map((value) => round(value, 1)),
        ...row.slice(4, 7).map((value) => round(value, 6)),
      ]),
    });
  }
  return {
    id: mission.id,
    source: SOURCE,
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
          ...row.slice(1, 4).map((value) => round(value, 1)),
          ...row.slice(4, 7).map((value) => round(value, 6)),
        ]),
    },
  };
}

/** Index-aligned rows → Hermite position at `time`, for rows sorted by time;
 * `hint` remembers the last interval. */
function interpolator(rows) {
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
function stateAt(rows) {
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
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Merge time ranges [from, to] that touch. */
const merge = (ranges) =>
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
const packed = (rows, start, digits, speedDigits = 6) => ({
  // Seconds from the mission start, then state vectors in km and km/s.
  t: rows.map((row) => (row[0] - start) / 1000),
  s: rows.flatMap((row) => [
    ...row.slice(1, 4).map((value) => round(value, digits)),
    ...row.slice(4, 7).map((value) => round(value, speedDigits)),
  ]),
});

async function fetchHelio(mission) {
  const start = Date.parse(mission.start);
  const stop = Date.parse(mission.stop);
  console.log(`${mission.id}: ${stamp(start)} → ${stamp(stop)} UTC`);
  // Daily rows of every body met, a day beyond the window either side.
  const day0 = Math.floor(start / DAY) * DAY;
  const day1 = Math.ceil(stop / DAY) * DAY;
  const daily = {};
  for (const key of mission.bodies)
    daily[key] = await vectors(BODIES[key].command, day0, day1, DAY, '10');
  const bodyAt = Object.fromEntries(
    mission.bodies.map((key) => [key, interpolator(daily[key])]),
  );
  const bodyState = Object.fromEntries(
    mission.bodies.map((key) => [key, stateAt(daily[key])]),
  );
  /** Spacecraft rows over [from, to] every `step`. Near a body they are
   * fetched relative to it and moved onto its heliocentric path: Horizons'
   * heliocentric vectors of an old spacecraft can disagree with its
   * planetocentric ones by thousands of km at a flyby (Voyager 2 passes
   * 102,000 km from Uranus' centre one way, the true 107,000 the other). */
  const around = async (command, from, to, step, sample) => {
    let nearest = null;
    let gap = Infinity;
    for (const row of sample)
      for (const body of mission.bodies) {
        const d = distance(bodyAt[body](row[0]), row.slice(1));
        if (d < gap && d < BODIES[body].near) [nearest, gap] = [body, d];
      }
    if (!nearest) return vectors(command, from, to, step, '10');
    const relative = await vectors(
      command,
      from,
      to,
      step,
      BODIES[nearest].command,
    );
    const state = bodyState[nearest];
    return relative.map((row) => {
      const body = state(row[0]);
      return [row[0], ...row.slice(1, 7).map((value, k) => value + body[k])];
    });
  };
  const craft = [];
  const encounters = Object.fromEntries(mission.bodies.map((key) => [key, []]));
  for (const { key, command } of mission.craft) {
    const coarse = await vectors(command, start, stop, DAY, '10');
    // Daily rows close enough to the Sun or a body get 30-minute rows, and
    // 30-minute rows in a close flyby 2-minute ones.
    const nearSomething = (row) =>
      Math.hypot(row[1], row[2], row[3]) < SUN_NEAR ||
      mission.bodies.some(
        (body) =>
          distance(bodyAt[body](row[0]), row.slice(1)) < BODIES[body].near,
      );
    const near = nearRanges(coarse, nearSomething, DAY, start, stop);
    let rows = coarse.filter(
      (row) => !near.some(([a, b]) => row[0] >= a && row[0] <= b),
    );
    let half = [];
    for (const [a, b] of near) {
      const from = Math.ceil(a / (30 * MINUTE)) * 30 * MINUTE;
      const inside = coarse.filter((row) => row[0] >= a && row[0] <= b);
      if (b > from)
        half = half.concat(await around(command, from, b, 30 * MINUTE, inside));
    }
    const closeTo = (row) =>
      mission.bodies.some(
        (body) =>
          distance(bodyAt[body](row[0]), row.slice(1)) < BODIES[body].close,
      );
    const close = nearRanges(half, closeTo, 30 * MINUTE, start, stop);
    // Hundreds of thousands of rows for Cassini's Saturn years: no spreading.
    rows = rows.concat(
      half.filter((row) => !close.some(([a, b]) => row[0] >= a && row[0] <= b)),
    );
    for (const [a, b] of close) {
      const from = Math.ceil(a / (2 * MINUTE)) * 2 * MINUTE;
      const inside = half.filter((row) => row[0] >= a && row[0] <= b);
      if (b > from)
        rows = rows.concat(await around(command, from, b, 2 * MINUTE, inside));
    }
    rows.sort((x, y) => x[0] - y[0]);
    rows = rows.filter((row, index) => !index || row[0] > rows[index - 1][0]);
    rows = consistent(rows, `${mission.id} ${key}`);
    // Half a kilometre plus 2/10,000 of the distance to whatever is nearest,
    // the Sun or a body: tens of km at Saturn's cloud tops, a few hundred
    // thousand far out, never a pixel on screen; about ten samples an orbit,
    // which keeps Cassini's 294 Saturn orbits within budget.
    for (const row of rows) {
      let nearest = Math.hypot(row[1], row[2], row[3]);
      for (const body of mission.bodies)
        nearest = Math.min(
          nearest,
          distance(bodyAt[body](row[0]), row.slice(1)),
        );
      row[7] = 0.5 + nearest * 2e-4;
    }
    const kept = thin(rows, (row) => row[7]).map((index) => rows[index]);
    // Where each body was met, for its own sampling.
    for (const body of mission.bodies)
      encounters[body].push(
        ...nearRanges(
          coarse,
          (row) =>
            distance(bodyAt[body](row[0]), row.slice(1)) < BODIES[body].near,
          2 * DAY,
          start,
          stop,
        ),
      );
    console.log(
      `  ${key.padEnd(12)} ${rows.length} rows → ${kept.length} kept` +
        ` (${near.length} near, ${close.length} close passes)`,
    );
    craft.push({ key, horizons: command, ...packed(kept, start, 0, 4) });
  }
  // Each body: hourly rows through its encounters (kept within 50 km), daily
  // rows elsewhere (within 8000 km: Earth and Pluto wobble around their
  // barycentres by thousands of km, invisible at that scale).
  const bodies = [];
  for (const key of mission.bodies) {
    const ranges = merge(encounters[key]);
    let rows = daily[key].filter(
      (row) => !ranges.some(([a, b]) => row[0] >= a && row[0] <= b),
    );
    for (const [a, b] of ranges) {
      const from = Math.ceil(a / HOUR) * HOUR;
      if (b > from)
        rows = rows.concat(
          await vectors(BODIES[key].command, from, b, HOUR, '10'),
        );
    }
    rows.sort((x, y) => x[0] - y[0]);
    rows = rows.filter((row, index) => !index || row[0] > rows[index - 1][0]);
    for (const row of rows)
      row[7] = ranges.some(([a, b]) => row[0] >= a - DAY && row[0] <= b + DAY)
        ? 50
        : 8000;
    const kept = thin(rows, (row) => row[7]).map((index) => rows[index]);
    console.log(
      `  ${key.padEnd(12)} ${rows.length} rows → ${kept.length} kept`,
    );
    bodies.push({
      key,
      horizons: BODIES[key].command,
      ...packed(kept, start, 0, 4),
    });
  }
  return {
    id: mission.id,
    kind: 'helio',
    source: SOURCE,
    fetched: new Date().toISOString(),
    start,
    stop,
    frame: 'heliocentric, ICRF (J2000 equatorial)',
    units: 'km, km/s; t in s from start',
    craft,
    bodies,
  };
}

const ALL = [...MISSIONS, ...HELIO];
const wanted = process.argv.slice(2);
for (const id of wanted)
  if (!ALL.some((mission) => mission.id === id))
    throw new Error(`Unknown mission ${id}`);
await mkdir(OUT, { recursive: true });
for (const mission of ALL) {
  if (wanted.length && !wanted.includes(mission.id)) continue;
  const data =
    mission.kind === 'helio'
      ? await fetchHelio(mission)
      : await fetchMission(mission);
  const json = `${JSON.stringify(data)}\n`;
  await writeFile(new URL(`${mission.id}.json`, OUT), json);
  console.log(
    `Wrote public/missions/${mission.id}.json (${Math.round(json.length / 1024)} kB)`,
  );
}
