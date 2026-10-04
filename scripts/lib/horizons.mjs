import { fetchText } from './net.mjs';
import { ttMinusUtc } from './time-scales.mjs';

// JPL Horizons ephemerides for the spacecraft beyond the constellations: the
// Sun–Earth L1/L2 spacecraft as geocentric state vectors every 6 h (their
// halo orbits take months), and two lunar orbiters as Moon-centred osculating
// elements every 2 h (both orbit in about two hours). The window runs from 21
// days before the fetch to 30 days after it: refreshed weekly, a snapshot
// still covers the page's tape, 14 days either side of now, for a week.
export const SOURCE = 'JPL Horizons, https://ssd.jpl.nasa.gov/horizons/';
const DEEP_SPACE = [
  ['soho', '-21'],
  ['jwst', '-170'],
  ['euclid', '-680'],
];
const LUNAR = [
  ['lro', '-85'],
  ['danuri', '-155'],
];
const HOUR = 3600000;
const DAY = 86400000;
const VECTOR_STEP = 6 * HOUR;
const LUNAR_STEP = 2 * HOUR;
// Horizons only predicts each spacecraft so far ahead (SOHO's file, for one,
// may end before the 30 days asked for). A track may end early, but never
// less than 21 days after the fetch: the snapshot is refreshed weekly and the
// page's tape reaches 14 days ahead, so 7 + 14 days must always be covered.
const MIN_AHEAD = 21 * DAY;
const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

/** The instant in Horizons' "No ephemeris for target … after A.D. 2026-NOV-02
 * 23:50:00.0000 UT" refusal, or null for any other answer. */
function ephemerisEnd(result) {
  const match =
    /No ephemeris for target .* after A\.D\. (\d{4})-([A-Z]{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?) (UT|TDB)/.exec(
      result,
    );
  if (!match) return null;
  const [, year, month, day, hour, minute, second, scale] = match;
  const time =
    Date.UTC(
      Number(year),
      MONTHS.indexOf(month),
      Number(day),
      Number(hour),
      Number(minute),
    ) +
    Number(second) * 1000;
  return { time, scale };
}
const round = (value, digits) => Number(value.toFixed(digits));

/** Rotation from J2000 (ICRF) to the mean equator and equinox of date
 * (IAU 1976 precession), so JPL vectors share the page's frame. */
function precession(time) {
  const T = (time / DAY + 2440587.5 - 2451545) / 36525;
  const arcsec = Math.PI / 648000;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * arcsec;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * arcsec;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * arcsec;
  const [cx, sx, cz, sz, ct, st] = [
    Math.cos(zeta),
    Math.sin(zeta),
    Math.cos(z),
    Math.sin(z),
    Math.cos(theta),
    Math.sin(theta),
  ];
  return [
    [cx * ct * cz - sx * sz, -sx * ct * cz - cx * sz, -st * cz],
    [cx * ct * sz + sx * cz, -sx * ct * sz + cx * cz, -st * sz],
    [cx * st, -sx * st, ct],
  ];
}
const rotate = (matrix, [x, y, z]) =>
  matrix.map((row) => row[0] * x + row[1] * y + row[2] * z);
const stamp = (time) =>
  new Date(time).toISOString().slice(0, 23).replace('T', ' ');

/** One Horizons table, strictly checked: the expected number of rows, the
 * first row at the requested instant. Any surprise throws, except a target
 * whose ephemeris ends early: that table is asked again up to its end, as
 * long as it still reaches `minStop`. Returns the rows and the stop used. */
async function table(command, parameters, start, stop, step, minStop) {
  // Osculating elements only come in TDB: ask for the same instants in TDB.
  // A leap second inside the window would skew the rows; refuse rather than
  // shift half of them by a second.
  let shift = 0;
  if (parameters.TIME_TYPE === 'TDB') {
    shift = ttMinusUtc(start);
    if (ttMinusUtc(stop) !== shift)
      throw new Error(`Horizons ${command}: leap second inside the window`);
  }
  const query = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    CSV_FORMAT: 'YES',
    OUT_UNITS: 'KM-S',
    REF_PLANE: 'FRAME',
    TIME_TYPE: 'UT',
    START_TIME: `'${stamp(start + shift)}'`,
    STOP_TIME: `'${stamp(stop + shift)}'`,
    STEP_SIZE: `'${step / HOUR} h'`,
    ...parameters,
  });
  const text = await fetchText(
    `https://ssd.jpl.nasa.gov/api/horizons.api?${query}`,
    {
      label: `Horizons ${command}`,
      timeout: 120,
    },
  );
  const { result } = JSON.parse(text);
  const body = result.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!body) {
    const end = ephemerisEnd(result);
    if (end && minStop !== undefined) {
      const utcEnd = end.time - (end.scale === 'TDB' ? shift : 0);
      const clipped = start + Math.floor((utcEnd - start) / step) * step;
      if (clipped >= minStop && clipped < stop) {
        console.warn(
          `Horizons ${command}: ephemeris ends ${stamp(utcEnd)} UTC; track shortened`,
        );
        return table(command, parameters, start, clipped, step);
      }
    }
    throw new Error(`Horizons ${command}: ${result.slice(0, 400)}`);
  }
  const rows = body
    .trim()
    .split('\n')
    .map((line) => line.split(',').map((cell) => cell.trim()));
  const expected = Math.round((stop - start) / step) + 1;
  if (rows.length !== expected)
    throw new Error(
      `Horizons ${command}: ${rows.length} rows, expected ${expected}`,
    );
  const firstJd = Number(rows[0][0]);
  if (Math.abs((firstJd - 2440587.5) * DAY - start - shift) > 1000) {
    throw new Error(`Horizons ${command}: misaligned start`);
  }
  return { rows, stop };
}

