import { mkdir, writeFile } from 'node:fs/promises';
import { SOURCE } from './lib/horizons.mjs';
import {
  DAY,
  HOUR,
  MINUTE,
  MOON_STEP,
  consistent,
  distance,
  interpolator,
  mend,
  merge,
  moonAt,
  nearRanges,
  ofDate,
  packed,
  round,
  stamp,
  stateAt,
  thin,
  vectors,
} from './lib/mission-data.mjs';

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
// Within these distances (km) the spacecraft is sampled every minute.
const NEAR_EARTH = 60000;
const NEAR_MOON = 15000;

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
    rows = mend(
      consistent(rows, `${mission.id} ${key}`),
      `${mission.id} ${key}`,
    );
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
