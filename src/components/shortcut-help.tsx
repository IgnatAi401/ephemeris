import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Language } from '@/lib/i18n';

export const SHORTCUTS = [
  { keys: ['Space'], en: 'Play / pause', zh: '播放 / 暂停' },
  {
    keys: ['←', '→'],
    en: 'Step 10 minutes (Shift: 6 hours)',
    zh: '拨动 10 分钟（Shift：6 小时）',
  },
  {
    keys: ['1', '2', '3', '4'],
    en: 'LEO · GNSS & GEO · Earth–Moon · L1/L2',
    zh: '近地 · 中高轨 · 地月 · 日地 L1/L2',
  },
  { keys: ['0'], en: 'Overview', zh: '总览' },
  { keys: ['N'], en: 'Back to now', zh: '回到现在' },
  { keys: ['+', '−'], en: 'Zoom in / out', zh: '放大 / 缩小' },
  { keys: ['L'], en: 'Layers', zh: '图层面板' },
  { keys: ['?'], en: 'This help', zh: '快捷键说明' },
] as const;

/** A small dialog listing the keyboard shortcuts. Escape (handled with the
 * other keys in orbit-view.tsx) or a click outside closes it. */
export function ShortcutHelp({
  lang,
  onClose,
}: {
  lang: Language;
  onClose: () => void;
}) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    close.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!dialog.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [onClose]);
  return (
    <div className="orbit-help-backdrop">
      <dialog
        ref={dialog}
        open
        className="orbit-help"
        aria-labelledby="orbit-help-title"
      >
        <header>
          <h2 id="orbit-help-title">{t('Keyboard and mouse', '键盘与鼠标')}</h2>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label={t('Close', '关闭')}
          >
            <X size={15} />
          </button>
        </header>
        <dl>
          {SHORTCUTS.map(({ keys, en, zh }) => (
            <div key={en}>
              <dt>
                {keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{t(en, zh)}</dd>
            </div>
          ))}
          <div>
            <dt>
              <kbd>{t('Drag', '拖动')}</kbd>
            </dt>
            <dd>
              {t(
                'Rotate the view (it keeps spinning a little)',
                '旋转视角（松手后带惯性）',
              )}
            </dd>
          </div>
          <div>
            <dt>
              <kbd>{t('Wheel', '滚轮')}</kbd>
              <kbd>{t('Pinch', '双指')}</kbd>
            </dt>
            <dd>{t('Zoom', '缩放')}</dd>
          </div>
        </dl>
      </dialog>
    </div>
  );
}
