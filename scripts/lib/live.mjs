import { rename, unlink, writeFile } from 'node:fs/promises';
import { SITE_HOST } from '../../src/lib/site.ts';
import { fetchText } from './net.mjs';
import { DATA } from './status.mjs';

// The previous snapshot, from the live site. Used when a source fails or does
// not need refreshing, so one failing source never blocks the other and the
// site never goes without data. SITE_ORIGIN overrides the origin (local
// tests: SITE_ORIGIN=http://127.0.0.1:3001).
export const ORIGIN = process.env.SITE_ORIGIN ?? `https://${SITE_HOST}`;

/** Download public/data/<name> for every name from the live site. All files
 * are fetched and parsed before any is written, so a failure leaves the
 * local copies untouched. */
export async function pullLive(names) {
  const bodies = [];
  for (const name of names) {
    const text = await fetchText(`${ORIGIN}/data/${name}`, {
      label: `live ${name}`,
      timeout: 60,
    });
    JSON.parse(text);
    bodies.push([name, text]);
  }
  for (const [name, text] of bodies) {
    const temporary = new URL(`${name}.part`, DATA);
    await writeFile(temporary, text);
    await rename(temporary, new URL(name, DATA));
  }
}

export async function removeData(name) {
  await unlink(new URL(name, DATA)).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
