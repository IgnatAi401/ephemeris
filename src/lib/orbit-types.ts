// The orbit families explained in the learn panel, how each is recognised
// from an element set, and an example orbit to draw when the snapshot has no
// member (or to show the shape alongside the real ones).
import type { Elements } from '@/lib/kepler';
import { EARTH_RADIUS_KM, type Fleet } from '@/lib/orbits';

const DEG = Math.PI / 180;
const MU = 398600.4418;
const DAY = 86400000;
// The Sun's mean motion along the ecliptic: what a sun-synchronous orbit's
// node must match (rad/ms).
const SUN_RATE = (2 * Math.PI) / (365.2422 * DAY);

export type OrbitTypeId = 'leo' | 'meo' | 'geo' | 'heo' | 'molniya' | 'sso';

type Sample = {
  /** Mean motion, rev/day. */
  n: number;
  e: number;
  /** Inclination, degrees. */
  i: number;
  perigee: number;
  apogee: number;
  /** Nodal precession from J2, rad/ms. */
  raanDot: number;
};

export const ORBIT_TYPES: {
  id: OrbitTypeId;
  zh: string;
  en: string;
  short: [string, string];
  about: [string, string];
  test: (s: Sample) => boolean;
  example: Elements;
}[] = [
  {
    id: 'leo',
    zh: '近地轨道 LEO',
    en: 'Low Earth orbit (LEO)',
    short: ['below 2,000 km', '2000 km 以下'],
    about: [
      'Below 2,000 km, one lap in 90–120 minutes. Space stations, Starlink and most Earth-imaging satellites live here: close enough for low latency and sharp pictures, low enough that drag eventually brings them down.',
      '高度 2000 km 以下，约 90–120 分钟绕地球一圈。空间站、星链和大多数对地观测卫星都在这里：离得近，通信延迟低、拍照清晰，但会受稀薄大气阻力慢慢下降。',
    ],
    test: (s) => s.apogee < 2000,
    example: { a: 1.065, e: 0.0005, i: 51.6 * DEG, raan: 0, argp: 0, M: 0 },
  },
  {
    id: 'meo',
    zh: '中地球轨道 MEO',
    en: 'Medium Earth orbit (MEO)',
    short: ['2,000–35,000 km', '2000–35000 km'],
    about: [
      'Between LEO and geostationary height. The navigation constellations, GPS, GLONASS, Galileo and BeiDou, fly here at about 20,000 km: high enough that a couple of dozen satellites cover the globe, with orbits of roughly 12 hours.',
      '介于近地轨道和地球静止轨道之间。GPS、格洛纳斯、伽利略和北斗等导航星座在约 2 万公里高度运行：足够高，二三十颗卫星就能覆盖全球，周期约 12 小时。',
    ],
    test: (s) => s.e < 0.25 && s.perigee >= 2000 && s.apogee < 35000,
    example: { a: 4.16, e: 0.005, i: 55 * DEG, raan: 0, argp: 0, M: 0 },
  },
  {
    id: 'geo',
    zh: '地球静止轨道 GEO',
    en: 'Geostationary orbit (GEO)',
    short: ['35,786 km, over the equator', '赤道上空 35786 km'],
    about: [
      'At 35,786 km over the equator a satellite circles once per sidereal day, exactly as fast as Earth turns, so it hangs over one spot. Weather, TV and relay satellites use this single ring; a fixed dish never has to move.',
      '在赤道上空 35786 km，卫星绕行一圈正好一个恒星日，与地球自转同步，看上去悬停在同一地点上空。气象、电视和中继卫星都挤在这一圈上，地面天线不必转动。',
    ],
    test: (s) => s.e < 0.01 && Math.abs(s.n - 1.0027) < 0.01 && s.i < 3,
    example: { a: 6.611, e: 0.0002, i: 0.05 * DEG, raan: 0, argp: 0, M: 0 },
  },
  {
    id: 'heo',
    zh: '大椭圆轨道 HEO',
    en: 'Highly elliptical orbit (HEO)',
    short: ['eccentricity above 0.25', '偏心率大于 0.25'],
    about: [
      'Strongly stretched ellipses: the satellite races through perigee and lingers near apogee. Transfer orbits to geostationary height (GTO), many rocket stages and some science missions follow such paths.',
      '拉得很长的椭圆：卫星在近地点附近飞得飞快，在远地点附近慢慢停留。前往地球静止轨道的转移轨道（GTO）、许多火箭末级和一些科学卫星都是这种轨道。',
    ],
    test: (s) => s.e >= 0.25,
    example: { a: 3.87, e: 0.73, i: 27 * DEG, raan: 0, argp: 180 * DEG, M: 0 },
  },
  {
    id: 'molniya',
    zh: '闪电轨道 Molniya',
    en: 'Molniya orbit',
    short: [
      '12 h, 63.4°, apogee over the north',
      '12 小时，63.4°，远地点在北方',
    ],
    about: [
      'A 12-hour ellipse inclined at 63.4°, the angle at which Earth’s bulge stops turning the apogee. The satellite spends about eight hours of each lap high over the northern latitudes that geostationary satellites see poorly; Russia has used it since the 1960s.',
      '周期 12 小时、倾角 63.4° 的大椭圆轨道：在这个倾角下，地球扁率不会让远地点漂移。卫星每圈约有 8 小时停留在高纬度地区上空，弥补地球静止卫星照顾不到的北方，苏联/俄罗斯自 1960 年代起使用。',
    ],
    test: (s) =>
      s.e >= 0.5 && Math.abs(s.n - 2.006) < 0.12 && Math.abs(s.i - 63.4) < 3,
    example: {
      a: 4.17,
      e: 0.72,
      i: 63.4 * DEG,
      raan: 0,
      argp: 270 * DEG,
      M: 0,
    },
  },
  {
    id: 'sso',
    zh: '太阳同步轨道 SSO',
    en: 'Sun-synchronous orbit (SSO)',
    short: ['about 98°, same local time daily', '约 98°，每天同一地方时经过'],
    about: [
      'A near-polar LEO tilted just past 90° so that Earth’s bulge turns the orbit plane about 1° a day, keeping pace with the Sun. The satellite crosses each latitude at the same local time every day: steady lighting for Earth-imaging and weather satellites.',
      '倾角略大于 90° 的近极地近地轨道：地球扁率让轨道面每天东移约 1°，正好跟上太阳。卫星每天在同一地方时飞过同一纬度，光照条件稳定，对地观测和气象卫星常用。',
    ],
    test: (s) =>
      s.e < 0.05 &&
      s.apogee < 6000 &&
      Math.abs(s.raanDot - SUN_RATE) < 0.1 * SUN_RATE,
    example: { a: 1.11, e: 0.001, i: 98.2 * DEG, raan: 0, argp: 0, M: 0 },
  },
];

/** For each orbit type, a 0/1 mask over the fleet and its count. */
export function classify(fleet: Fleet) {
  const masks = Object.fromEntries(
    ORBIT_TYPES.map(({ id }) => [id, new Uint8Array(fleet.count)]),
  ) as Record<OrbitTypeId, Uint8Array>;
  const counts = Object.fromEntries(
    ORBIT_TYPES.map(({ id }) => [id, 0]),
  ) as Record<OrbitTypeId, number>;
  for (let index = 0; index < fleet.count; index++) {
    const at = index * 7;
    const n = fleet.elements[at + 1];
    const e = fleet.elements[at + 2];
    const radians = (n * 2 * Math.PI) / 86400;
    const a = Math.cbrt(MU / (radians * radians));
    const sample: Sample = {
      n,
      e,
      i: fleet.elements[at + 3],
      perigee: a * (1 - e) - EARTH_RADIUS_KM,
      apogee: a * (1 + e) - EARTH_RADIUS_KM,
      raanDot: fleet.raanDot[index],
    };
    for (const type of ORBIT_TYPES) {
      if (!type.test(sample)) continue;
      masks[type.id][index] = 1;
      counts[type.id]++;
    }
  }
  return { masks, counts };
}
