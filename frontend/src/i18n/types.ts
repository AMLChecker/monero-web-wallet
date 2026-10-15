export type MessageKey = keyof typeof import('./en').en;

export type LocaleCode = 'en' | 'ru';

export type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string;
