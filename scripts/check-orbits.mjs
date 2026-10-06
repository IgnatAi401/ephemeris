import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

// Offline checks on public/data before it is deployed. Any failure exits
// non-zero, and the workflow then keeps the previous snapshot online.
//
// - every group present, every satellite at a plausible radius ±7 days out;
// - catalog.json aligned with orbits.json, catalogue numbers unique;
// - no group empty or more than 35% (and 5 objects) smaller than in the last committed
//   status (status/status.json); `--accept-drop` overrides this once a drop
//   has been checked by hand;
// - the L1/L2 spacecraft and lunar orbiters at plausible distances;
// - each file within its size budget.
const DATA = new URL('../public/data/', import.meta.url);
const BASELINE = new URL('../status/status.json', import.meta.url);
const DAY = 86400000;
const acceptDrop = process.argv.includes('--accept-drop');
const warnings = [];
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const optionalJson = (url) =>
  readJson(url).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });

const {
  CONSTELLATIONS,
  createFleet,
  moonPosition,
  propagate,
  EARTH_RADIUS_KM,
} = await import('../src/lib/orbits.ts');
const { DEEP_SPACECRAFT, LUNAR_ORBITERS, lunarAt, vectorAt } =
  await import('../src/lib/ephemeris.ts');

// --- Constellations -------------------------------------------------------
const snapshot = await readJson(new URL('orbits.json', DATA));
const fleet = createFleet(snapshot);
// Radius bands in Earth radii. They only catch elements gone wrong (a
// satellite inside the Earth or flung far out), so they are kept generous:
// groups pick up eccentric oddities that tight bands keep tripping over.
// LEO shells sit 1.03–1.3, but the stations group also carries a Fregat
// fragment (49271, e ≈ 0.094) reaching 1.35; GNSS runs from MEO (~3.9) to GEO
// (~6.6), Galileo 5 and 6 dip to ~3.7 and QZSS reaches ~7.1; debris clouds
// reach a few thousand km; new launches include transfer orbits, out to the
// Moon.
const shells = {
  leo: [1.0, 1.6],
  station: [1.0, 1.6],
  gnss: [3.0, 8.0],
  geo: [5.0, 8.0],
  debris: [1.0, 3.0],
  new: [1.0, 70],
};
CONSTELLATIONS.forEach(({ key, kind }, index) => {
  if (kind !== 'new') assert(fleet.counts[index] > 0, `No ${key} satellites`);
});
const catalog = await readJson(new URL('catalog.json', DATA));
assert.equal(
  catalog.fetched,
  snapshot.fetched,
  'catalog.json and orbits.json come from different fetches',
);
const names = CONSTELLATIONS.flatMap(({ key }) =>
  (catalog.groups[key] ?? []).map(([norad, name]) => `${name} (${norad})`),
);
const positions = new Float32Array(fleet.count * 3);
for (const offset of [0, 7, -7]) {
  propagate(fleet, fleet.fetched + offset * DAY, positions);
  for (let index = 0; index < fleet.count; index++) {
    const radius = Math.hypot(
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    );
    const { key, kind } = CONSTELLATIONS[fleet.group[index]];
    const [low, high] = shells[kind];
    assert(
      radius > low && radius < high,
      `${key} ${names[index]} at ${radius.toFixed(3)} Earth radii (${offset} d)`,
    );
  }
}

const numbers = new Set();
CONSTELLATIONS.forEach(({ key }, index) => {
  const rows = catalog.groups[key] ?? [];
  assert.equal(
    rows.length,
    fleet.counts[index],
    `catalog ${key}: ${rows.length} rows for ${fleet.counts[index]} satellites`,
  );
  for (const [norad, name] of rows) {
    assert(
      Number.isInteger(norad) && norad > 0,
      `catalog ${key}: bad number ${norad}`,
    );
    assert(
      typeof name === 'string' && name,
      `catalog ${key}: unnamed ${norad}`,
    );
    assert(!numbers.has(norad), `catalog: ${norad} appears twice`);
    numbers.add(norad);
  }
  for (const at of snapshot.recent?.[key] ?? []) {
    assert(
      Number.isInteger(at) && at >= 0 && at < fleet.counts[index],
      `recent ${key}: index ${at} out of range`,
    );
  }
});

