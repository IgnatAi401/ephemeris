import { useEffect, useState } from 'react';

export type Language = 'zh' | 'en';

const KEY = 'orbit.lang';

function stored(): Language {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

/** Chinese by default; an explicit choice is remembered in this browser. */
export function useLanguage() {
  const [lang, setLang] = useState<Language>(stored);
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      // Private windows may refuse storage; the choice then lasts the visit.
    }
  }, [lang]);
  return [lang, setLang] as const;
}
