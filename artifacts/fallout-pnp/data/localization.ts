import fr from './locales/fr.json';
import it from './locales/it.json';
import de from './locales/de.json';
import esES from './locales/es-ES.json';
import esMX from './locales/es-MX.json';
import ja from './locales/ja.json';
import pl from './locales/pl.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import languageSettings from './locales/language-settings.json';
import patternsFr from './locales/patterns-fr.json';
import patternsIt from './locales/patterns-it.json';
import patternsDe from './locales/patterns-de.json';
import patternsEsES from './locales/patterns-es-ES.json';
import patternsEsMX from './locales/patterns-es-MX.json';
import patternsJa from './locales/patterns-ja.json';
import patternsPl from './locales/patterns-pl.json';
import patternsPtBR from './locales/patterns-pt-BR.json';
import patternsRu from './locales/patterns-ru.json';
import patternsZhHans from './locales/patterns-zh-Hans.json';
import patternsZhHant from './locales/patterns-zh-Hant.json';

export const APP_LANGUAGES = [
  { locale: 'en', label: 'English' },
  { locale: 'fr', label: 'Français' },
  { locale: 'it', label: 'Italiano' },
  { locale: 'de', label: 'Deutsch' },
  { locale: 'es-ES', label: 'Español (España)' },
  { locale: 'es-MX', label: 'Español (México)' },
  { locale: 'ja', label: '日本語' },
  { locale: 'pl', label: 'Polski' },
  { locale: 'pt-BR', label: 'Português (Brasil)' },
  { locale: 'ru', label: 'Русский' },
  { locale: 'zh-Hant', label: '繁體中文' },
  { locale: 'zh-Hans', label: '简体中文' },
] as const;

export type AppLocale = typeof APP_LANGUAGES[number]['locale'];

const translations: Partial<Record<AppLocale, Record<string, string>>> = {
  fr, it, de, 'es-ES': esES, 'es-MX': esMX, ja, pl, 'pt-BR': ptBR, ru,
  'zh-Hans': zhHans, 'zh-Hant': zhHant,
};
const supplementalTranslations: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: { 'No Armor': 'Aucune armure', 'No Weapon': 'Aucune arme' },
  it: { 'No Armor': 'Nessuna armatura', 'No Weapon': 'Nessuna arma' },
  de: { 'No Armor': 'Keine Rüstung', 'No Weapon': 'Keine Waffe' },
  'es-ES': { 'No Armor': 'Sin armadura', 'No Weapon': 'Sin arma' },
  'es-MX': { 'No Armor': 'Sin armadura', 'No Weapon': 'Sin arma' },
  ja: { 'No Armor': '防具なし', 'No Weapon': '武器なし' },
  pl: { 'No Armor': 'Brak pancerza', 'No Weapon': 'Brak broni' },
  'pt-BR': { 'No Armor': 'Sem armadura', 'No Weapon': 'Sem arma' },
  ru: { 'No Armor': 'Без брони', 'No Weapon': 'Без оружия' },
  'zh-Hans': { 'No Armor': '无护甲', 'No Weapon': '无武器' },
  'zh-Hant': { 'No Armor': '無護甲', 'No Weapon': '無武器' },
};
const dynamicPatterns: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: patternsFr, it: patternsIt, de: patternsDe, 'es-ES': patternsEsES,
  'es-MX': patternsEsMX, ja: patternsJa, pl: patternsPl, 'pt-BR': patternsPtBR,
  ru: patternsRu, 'zh-Hans': patternsZhHans, 'zh-Hant': patternsZhHant,
};
const languageSettingsTranslations = languageSettings as Record<string, Record<string, string>>;
const patternCache = new Map<AppLocale, Array<{ regex: RegExp; placeholderOrder: number[]; translated: string }>>();

let activeLocale: AppLocale = 'en';

export function isAppLocale(value: unknown): value is AppLocale {
  return APP_LANGUAGES.some(language => language.locale === value);
}

export function setActiveLocale(locale: AppLocale) {
  activeLocale = locale;
}

export function getActiveLocale(): AppLocale {
  return activeLocale;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function compiledPatterns(locale: AppLocale) {
  const cached = patternCache.get(locale);
  if (cached) return cached;
  const patterns = Object.entries(dynamicPatterns[locale] ?? {})
    .filter(([pattern]) => /\{\d+\}/.test(pattern))
    .map(([pattern, translated]) => {
      const placeholderOrder: number[] = [];
      const source = pattern.split(/(\{\d+\})/g).map(part => {
        const placeholder = part.match(/^\{(\d+)\}$/);
        if (placeholder) {
          placeholderOrder.push(Number(placeholder[1]));
          return '([\\s\\S]*?)';
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      return { regex: new RegExp(`^${source}$`, 'u'), placeholderOrder, translated };
    })
    .sort((a, b) => b.regex.source.length - a.regex.source.length);
  patternCache.set(locale, patterns);
  return patterns;
}

export function translateText(value: string, locale: AppLocale = activeLocale): string {
  if (locale === 'en') return value;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const endIndex = trailing.length > 0 ? value.length - trailing.length : value.length;
  const core = value.slice(leading.length, endIndex);
  const key = normalizeText(core);
  if (!key) return value;
  const exact = translations[locale]?.[key] ?? supplementalTranslations[locale]?.[key] ?? languageSettingsTranslations[locale]?.[key];
  if (exact !== undefined) return `${leading}${exact}${trailing}`;
  for (const pattern of compiledPatterns(locale)) {
    const match = key.match(pattern.regex);
    if (!match) continue;
    const values = new Map<number, string>();
    pattern.placeholderOrder.forEach((placeholder, index) => values.set(placeholder, match[index + 1] ?? ''));
    const translated = pattern.translated.replace(/\{(\d+)\}/g, (_, index: string) => values.get(Number(index)) ?? `{${index}}`);
    return `${leading}${translated}${trailing}`;
  }
  return value;
}
