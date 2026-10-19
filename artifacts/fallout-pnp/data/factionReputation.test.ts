import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import {
  applyFactionReputationAdjustment,
  FACTION_REPUTATION_THRESHOLDS,
  FNV_REPUTATION_TITLES,
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
  fame: 5,
  infamy: 5,
  log: [
    { id: 'fame-1', kind: 'fame', change: 5, reason: 'Helped a family', createdAt: 100 },
    { id: 'infamy-1', kind: 'infamy', change: 5, reason: 'Stole supplies', createdAt: 200 },
  ],
};

test('one universal threshold profile is used for Fame and Infamy', () => {
  assert.deepEqual(FACTION_REPUTATION_THRESHOLDS, [0, 25, 50, 75]);
  assert.deepEqual(
    [0, 24, 25, 49, 50, 74, 75, 100].map(points => reputationRange(points, FACTION_REPUTATION_THRESHOLDS)),
    [0, 0, 1, 1, 2, 2, 3, 3],
  );
});

test('separate Fame and Infamy ranges select the complete New Vegas title matrix', () => {
  const thresholds = FACTION_REPUTATION_THRESHOLDS;
  for (let infamyRange = 0; infamyRange < 4; infamyRange += 1) {
    for (let fameRange = 0; fameRange < 4; fameRange += 1) {
      assert.equal(
        factionReputationTitle({
          ...faction,
          fame: thresholds[fameRange],
          infamy: thresholds[infamyRange],
        }),
        FNV_REPUTATION_TITLES[infamyRange][fameRange],
      );
    }
  }
  assert.equal(factionReputationTitle(faction), 'Neutral');
  assert.equal(factionReputationTitle({ ...faction, fame: 50, infamy: 25 }), 'Smiling Troublemaker');
  assert.equal(factionReputationTitle({ ...faction, fame: 75, infamy: 75 }), 'Wild Child');
  assert.equal(factionReputationTitle({ ...faction, fame: 75, infamy: 75, customTitle: 'Paladin' }), 'Paladin - Wild Child');
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
  const legacyProfileFaction = { ...faction, thresholdProfile: 'brotherhood-of-steel' };
  assert.equal(isFactionReputation(legacyProfileFaction), true);
  assert.equal(factionReputationTitle(legacyProfileFaction), factionReputationTitle(faction));
  const normalized = normalizeFactionReputations([legacyProfileFaction]);
  assert.equal(normalized.length, 1);
  assert.equal('thresholdProfile' in normalized[0], false);
  assert.deepEqual(normalizeFactionReputations(undefined), []);
  assert.deepEqual(normalizeFactionReputations([faction, { ...faction, id: 'faction-1' }]).map(item => item.id), ['faction-1']);
});

test('character editor combines Karma and faction reputation in one tab with edit and delete controls', () => {
  const editor = readFileSync(new URL('../components/FactionReputationTracker.tsx', import.meta.url), 'utf8');
  const characterEditor = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
  assert.match(characterEditor, /'Effects', 'Karma & Reputation'/);
  assert.match(characterEditor, /<KarmaTracker[\s\S]*?<FactionReputationTracker/);
  assert.match(editor, /testID="faction-name-input"/);
  assert.match(editor, /testID="faction-threshold-help"/);
  assert.match(editor, /testID="faction-threshold-help-modal"/);
  assert.match(editor, /0–24[\s\S]*25–49[\s\S]*50–74[\s\S]*75\+/);
  assert.doesNotMatch(editor, /faction-threshold-profile-picker|THRESHOLD PROFILE/);
  assert.match(editor, /testID=\{`faction-custom-title-\$\{faction\.id\}`\}/);
  assert.match(editor, /testID=\{`faction-record-change-\$\{faction\.id\}`\}/);
  assert.match(editor, /removeFactionReputationLogEntry\(faction, entryId\)/);
  assert.match(editor, /Delete this faction and its entire reputation history\?/);
});
