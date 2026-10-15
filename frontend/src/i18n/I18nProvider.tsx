import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  createTranslator,
  detectBrowserLocale,
  LOCALE_OPTIONS,
  readStoredLocale,
  writeStoredLocale,
  type LocaleCode,
  type MessageKey,
  type TranslateFn,
} from './index';

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: TranslateFn;
  localeOptions: typeof LOCALE_OPTIONS;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function initialLocale(): LocaleCode {
  return readStoredLocale() ?? detectBrowserLocale();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      localeOptions: LOCALE_OPTIONS,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export type { LocaleCode, MessageKey, TranslateFn };
