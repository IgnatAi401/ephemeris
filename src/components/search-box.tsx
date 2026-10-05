import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Search } from 'lucide-react';
import type { Catalog, CatalogEntry } from '@/lib/catalog';
import type { Language } from '@/lib/i18n';
import { CONSTELLATIONS } from '@/lib/orbits';
import {
  SPACECRAFT,
  SPACECRAFT_ALIASES,
  type SpacecraftKey,
} from '@/lib/ephemeris';

type SearchResult =
  | { entry: CatalogEntry }
  | { spacecraft: (typeof SPACECRAFT)[number] };

/** Find a satellite by name or NORAD number. The catalogue is fetched the
 * first time the box is used. "/" focuses it from anywhere. */
export function SearchBox({
  lang,
  catalog,
  onOpen,
  onPick,
  onPickSpacecraft,
}: {
  lang: Language;
  catalog: Catalog | null;
  /** Called on first focus, to start loading the catalogue. */
  onOpen: () => void;
  onPick: (entry: CatalogEntry) => void;
  onPickSpacecraft: (key: SpacecraftKey) => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const input = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const craft = SPACECRAFT.filter((item) =>
      `${item.key} ${item.en} ${item.zh} ${SPACECRAFT_ALIASES[item.key]}`
        .toLowerCase()
        .includes(q),
    );
    return [
      ...craft.map((spacecraft) => ({ spacecraft })),
      ...(catalog?.search(q, 10) ?? []).map((entry) => ({ entry })),
    ].slice(0, 10);
  }, [catalog, query]);

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.key !== '/' || target?.closest('input, textarea, select'))
        return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', focus);
    return () => {
      window.removeEventListener('keydown', focus);
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const pick = (result: SearchResult) => {
    if ('entry' in result) onPick(result.entry);
    else onPickSpacecraft(result.spacecraft.key);
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
          'Search satellites and spacecraft by name or NORAD number',
          '按名称或 NORAD 编号搜索卫星与航天器',
        )}
        placeholder={t(
          'Satellite, spacecraft or NORAD no.',
          '搜索卫星、航天器或 NORAD 编号',
        )}
        value={query}
        onFocus={() => {
          if (blurTimer.current !== null)
            window.clearTimeout(blurTimer.current);
          onOpen();
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown')
            setActive((at) =>
              Math.min(Math.max(0, results.length - 1), at + 1),
            );
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
              {t('No match', '没有匹配的目标')}
            </li>
          )}
          {results.map((result, at) => {
            const entry = 'entry' in result ? result.entry : null;
            const craft = 'spacecraft' in result ? result.spacecraft : null;
            const group = entry ? CONSTELLATIONS[entry.group] : null;
            const name = entry?.name ?? craft![lang];
            return (
              <li key={entry?.norad ?? craft!.key}>
                <button
                  type="button"
                  data-active={at === active || undefined}
                  style={
                    { '--dot': group?.color ?? craft!.color } as CSSProperties
                  }
                  // Before the input's blur closes the list.
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => pick(result)}
                  onPointerEnter={() => setActive(at)}
                >
                  <i aria-hidden="true" />
                  <span>{name}</span>
                  <small>
                    {entry && group
                      ? `${entry.norad} · ${t(group.en, group.zh)}`
                      : t('Spacecraft', '航天器')}
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
