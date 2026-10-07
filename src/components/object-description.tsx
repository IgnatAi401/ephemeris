import { useEffect, useState } from 'react';
import type { CatalogEntry } from '@/lib/catalog';
import type { SpacecraftKey } from '@/lib/ephemeris';
import type { Language } from '@/lib/i18n';
import type { ProfileText } from '@/lib/object-profiles';

type Profiles = typeof import('@/lib/object-profiles');
let pending: Promise<Profiles> | null = null;
const loadProfiles = () =>
  (pending ??= import('@/lib/object-profiles').catch((error: unknown) => {
    pending = null;
    throw error;
  }));

/** The authored catalogue is loaded on the first selection, not first paint. */
export function ObjectDescription({
  lang,
  entry,
  spacecraft,
}: {
  lang: Language;
  entry?: CatalogEntry;
  spacecraft?: SpacecraftKey;
}) {
  const [profiles, setProfiles] = useState<Profiles | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadProfiles().then(
      (data) => {
        if (active) setProfiles(data);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const pick = (value: ProfileText) => value[lang];
  if (!profiles)
    return (
      <output className="orbit-profile-loading">
        {failed
          ? t(
              'Background information could not be loaded.',
              '介绍资料暂时无法加载。',
            )
          : t('Loading background information…', '正在加载介绍…')}
      </output>
    );
  const resolved = entry
    ? profiles.satelliteProfile(entry)
    : spacecraft
      ? {
          profile: profiles.SPACECRAFT_PROFILES[spacecraft],
          scope: 'object' as const,
        }
      : null;
  if (!resolved) return null;
  const { profile, scope } = resolved;
  const rows: [string, string][] = [];
  if (profile.affiliation)
    rows.push([
      t('Country / affiliation', '国家／所属'),
      pick(profile.affiliation),
    ]);
  if (profile.operator)
    rows.push([t('Organisation', '机构'), pick(profile.operator)]);
  if (profile.launch)
    rows.push([t('Launch date', '发射日期'), `${profile.launch} UTC`]);
  // Without a verified date, the designator still names the launch: year,
  // that year's launch number and a letter per catalogued piece.
  const designator = entry
    ? /^(\d{4})-(\d{3})([A-Z]+)$/i.exec(entry.cospar)
    : null;
  if (!profile.launch && designator) {
    const [, year, number, piece] = designator;
    rows.push([
      t('Launch', '所属发射'),
      t(
        `Launch no. ${Number(number)} of ${year} · piece ${piece}`,
        `${year} 年第 ${Number(number)} 次发射 · 物体 ${piece}`,
      ),
    ]);
  }
  if (profile.launchSite)
    rows.push([t('Launch site', '发射地点'), pick(profile.launchSite)]);
  if (profile.event)
    rows.push([pick(profile.event.label), `${profile.event.date} UTC`]);

  return (
    <div className="orbit-profile">
      <div className="orbit-profile-heading">
        {profile.name && <strong>{pick(profile.name)}</strong>}
        <span>
          {scope === 'family'
            ? t('Series background', '系列介绍')
            : scope === 'group'
              ? t('Catalogue background', '分组背景')
              : t('About this object', '目标介绍')}
        </span>
      </div>
      <p className="orbit-profile-mission">{pick(profile.mission)}</p>
      <p className="orbit-profile-summary">{pick(profile.summary)}</p>
      <dl className="orbit-profile-facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!profile.launch && designator && profile.separated && (
        <p className="orbit-profile-note">
          {t(
            'The designator identifies the launch that carried this object to orbit; a released object or fragment may have separated later.',
            '国际编号对应把它送入轨道的那次发射；释放物或碎片可能在之后才分离。',
          )}
        </p>
      )}
      <p className="orbit-profile-sources">
        <span>{t('Sources', '资料来源')}</span>
        {profile.sources.map(({ name, href }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        ))}
      </p>
    </div>
  );
}
