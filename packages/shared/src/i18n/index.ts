import ko from './locales/ko.json';
import en from './locales/en.json';

type LocaleResource = typeof ko;

type NestedKeyOf<T, Prefix extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<LocaleResource>;
export type Locale = 'ko' | 'en';

const resources: Record<Locale, LocaleResource> = { ko, en };

function formatWithParams(value: string, params?: Record<string, string | number>): string {
  if (!params) return value;
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(`{${k}}`, String(v)),
    value,
  );
}

function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

function collectTranslationKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return prefix ? [prefix] : [];
  if (obj == null || typeof obj !== 'object') return [];

  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectTranslationKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

export function getTranslationKeys(locale: Locale): string[] {
  return collectTranslationKeys(resources[locale]).sort();
}

export function getMissingTranslationKeys(referenceLocale: Locale, locale: Locale): string[] {
  return getTranslationKeys(referenceLocale).filter(
    (key) => getNestedValue(resources[locale], key) === undefined,
  );
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const value = getNestedValue(resources[locale], key) ?? key;
  return formatWithParams(value, params);
}

export function translateStrict(
  locale: Locale,
  key: TranslationKey | string,
  params?: Record<string, string | number>,
): string {
  const value = getNestedValue(resources[locale], key);
  if (value === undefined) {
    throw new Error(`Missing translation for ${locale}:${key}`);
  }
  return formatWithParams(value, params);
}
