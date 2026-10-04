import type { CSSProperties } from 'react';
import { ChevronDown, Layers as LayersIcon } from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { CONSTELLATIONS, type ConstellationKind } from '@/lib/orbits';
import {
  GROUP_LAYER,
  VISUAL_LAYERS,
  type LayerId,
  type Layers,
} from '@/lib/layers';

type Row = { id: LayerId; color?: string; label: string; count?: number };

/** The legend, doubling as the layer switches: one row per group (the debris
 * clouds share one), then the visual layers. Collapsible; closed by default
 * on narrow screens. */
export function LayerPanel({
  lang,
  layers,
  counts,
  fetched,
  open,
  onOpenChange,
  onToggle,
  onSetAll,
}: {
  lang: Language;
  layers: Layers;
  counts: number[] | null;
  fetched: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: LayerId) => void;
  onSetAll: (on: boolean) => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const groupRows = (kinds: readonly ConstellationKind[]) => {
    const rows: Row[] = [];
    CONSTELLATIONS.forEach((item, index) => {
      if (!kinds.includes(item.kind)) return;
      const id = GROUP_LAYER[index];
      const count = counts?.[index];
      const existing = rows.find((row) => row.id === id);
      if (existing) {
        if (existing.count !== undefined && count !== undefined)
          existing.count += count;
        return;
      }
      rows.push({
        id,
        color: item.color,
        label:
          item.kind === 'debris'
            ? t('Debris clouds', '碎片云')
            : t(item.en, item.zh),
        count,
      });
    });
    return rows;
  };
  const sections: { id: string; label: string; rows: Row[] }[] = [
    { id: 'leo', label: 'LEO', rows: groupRows(['leo']) },
    { id: 'gnss', label: 'GNSS', rows: groupRows(['gnss']) },
    {
      id: 'other',
      label: t('More', '其他'),
      rows: groupRows(['station', 'geo', 'debris', 'new']),
    },
    {
      id: 'visual',
      label: t('Visual', '视觉'),
      rows: VISUAL_LAYERS.map(({ id, en, zh }) => ({ id, label: t(en, zh) })),
    },
  ];
  const allOn = sections.every((section) =>
    section.rows.every((row) => layers[row.id]),
  );

  return (
    <div className="orbit-key" data-open={open || undefined}>
      <div className="orbit-key-head">
        <button
          type="button"
          className="orbit-key-toggle"
          aria-expanded={open}
          aria-controls="orbit-layers"
          onClick={() => onOpenChange(!open)}
        >
          <LayersIcon size={13} aria-hidden="true" />
          {t('Layers', '图层')}
          <kbd>L</kbd>
          <ChevronDown
            size={13}
            aria-hidden="true"
            className="orbit-key-chevron"
          />
        </button>
        {open && (
          <button
            type="button"
            className="orbit-key-all"
            aria-pressed={allOn}
            onClick={() => onSetAll(!allOn)}
          >
            {allOn ? t('None', '取消全选') : t('All', '全选')}
          </button>
        )}
      </div>
      <div id="orbit-layers" className="orbit-key-body" hidden={!open}>
        {sections.map((section) => (
          <div
            key={section.id}
            className="orbit-key-group"
            data-kind={section.id}
          >
            <span className="orbit-key-title">{section.label}</span>
            <ul>
              {section.rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={layers[row.id]}
                    data-off={!layers[row.id] || undefined}
                    style={
                      row.color
                        ? ({ '--dot': row.color } as CSSProperties)
                        : undefined
                    }
                    onClick={() => onToggle(row.id)}
                  >
                    <i
                      aria-hidden="true"
                      data-visual={!row.color || undefined}
                    />
                    {row.label}
                    {row.count !== undefined && (
                      <span>{row.count.toLocaleString('en-US')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {fetched && <p className="orbit-key-source">CELESTRAK · {fetched}</p>}
      </div>
    </div>
  );
}
