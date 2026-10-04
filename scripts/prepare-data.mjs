import { spawnSync } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import { ORIGIN, pullLive, removeData } from './lib/live.mjs';
import { DATA, writeStatus } from './lib/status.mjs';

// Puts a checked snapshot in public/data for the build, the way the deploy
// workflow needs it:
//
//   node scripts/prepare-data.mjs --constellations=fetch|live --spacecraft=fetch|live [--accept-drop]
//
// Each part is taken from its preferred source and, if that fails, from the
// other one: `fetch` asks CelesTrak / JPL Horizons, `live` copies the
// previous snapshot from the live site. The spacecraft are optional (the page
// works without them); the constellations are not.
//
// Then scripts/check-orbits.mjs runs. If freshly fetched data fails it, the
// fresh parts are replaced by the live copies and checked again: the site
// keeps its previous data, other updates still deploy, and the run reports
// `degraded=true` so the workflow can end in failure and notify.
const PARTS = {
  constellations: { files: ['orbits.json', 'catalog.json'], required: true },
  spacecraft: { files: ['spacecraft.json'], required: false },
};
const argument = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const acceptDrop = process.argv.includes('--accept-drop');
const plan = {};
for (const part of Object.keys(PARTS)) {
  plan[part] = argument(part) ?? 'live';
  if (!['fetch', 'live'].includes(plan[part]))
    throw new Error(`--${part} must be fetch or live`);
}
const github = Boolean(process.env.GITHUB_ACTIONS);
const warn = (message) =>
  console.log(github ? `::warning::${message}` : `WARN: ${message}`);
const node = (...args) =>
  spawnSync(process.execPath, args, { stdio: 'inherit' }).status === 0;

async function obtain(part, method) {
  if (method === 'fetch') {
    if (!node('scripts/fetch-orbits.mjs', `--only=${part}`))
      throw new Error(`fetching ${part} failed`);
  } else {
    await pullLive(PARTS[part].files);
  }
}

await mkdir(DATA, { recursive: true });
const used = {};
for (const [part, { files, required }] of Object.entries(PARTS)) {
  const order = plan[part] === 'fetch' ? ['fetch', 'live'] : ['live', 'fetch'];
  for (const method of order) {
    try {
      console.log(
        `${part}: ${method === 'fetch' ? 'fetching' : `copying from ${ORIGIN}`}`,
      );
      await obtain(part, method);
      used[part] = method;
      break;
    } catch (error) {
      warn(`${part}: ${method} failed (${error.message})`);
    }
  }
  if (!used[part]) {
    if (required)
      throw new Error(`${part}: no source worked; nothing to deploy`);
    for (const file of files) await removeData(file);
    used[part] = 'none';
    warn(`${part}: deploying without it`);
  }
}

const check = () => {
  // fetch-orbits.mjs rebuilt status.json after a fetch, but not after a copy.
  return writeStatus().then(() =>
    node('scripts/check-orbits.mjs', ...(acceptDrop ? ['--accept-drop'] : [])),
  );
};
let degraded = false;
if (!(await check())) {
  const fresh = Object.keys(PARTS).filter((part) => used[part] === 'fetch');
  if (!fresh.length)
    throw new Error('the live snapshot itself fails the checks');
  console.log(
    `Fresh ${fresh.join(' and ')} failed the checks; falling back to the live snapshot`,
  );
  for (const part of fresh) {
    try {
      await pullLive(PARTS[part].files);
      used[part] = 'live';
    } catch (error) {
      if (PARTS[part].required)
        throw new Error(
          `${part}: fresh data is bad and the live copy is unavailable (${error.message})`,
        );
      for (const file of PARTS[part].files) await removeData(file);
      used[part] = 'none';
    }
  }
  if (!(await check()))
    throw new Error('the live snapshot fails the checks too');
  degraded = true;
  console.log(
    github
      ? '::error::Fresh data failed the checks; deployed the previous snapshot'
      : 'DEGRADED: deployed the previous snapshot',
  );
}

const summary = `constellations=${used.constellations}, spacecraft=${used.spacecraft}${degraded ? ', degraded' : ''}`;
console.log(`Prepared public/data: ${summary}`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `degraded=${degraded}\nconstellations=${used.constellations}\nspacecraft=${used.spacecraft}\n`,
  );
}
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `Data: ${summary}\n`);
