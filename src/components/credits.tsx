import type { Language } from '@/lib/i18n';
import { SOURCES } from '@/lib/site';

export function Credits({ lang }: { lang: Language }) {
  return (
    <footer className="orbit-credits">
      <span>{lang === 'en' ? 'Data' : '数据'}</span>
      {SOURCES.map((source) => (
        <span key={source.name}>
          <a href={source.href} target="_blank" rel="noreferrer">
            {source.name}
          </a>
          {'via' in source && (
            <span className="orbit-credits-via">
              {' · '}
              <a href={source.via} target="_blank" rel="noreferrer">
                world-atlas
              </a>
            </span>
          )}
          <small>{lang === 'en' ? source.en : source.zh}</small>
        </span>
      ))}
    </footer>
  );
}
