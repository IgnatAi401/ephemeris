import { CONSTELLATIONS } from '../../src/lib/orbits.ts';
import { cachedText } from './net.mjs';

// CelesTrak GP element sets in OMM JSON. OMM rather than TLE: a TLE has room
// for five-digit catalogue numbers only, and objects past 99999 are already
// in orbit (e.g. 100057 SOYUZ-MS 29 in the stations group).
//
// CelesTrak asks for each group to be downloaded at most once every two hours
// (its data update about that often); the cache in .cache/celestrak enforces
// that locally, and the workflow runs twice a day.
export const SOURCE = 'CelesTrak GP element sets (OMM), https://celestrak.org';
const MAX_AGE = 2 * 3600000;
// A pause between uncached downloads, to spread the load.
const GAP = 2000;
const DAY = 86400000;
// An object in several groups is kept once, in the first group listed here:
// stations before constellations, constellations before the generic GEO
// belt, and last-30-days only for objects in no other group. Launches from
// the last 30 days are flagged wherever they end up.
const PRIORITY = [
  'stations',
  'gps',
  'glonass',
  'galileo',
  'beidou',
  'starlink',
  'iridium',
  'orbcomm',
  'qianfan',
  'guowang',
  'geo',
  'debrisFy1c',
  'debrisCosmos2251',
  'debrisIridium33',
  'recent',
];
const NUMERIC = [
  'NORAD_CAT_ID',
  'MEAN_MOTION',
  'ECCENTRICITY',
  'INCLINATION',
  'RA_OF_ASC_NODE',
  'ARG_OF_PERICENTER',
  'MEAN_ANOMALY',
  'BSTAR',
  'MEAN_MOTION_DOT',
  'MEAN_MOTION_DDOT',
];
const round = (value, digits) => Number(value.toFixed(digits));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parse and check one group's OMM JSON; throws on anything unexpected. */
function parse(text, group) {
  let records;
  try {
    records = JSON.parse(text);
  } catch {
    // CelesTrak answers some errors (unknown group, rate limit) in plain text.
    throw new Error(`${group}: not JSON: ${text.slice(0, 200)}`);
  }
  if (!Array.isArray(records) || records.length === 0)
    throw new Error(`${group}: no element sets`);
  for (const record of records) {
    for (const field of NUMERIC) {
      if (!Number.isFinite(record[field]))
        throw new Error(`${group}: bad ${field} in ${JSON.stringify(record)}`);
    }
    if (!Number.isFinite(Date.parse(`${record.EPOCH}Z`)))
      throw new Error(`${group}: bad EPOCH ${record.EPOCH}`);
  }
  return records;
}

/** Objects the page's propagator should not draw: decaying (mean motion above
 * ~16.4 rev/day is below ~180 km and gone within days) or on orbits too
 * stretched for an Earth-orbit picture. */
const drawable = (record) =>
  record.MEAN_MOTION < 16.4 &&
  record.MEAN_MOTION > 0.25 &&
  record.ECCENTRICITY < 0.9;

/** All groups, deduplicated. `now` only times the log; the snapshot is
 * stamped with its oldest download, so a run served from the cache does not
 * claim fresher data than it has. */
export async function fetchConstellations(now = Date.now()) {
  const raw = {};
  let fetched = now;
  for (const { key, group } of CONSTELLATIONS) {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;
    const result = await cachedText('celestrak', group, url, {
      maxAge: MAX_AGE,
      label: `CelesTrak ${group}`,
      validate: (text) => parse(text, group),
    });
    raw[key] = parse(result.text, group);
    fetched = Math.min(fetched, result.fetched);
    const age = Math.round((now - result.fetched) / 60000);
    console.log(
      `${group.padEnd(20)} ${String(raw[key].length).padStart(6)}${result.cached ? `  (cached, ${age} min old)` : ''}`,
    );
    if (!result.cached) await sleep(GAP);
  }

  const recentIds = new Set(raw.recent.map((record) => record.NORAD_CAT_ID));
  const seen = new Set();
  const kept = {};
  const stats = {};
  for (const key of PRIORITY) {
    const records = raw[key];
    const unique = records.filter((record) => !seen.has(record.NORAD_CAT_ID));
    unique.forEach((record) => seen.add(record.NORAD_CAT_ID));
    kept[key] = unique
      .filter(drawable)
      .sort((a, b) => a.NORAD_CAT_ID - b.NORAD_CAT_ID);
    stats[key] = {
      celestrak: records.length,
      duplicates: records.length - unique.length,
      dropped: unique.length - kept[key].length,
    };
  }

  // Epochs are stored in days from this reference to keep the file small;
  // eight decimals is a millisecond, enough for SGP4 on a selected satellite.
  const reference = Math.round(fetched / 60000) * 60000;
  const groups = {};
  const recent = {};
  const catalog = {};
  for (const { key } of CONSTELLATIONS) {
    groups[key] = kept[key].flatMap((record) => [
      round((Date.parse(`${record.EPOCH}Z`) - reference) / DAY, 8),
      round(record.MEAN_MOTION, 8),
      round(record.ECCENTRICITY, 8),
      round(record.INCLINATION, 4),
      round(record.RA_OF_ASC_NODE, 4),
      round(record.ARG_OF_PERICENTER, 4),
      round(record.MEAN_ANOMALY, 4),
    ]);
    const flagged = kept[key].flatMap((record, index) =>
      recentIds.has(record.NORAD_CAT_ID) ? [index] : [],
    );
    if (flagged.length) recent[key] = flagged;
    catalog[key] = kept[key].map((record) => [
      record.NORAD_CAT_ID,
      record.OBJECT_NAME.trim(),
      record.OBJECT_ID ?? '',
      Number(record.BSTAR.toPrecision(6)),
      Number(record.MEAN_MOTION_DOT.toPrecision(6)),
      Number(record.MEAN_MOTION_DDOT.toPrecision(6)),
    ]);
    stats[key].count = kept[key].length;
    stats[key].recent = flagged.length;
  }

  const iso = new Date(fetched).toISOString();
  return {
    orbits: {
      source: SOURCE,
      fetched: iso,
      reference,
      fields: [
        'epochDays',
        'meanMotionRevPerDay',
        'eccentricity',
        'inclinationDeg',
        'raanDeg',
        'argPerigeeDeg',
        'meanAnomalyDeg',
      ],
      groups,
      recent,
      stats,
    },
    catalog: {
      source: SOURCE,
      fetched: iso,
      // Same order as the arrays in orbits.json.
      fields: [
        'norad',
        'name',
        'cospar',
        'bstar',
        'meanMotionDot',
        'meanMotionDdot',
      ],
      groups: catalog,
    },
  };
}
