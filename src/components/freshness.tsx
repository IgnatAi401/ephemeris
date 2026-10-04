import { useEffect, useState } from 'react';
import type { Language } from '@/lib/i18n';

const HOUR = 3600000;
// Older than this, the data is flagged: the workflow should refresh it twice
// a day, so three days means it has been failing for a while.
const STALE = 72 * HOUR;

/** "Ephemerides updated N hours ago", from public/data/status.json, with a
 * warning once the snapshot is more than three days old. */
export function Freshness({ lang }: { lang: Language }) {
  const [fetched, setFetched] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/status.json', { cache: 'no-cache', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((status: { constellations?: { fetched?: string } } | null) => {
        const time = Date.parse(status?.constellations?.fetched ?? '');
        if (Number.isFinite(time)) setFetched(time);
      })
      .catch(() => {});
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);
  if (fetched === null) return null;

  const age = Math.max(0, now - fetched);
  const hours = Math.floor(age / HOUR);
  const days = Math.floor(age / (24 * HOUR));
  const ago =
    lang === 'en'
      ? hours < 1
        ? 'less than an hour ago'
        : hours < 48
          ? `${hours} hour${hours === 1 ? '' : 's'} ago`
          : `${days} days ago`
      : hours < 1
        ? '不到 1 小时前'
        : hours < 48
          ? `${hours} 小时前`
          : `${days} 天前`;
  const stale = age > STALE;
  const stamp = new Date(fetched).toISOString().slice(0, 16).replace('T', ' ');
  return (
    <p
      className="orbit-fresh"
      data-stale={stale || undefined}
      title={`${stamp} UTC`}
    >
      <i aria-hidden="true" />
      {lang === 'en' ? `Ephemerides updated ${ago}` : `星历更新于 ${ago}`}
      {stale && (
        <span>
          {lang === 'en'
            ? ' · not refreshed for over 3 days; positions drift with age'
            : ' · 已超过 3 天未更新，位置误差会随时间增大'}
        </span>
      )}
    </p>
  );
}
