import type { Language } from '@/lib/i18n';

/** Shown in place of the scene when the browser has no WebGL 2: a still of
 * the live view and a short explanation. */
export function Fallback({ lang }: { lang: Language }) {
  const t = (en: string, zh: string) => (lang === 'en' ? en : zh);
  return (
    <div className="orbit-poster">
      <img
        src="/poster.webp"
        alt={t(
          'A still of the orbit view: Earth surrounded by satellite constellations.',
          '轨道视图静态截图：被卫星星座环绕的地球。',
        )}
      />
      <p>
        {t(
          'The live view needs WebGL 2. This is a still image; try a recent browser or enable hardware acceleration.',
          '实时视图需要 WebGL 2 支持。当前显示的是静态截图，可换用较新的浏览器或开启硬件加速。',
        )}
      </p>
    </div>
  );
}
