import { translateText } from '@/data/localization';

/** Translates a template and then substitutes {0}, {1}... so names and numbers are never translated. */
export const tr = (template: string, ...values: (string | number)[]): string =>
  translateText(template).replace(/\{(\d+)\}/g, (_m, i: string) => String(values[Number(i)] ?? ''));
