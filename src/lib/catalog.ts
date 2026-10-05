import { CONSTELLATIONS, type Fleet } from '@/lib/orbits';

// Names, catalogue numbers and drag terms (public/data/catalog.json), in the
// same order as the satellites in orbits.json. Loaded only when needed:
// hover names, search, the info card and SGP4.

/** One catalogue row: [NORAD, name, COSPAR id, B*, ṅ/2, n̈/6]. */
type Row = [number, string, string, number, number, number];
type CatalogFile = { fetched: string; groups: Record<string, Row[]> };

export type CatalogEntry = {
  /** Index in the fleet (and the scene's position buffer). */
  index: number;
  group: number;
  norad: number;
  name: string;
  cospar: string;
  bstar: number;
  meanMotionDot: number;
  meanMotionDdot: number;
};

export type Catalog = {
  entries: CatalogEntry[];
  byNorad: Map<number, CatalogEntry>;
  search: (query: string, limit?: number) => CatalogEntry[];
};

let pending: Promise<Catalog> | null = null;

/** The catalogue for `fleet`, fetched once. */
export function loadCatalog(fleet: Fleet) {
  pending ??= fetch(`${import.meta.env.BASE_URL}data/catalog.json`)
    .then((response) => {
      if (!response.ok) throw new Error('Catalog unavailable');
      return response.json() as Promise<CatalogFile>;
    })
    .then((file) => build(file, fleet))
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

function build(file: CatalogFile, fleet: Fleet): Catalog {
  const entries: CatalogEntry[] = [];
  CONSTELLATIONS.forEach(({ key }, group) => {
    const rows = file.groups[key] ?? [];
    // A catalogue from another fetch than the elements cannot be trusted to
    // line up; the workflow always deploys the two together.
    if (rows.length !== fleet.counts[group])
      throw new Error(`catalog.json does not match orbits.json (${key})`);
    rows.forEach(
      ([norad, name, cospar, bstar, meanMotionDot, meanMotionDdot], at) => {
        entries.push({
          index: fleet.starts[group] + at,
          group,
          norad,
          name,
          cospar,
          bstar,
          meanMotionDot,
          meanMotionDdot,
        });
      },
    );
  });
  const byNorad = new Map(entries.map((entry) => [entry.norad, entry]));
  const folded = entries.map((entry) => entry.name.toLowerCase());

  /** Catalogue number (exact, then prefix) or name (prefix first, then
   * anywhere). */
  const search = (query: string, limit = 12) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (/^\d+$/.test(q)) {
      const exact = byNorad.get(Number(q));
      const prefix = entries.filter(
        (entry) => entry !== exact && String(entry.norad).startsWith(q),
      );
      return [...(exact ? [exact] : []), ...prefix].slice(0, limit);
    }
    const starts: CatalogEntry[] = [];
    const contains: CatalogEntry[] = [];
    for (let at = 0; at < entries.length; at++) {
      const position = folded[at].indexOf(q);
      if (position === 0) starts.push(entries[at]);
      else if (position > 0) contains.push(entries[at]);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  };
  return { entries, byNorad, search };
}
