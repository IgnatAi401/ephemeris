/** The deployed origin. The workflow pulls the previous data from here when a
 * source fails; wrangler.toml routes the same host. */
export const SITE_HOST = 'orbit.ignat.ai';

export const SOURCES = [
  {
    name: 'CelesTrak',
    href: 'https://celestrak.org',
    zh: '卫星根数',
    en: 'element sets',
  },
  {
    name: 'JPL Horizons',
    href: 'https://ssd.jpl.nasa.gov/horizons/',
    zh: '航天器星历与任务轨迹',
    en: 'spacecraft ephemerides and mission trajectories',
  },
  {
    name: 'Apollo by the Numbers',
    href: 'https://history.nasa.gov/SP-4029/',
    zh: '重建阿波罗轨迹所用的任务参数',
    en: 'figures for the rebuilt Apollo paths',
  },
  {
    name: 'Natural Earth',
    href: 'https://www.naturalearthdata.com',
    zh: '陆地边界（经 world-atlas）',
    en: 'land boundaries (via world-atlas)',
    via: 'https://github.com/topojson/world-atlas',
  },
  {
    name: 'NASA Earth Observatory',
    href: 'https://earthobservatory.nasa.gov/features/NightLights',
    zh: '夜间灯光（Black Marble）',
    en: 'night lights (Black Marble)',
  },
] as const;
