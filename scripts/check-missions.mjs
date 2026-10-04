import { readFile, stat } from 'node:fs/promises';
import { MISSIONS } from '../src/lib/missions.ts';

// Offline checks of the mission replays: every mission in src/lib/missions.ts
// has its trajectory in public/missions/, with sane samples covering its
// phases and events.
//
//   pnpm check:missions
const DIR = new URL('../public/missions/', import.meta.url);
const MAX_BYTES = 300 * 1024;
const EARTH_KM = 6378.137;
const problems = [];
const fail = (id, message) => problems.push(`${id}: ${message}`);

for (const mission of MISSIONS) {
  const { id } = mission;
  const file = new URL(`${id}.json`, DIR);
  let data;
  try {
    const { size } = await stat(file);
    if (size > MAX_BYTES)
      fail(id, `${Math.round(size / 1024)} kB, over ${MAX_BYTES / 1024} kB`);
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    fail(id, `cannot read public/missions/${id}.json (${error.message})`);
    continue;
  }
  if (data.id !== id) fail(id, `file says id ${data.id}`);
  if (data.craft.length !== mission.craft.length)
    fail(id, `${data.craft.length} tracks, ${mission.craft.length} spacecraft`);
  for (const track of data.craft) {
    const { key, t, s } = track;
    if (s.length !== t.length * 6)
      fail(id, `${key}: ${t.length} times, ${s.length / 6} states`);
    for (let k = 1; k < t.length; k++)
      if (!(t[k] > t[k - 1])) {
        fail(id, `${key}: times not increasing at sample ${k}`);
        break;
      }
    for (let k = 0; k < t.length; k++) {
      const r = Math.hypot(s[k * 6], s[k * 6 + 1], s[k * 6 + 2]);
      const v = Math.hypot(s[k * 6 + 3], s[k * 6 + 4], s[k * 6 + 5]);
      // Above the upper atmosphere, inside four times the L2 distance, and
      // slower than Earth's escape speed at the surface.
      if (!(r > EARTH_KM + 50 && r < 6e6 && v < 11.2)) {
        fail(
          id,
          `${key}: sample ${k} at ${Math.round(r)} km, ${v.toFixed(2)} km/s`,
        );
        break;
      }
    }
  }
  const lead = data.craft[0];
  const first = data.start + lead.t[0] * 1000;
  const last = data.start + lead.t.at(-1) * 1000;
  const moonEnd =
    data.moon.start + (data.moon.s.length / 6 - 1) * data.moon.step * 1000;
  if (data.moon.start > first || moonEnd < last)
    fail(id, 'the Moon does not cover the whole trajectory');
  let previous = -Infinity;
  for (const phase of mission.phases) {
    const from = Date.parse(phase.from);
    if (!(from > previous)) fail(id, `phase ${phase.en} out of order`);
    if (from < first - 60000 || from >= last)
      fail(id, `phase ${phase.en} outside the data`);
    if (phase.frame && !mission.frames.includes(phase.frame))
      fail(id, `phase ${phase.en} turns to ${phase.frame}, not offered`);
    previous = from;
  }
  for (const event of mission.events) {
    const at = Date.parse(event.at);
    if (!(at >= first && at <= last))
      fail(id, `event ${event.en} outside the data`);
  }
  if (Date.parse(mission.launch) > first)
    fail(id, 'launch after the data begins');
  console.log(
    `${id.padEnd(13)} ${lead.t.length} samples, ` +
      `${new Date(first).toISOString().slice(0, 16)} → ${new Date(last).toISOString().slice(0, 16)}`,
  );
}

if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(`Mission replays OK (${MISSIONS.length})`);
