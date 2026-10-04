import { readFile, stat, writeFile } from 'node:fs/promises';
import { LEAP_TABLE_SOURCE } from './time-scales.mjs';

// public/data/status.json: when each snapshot was fetched, how many objects
// each group holds and where the data came from. Built from the files on
// disk, so it is right whether a snapshot was just fetched or carried over
// from the live site.
export const DATA = new URL('../../public/data/', import.meta.url);
export const FILES = ['orbits.json', 'catalog.json', 'spacecraft.json'];

const readJson = async (name) => {
  try {
    return JSON.parse(await readFile(new URL(name, DATA), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

export async function buildStatus() {
  const orbits = await readJson('orbits.json');
  if (!orbits) throw new Error('public/data/orbits.json is missing');
  const craft = await readJson('spacecraft.json');
  const groups = {};
  for (const [key, values] of Object.entries(orbits.groups)) {
    groups[key] = { count: values.length / 7, ...orbits.stats?.[key] };
  }
  const files = {};
  for (const name of FILES) {
    try {
      files[name] = (await stat(new URL(name, DATA))).size;
    } catch {
      // Optional file absent.
    }
  }
  return {
    generated: new Date().toISOString(),
    constellations: {
      source: orbits.source,
      fetched: orbits.fetched,
      total: Object.values(groups).reduce((sum, group) => sum + group.count, 0),
      groups,
    },
    spacecraft: craft
      ? {
          source: craft.source,
          fetched: craft.fetched,
          start: new Date(craft.start).toISOString(),
          stop: new Date(craft.stop).toISOString(),
          // Tracks whose Horizons ephemeris ends before `stop`.
          stops: Object.fromEntries(
            Object.entries(craft.stops ?? {}).map(([key, time]) => [
              key,
              new Date(time).toISOString(),
            ]),
          ),
          tracks: [
            ...Object.keys(craft.vectors.tracks),
            ...Object.keys(craft.lunar.tracks),
          ],
          leapSeconds: LEAP_TABLE_SOURCE,
        }
      : null,
    files,
  };
}

export async function writeStatus() {
  const status = await buildStatus();
  await writeFile(
    new URL('status.json', DATA),
    `${JSON.stringify(status, null, 2)}\n`,
  );
  return status;
}
