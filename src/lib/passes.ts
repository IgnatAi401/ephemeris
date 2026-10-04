// Visible passes of one satellite over one observer, computed entirely in the
// browser from SGP4. A pass is visible while the satellite is above the
// elevation mask, lit by the Sun, and the observer's sky is dark: the Sun
// more than 6° below the horizon (civil twilight over), when the space
// stations are at their brightest against a darkening sky.
import type { Precise } from '@/lib/precise';

export type Observer = {
  latitude: number;
  longitude: number;
  /** Shown in the panel: a city name, or "my location". */
  label: string;
};
export type PassPoint = { time: number; azimuth: number; elevation: number };
export type Pass = {
  norad: number;
  name: string;
  start: PassPoint;
  peak: PassPoint;
  end: PassPoint;
  /** Why the pass begins: rising over the mask, leaving Earth's shadow,
   * the sky getting dark, or already under way at the start of the search. */
  startReason: 'rise' | 'sunlit' | 'dark' | 'now';
  /** Why it ends: setting, entering Earth's shadow, or dawn. */
  endReason: 'set' | 'shadow' | 'dawn' | 'later';
  /** Sky track every 10 s, for the sky chart. */
  path: PassPoint[];
};

const DEG = Math.PI / 180;
const STEP = 30000;
export const MIN_ELEVATION = 10;
export const SUN_LIMIT = -6;

type Sample = {
  time: number;
  azimuth: number;
  elevation: number;
  above: boolean;
  lit: boolean;
  dark: boolean;
};

export function predictPasses(
  precise: Precise,
  observer: Observer,
  from: number,
  days = 5,
): Pass[] {
  const { lib } = precise;
  const site = {
    latitude: observer.latitude * DEG,
    longitude: observer.longitude * DEG,
    height: 0,
  };
  const siteEcf = lib.geodeticToEcf(site);

  const sample = (time: number): Sample | null => {
    const state = precise.state(time);
    if (!state) return null;
    const date = new Date(time);
    const gmst = lib.gstime(date);
    const [x, y, z] = state.position;
    const eci = { x, y, z };
    const look = lib.ecfToLookAngles(site, lib.eciToEcf(eci, gmst));
    const elevation = look.elevation / DEG;
    const point = {
      time,
      azimuth: (((look.azimuth / DEG) % 360) + 360) % 360,
      elevation,
    };
    const above = elevation > MIN_ELEVATION;
    // Light and darkness only matter while the satellite is up.
    if (!above) return { ...point, above, lit: false, dark: false };
    const sun = lib.sunPos(lib.jday(date)).rsun;
    const lit = lib.shadowFraction(sun, eci) < 0.5;
    const up = lib.ecfToEci(siteEcf, gmst);
    const sunLength = Math.hypot(sun.x, sun.y, sun.z);
    const upLength = Math.hypot(up.x, up.y, up.z);
    const sunElevation =
      Math.asin(
        (sun.x * up.x + sun.y * up.y + sun.z * up.z) / (sunLength * upLength),
      ) / DEG;
    return { ...point, above, lit, dark: sunElevation < SUN_LIMIT };
  };
  const visible = (s: Sample | null) => !!s && s.above && s.lit && s.dark;
  /** The first instant (to ~10 ms) where visibility flips, between a and b. */
  const edge = (a: number, b: number, from: boolean) => {
    for (let i = 0; i < 12; i++) {
      const middle = (a + b) / 2;
      if (visible(sample(middle)) === from) a = middle;
      else b = middle;
    }
    return b;
  };
  const toPoint = (s: Sample): PassPoint => ({
    time: s.time,
    azimuth: s.azimuth,
    elevation: s.elevation,
  });

  const passes: Pass[] = [];
  const stop = from + days * 86400000;
  let opened: { time: number; reason: Pass['startReason'] } | null = visible(
    sample(from),
  )
    ? { time: from, reason: 'now' }
    : null;
  for (let time = from + STEP; time <= stop + STEP; time += STEP) {
    const current = time > stop ? null : sample(time);
    const now = visible(current);
    if (!opened && now) {
      const start = edge(time - STEP, time, false);
      const before = sample(start - 1000);
      opened = {
        time: start,
        reason: !before?.above ? 'rise' : !before.lit ? 'sunlit' : 'dark',
      };
    } else if (opened && !now) {
      const end = current
        ? edge(time - STEP, time, true)
        : Math.min(time - STEP, stop);
      const after = current ? sample(end + 1000) : null;
      const endReason: Pass['endReason'] = !after
        ? 'later'
        : !after.above
          ? 'set'
          : !after.lit
            ? 'shadow'
            : 'dawn';
      const path: PassPoint[] = [];
      let peak: Sample | null = null;
      for (let at = opened.time; at <= end; at += 5000) {
        const s = sample(at);
        if (!s) continue;
        if (!peak || s.elevation > peak.elevation) peak = s;
        if (Math.round((at - opened.time) / 5000) % 2 === 0)
          path.push(toPoint(s));
      }
      const first = sample(opened.time);
      const last = sample(end);
      if (first && last && peak) {
        path.push(toPoint(last));
        passes.push({
          norad: precise.entry.norad,
          name: precise.entry.name,
          start: toPoint(first),
          peak: toPoint(peak),
          end: toPoint(last),
          startReason: opened.reason,
          endReason,
          path,
        });
      }
      opened = null;
    }
  }
  return passes;
}

/** Compass point for an azimuth in degrees. */
export function compass(azimuth: number, lang: 'zh' | 'en') {
  const en = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const zh = [
    '北',
    '北东北',
    '东北',
    '东东北',
    '东',
    '东东南',
    '东南',
    '南东南',
    '南',
    '南西南',
    '西南',
    '西西南',
    '西',
    '西西北',
    '西北',
    '北西北',
  ];
  const at = Math.round(azimuth / 22.5) % 16;
  return lang === 'en' ? en[at] : zh[at];
}
