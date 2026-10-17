import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import {
  applyFactionReputationAdjustment,
  DEFAULT_FACTION_THRESHOLD_PROFILE,
  FACTION_THRESHOLD_PROFILES,
  factionReputationTitle,
  isFactionReputation,
  normalizeFactionReputations,
  parseFactionReputationAdjustment,
  removeFactionReputationLogEntry,
  reputationRange,
} from './factionReputation.ts';
import type { FactionReputation } from '../context/types.ts';

const faction: FactionReputation = {
  id: 'faction-1',
  name: 'Great Khans',
  thresholdProfile: 'great-khans',
  fame: 5,
  infamy: 5,
  log: [
    { id: 'fame-1', kind: 'fame', change: 5, reason: 'Helped a family', createdAt: 100 },
    { id: 'infamy-1', kind: 'infamy', change: 5, reason: 'Stole supplies', createdAt: 200 },
  ],
};

test('all New Vegas faction and settlement fame/infamy thresholds match the reference chart', () => {
  assert.deepEqual(FACTION_THRESHOLD_PROFILES.map(profile => [profile.name, profile.thresholds]), [
    ['Boomers', [0, 8, 25, 50]],
    ['Brotherhood of Steel', [0, 3, 10, 20]],
    ["Caesar's Legion", [0, 15, 50, 100]],
    ['Followers of the Apocalypse', [0, 8, 25, 50]],
    ['Freeside', [0, 11, 35, 70]],
    ['Goodsprings', [0, 3, 8, 15]],
    ['Great Khans', [0, 5, 15, 30]],
    ['New California Republic', [0, 12, 40, 80]],
    ['Novac', [0, 3, 10, 20]],
    ['Powder Gangers', [0, 5, 15, 50]],
    ['Primm', [0, 5, 15, 30]],
    ['The Strip', [0, 6, 20, 40]],
    ['White Glove Society', [0, 2, 5, 10]],
  ]);
  assert.equal(DEFAULT_FACTION_THRESHOLD_PROFILE, 'great-khans');
  assert.deepEqual([0, 4, 5, 14, 15, 30].map(points => reputationRange(points, [0, 5, 15, 30])), [0, 0, 1, 1, 2, 3]);
});

test('separate Fame and Infamy ranges select the complete New Vegas title matrix', () => {
  assert.equal(factionReputationTitle(faction), 'Mixed');
  assert.equal(factionReputationTitle({ ...faction, fame: 15, infamy: 5 }), 'Smiling Troublemaker');
  assert.equal(factionReputationTitle({ ...faction, fame: 30, infamy: 30 }), 'Wild Child');
  assert.equal(factionReputationTitle({ ...faction, fame: 30, infamy: 30, customTitle: 'Paladin' }), 'Paladin - Wild Child');
  assert.equal(factionReputationTitle({ ...faction, fame: 0, infamy: 0, customTitle: 'Paladin' }), 'Paladin - Neutral');
});

test('reputation adjustments are signed, integer-only, and cannot take either pool below zero', () => {
  assert.equal(parseFactionReputationAdjustment('+12'), 12);
  assert.equal(parseFactionReputationAdjustment('-3'), -3);
  assert.equal(parseFactionReputationAdjustment('0'), null);
  assert.equal(parseFactionReputationAdjustment('3.5'), null);
  assert.deepEqual(applyFactionReputationAdjustment(5, -9), { total: 0, appliedChange: -5 });
  assert.equal(applyFactionReputationAdjustment(0, -9), null);
  assert.deepEqual(applyFactionReputationAdjustment(5, 7), { total: 12, appliedChange: 7 });
});

test('deleting a history item recomputes only its Fame or Infamy total', () => {
  const updated = removeFactionReputationLogEntry(faction, 'fame-1');
  assert.ok(updated);
  assert.equal(updated.fame, 0);
  assert.equal(updated.infamy, 5);
  assert.deepEqual(updated.log.map(entry => entry.id), ['infamy-1']);
  assert.equal(removeFactionReputationLogEntry(faction, 'missing'), null);
});

test('saved faction history is validated and legacy characters normalize to an empty tracker', () => {
  assert.equal(isFactionReputation(faction), true);
  assert.equal(isFactionReputation({ ...faction, fame: 4 }), false);
  assert.equal(isFactionReputation({ ...faction, thresholdProfile: 'unknown' }), false);
  assert.deepEqual(normalizeFactionReputations(undefined), []);
  assert.deepEqual(normalizeFactionReputations([faction, { ...faction, id: 'faction-1' }]).map(item => item.id), ['faction-1']);
});

test('character editor combines Karma and faction reputation in one tab with edit and delete controls', () => {
  const editor = readFileSync(new URL('../components/FactionReputationTracker.tsx', import.meta.url), 'utf8');
  const characterEditor = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
  assert.match(characterEditor, /'Effects', 'Karma & Factions'/);
  assert.match(characterEditor, /<KarmaTracker[\s\S]*?<FactionReputationTracker/);
  assert.match(editor, /testID="faction-name-input"/);
  assert.match(editor, /testID="faction-threshold-profile-picker"/);
  assert.match(editor, /testID=\{`faction-custom-title-\$\{faction\.id\}`\}/);
  assert.match(editor, /testID=\{`faction-record-change-\$\{faction\.id\}`\}/);
  assert.match(editor, /removeFactionReputationLogEntry\(faction, entryId\)/);
  assert.match(editor, /Delete this faction and its entire reputation history\?/);
});
