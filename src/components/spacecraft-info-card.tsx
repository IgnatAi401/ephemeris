import { useEffect, useState, type CSSProperties } from 'react';
import { Rocket, X } from 'lucide-react';
import { ObjectDescription } from '@/components/object-description';
import { spacecraftByKey, type SpacecraftKey } from '@/lib/ephemeris';
import type { Language } from '@/lib/i18n';

export function SpacecraftInfoCard({
  lang,
  spacecraft,
  simTime,
  readState,
  onClose,
  onReplay,
}: {
  lang: Language;
  spacecraft: SpacecraftKey;
  simTime: () => number;
  readState: (
    time: number,
  ) => { distance: number; lunar: boolean; period: number | null } | null;
  onClose: () => void;
  onReplay: () => void;
}) {
  const [time, setTime] = useState(simTime);
  useEffect(() => {
    const timer = window.setInterval(() => setTime(simTime()), 400);
    return () => window.clearInterval(timer);
  }, [simTime]);
  const item = spacecraftByKey(spacecraft)!;
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const state = readState(time);
  return (
    <section
      className="orbit-card"
      aria-label={item[lang]}
      style={{ '--dot': item.color } as CSSProperties}
    >
      <header>
        <i aria-hidden="true" />
        <div>
          <h2>{item[lang]}</h2>
          <p>{t('Spacecraft', '航天器')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('Close', '关闭')}>
          <X size={15} />
        </button>
      </header>
      <ObjectDescription lang={lang} spacecraft={spacecraft} />
      <details className="orbit-card-details">
        <summary>{t('Current orbit readouts', '当前轨道读数')}</summary>
        {state ? (
          <dl>
            <div>
              <dt>
                {state.lunar
                  ? t('Distance from Moon centre', '距月心')
                  : t('Distance from Earth centre', '距地心')}
              </dt>
              <dd>{Math.round(state.distance).toLocaleString('en-US')} km</dd>
            </div>
            {state.period !== null && (
              <div>
                <dt>{t('Period', '周期')}</dt>
                <dd>
                  {(state.period / 60000).toFixed(1)} {t('min', '分钟')}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="orbit-card-note">
            {t(
              'No ephemeris is available at this time.',
              '此时刻没有可用星历。',
            )}
          </p>
        )}
        <p className="orbit-card-note">
          {t(
            'Readouts follow the simulation clock and use the JPL Horizons snapshot.',
            '读数随模拟时钟变化，由 JPL Horizons 星历快照推算。',
          )}
        </p>
      </details>
      {spacecraft === 'jwst' && (
        <button type="button" className="orbit-card-action" onClick={onReplay}>
          <Rocket size={14} aria-hidden="true" />
          {t('Replay the journey to L2', '回放前往 L2 的旅程')}
        </button>
      )}
    </section>
  );
}
