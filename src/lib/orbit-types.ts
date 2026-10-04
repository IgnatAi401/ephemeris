// The orbit families explained in the learn panel, how each is recognised
// from an element set, and an example orbit to draw when the snapshot has no
// member (or to show the shape alongside the real ones).
import type { Elements } from '@/lib/kepler';
import { EARTH_RADIUS_KM, moonPosition, type Fleet } from '@/lib/orbits';

const DEG = Math.PI / 180;
const MU = 398600.4418;
const DAY = 86400000;
// The Sun's mean motion along the ecliptic: what a sun-synchronous orbit's
// node must match (rad/ms).
const SUN_RATE = (2 * Math.PI) / (365.2422 * DAY);

export type OrbitTypeId =
  | 'leo'
  | 'meo'
  | 'geo'
  | 'heo'
  | 'molniya'
  | 'sso'
  | 'tli';

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
  /** In place of the generic note when the snapshot has no member. */
  none?: [string, string];
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
  {
    id: 'tli',
    zh: '地月转移轨道',
    en: 'Trans-lunar transfer',
    short: ['from a parking orbit out to the Moon', '从停泊轨道一路伸到月球'],
    about: [
      'Not a place to stay but a road: a burn in a low parking orbit stretches it into a long ellipse whose apogee reaches the Moon, 380,000 km out. The apogee has to arrive together with the Moon, so the spacecraft aims at where the Moon will be days later. The thriftiest, Hohmann-like route takes about five days; Apollo flew a little faster by putting the apogee beyond the Moon. Near the Moon its gravity takes over, and the spacecraft brakes into lunar orbit; Chang’e and Chandrayaan first loop around Earth a few times, raising the apogee step by step.',
      '这不是长期停留的轨道，而是一段路程：在近地停泊轨道上点火加速，轨道被拉成细长的椭圆，远地点一直伸到 38 万 km 外的月球。远地点必须和月球同时到达同一位置，所以出发时要瞄准月球几天后所在的地方。最省燃料的霍曼式转移单程约 5 天；阿波罗把远地点放在月球之外，3 天左右就能到。飞近月球后月球引力占主导，探测器减速进入环月轨道；嫦娥、月船等任务则先绕地球几圈，逐步抬高远地点。',
    ],
    test: (s) => s.apogee > 150000,
    example: {
      a: 30.67,
      e: 0.9664,
      i: 28.5 * DEG,
      raan: 0,
      argp: 180 * DEG,
      M: 0,
    },
    none: [
      'Nothing in the current snapshot is on its way to the Moon. The dashed line is worked out from the real Moon: leave now, and the apogee meets it about five days later. The clock runs at 3600× to show the trip.',
      '当前数据中没有正在飞往月球的目标。虚线按真实月球位置算出：探测器此刻出发，约 5 天后在远地点与月球相遇。时钟已调到 3600× 演示这段飞行。',
    ],
  },
];

// A 200 km parking orbit, where trans-lunar burns usually start.
const PARKING = 1 + 200 / EARTH_RADIUS_KM;

/** A Hohmann-style trip to the Moon leaving perigee at `depart`: the apogee
 * sits where the Moon will be on arrival, the plane is the Moon's own, and
 * the flight takes half the ellipse's period. */
export function lunarTransfer(depart: number) {
  let flight = 5 * DAY;
  let moon = moonPosition(depart + flight);
  // Arrival fixes the apogee distance, which fixes the flight time; a few
  // rounds settle both.
  for (let round = 0; round < 4; round++) {
    const a = ((PARKING + Math.hypot(...moon)) / 2) * EARTH_RADIUS_KM;
    flight = Math.PI * Math.sqrt(a ** 3 / MU) * 1000;
    moon = moonPosition(depart + flight);
  }
  const r = Math.hypot(...moon);
  // The orbit normal follows the Moon's motion around Earth.
  const ahead = moonPosition(depart + flight + DAY / 24);
  const normal = [
    moon[1] * ahead[2] - moon[2] * ahead[1],
    moon[2] * ahead[0] - moon[0] * ahead[2],
    moon[0] * ahead[1] - moon[1] * ahead[0],
  ];
  const length = Math.hypot(...normal);
  const [hx, hy, hz] = normal.map((value) => value / length);
  const raan = Math.atan2(hx, -hy);
  // In-plane axes: toward the ascending node, and 90° on along the motion.
  const node = [Math.cos(raan), Math.sin(raan), 0];
  const along = [
    hy * node[2] - hz * node[1],
    hz * node[0] - hx * node[2],
    hx * node[1] - hy * node[0],
  ];
  // Perigee lies opposite the meeting point.
  const perigee = moon.map((value) => -value / r);
  const dot = (a: number[], b: number[]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const elements: Elements = {
    a: (PARKING + r) / 2,
    e: (r - PARKING) / (r + PARKING),
    i: Math.acos(hz),
    raan,
    argp: Math.atan2(dot(perigee, along), dot(perigee, node)),
    M: 0,
  };
  return { elements, depart, arrive: depart + flight };
}

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
