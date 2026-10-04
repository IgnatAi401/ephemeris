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
// The Moon comes from Horizons too (three-hourly), so the spacecraft meets the real
// Moon and not the page's analytic one, which is off by ~2000 km.
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

const OUT = new URL('../public/missions/', import.meta.url);
const stamp = (time) =>
  new Date(time).toISOString().slice(0, 19).replace('T', ' ');
const round = (value, digits) => Number(value.toFixed(digits));

/** Geocentric vectors (km, km/s, ICRF) of `command` from `start` to `stop`
 * every `step` ms, as rows [time, x, y, z, vx, vy, vz]. Cached for good:
 * Horizons' reconstructed trajectories of past missions do not change. */
async function vectors(command, start, stop, step) {
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
      CENTER: "'500@399'",
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
      `${command}-${from}-${to}-${step}`,
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
    const error = Math.hypot(
      ...[0, 1, 2].map(
        (axis) => row[4 + axis] - (b[1 + axis] - a[1 + axis]) / span,
      ),
    );
    if (error <= 0.1) return true;
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
      if (b > a) rows.push(...(await vectors(command, a, b, MINUTE)));
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

const wanted = process.argv.slice(2);
for (const id of wanted)
  if (!MISSIONS.some((mission) => mission.id === id))
    throw new Error(`Unknown mission ${id}`);
await mkdir(OUT, { recursive: true });
for (const mission of MISSIONS) {
  if (wanted.length && !wanted.includes(mission.id)) continue;
  const data = await fetchMission(mission);
  const json = `${JSON.stringify(data)}\n`;
  await writeFile(new URL(`${mission.id}.json`, OUT), json);
  console.log(
    `Wrote public/missions/${mission.id}.json (${Math.round(json.length / 1024)} kB)`,
  );
}
