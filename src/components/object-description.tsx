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
  const rows: [string, string][] = [
    [
      t('Country / affiliation', '国家／所属'),
      profile.affiliation
        ? pick(profile.affiliation)
        : t('Not yet documented', '尚未补录'),
    ],
    ...(profile.operator
      ? [
          [t('Organisation', '机构'), pick(profile.operator)] as [
            string,
            string,
          ],
        ]
      : []),
    [
      t('Launch date', '发射日期'),
      profile.launch
        ? `${profile.launch} UTC`
        : t('Not yet documented', '尚未补录'),
    ],
  ];
  if (!profile.launch && entry) {
    const year = /^(\d{4})-\d{3}[A-Z]+$/i.exec(entry.cospar)?.[1];
    if (year) rows.push([t('Designator year', '编号关联年份'), year]);
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
      {!profile.launch && entry && (
        <p className="orbit-profile-note">
          {t(
            'The designator year belongs to the associated launch; a released object or fragment may have separated later.',
            '编号年份关联原发射事件；释放物或碎片可能在更晚的时间分离。',
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