/** The spacecraft snapshot (public/data/spacecraft.json) around `fetched`. */
export async function fetchSpacecraft(fetched) {
  const start = Math.floor(fetched / VECTOR_STEP) * VECTOR_STEP - 21 * DAY;
  const stop = start + 51 * DAY;
  const minStop = fetched + MIN_AHEAD;
  // Tracks that end early record their own stop; the rest end at `stop`.
  const stops = {};
  const vectors = {};
  for (const [key, command] of DEEP_SPACE) {
    const { rows, stop: end } = await table(
      command,
      { EPHEM_TYPE: 'VECTORS', CENTER: "'500@399'", VEC_TABLE: '2' },
      start,
      stop,
      VECTOR_STEP,
      minStop,
    );
    if (end !== stop) stops[key] = end;
    vectors[key] = rows.flatMap((row, index) => {
      const matrix = precession(start + index * VECTOR_STEP);
      const position = rotate(matrix, row.slice(2, 5).map(Number));
      const velocity = rotate(matrix, row.slice(5, 8).map(Number));
      return [
        ...position.map((value) => Math.round(value)),
        ...velocity.map((value) => round(value, 5)),
      ];
    });
    const [x, y, z] = vectors[key].slice(0, 3);
    console.log(
      `${key.padEnd(10)} ${rows.length} vectors, ${Math.round(Math.hypot(x, y, z)).toLocaleString('en-US')} km at start`,
    );
  }
  const lunar = {};
  for (const [key, command] of LUNAR) {
    const { rows, stop: end } = await table(
      command,
      { EPHEM_TYPE: 'ELEMENTS', CENTER: "'500@301'", TIME_TYPE: 'TDB' },
      start,
      stop,
      LUNAR_STEP,
      minStop,
    );
    if (end !== stop) stops[key] = end;
    // JDTDB, date, EC, QR, IN, OM, W, Tp, N, MA, TA, A, …
    lunar[key] = rows.flatMap((row) => [
      round(Number(row[11]), 2),
      round(Number(row[2]), 7),
      round(Number(row[4]), 5),
      round(Number(row[5]), 5),
      round(Number(row[6]), 5),
      round(Number(row[9]), 5),
      Number(Number(row[8]).toPrecision(9)),
    ]);
    console.log(
      `${key.padEnd(10)} ${rows.length} element sets, a = ${Math.round(Number(rows[0][11]))} km`,
    );
  }
  return {
    source: SOURCE,
    fetched: new Date(fetched).toISOString(),
    start,
    stop,
    stops,
    vectors: {
      step: VECTOR_STEP,
      frame: 'geocentric, mean equator of date',
      fields: ['x', 'y', 'z', 'vx', 'vy', 'vz'],
      units: 'km, km/s',
      tracks: vectors,
    },
    lunar: {
      step: LUNAR_STEP,
      frame: 'Moon-centred, ICRF',
      fields: [
        'aKm',
        'e',
        'iDeg',
        'nodeDeg',
        'argPeriDeg',
        'meanAnomalyDeg',
        'meanMotionDegPerS',
      ],
      tracks: lunar,
    },
  };
}
