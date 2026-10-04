import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Search } from 'lucide-react';
import type { Catalog, CatalogEntry } from '@/lib/catalog';
import type { Language } from '@/lib/i18n';
import { CONSTELLATIONS } from '@/lib/orbits';

/** Find a satellite by name or NORAD number. The catalogue is fetched the
 * first time the box is used. "/" focuses it from anywhere. */
export function SearchBox({
  lang,
  catalog,
  onOpen,
  onPick,
}: {
  lang: Language;
  catalog: Catalog | null;
  /** Called on first focus, to start loading the catalogue. */
  onOpen: () => void;
  onPick: (entry: CatalogEntry) => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const results = catalog && query ? catalog.search(query, 10) : [];

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key !== '/' || target?.closest('input, textarea, select'))
        return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);

  const pick = (entry: CatalogEntry) => {
    onPick(entry);
    setQuery('');
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div
      className="orbit-search"
      data-open={(open && query.length > 0) || undefined}
    >
      <Search size={14} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        aria-controls="orbit-search-results"
        aria-label={t(
          'Search satellites by name or NORAD number',
          '按名称或 NORAD 编号搜索卫星',
        )}
        placeholder={t(
          'Search satellite or NORAD no.',
          '搜索卫星名称或 NORAD 编号',
        )}
        value={query}
        onFocus={() => {
          onOpen();
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown')
            setActive((at) => Math.min(results.length - 1, at + 1));
          else if (event.key === 'ArrowUp')
            setActive((at) => Math.max(0, at - 1));
          else if (event.key === 'Enter' && results[active])
            pick(results[active]);
          else if (event.key === 'Escape') {
            setQuery('');
            event.currentTarget.blur();
          } else return;
          event.preventDefault();
        }}
      />
      <kbd aria-hidden="true">/</kbd>
      {open && query && (
        <ul id="orbit-search-results" className="orbit-search-results">
          {!catalog && (
            <li className="orbit-search-note">
              {t('Loading the catalogue…', '正在加载卫星目录…')}
            </li>
          )}
          {catalog && results.length === 0 && (
            <li className="orbit-search-note">
              {t('No match', '没有匹配的卫星')}
            </li>
          )}
          {results.map((entry, at) => {
            const group = CONSTELLATIONS[entry.group];
            return (
              <li key={entry.norad}>
                <button
                  type="button"
                  data-active={at === active || undefined}
                  style={{ '--dot': group.color } as CSSProperties}
                  // Before the input's blur closes the list.
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => pick(entry)}
                  onPointerEnter={() => setActive(at)}
                >
                  <i aria-hidden="true" />
                  <span>{entry.name}</span>
                  <small>
                    {entry.norad} · {t(group.en, group.zh)}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
