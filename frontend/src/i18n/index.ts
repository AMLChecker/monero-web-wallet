import { en } from './en';
import { ru } from './ru';
import type { LocaleCode, MessageKey, TranslateFn } from './types';

export type { LocaleCode, MessageKey, TranslateFn };
export { en } from './en';
export { ru } from './ru';

export const LOCALES: Record<LocaleCode, Record<MessageKey, string>> = {
  en,
  ru,
};

export const LOCALE_OPTIONS: Array<{ code: LocaleCode; labelKey: MessageKey }> = [
  { code: 'en', labelKey: 'settings.languageEn' },
  { code: 'ru', labelKey: 'settings.languageRu' },
];

export const LANGUAGE_STORAGE_KEY = 'monero-web-wallet.language';

export function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return value === 'en' || value === 'ru';
}

export function detectBrowserLocale(): LocaleCode {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = [navigator.language, ...(navigator.languages ?? [])];
  for (const candidate of candidates) {
    if (candidate && candidate.toLowerCase().startsWith('ru')) return 'ru';
  }
  return 'en';
}

export function readStoredLocale(): LocaleCode | null {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLocaleCode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(code: LocaleCode): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Ignore quota / private-mode failures — UI still switches in-memory.
  }
}

export function createTranslator(locale: LocaleCode): TranslateFn {
  const table = LOCALES[locale];
  return (key, params) => {
    let text: string = table[key] ?? LOCALES.en[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}
