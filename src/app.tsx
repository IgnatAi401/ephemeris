import { Credits } from '@/components/credits';
import { OrbitView } from '@/components/orbit-view';
import { useLanguage } from '@/lib/i18n';

export function App() {
  const [lang, setLang] = useLanguage();
  return (
    <main className="app">
      {/* The title and controls live in the dock, which floats over the
          bottom of the full-screen scene. */}
      <OrbitView lang={lang}>
        <div className="app-bar">
          <h1>
            ORBIT{' '}
            <span>{lang === 'en' ? 'Live satellite sky' : '实时卫星轨道'}</span>
          </h1>
          <Credits lang={lang} />
          <button
            type="button"
            className="app-lang"
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            aria-label={lang === 'en' ? '切换到中文' : 'Switch to English'}
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </OrbitView>
    </main>
  );
}
