import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Network etiquette for the data scripts: an identifiable User-Agent, retries
// with backoff, and a local cache so a CelesTrak group is downloaded at most
// once every two hours however often the script is run.
const { version } = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
);
export const USER_AGENT = `ephemeris-orbit/${version} (+https://orbit.ignat.ai)`;
const CACHE = new URL('../../.cache/', import.meta.url);
// Seconds to wait before each retry. 4xx answers other than 408/429 are not
// retried: asking again will not change them.
const BACKOFF = [5, 20, 60];
const sleep = (seconds) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/** GET `url` and return the response text, retrying transient failures. */
export async function fetchText(url, { label = url, timeout = 180 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let retry = true;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeout * 1000),
      });
      if (!response.ok) {
        retry =
          response.status >= 500 ||
          response.status === 408 ||
          response.status === 429;
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (!retry || attempt === BACKOFF.length)
        throw new Error(`${label}: ${error.message}`);
      console.warn(
        `${label}: ${error.message}; retrying in ${BACKOFF[attempt]} s`,
      );
      await sleep(BACKOFF[attempt]);
    }
  }
}

/** `fetchText` through a file cache under .cache/<namespace>/<key>.json; a
 * cached copy younger than `maxAge` ms is returned without a request. The
 * response is only cached once `validate` accepts it. */
export async function cachedText(
  namespace,
  key,
  url,
  { maxAge, validate = () => {}, ...options },
) {
  const file = new URL(`${namespace}/${key}.json`, CACHE);
  try {
    const cached = JSON.parse(await readFile(file, 'utf8'));
    if (cached.url === url && Date.now() - cached.fetched < maxAge) {
      return { text: cached.text, fetched: cached.fetched, cached: true };
    }
  } catch {
    // No usable cache entry: download.
  }
  const text = await fetchText(url, options);
  validate(text);
  const fetched = Date.now();
  await mkdir(new URL('.', file), { recursive: true });
  await writeFile(file, JSON.stringify({ url, fetched, text }));
  return { text, fetched, cached: false };
}
