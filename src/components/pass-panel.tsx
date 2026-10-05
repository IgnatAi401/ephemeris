import { useEffect, useMemo, useState } from 'react';
import { LocateFixed, Play, X } from 'lucide-react';
import type { Catalog, CatalogEntry } from '@/lib/catalog';
import { CITIES } from '@/lib/cities';
import type { Language } from '@/lib/i18n';
import type { Fleet } from '@/lib/orbits';
import {
  compass,
  MIN_ELEVATION,
  predictPassesAsync,
  SUN_LIMIT,
  type Observer,
  type Pass,
} from '@/lib/passes';
import { precise } from '@/lib/precise';
import { SkyChart } from '@/components/sky-chart';

const STORAGE = 'orbit.observer';
// The bright space stations, always forecast; a selected satellite joins them.
const STATIONS = [25544, 48274];
const DAYS = 5;

function storedObserver(): Observer | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE) ?? 'null',
    ) as Observer | null;
    return value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude)
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Visible passes over the observer for the next five days. The location is
 * used only in this browser: nothing is sent anywhere, and it is stored
 * (in localStorage) only when asked. */
export function PassPanel({
  lang,
  fleet,
  catalog,
  selected,
  simTime,
  onClose,
  onPlay,
}: {
  lang: Language;
  fleet: Fleet;
  catalog: Catalog | null;
  selected: CatalogEntry | null;
  simTime: () => number;
  onClose: () => void;
  /** Select the pass's satellite, run the clock through the pass and look
   * down on the observer. */
  onPlay: (pass: Pass, observer: Observer) => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const [observer, setObserver] = useState<Observer | null>(storedObserver);
  const [remember, setRemember] = useState(() => storedObserver() !== null);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied'>('idle');
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [chosen, setChosen] = useState<Pass | null>(null);

  useEffect(() => {
    try {
      if (remember && observer)
        localStorage.setItem(STORAGE, JSON.stringify(observer));
      else localStorage.removeItem(STORAGE);
    } catch {
      // Storage refused (private window): the location lasts this visit.
    }
  }, [remember, observer]);

  const targets = useMemo(() => {
    if (!catalog) return [];
    const numbers = [...STATIONS];
    if (selected && !numbers.includes(selected.norad))
      numbers.push(selected.norad);
    return numbers.flatMap((norad) => catalog.byNorad.get(norad) ?? []);
  }, [catalog, selected]);

  useEffect(() => {
    if (!observer || !targets.length) return;
    let cancelled = false;
    // Yield first so the panel paints before the few tens of ms of SGP4.
    const timer = window.setTimeout(async () => {
      setPasses(null);
      const from = Date.now();
      const all: Pass[] = [];
      for (const entry of targets) {
        const model = await precise(fleet, entry);
        if (cancelled) return;
        const found = await predictPassesAsync(
          model,
          observer,
          from,
          DAYS,
          () => cancelled,
        );
        if (!found || cancelled) return;
        all.push(...found);
      }
      all.sort((a, b) => a.start.time - b.start.time);
      setPasses(all);
      setChosen(all[0] ?? null);
    }, 30);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [observer, targets, fleet]);

  const locate = () => {
    if (!navigator.geolocation) return setLocating('denied');
    setLocating('busy');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // Two decimals (about a kilometre) is plenty for a pass forecast.
        setObserver({
          latitude: Math.round(coords.latitude * 100) / 100,
          longitude: Math.round(coords.longitude * 100) / 100,
          label: '',
        });
        setLocating('idle');
      },
      () => setLocating('denied'),
      { maximumAge: 600000, timeout: 15000 },
    );
  };

  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
  const clock = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const where = observer
    ? observer.label ||
      `${Math.abs(observer.latitude).toFixed(2)}°${observer.latitude >= 0 ? 'N' : 'S'} ${Math.abs(observer.longitude).toFixed(2)}°${observer.longitude >= 0 ? 'E' : 'W'}`
    : null;
  const cityValue = observer?.label
    ? CITIES.findIndex(
        (city) => city.en === observer.label || city.zh === observer.label,
      )
    : -1;
  const reasons = {
    rise: t('rises', '升起'),
    sunlit: t('leaves Earth’s shadow', '离开地影'),
    dark: t('sky darkens', '天色变暗'),
    now: t('already up', '正在过境'),
    set: t('sets', '落下'),
    shadow: t('enters Earth’s shadow', '进入地影'),
    dawn: t('dawn', '天亮'),
    later: t('beyond the forecast', '超出预报范围'),
  };

  return (
    <section
      className="orbit-passes"
      aria-label={t('Visible passes', '可见过境预报')}
    >
      <header>
        <h2>{t('Visible passes', '可见过境预报')}</h2>
        <button type="button" onClick={onClose} aria-label={t('Close', '关闭')}>
          <X size={15} />
        </button>
      </header>
      <div className="orbit-passes-where">
        <button type="button" onClick={locate} disabled={locating === 'busy'}>
          <LocateFixed size={14} aria-hidden="true" />
          {locating === 'busy'
            ? t('Locating…', '定位中…')
            : t('Use my location', '使用我的位置')}
        </button>
        <select
          aria-label={t('Or choose a city', '或选择城市')}
          value={cityValue}
          onChange={(event) => {
            const city = CITIES[Number(event.currentTarget.value)];
            if (city)
              setObserver({
                latitude: city.latitude,
                longitude: city.longitude,
                label: lang === 'en' ? city.en : city.zh,
              });
          }}
        >
          <option value={-1}>{t('Choose a city…', '选择城市…')}</option>
          {CITIES.map((city, index) => (
            <option key={city.en} value={index}>
              {lang === 'en' ? city.en : city.zh}
            </option>
          ))}
        </select>
      </div>
      {locating === 'denied' && (
        <p className="orbit-passes-note">
          {t(
            'Location unavailable; choose a city instead.',
            '无法获取位置，请改为选择城市。',
          )}
        </p>
      )}
      <p className="orbit-passes-note">
        {where ? `${t('Observer', '观测地')}: ${where} · ` : ''}
        {t(
          'Computed in this browser; your location is never uploaded.',
          '只在本机计算，位置不会上传。',
        )}
      </p>
      <label className="orbit-passes-remember">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.currentTarget.checked)}
        />
        {t('Remember this location on this device', '在本机记住这个位置')}
      </label>

      {observer && !catalog && (
        <p className="orbit-passes-note">
          {t('Loading the catalogue…', '正在加载卫星目录…')}
        </p>
      )}
      {observer && catalog && passes === null && (
        <p className="orbit-passes-note">{t('Computing…', '计算中…')}</p>
      )}
      {passes && passes.length === 0 && (
        <p className="orbit-passes-note">
          {t(
            `No visible passes in the next ${DAYS} days.`,
            `未来 ${DAYS} 天没有可见过境。`,
          )}
        </p>
      )}
      {passes && passes.length > 0 && (
        <>
          <SkyChart lang={lang} pass={chosen} simTime={simTime} />
          <ol className="orbit-passes-list">
            {passes.slice(0, 14).map((pass) => {
              const minutes = Math.max(
                1,
                Math.round((pass.end.time - pass.start.time) / 60000),
              );
              const isChosen = chosen === pass;
              return (
                <li
                  key={`${pass.norad}-${pass.start.time}`}
                  data-chosen={isChosen || undefined}
                >
                  <button
                    type="button"
                    onClick={() => setChosen(pass)}
                    aria-pressed={isChosen}
                  >
                    <span className="orbit-pass-when">
                      {day.format(pass.start.time)}{' '}
                      <strong>{clock.format(pass.start.time)}</strong>
                    </span>
                    <span className="orbit-pass-name">{pass.name}</span>
                    <span className="orbit-pass-sky">
                      {compass(pass.start.azimuth, lang)} → {t('max', '最高')}{' '}
                      {Math.round(pass.peak.elevation)}° →{' '}
                      {compass(pass.end.azimuth, lang)} · {minutes}{' '}
                      {t('min', '分钟')}
                    </span>
                    <span className="orbit-pass-why">
                      {reasons[pass.startReason]} … {reasons[pass.endReason]}
                    </span>
                  </button>
                  {isChosen && (
                    <button
                      type="button"
                      className="orbit-pass-play"
                      onClick={() => observer && onPlay(pass, observer)}
                      aria-label={t(
                        'Play this pass in the view',
                        '在视图中播放这次过境',
                      )}
                    >
                      <Play size={13} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
      <p className="orbit-passes-note">
        {t(
          `Times in ${zone}. Visible: above ${MIN_ELEVATION}°, sunlit, and the Sun more than ${-SUN_LIMIT}° below your horizon.`,
          `时间为本机时区（${zone}）。可见条件：仰角高于 ${MIN_ELEVATION}°、卫星被阳光照亮、当地太阳低于地平线 ${-SUN_LIMIT}° 以上。`,
        )}
      </p>
    </section>
  );
}
