/** The deployed origin. The workflow pulls the previous data from here when a
 * source fails; public/CNAME holds the same host. */
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
    zh: '航天器星历',
    en: 'spacecraft ephemerides',
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
