import { readFile, stat } from 'node:fs/promises';
import { MISSIONS } from '../src/lib/missions.ts';

// Offline checks of the mission replays: every mission in src/lib/missions.ts
// has its trajectory in public/missions/, with sane samples covering its
// phases and events.
//
//   pnpm check:missions
const DIR = new URL('../public/missions/', import.meta.url);
const MAX_BYTES = 300 * 1024;
// Cassini's 294 Saturn orbits; loaded only when picked (~230 kB gzipped).
const MAX_HELIO_BYTES = 600 * 1024;
const EARTH_KM = 6378.137;
const AU = 1.495978707e8;
const problems = [];
const fail = (id, message) => problems.push(`${id}: ${message}`);

for (const mission of MISSIONS) {
  const { id } = mission;
  const file = new URL(`${id}.json`, DIR);
  let data;
  try {
    const { size } = await stat(file);
    const budget = mission.kind === 'helio' ? MAX_HELIO_BYTES : MAX_BYTES;
    if (size > budget)
      fail(id, `${Math.round(size / 1024)} kB, over ${budget / 1024} kB`);
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
      // Around Earth: above the upper atmosphere, inside four times the L2
      // distance, slower than escape speed at the surface. Around the Sun:
      // outside 0.03 AU (Parker's record is 0.041), inside 300 AU, slower
      // than 250 km/s.
      const sane =
        mission.kind === 'helio'
          ? r > 0.03 * AU && r < 300 * AU && v < 250
          : r > EARTH_KM + 50 && r < 6e6 && v < 11.2;
      if (!sane) {
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
  if (mission.kind === 'helio') {
    if (data.kind !== 'helio') fail(id, 'file is not heliocentric');
    // Every body the phases look at or centre on is in the file, over the
    // whole trajectory.
    const keys = new Set(data.bodies.map((body) => body.key));
    for (const phase of mission.phases)
      for (const key of [phase.shot.body, phase.frame])
        if (key && key !== 'sun' && !keys.has(key))
          fail(id, `phase ${phase.en} needs ${key}, not in the file`);
    for (const body of data.bodies) {
      const from = data.start + body.t[0] * 1000;
      const to = data.start + body.t.at(-1) * 1000;
      if (from > first || to < last)
        fail(id, `${body.key} does not cover the whole trajectory`);
    }
  } else {
    const moonEnd =
      data.moon.start + (data.moon.s.length / 6 - 1) * data.moon.step * 1000;
    if (data.moon.start > first || moonEnd < last)
      fail(id, 'the Moon does not cover the whole trajectory');
  }
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
