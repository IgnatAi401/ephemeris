import { useEffect, useState, type CSSProperties } from 'react';
import { Telescope, X } from 'lucide-react';
import type { CatalogEntry } from '@/lib/catalog';
import type { Language } from '@/lib/i18n';
import { CONSTELLATIONS, EARTH_RADIUS_KM, type Fleet } from '@/lib/orbits';
import type { Precise } from '@/lib/precise';
import { ObjectDescription } from '@/components/object-description';

const MU = 398600.4418;

/** The selected satellite: identity, its orbit from the element set, and
 * where SGP4 puts it at the simulated instant. */
export function InfoCard({
  lang,
  entry,
  fleet,
  precise,
  simTime,
  onClose,
  onPasses,
}: {
  lang: Language;
  entry: CatalogEntry;
  fleet: Fleet;
  precise: Precise | null;
  simTime: () => number;
  onClose: () => void;
  onPasses: () => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const [time, setTime] = useState(simTime);
  useEffect(() => {
    const timer = window.setInterval(() => setTime(simTime()), 400);
    return () => window.clearInterval(timer);
  }, [simTime]);

  const group = CONSTELLATIONS[entry.group];
  const at = entry.index * 7;
  const [epoch, motion, e, inclination] = fleet.elements.subarray(at, at + 4);
  // Semi-major axis from the mean motion (two-body; close enough to show).
  const n = (motion * 2 * Math.PI) / 86400;
  const a = Math.cbrt(MU / (n * n));
  const perigee = a * (1 - e) - EARTH_RADIUS_KM;
  const apogee = a * (1 + e) - EARTH_RADIUS_KM;
  const state = precise?.state(time) ?? null;
  const altitude = state
    ? Math.hypot(...state.position) - EARTH_RADIUS_KM
    : null;
  const speed = state ? Math.hypot(...state.velocity) : null;
  const age = (time - epoch) / 86400000;
  const km = (value: number) =>
    `${Math.round(value).toLocaleString('en-US')} km`;

  const rows: [string, string][] = [
    [t('NORAD no.', 'NORAD 编号'), String(entry.norad)],
    [t('Int’l designator', '国际编号'), entry.cospar || '—'],
    [
      t('Altitude now', '此刻高度'),
      altitude === null
        ? precise
          ? t('SGP4 failed', 'SGP4 推算失败')
          : '…'
        : km(altitude),
    ],
    [t('Speed', '速度'), speed === null ? '—' : `${speed.toFixed(2)} km/s`],
    [
      t('Perigee · apogee', '近地点 · 远地点'),
      `${km(perigee)} · ${km(apogee)}`,
    ],
    [t('Inclination', '倾角'), `${inclination.toFixed(2)}°`],
    [t('Period', '周期'), `${(1440 / motion).toFixed(1)} ${t('min', '分钟')}`],
    [
      t('Element epoch', '数据历元'),
      `${new Date(epoch).toISOString().slice(0, 16).replace('T', ' ')} UTC (${age >= 0 ? '+' : ''}${age.toFixed(1)} ${t('d', '天')})`,
    ],
  ];

  return (
    <section
      className="orbit-card"
      aria-label={entry.name}
      style={{ '--dot': group.color } as CSSProperties}
    >
      <header>
        <i aria-hidden="true" />
        <div>
          <h2>{entry.name}</h2>
          <p>{t(group.en, group.zh)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('Close', '关闭')}>
          <X size={15} />
        </button>
      </header>
      <ObjectDescription lang={lang} entry={entry} />
      <details className="orbit-card-details">
        <summary>
          {t('Orbit readouts and identifiers', '轨道读数与编号')}
        </summary>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="orbit-card-note">
          {t(
            'Position, orbit and ground track from SGP4; the dots for the whole sky use a faster approximation.',
            '位置、轨道线和星下点轨迹由 SGP4 精确推算；满天的光点用的是更快的近似算法。',
          )}
        </p>
      </details>
      <button type="button" className="orbit-card-action" onClick={onPasses}>
        <Telescope size={14} aria-hidden="true" />
        {t('Visible passes', '可见过境预报')}
      </button>
    </section>
  );
}
