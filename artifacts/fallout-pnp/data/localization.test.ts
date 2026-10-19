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
const appTourTranslationData = JSON.parse(
  readFileSync(new URL('app-tour.json', localeDirectory), 'utf8'),
) as { keys: string[] } & Record<string, string[]>;
const appTourSourceFiles = [
  '../data/appTour.ts',
  '../components/AboutThisAppModal.tsx',
  '../components/AppTourOverlay.tsx',
  '../app/index.tsx',
];
const appTourRenderedSource = appTourSourceFiles
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n');
const uiSupplemental = JSON.parse(
  readFileSync(new URL('ui-supplemental.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const customRulesTranslations = JSON.parse(
  readFileSync(new URL('custom-rules.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const customEditorsTranslations = JSON.parse(
  readFileSync(new URL('custom-editors.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const equipmentTagTranslations = JSON.parse(
  readFileSync(new URL('equipment-tags.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const catalogImagesTranslations = JSON.parse(
  readFileSync(new URL('catalog-images.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const consumablesTranslations = JSON.parse(
  readFileSync(new URL('consumables-ui.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const factionReputationTranslations = JSON.parse(
  readFileSync(new URL('faction-reputation.json', localeDirectory), 'utf8'),
) as Record<string, Record<string, string>>;
const factionReputationHelpTranslations = JSON.parse(
  readFileSync(new URL('faction-reputation-help.json', localeDirectory), 'utf8'),
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
    'Save changes before leaving?',
    'You have unsaved character changes. Save them before leaving?',
    'SAVE CHANGES',
    'DISCARD CHANGES',
    'KEEP EDITING',
    'A character name is required before it can be saved.',
    'Close character editor',
    'Save changes',
    'Discard changes',
    'Keep editing',
    'ADD SKILL',
    'APPLY RESISTANCE',
    'REFUND PERK?',
    'Enter a positive or negative  number. Add an explanation. The total is Limited to −1000 to +1000.',
    'EDIT ENTRY',
    'REMOVE ENTRY',
    'EDIT PRE-MADE NPC',
    'Edit built-in NPC?',
    'Editing this built-in NPC will override its default data. You can restore the default roster in Campaign Options.',
    'Remove built-in NPC?',
    'This hides the NPC from the Bestiary. You can restore the default roster in Campaign Options.',
    'Restore default Bestiary?',
    'This restores the current built-in NPC roster and removes its edits and removals. Custom NPCs and catalog photos are kept.',
    'Restore built-in NPCs hidden or edited in the Bestiary. Custom NPCs and catalog photos are kept.',
    'RESTORE DEFAULT BESTIARY',
    'AOE ATTACK',
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
    'CUSTOM WEAPON MODS',
    'WEAPON TAGS',
    'ELIGIBLE WEAPON TAGS',
    'SELECT WEAPON TAGS',
    'SELECT ARMOR TAGS',
    '+ CUSTOM WEAPON TAG',
    '+ CUSTOM ARMOR TAG',
    'CANCEL',
    'All',
    'Custom',
    'ADD TAG',
    '+ CUSTOM MOD',
    '+ CUSTOM PERK',
    'Create direct weapon adjustments or description-only modifications.',
    'Create perks with automatic effects or roleplay-only descriptions. Conditions are checked when the perk applies.',
    'Natural Attack',
    'Mines & Traps',
    'Battle Rifle',
    'Carbine',
    'Grenade Launcher',
    'Missile/Rocket Launcher',
    'Mortar',
    'Cannon',
    'Flamethrower',
    'Bow',
    'Crossbow',
    'Blowgun',
    'Sling',
    'Grenade',
    'Mine',
    'Trap',
    'Armor',
    'Body Armor',
    'Leather Armor',
    'Metal Armor',
    'Chitin Armor',
    'Environmental Armor',
    'Clothing',
    'Pistol',
    'Revolver',
    'Shotgun',
    'Submachine Gun',
    'Rifle',
    'Single-shot Rifle',
    'Assault Rifle',
    'Sniper Rifle',
    'Launcher',
    'Heavy Weapon',
    'Energy Pistol',
    'Energy Rifle',
    'Burst-capable',
    'Explosive',
    'Helmet',
  ];

  for (const locale of localeIds) {
    const translations = JSON.parse(
      readFileSync(new URL(`${locale}.json`, localeDirectory), 'utf8'),
    ) as Record<string, string>;
    const supplemental = {
      ...(uiSupplemental[locale] ?? {}),
      ...(customRulesTranslations[locale] ?? {}),
      ...(customEditorsTranslations[locale] ?? {}),
      ...(equipmentTagTranslations[locale] ?? {}),
      ...(catalogImagesTranslations[locale] ?? {}),
      ...(consumablesTranslations[locale] ?? {}),
    };
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

test('consumable catalog and custom editor text is translated in every locale', () => {
  const required = [
    'CONSUMABLES',
    'CUSTOM CONSUMABLE',
    'EDIT CUSTOM CONSUMABLE',
    'CREATE CUSTOM CONSUMABLE',
    'Consumable name*',
    'CHEM',
    'MEDICAL',
    'FOOD',
    'DRINK',
    'OTHER',
    'VALUE (CAPS)',
    'NO LISTED VALUE',
    'Description (optional)',
    'Effects / use notes (optional)',
    'Custom effect notes are descriptive for now; they do not automatically change character stats or combat.',
    'Close consumable editor',
    'CREATE CONSUMABLE',
    'Consumable filters',
    'Built-in chems and alcohol, plus campaign-specific consumables. Custom effect notes are reference-only.',
    'Copy {0} as a custom consumable',
    'Edit {0}',
    'Delete {0}',
  ];

  for (const locale of localeIds) {
    const translations = consumablesTranslations[locale];
    assert.ok(translations, `${locale} has consumable translations`);
    for (const source of required) {
      assert.ok(translations[source]?.trim(), `${locale} translates “${source}”`);
      assert.notEqual(translations[source], source, `${locale} does not display English for “${source}”`);
    }
  }
});

test('faction reputation UI, threshold guide, and every automated title are translated in every locale', () => {
  const required = [
    'Karma & Reputation',
    'FACTION REPUTATION',
    'Track Fame and Infamy separately. Both use the same thresholds to determine the reputation title.',
    'Reputation threshold help',
    'Shows how Fame and Infamy points map to reputation tiers',
    'REPUTATION THRESHOLDS',
    'Fame and Infamy each use these point ranges. Their combined tiers determine the automated reputation title.',
    'FAME OR INFAMY POINTS',
    'TIER',
    'Fame and Infamy are measured separately. Use the resulting tiers together to look up the New Vegas-style reputation title.',
    'Close',
    'ADD A FACTION',
    'Add faction',
    'Faction name',
    'Enter a faction name.',
    'The faction tracker is full.',
    'A faction with that name is already being tracked.',
    'FACTION',
    'Current faction reputation',
    'FAME',
    'INFAMY',
    'AUTOMATED REPUTATION TITLE',
    'CUSTOM TITLE (OPTIONAL)',
    'Custom title, e.g. Paladin',
    'RECORD REPUTATION CHANGE',
    'Add Fame or Infamy points with an explanation. Negative changes reduce that total.',
    'Change, e.g. +5 or -2',
    'Why did reputation change?',
    'Enter a non-zero whole number and an explanation.',
    'No points in this category are available to remove.',
    'Some points were not applied because the total cannot go below zero.',
    'Record reputation change',
    'ADD TO REPUTATION LOG',
    'REPUTATION HISTORY',
    'No reputation changes recorded yet.',
    'Delete reputation entry',
    'Delete faction',
    'Delete this reputation entry? The total will be recalculated from remaining entries.',
    'Delete this faction and its entire reputation history? This cannot be undone.',
    'Current faction reputation',
    'No factions tracked yet. Add one above to begin recording Fame and Infamy.',
    'Neutral', 'Accepted', 'Liked', 'Idolized',
    'Shunned', 'Mixed', 'Smiling Troublemaker', 'Good-Natured Rascal',
    'Hated', 'Sneering Punk', 'Unpredictable', 'Dark Hero',
    'Vilified', 'Merciful Thug', 'Soft-Hearted Devil', 'Wild Child',
  ];

  for (const locale of localeIds) {
    const translations = {
      ...(factionReputationTranslations[locale] ?? {}),
      ...(factionReputationHelpTranslations[locale] ?? {}),
    };
    for (const source of required) {
      assert.ok(translations[source]?.trim(), `${locale} translates faction UI text “${source}”`);
      if (source !== 'Neutral') {
        assert.notEqual(translations[source], source, `${locale} does not show English for “${source}”`);
      }
    }
  }

  const tracker = readFileSync(new URL('../components/FactionReputationTracker.tsx', import.meta.url), 'utf8');
  assert.match(tracker, /testID="faction-threshold-help"/);
  assert.match(tracker, /testID="faction-threshold-help-modal"/);
  assert.doesNotMatch(tracker, /THRESHOLD PROFILE|faction-threshold-profile-picker/);
});

test('translated interface fallbacks override English identity entries and match dynamic prompts', () => {
  assert.equal(runtimeTranslateText('SPAWN', 'it'), 'GENERA');
  assert.equal(runtimeTranslateText('SPAWN', 'de'), 'ERSTELLEN');
  assert.equal(runtimeTranslateText('% Gas ·', 'ja'), '% ガス ·');
  assert.notEqual(runtimeTranslateText('ROLL FOR ATTACK', 'fr'), 'ROLL FOR ATTACK');
  assert.notEqual(runtimeTranslateText('Wild Child', 'fr'), 'Wild Child');
  assert.notEqual(runtimeTranslateText('FACTION REPUTATION', 'ja'), 'FACTION REPUTATION');
  for (const locale of Object.keys(uiSupplemental)) {
    assert.notEqual(runtimeTranslateText('Hardcore Radiation Penalties', locale), 'Hardcore Radiation Penalties', locale);
    assert.notEqual(runtimeTranslateText('CUSTOM ARMOR', locale), 'CUSTOM ARMOR', locale);
    assert.notEqual(runtimeTranslateText('CUSTOM AMMO', locale), 'CUSTOM AMMO', locale);
    assert.notEqual(runtimeTranslateText('Public Domain 1920s', locale), 'Public Domain 1920s', locale);
    for (const source of [
      'NOW PLAYING',
      'Previous track',
      'Next track',
      'Loading track…',
      'No track playing',
      'Unknown artist',
    ]) {
      assert.notEqual(runtimeTranslateText(source, locale), source, `${locale} translates ${source}`);
    }
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

test('About and guided-tour copy is translated and wired for every supported locale', () => {
  assert.equal(new Set(appTourTranslationData.keys).size, appTourTranslationData.keys.length);
  for (const locale of localeIds) {
    const values = appTourTranslationData[locale];
    assert.ok(values, `${locale} has app-tour translations`);
    assert.equal(values.length, appTourTranslationData.keys.length, `${locale} has one value for each app-tour string`);
    appTourTranslationData.keys.forEach((source, index) => {
      if (!source.includes('{0}') && !source.includes('{1}')) {
        assert.ok(appTourRenderedSource.includes(source), `app-tour source contains “${source}”`);
      }
      const translated = values[index];
      assert.ok(translated?.trim(), `${locale} translates “${source}”`);
      assert.notEqual(translated, source, `${locale} does not show English for “${source}”`);
      const sample = source
        .replace('{0}', '2')
        .replace('{1}', '5');
      const runtimeValue = runtimeTranslateText(sample, locale);
      assert.notEqual(runtimeValue, sample, `${locale} resolves “${source}” at runtime`);
      if (source.includes('{0}') || source.includes('{1}')) {
        assert.equal(runtimeValue, translated.replace('{0}', '2').replace('{1}', '5'));
      }
    });
  }
});
