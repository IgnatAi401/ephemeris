import { mkdir, writeFile } from 'node:fs/promises';
import { fetchConstellations } from './lib/celestrak.mjs';
import { fetchSpacecraft } from './lib/horizons.mjs';
import { DATA, writeStatus } from './lib/status.mjs';

// Snapshots behind the orbit view, written to public/data (not committed):
// - orbits.json: CelesTrak element sets, seven numbers per satellite.
// - catalog.json: names, catalogue numbers and drag terms in the same order,
//   loaded only for search, the info card and SGP4.
// - spacecraft.json: JPL Horizons ephemerides for the L1/L2 spacecraft and
//   two lunar orbiters.
// - status.json: fetch times and counts, rebuilt from whatever is on disk.
// The page propagates from these files and never calls CelesTrak or JPL.
//
//   pnpm data:fetch                        everything
//   pnpm data:fetch --only=constellations  CelesTrak only
//   pnpm data:fetch --only=spacecraft      Horizons only
//   pnpm data:fetch --only=status          just rebuild status.json
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
if (only && !['constellations', 'spacecraft', 'status'].includes(only)) {
  throw new Error(`Unknown --only=${only}`);
}
const fetched = Date.now();
const write = async (name, value) => {
  await writeFile(new URL(name, DATA), `${JSON.stringify(value)}\n`);
  console.log(`Wrote public/data/${name}`);
};

await mkdir(DATA, { recursive: true });
if (!only || only === 'constellations') {
  const { orbits, catalog } = await fetchConstellations(fetched);
  await write('orbits.json', orbits);
  await write('catalog.json', catalog);
  for (const [
    key,
    { count, celestrak, duplicates, dropped, recent },
  ] of Object.entries(orbits.stats)) {
    console.log(
      `${key.padEnd(18)} ${String(count).padStart(6)} kept of ${celestrak}` +
        (duplicates ? `, ${duplicates} in other groups` : '') +
        (dropped ? `, ${dropped} not drawable` : '') +
        (recent ? `, ${recent} new` : ''),
    );
  }
}
if (!only || only === 'spacecraft')
  await write('spacecraft.json', await fetchSpacecraft(fetched));
const status = await writeStatus();
console.log(
  `Wrote public/data/status.json (${status.constellations.total} satellites)`,
);
