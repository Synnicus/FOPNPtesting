import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PERK_AUTOMATION_AUDIT,
  PERK_RECORD_IDS,
  RULE_AUTOMATION_AUDIT,
  TRAIT_AUTOMATION_AUDIT,
  TRAIT_RECORD_IDS,
  getRuleAutomationAudit,
} from './ruleAutomationAudit.ts';

function exportedRecordIds(file: 'traits.ts' | 'perks.ts', exportName: 'TRAITS' | 'PERKS'): string[] {
  const source = readFileSync(new URL(file, import.meta.url).pathname, 'utf8');
  const list = source.split(`export const ${exportName}`)[1]?.split('\n];')[0];
  assert.ok(list, `could not locate ${exportName} in ${file}`);
  return [...list.matchAll(/\bid:\s*'([^']+)'/g)].map(match => match[1]);
}

test('every current TRAITS and PERKS id has exactly one audit classification', () => {
  const traitIds = exportedRecordIds('traits.ts', 'TRAITS');
  const perkIds = exportedRecordIds('perks.ts', 'PERKS');

  assert.deepEqual([...TRAIT_RECORD_IDS], traitIds);
  assert.deepEqual([...PERK_RECORD_IDS], perkIds);
  assert.deepEqual(new Set(Object.keys(TRAIT_AUTOMATION_AUDIT)), new Set(traitIds));
  assert.deepEqual(new Set(Object.keys(PERK_AUTOMATION_AUDIT)), new Set(perkIds));
  assert.equal(RULE_AUTOMATION_AUDIT.length, traitIds.length + perkIds.length);

  for (const id of traitIds) assert.ok(getRuleAutomationAudit('trait', id), `unclassified trait ${id}`);
  for (const id of perkIds) assert.ok(getRuleAutomationAudit('perk', id), `unclassified perk ${id}`);
});

test('audit contains no unknown or duplicate kind/id pairs', () => {
  const known = new Set([
    ...TRAIT_RECORD_IDS.map(id => `trait:${id}`),
    ...PERK_RECORD_IDS.map(id => `perk:${id}`),
  ]);
  const actual = RULE_AUTOMATION_AUDIT.map(record => `${record.kind}:${record.id}`);
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(new Set(actual), known);
});

test('every audit result has an actionable reason and source summary', () => {
  const statuses = new Set([
    'automatic', 'conditional', 'oneTime', 'contextualManual', 'missingSystem',
  ]);
  for (const record of RULE_AUTOMATION_AUDIT) {
    assert.ok(statuses.has(record.status), `invalid status for ${record.kind}:${record.id}`);
    assert.ok(record.reason.length >= 40, `unclear reason for ${record.kind}:${record.id}`);
    assert.match(record.sourceSummary, /(Fallout PnP 2\.0 manual|compatibility record)/);
    assert.ok(record.sourceSummary.includes(`"${record.id}"`));
  }
});

test('contextual-only rules explicitly disclose manual or GM adjudication', () => {
  const contextual = RULE_AUTOMATION_AUDIT.filter(record => record.status === 'contextualManual');
  assert.ok(contextual.length > 0);
  for (const record of contextual) {
    assert.match(record.reason, /\b(GM|manual|context)\b/i, `${record.kind}:${record.id} looks automated`);
    assert.doesNotMatch(record.reason, /\bautomatically applied\b/i);
  }
});

test('unknown ids do not silently receive a classification', () => {
  assert.equal(getRuleAutomationAudit('trait', 'not_a_trait'), undefined);
  assert.equal(getRuleAutomationAudit('perk', 'not_a_perk'), undefined);
});