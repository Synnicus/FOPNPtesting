import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as ts from 'typescript';

const localeIds = [
  'fr', 'it', 'de', 'es-ES', 'es-MX', 'ja', 'pl', 'pt-BR', 'ru', 'zh-Hans', 'zh-Hant',
];
const localeDirectory = new URL('./locales/', import.meta.url);
const localizationSource = readFileSync(new URL('./localization.ts', import.meta.url), 'utf8');
const uiSupplemental = JSON.parse(
  readFileSync(new URL('ui-supplemental.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const localizationFilePath = fileURLToPath(new URL('./localization.ts', import.meta.url));
const nodeModule = createRequire(import.meta.url)('node:module') as any;
const localizationRuntime = new nodeModule.Module(localizationFilePath);
localizationRuntime.filename = localizationFilePath;
localizationRuntime.paths = nodeModule.Module._nodeModulePaths(dirname(localizationFilePath));
localizationRuntime._compile(ts.transpileModule(localizationSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: localizationFilePath,
}).outputText, localizationFilePath);
const runtimeTranslateText = localizationRuntime.exports.translateText as (
  value: string,
  locale: string,
) => string;
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

test('nested interface actions and prompts are translated in every locale', () => {
  const requiredUiSources = [
    'ROLL FOR ATTACK',
    'BACK TO TOP',
    'PREPARING CAMPAIGN…',
    'LOAD JSON FILE',
    'EDIT CHARACTER',
    'ADD SKILL',
    'APPLY RESISTANCE',
    'REFUND PERK?',
    'Heal Character?',
    'Restore {0} to full HP and clear unconsciousness?',
    'Store Character?',
    'Find {0} in the storage chest below.',
    'Return Character?',
    'Move {0} from the storage chest back to the active character list?',
    'Copy Character?',
    'Create a copy of {0} with the same stats and equipment?',
    'Move Character Up?',
    'Move {0} one position up in the list?',
    'Move Character Down?',
    'Move {0} one position down in the list?',
    'Delete Character?',
    'Permanently remove {0} from the campaign? This cannot be undone.',
    'SELECT ATTACKER',
    'SELECT DEFENDER',
    'ROLL & APPLY',
    'REPAIR ARMOR',
    'REPAIR WEAPON (-2 BOXES)',
    'Swipe or drag horizontally, or use the arrow buttons to see more tabs.',
  ];

  for (const locale of localeIds) {
    const translations = JSON.parse(
      readFileSync(new URL(`${locale}.json`, localeDirectory), 'utf8'),
    ) as Record<string, string>;
    const supplemental = uiSupplemental[locale] ?? {};
    assert.ok(Object.keys(supplemental).length > 350, `${locale} includes supplemental interface translations`);

    for (const source of requiredUiSources) {
      const translated = supplemental[source] ?? translations[source];
      assert.ok(translated?.trim(), `${locale} translates nested interface text “${source}”`);
      assert.notEqual(translated, source, `${locale} does not show English for “${source}”`);
    }

    for (const [source, translated] of Object.entries(supplemental)) {
      assert.ok(translated.trim(), `${locale} has a non-empty supplemental translation for “${source}”`);
      assert.notEqual(translated, source, `${locale} does not leave supplemental text in English: “${source}”`);
      assert.deepEqual(
        [...source.matchAll(/\{\d+\}/g)].map(match => match[0]).sort(),
        [...translated.matchAll(/\{\d+\}/g)].map(match => match[0]).sort(),
        `${locale} preserves placeholders in “${source}”`,
      );
    }
  }
});

test('translated interface fallbacks override English identity entries and match dynamic prompts', () => {
  assert.equal(runtimeTranslateText('SPAWN', 'it'), 'GENERA');
  assert.equal(runtimeTranslateText('SPAWN', 'de'), 'ERSTELLEN');
  assert.equal(runtimeTranslateText('% Gas ·', 'ja'), '% ガス ·');
  assert.notEqual(runtimeTranslateText('ROLL FOR ATTACK', 'fr'), 'ROLL FOR ATTACK');
  for (const locale of Object.keys(uiSupplemental)) {
    assert.notEqual(runtimeTranslateText('CUSTOM ARMOR', locale), 'CUSTOM ARMOR', locale);
  }
  assert.notEqual(
    runtimeTranslateText('Move Alex one position up in the list?', 'ja'),
    'Move Alex one position up in the list?',
  );
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
