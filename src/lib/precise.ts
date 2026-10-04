// SGP4 (SDP4 for deep-space orbits) for a selected satellite, through
// satellite.js. The ten thousand satellites on screen keep the fast J2
// propagator in lib/orbits.ts; this is for one satellite at a time: its exact
// position, orbit line, ground track and visible passes. satellite.js is
// loaded on first use so it never weighs on the first paint.
import type { CatalogEntry } from '@/lib/catalog';
import { EARTH_RADIUS_KM, type Fleet } from '@/lib/orbits';

type SatelliteJs = typeof import('satellite.js');
type SatRec = import('satellite.js').SatRec;

let library: Promise<SatelliteJs> | null = null;
export const loadSatelliteJs = () => (library ??= import('satellite.js'));

export type Precise = {
  entry: CatalogEntry;
  /** Position in Earth radii (TEME, the scene's frame) at `time` (Unix ms),
   * or null where SGP4 fails (e.g. the orbit has decayed). */
  position: (time: number) => [number, number, number] | null;
  /** TEME position (km) and velocity (km/s), or null. */
  state: (time: number) => { position: number[]; velocity: number[] } | null;
  /** Orbital period, ms. */
  period: number;
  epoch: number;
  satrec: SatRec;
  lib: SatelliteJs;
};

/** An OMM record rebuilt from orbits.json and catalog.json. */
function omm(fleet: Fleet, entry: CatalogEntry) {
  const at = entry.index * 7;
  const [epoch, motion, e, inclination, raan, argp, anomaly] =
    fleet.elements.subarray(at, at + 7);
  return {
    OBJECT_NAME: entry.name,
    OBJECT_ID: entry.cospar,
    EPOCH: new Date(epoch).toISOString(),
    MEAN_MOTION: motion,
    ECCENTRICITY: e,
    INCLINATION: inclination,
    RA_OF_ASC_NODE: raan,
    ARG_OF_PERICENTER: argp,
    MEAN_ANOMALY: anomaly,
    EPHEMERIS_TYPE: 0 as const,
    CLASSIFICATION_TYPE: 'U' as const,
    NORAD_CAT_ID: entry.norad,
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 0,
    BSTAR: entry.bstar,
    MEAN_MOTION_DOT: entry.meanMotionDot,
    MEAN_MOTION_DDOT: entry.meanMotionDdot,
  };
}

export async function precise(
  fleet: Fleet,
  entry: CatalogEntry,
): Promise<Precise> {
  const lib = await loadSatelliteJs();
  const record = omm(fleet, entry);
  const satrec = lib.json2satrec(record);
  const state = (time: number) => {
    const result = lib.propagate(satrec, new Date(time));
    if (!result) return null;
    const { position: p, velocity: v } = result;
    return { position: [p.x, p.y, p.z], velocity: [v.x, v.y, v.z] };
  };
  return {
    entry,
    state,
    position(time) {
      const result = state(time);
      if (!result) return null;
      const [x, y, z] = result.position;
      return [x / EARTH_RADIUS_KM, y / EARTH_RADIUS_KM, z / EARTH_RADIUS_KM];
    },
    period: 86400000 / record.MEAN_MOTION,
    epoch: Date.parse(record.EPOCH),
    satrec,
    lib,
  };
}
