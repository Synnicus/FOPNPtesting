import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

const localeIds = [
  'fr', 'it', 'de', 'es-ES', 'es-MX', 'ja', 'pl', 'pt-BR', 'ru', 'zh-Hans', 'zh-Hant',
];
const localeDirectory = new URL('./locales/', import.meta.url);
const localizationSource = readFileSync(new URL('./localization.ts', import.meta.url), 'utf8');
const statusCleanupTranslationSource = localizationSource.slice(
  localizationSource.indexOf('const statusCleanupLabels:'),
  localizationSource.indexOf('function translateStatusCleanupLabel'),
);

function getStatusCleanupLocaleBlock(locale: string): string {
  const escapedLocale = locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const localeMatch = statusCleanupTranslationSource.match(new RegExp(
    `(?:^|\\n)  (?:'${escapedLocale}'|${escapedLocale}): \\{([\\s\\S]*?)(?=\\n  (?:'[^']+'|[a-z-]+): \\{|\\n\\};)`,
  ));
  assert.ok(localeMatch, `${locale} has status-cleanup translations`);
  return localeMatch[1];
}

test('every supported non-English locale bundles app UI and built-in content translations', () => {
  const requiredStrings = [
    'CAMPAIGN OPTIONS',
    'Hardcore radiation penalties',
    'Search the Fallout PnP manual',
  ];

  for (const locale of localeIds) {
    const translations = JSON.parse(
      readFileSync(new URL(`${locale}.json`, localeDirectory), 'utf8'),
    ) as Record<string, string>;
    assert.ok(Object.keys(translations).length >= 1600, `${locale} has the full string catalog`);

    for (const source of requiredStrings) {
      assert.ok(translations[source]?.trim(), `${locale} includes “${source}”`);
      assert.notEqual(translations[source], source, `${locale} translates “${source}”`);
    }
  }
});

test('dynamic translations preserve every interpolation token', () => {
  const tokenPattern = /\{\d+\}/g;
  for (const locale of localeIds) {
    const patterns = JSON.parse(
      readFileSync(new URL(`patterns-${locale}.json`, localeDirectory), 'utf8'),
    ) as Record<string, string>;
    assert.ok(Object.keys(patterns).length >= 200, `${locale} includes dynamic text patterns`);

    for (const [source, translated] of Object.entries(patterns)) {
      assert.deepEqual(
        [...source.matchAll(tokenPattern)].map(match => match[0]).sort(),
        [...translated.matchAll(tokenPattern)].map(match => match[0]).sort(),
        `${locale} preserves placeholders in “${source}”`,
      );
    }
  }
});

test('language setting copy is available for every locale without translating user-entered text', () => {
  const languageSettings = JSON.parse(
    readFileSync(new URL('language-settings.json', localeDirectory), 'utf8'),
  ) as Record<string, Record<string, string>>;

  for (const locale of localeIds) {
    assert.ok(languageSettings[locale]?.Language);
    assert.ok(languageSettings[locale]?.['Names and notes you enter stay in the language you wrote them.']);
    assert.ok(languageSettings[locale]?.['rank']);
    assert.ok(languageSettings[locale]?.['perk points']);
  }
});

test('status-cleanup prompt text is translated for every supported non-English locale', () => {
  const promptText = [
    'Remove All Status Effects',
    'Also Heal Injuries?',
    'Should injuries such as broken limbs also be healed? Their entries will be kept but marked inactive.',
    'KEEP INJURIES',
    'HEAL INJURIES',
    'Are you sure?',
    'This clears temporary effects (poison, unconsciousness, drug effects, withdrawal, and ongoing hazards) from all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.',
    'This clears temporary effects and marks all injuries inactive for all active characters. Stored characters, HP, radiation, armor, and perk effects are unchanged.',
    'CANCEL',
    'REMOVE ALL EFFECTS',
  ];

  for (const locale of localeIds) {
    const localeBlock = getStatusCleanupLocaleBlock(locale);
    for (const source of promptText) {
      const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const translation = localeBlock.match(new RegExp(`^\\s*'${escapedSource}': '([^']*)'`, 'm'));
      assert.ok(translation, `${locale} translates status-cleanup prompt text “${source}”`);
      assert.ok(translation[1].trim(), `${locale} has a non-empty translation for “${source}”`);
      assert.notEqual(translation[1], source, `${locale} does not show English for “${source}”`);
    }
  }
});