// --- Against the last committed status ------------------------------------
const baseline = await optionalJson(BASELINE);
if (!baseline) warnings.push('no status/status.json yet: counts not compared');
else {
  for (const { key, kind } of CONSTELLATIONS) {
    // Launches from the last 30 days come and go by definition.
    if (kind === 'new') continue;
    const before = baseline.constellations?.groups?.[key]?.count;
    if (!before) continue;
    const now =
      fleet.counts[CONSTELLATIONS.findIndex((item) => item.key === key)];
    const drop = before - now;
    // A drop of a few objects is ordinary churn in the small groups (a
    // spacecraft undocking from a station); only larger ones are suspicious.
    const message = `${key}: ${before} → ${now} (−${Math.round((drop / before) * 100)}%)`;
    if (drop > 5 && drop > before * 0.35) {
      if (acceptDrop) warnings.push(`accepted ${message}`);
      else
        assert.fail(
          `${message} since the last deploy; rerun with --accept-drop if this is real`,
        );
    }
  }
}

// --- JPL spacecraft --------------------------------------------------------
const craft = await optionalJson(new URL('spacecraft.json', DATA));
if (!craft)
  warnings.push(
    'no spacecraft.json: the page will show no L1/L2 or lunar spacecraft',
  );
else {
  const at = [0, 0, 0];
  const now = Date.now();
  // Physical sanity over every sample the snapshot holds.
  for (let time = craft.start; time <= craft.stop; time += 5 * 3600000) {
    for (const { key } of DEEP_SPACECRAFT) {
      if (!vectorAt(craft, key, time, at)) continue;
      const km = Math.hypot(...at);
      assert(km > 0.8e6 && km < 2.2e6, `${key} at ${Math.round(km)} km`);
    }
    for (const { key } of LUNAR_ORBITERS) {
      if (!lunarAt(craft, key, time, at)) continue;
      const altitude = Math.hypot(...at) - 1737.4;
      assert(
        altitude > 0 && altitude < 3000,
        `${key} at ${Math.round(altitude)} km altitude`,
      );
    }
  }
  // Coverage of the page's tape, 14 days either side of now. Missing
  // coverage only hides a spacecraft for part of the tape: warn, do not fail.
  for (const { key } of [...DEEP_SPACECRAFT, ...LUNAR_ORBITERS]) {
    const lookup = DEEP_SPACECRAFT.some((item) => item.key === key)
      ? vectorAt
      : lunarAt;
    assert(
      lookup(craft, key, Date.parse(craft.fetched), at),
      `${key} missing at its own fetch time`,
    );
    const gaps = [-14, 14].filter(
      (days) => !lookup(craft, key, now + days * DAY, at),
    );
    if (gaps.length)
      warnings.push(
        `${key} not covered at now ${gaps.map((days) => `${days > 0 ? '+' : ''}${days} d`).join(', ')}`,
      );
  }
}
const moon = Math.hypot(...moonPosition(fleet.fetched)) * EARTH_RADIUS_KM;
assert(moon > 350000 && moon < 410000, `Moon at ${Math.round(moon)} km`);

// --- Size budgets (bytes, uncompressed; Pages serves them gzipped) ---------
const BUDGET = {
  'orbits.json': 2.5e6,
  'catalog.json': 2.5e6,
  'spacecraft.json': 300e3,
  'status.json': 20e3,
};
const sizes = [];
for (const [name, limit] of Object.entries(BUDGET)) {
  let size;
  try {
    size = (await stat(new URL(name, DATA))).size;
  } catch {
    if (name === 'spacecraft.json') continue;
    assert.fail(`public/data/${name} is missing`);
  }
  assert(
    size <= limit,
    `${name} is ${Math.round(size / 1000)} kB, over its ${Math.round(limit / 1000)} kB budget`,
  );
  sizes.push(`${name} ${Math.round(size / 1000)} kB`);
}

const age = (Date.now() - fleet.fetched) / DAY;
if (age > 3)
  warnings.push(
    `constellation snapshot is ${age.toFixed(1)} days old; run pnpm data:fetch`,
  );
for (const warning of warnings) console.warn(`WARN: ${warning}`);
console.log(
  `PASS: ${fleet.count} satellites in ${CONSTELLATIONS.length} groups from ${snapshot.fetched.slice(0, 16)}Z` +
    (craft
      ? `, ${DEEP_SPACECRAFT.length + LUNAR_ORBITERS.length} JPL spacecraft`
      : '') +
    ` · ${sizes.join(', ')}`,
);
