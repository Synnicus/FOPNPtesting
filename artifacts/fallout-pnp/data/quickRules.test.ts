import test from 'node:test';
import assert from 'node:assert/strict';

import { QUICK_RULES } from './quickRules.ts';
import {
  allQuickRules,
  countQuickRuleResults,
  QUICK_RULE_SECTIONS,
  searchQuickRuleSections,
} from './manualRuleSections.ts';

test('manual reference follows the manual parts and major chapter hierarchy', () => {
  assert.deepEqual(QUICK_RULE_SECTIONS.map(section => section.title), [
    'Part I — Introduction',
    'Part II — Character Creation',
    'Part III — The Game',
    'Part IV — The Fallout Universe: A Rough Guide',
    'Part V — A Fallout Bestiary',
    'Part VI — Arms, Armor, Equipment, and Vehicles',
    'Appendices',
  ]);

  const gameSubsections = QUICK_RULE_SECTIONS.find(section => section.id === 'the-game')?.subsections ?? [];
  for (const expected of [
    'Before Combat',
    'Combat — Begins, Sequence, and Action',
    'Combat — Attacking and To-Hit',
    'Combat — Damage and Criticals',
    'Combat — Continuing and Ending Combat',
    'Vehicle Combat and Mechanics',
    'Damage and Death',
    'Life in the Wastes',
    'The Art of the Thief',
    'Advancement and Perks',
  ]) {
    assert.ok(gameSubsections.some(child => child.title === expected), `Part III includes ${expected}`);
  }
});

test('all reference topics have unique IDs, details, and printed-page citations', () => {
  const rules = allQuickRules();
  assert.ok(rules.length >= 35, `expected broad rules coverage, got ${rules.length} topics`);
  assert.equal(new Set(rules.map(item => item.id)).size, rules.length, 'rule IDs are unique');
  assert.equal(
    new Set(QUICK_RULE_SECTIONS.map(section => section.id)).size,
    QUICK_RULE_SECTIONS.length,
    'section IDs are unique',
  );
  for (const section of QUICK_RULE_SECTIONS) {
    assert.match(section.manualPages, /\bp{1,2}\.\s*\d+/i, `${section.title} has a page span`);
    for (const child of section.subsections) {
      assert.ok(child.rules.length > 0, `${child.title} has at least one rule entry`);
      for (const item of child.rules) {
        assert.ok(item.details.length > 0, `${item.title} has explanation text`);
        assert.match(item.manualPages, /\bp{1,2}\.\s*\d+/i, `${item.title} has a printed page reference`);
      }
    }
  }
});

test('the expanded reference keeps all existing combat topics', () => {
  const newIds = new Set(allQuickRules().map(item => item.id));
  for (const item of QUICK_RULES) {
    assert.ok(newIds.has(item.id), `existing quick rule ${item.title} remains available`);
  }
});

test('manual index terms for rules and tables are discoverable through search', () => {
  const indexedTerms = [
    'acid damage', 'advancement', 'ammo loading', 'armor condition', 'armor equipping',
    'armor wearing', 'attacking', 'bartering', 'bestiary', 'blindness', 'burst mode',
    'streamlined burst mode', 'carrying objects', 'combat', 'changing positions',
    'chems withdrawal', 'cover modifiers', 'crashing', 'crippled limbs',
    'critical failure', 'critical hits', 'damage formula', 'non-conventional weapons',
    'death', 'deathclaw race', 'defending', 'double-shot weapons', 'dog race',
    'doors', 'explosives', 'fire damage', 'gas damage', 'ghoul race', 'healing',
    'healing in combat', 'human race', 'karma', 'karmic perks', 'knockdown',
    'laying mines', 'light modifiers', 'mines', 'movement in combat', 'pilot roll',
    'planting items', 'poison damage', 'radiation damage', 'random encounters',
    'range modifiers', 'rate of fire', 'reading books', 'repairing armor',
    'repairing weapons', 'robot healing', 'sequence', 'skill progression',
    'skill list', 'skills in combat', 'sneaking', 'stealing', 'swimming',
    'super-mutant race', 'tag skills',
  ];
  for (const term of indexedTerms) {
    assert.ok(
      searchQuickRuleSections(term).length > 0,
      `manual index term "${term}" should find a reference entry`,
    );
  }
});

test('search returns matching nested entries so results are visible under collapsed parents', () => {
  const armor = searchQuickRuleSections('armor condition');
  assert.ok(armor.some(result =>
    result.section.id === 'the-game' &&
    result.subsections.some(child =>
      child.rules.some(item => item.id === 'armor-condition-rule'),
    ),
  ));

  const crit = searchQuickRuleSections('critical hits 1d10');
  const critSection = crit.find(result => result.section.id === 'the-game');
  assert.ok(critSection?.subsections.some(child =>
    child.rules.some(item => item.id === 'criticals'),
  ));

  const ammo = searchQuickRuleSections('AP ammo');
  assert.ok(ammo.some(result => result.section.id === 'equipment-catalog'));
  assert.ok(countQuickRuleResults(ammo) >= 1);
  assert.equal(searchQuickRuleSections('unmatched wasteland phrase').length, 0);
});

test('core manual tables retain the key rows and values', () => {
  const rules = allQuickRules();
  const tables = rules.flatMap(item => item.tables ?? []);
  const byTitle = (title: string) => tables.find(item => item.title === title);

  assert.equal(byTitle('Secondary statistic rules')?.rows.length, 10);
  assert.equal(byTitle('Starting skill formulas')?.rows.length, 19);
  assert.equal(byTitle('Armor condition modifier')?.rows.length, 11);
  assert.equal(byTitle('To-hit light modifiers')?.rows.length, 13);
  assert.equal(byTitle('Radiation poisoning thresholds')?.rows.length, 6);
  assert.equal(byTitle('XP required by level')?.rows.length, 22);
  assert.equal(byTitle('Skill-point cost per 1 percentage point')?.rows.length, 6);
  assert.equal(byTitle('Special unarmed techniques (manual pp. 19–20)')?.rows.length, 12);

  const armorRows = byTitle('Armor condition modifier')?.rows ?? [];
  assert.deepEqual(armorRows.slice(0, 5).map(row => row.values[0]), [
    'None', 'None', 'None', 'None', '5%',
  ]);
  assert.equal(armorRows.at(-1)?.values[0], '60%');
});

test('major manual content outside the rules chapters stays clearly cross-referenced', () => {
  assert.ok(searchQuickRuleSections('Bestiary creature catalog').some(result =>
    result.section.id === 'bestiary',
  ));
  assert.ok(searchQuickRuleSections('equipment vehicle catalog').some(result =>
    result.section.id === 'equipment-catalog',
  ));
  assert.ok(searchQuickRuleSections('appendix sample adventure').some(result =>
    result.section.id === 'appendices',
  ));
});
