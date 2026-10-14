import test from 'node:test';
import assert from 'node:assert/strict';

import { QUICK_RULES, searchQuickRules } from './quickRules.ts';

const expectedTopics = [
  'Attack Roll',
  'Range Penalty',
  'Damage',
  'Criticals',
  'Critical Failure',
  'Targeted Shot — Ranged',
  'Targeted Shot — Melee',
  'Positions',
  'Weapon Condition',
  'Action Points',
  'Injuries',
];

test('searchable rule catalog keeps every existing quick-reference topic', () => {
  assert.deepEqual(QUICK_RULES.map(rule => rule.title), expectedTopics);
});

test('every topic includes detailed text and a printed manual page reference', () => {
  for (const rule of QUICK_RULES) {
    assert.ok(rule.details.length > 0, `${rule.title} has detail text`);
    assert.match(rule.manualPages, /\bp{1,2}\.\s*\d+/i, `${rule.title} has a page citation`);
  }

  assert.deepEqual(
    Object.fromEntries(QUICK_RULES.map(rule => [rule.title, rule.manualPages])),
    {
      'Attack Roll': 'pp. 28–29',
      'Range Penalty': 'p. 28',
      Damage: 'p. 32',
      Criticals: 'pp. 18, 33–34, 54',
      'Critical Failure': 'p. 31',
      'Targeted Shot — Ranged': 'p. 29',
      'Targeted Shot — Melee': 'p. 29',
      Positions: 'p. 27',
      'Weapon Condition': 'pp. 23, 31',
      'Action Points': 'pp. 25–28',
      Injuries: 'pp. 41–42',
    },
  );
});

test('search matches titles, keywords, explanations, and table entries', () => {
  assert.ok(searchQuickRules('ranged').some(rule => rule.id === 'targeted-ranged'));
  assert.ok(searchQuickRules('perception').some(rule => rule.id === 'range-penalty'));
  assert.ok(searchQuickRules('miniature anvil').some(rule => rule.id === 'critical-failure'));
  assert.ok(searchQuickRules('1d10 unconsciousness').some(rule => rule.id === 'criticals'));
});

test('multiple terms narrow results and matching ignores case and extra spaces', () => {
  const matches = searchQuickRules('  TARGETED   EYES ');
  assert.ok(matches.some(rule => rule.id === 'targeted-ranged'));
  assert.ok(matches.some(rule => rule.id === 'targeted-melee'));
  assert.ok(matches.every(rule => rule.title.includes('Targeted') || rule.id === 'criticals'));
});

test('empty and unmatched searches have predictable results', () => {
  assert.equal(searchQuickRules('   ').length, QUICK_RULES.length);
  assert.deepEqual(searchQuickRules('no such wasteland rule'), []);
});

test('Critical Hits and Critical Failure tables remain searchable in their detail topics', () => {
  const criticals = QUICK_RULES.find(rule => rule.id === 'criticals');
  const failures = QUICK_RULES.find(rule => rule.id === 'critical-failure');
  assert.ok(criticals?.tables?.some(table => table.title === 'Critical Hits (1d10)' && table.rows.length === 10));
  assert.ok(criticals?.tables?.some(table => table.title === 'Effects of targeted critical hits' && table.rows.length === 6));
  assert.ok(failures?.tables?.some(table => table.title === 'Critical Failure (1d10)' && table.rows.length === 10));
  assert.ok(searchQuickRules('More Criticals 5%').some(rule => rule.id === 'criticals'));
  assert.ok(searchQuickRules('300% damage').some(rule => rule.id === 'criticals'));
  assert.ok(searchQuickRules('weapon explodes').some(rule => rule.id === 'critical-failure'));
});
