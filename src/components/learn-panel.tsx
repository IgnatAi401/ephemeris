import { useState } from 'react';
import { X } from 'lucide-react';
import { ElementsDemo, PRESETS } from '@/components/elements-demo';
import type { Language } from '@/lib/i18n';
import type { Elements } from '@/lib/kepler';
import { ORBIT_TYPES, type OrbitTypeId } from '@/lib/orbit-types';

/** Short lessons over the live sky: the orbit families (each lights up its
 * real members in the scene) and the six orbital elements. */
export function LearnPanel({
  lang,
  counts,
  active,
  onType,
  elements,
  onElements,
  showing,
  onShow,
  onClose,
}: {
  lang: Language;
  /** Members of each family in the current snapshot; null while counting. */
  counts: Record<OrbitTypeId, number> | null;
  active: OrbitTypeId | null;
  onType: (id: OrbitTypeId | null) => void;
  elements: Elements;
  onElements: (next: Elements) => void;
  /** Whether the demo orbit is drawn in the scene. */
  showing: boolean;
  onShow: (show: boolean) => void;
  onClose: () => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const [tab, setTab] = useState<'types' | 'elements'>('types');
  return (
    <section className="orbit-learn" aria-label={t('Learn', '轨道科普')}>
      <header>
        <div className="orbit-learn-tabs">
          <button
            type="button"
            aria-pressed={tab === 'types'}
            onClick={() => setTab('types')}
          >
            {t('Orbit types', '轨道类型')}
          </button>
          <button
            type="button"
            aria-pressed={tab === 'elements'}
            onClick={() => setTab('elements')}
          >
            {t('Six elements', '轨道六根数')}
          </button>
        </div>
        <button
          type="button"
          className="orbit-learn-close"
          onClick={onClose}
          aria-label={t('Close', '关闭')}
        >
          <X size={15} />
        </button>
      </header>

      {tab === 'types' && (
        <>
          <p className="orbit-learn-intro">
            {t(
              'Pick a family to light up its members in the sky; the dashed line is an example of its shape.',
              '点选一类，场景中会高亮当前数据里属于这一类的卫星；虚线是这类轨道的示例形状。',
            )}
          </p>
          <ul className="orbit-types">
            {ORBIT_TYPES.map((type) => {
              const on = active === type.id;
              const count = counts?.[type.id];
              return (
                <li key={type.id} data-active={on || undefined}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onType(on ? null : type.id)}
                  >
                    <strong>{t(type.en, type.zh)}</strong>
                    <small>{t(type.short[0], type.short[1])}</small>
                    <span>
                      {count === undefined
                        ? '…'
                        : count.toLocaleString('en-US')}
                    </span>
                  </button>
                  {on && (
                    <div className="orbit-type-about">
                      <p>{t(type.about[0], type.about[1])}</p>
                      {count === 0 && (
                        <p className="orbit-type-none">
                          {type.none
                            ? t(type.none[0], type.none[1])
                            : t(
                                'None in the current snapshot: only the example orbit is drawn.',
                                '当前数据中没有这类卫星，只画出示例轨道。',
                              )}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === 'elements' && (
        <>
          <p className="orbit-learn-intro">
            {t(
              'Six numbers pin down an orbit and a position on it. Move a slider to see what it controls.',
              '六个数就能确定一条轨道和卫星在轨道上的位置。拖动滑块，看看每个数控制什么。',
            )}
          </p>
          <ElementsDemo lang={lang} elements={elements} onChange={onElements} />
          <div className="orbit-demo-presets">
            <span>{t('Load', '载入')}</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onElements(preset.elements)}
              >
                {t(preset.en, preset.zh)}
              </button>
            ))}
          </div>
          <label className="orbit-demo-show">
            <input
              type="checkbox"
              checked={showing}
              onChange={(event) => onShow(event.currentTarget.checked)}
            />
            {t(
              'Draw this orbit in the main view (Ω measured from the real equinox)',
              '在主视图中画出这条轨道（Ω 从真实春分点方向量起）',
            )}
          </label>
        </>
      )}
    </section>
  );
}
