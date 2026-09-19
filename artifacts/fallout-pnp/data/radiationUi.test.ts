import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const characterSource = readFileSync(new URL('../app/(tabs)/characters.tsx', import.meta.url), 'utf8');
const combatSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');

test('character editor adds radiation with an optional single resistance adjustment', () => {
  assert.match(characterSource, /if \(amount > 0\) setPendingRadiation\(amount\)/);
  assert.match(characterSource, /title="Apply Radiation Resistance\?"/);
  assert.match(
    characterSource,
    /onCancel=\{\(\) => \{ if \(pendingRadiation !== null\) setChar\(c => \(\{ \.\.\.c, accumulatedRadiation: adjustRadiation\(c\.accumulatedRadiation \?\? 0, pendingRadiation\) \}\)\)/,
  );
  assert.match(
    characterSource,
    /onConfirm=\{\(\) => \{ if \(pendingRadiation !== null\) setChar\(c => \(\{ \.\.\.c, accumulatedRadiation: adjustRadiation\(c\.accumulatedRadiation \?\? 0, resolveRadiationAddition\(pendingRadiation, armorSheet\.radiationResistance\)\) \}\)\)/,
  );
});

test('character editor subtraction skips resistance and clamps through the shared meter rule', () => {
  const subtraction = characterSource.match(
    /onPress=\{\(\) => \{ const amount = parseInt\(radiationInput, 10\) \|\| 0; setChar\(c => \(\{ \.\.\.c, accumulatedRadiation: adjustRadiation\(c\.accumulatedRadiation \?\? 0, -amount\) \}\)\); setRadiationInput\(''\); \}\}/,
  );
  assert.ok(subtraction, 'radiation subtraction must directly use a negative shared-rule adjustment');
  assert.doesNotMatch(subtraction[0], /setPendingRadiation|resolveRadiationAddition|currentHp/);
});

test('normal and streamlined combat add resolved radiation without applying resistance twice or changing HP', () => {
  const normalApply = combatSource.slice(
    combatSource.indexOf('const handleApplyDamage = useCallback'),
    combatSource.indexOf('// Apply a critical-hit table entry'),
  );
  assert.match(normalApply, /if \(totalDamage > 0\) applyDamage\(defender\.id, totalDamage\)/);
  assert.match(normalApply, /if \(totalRadiationExposure > 0\) adjustRadiation\(defender\.id, totalRadiationExposure\)/);
  assert.doesNotMatch(normalApply, /resolveRadiationAddition|radiationResistance/);

  const streamlinedApply = combatSource.slice(
    combatSource.indexOf('setStreamlinedDmgResult({ perHit'),
    combatSource.indexOf('Haptics.notificationAsync', combatSource.indexOf('setStreamlinedDmgResult({ perHit')),
  );
  assert.match(streamlinedApply, /if \(totalBurstDmg > 0\) applyDamage\(defender\.id, totalBurstDmg\)/);
  assert.match(streamlinedApply, /if \(radiationExposure > 0\) adjustRadiation\(defender\.id, radiationExposure\)/);
  assert.doesNotMatch(streamlinedApply, /resolveRadiationAddition|radiationResistance|currentHp/);
});

test('combat sheets receive the campaign toggle and character radiation meter', () => {
  assert.match(combatSource, /accumulatedRadiation: character\.accumulatedRadiation/);
  assert.match(combatSource, /fallout3RadiationDebuffs,/);
  assert.match(combatSource, /resolveCombatSheet\(attacker, allArmor, true, fallout3RadiationDebuffs\)/);
  assert.match(combatSource, /resolveCombatSheet\(defender, allArmor, true, fallout3RadiationDebuffs\)/);
  assert.match(combatSource, /resolveCombatSheet\(completionHealActor, allArmor, true, fallout3RadiationDebuffs\)/);
});

test('radiation changes resynchronize live initiative when optional penalties are enabled', () => {
  assert.match(contextSource, /if \(!s\.fallout3RadiationDebuffs\) return \{ \.\.\.s, characters \}/);
  assert.match(contextSource, /syncInitiativeEntrySheet\(entry, resolveCharacterArmorSheet\(character, allArmor, false, true\)\)/);
  assert.match(contextSource, /sortInitiativeEntries\(s\.initiativeEntries\.map/);
});

test('area combat updates radiation independently from HP damage', () => {
  const areaUpdate = contextSource.slice(
    contextSource.indexOf('const characters = s.characters.map(c => {', contextSource.indexOf('const applyAreaAttack')),
    contextSource.indexOf('const initiativeEntries = s.initiativeEntries.map', contextSource.indexOf('const applyAreaAttack')),
  );
  assert.match(areaUpdate, /currentHp: Math\.max\(0, c\.currentHp - result\.damage\)/);
  assert.match(
    areaUpdate,
    /accumulatedRadiation: adjustRadiationValue\(c\.accumulatedRadiation \?\? 0, result\.radiationExposure \?\? 0\)/,
  );
  assert.doesNotMatch(areaUpdate, /currentHp:[^\n]*radiation|resolveRadiationAddition/);
  assert.match(contextSource, /const maxAP = charMaxAP\(updated, armor, true\)/);
  assert.match(contextSource, /resolveCharacterArmorSheet\(updatedCharacter, armor, false, true\)/);
});

test('radiation meter is normalized on reload and persisted with campaign state', () => {
  const activeProvider = contextSource.slice(contextSource.indexOf('export function AppProvider'));
  assert.match(
    activeProvider,
    /AsyncStorage\.getItem\(STORAGE_KEY\)\.then\(raw => \{[\s\S]*normalizePersistedState\(JSON\.parse\(raw\) as AppState\)/,
  );
  assert.match(activeProvider, /AsyncStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(state\)\)/);
  assert.match(
    contextSource,
    /const accumulatedRadiation = normalizeRadiation\(normalized\.accumulatedRadiation\)/,
  );
});