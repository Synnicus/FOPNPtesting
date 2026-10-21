import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const source = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('area chooser lists built-in and custom explosives without unrelated traps', () => {
  assert.match(source, /MINE_TRAP_PROFILES,[\s\S]*?from '@\/data\/areaEffects'/);
  assert.match(source, /getBuiltInAreaDamageProfiles\(missingExplosiveBlastZoneHouseRule\)/);
  assert.match(source, /profiles\.map\(profile =>/);
  assert.match(source, /testID=\{`aoe-profile-choice-/);
  assert.match(source, /SELECT A CONFIGURED BLAST PROFILE/);
  assert.match(source, /Only profiles with saved zone ranges are shown/);
  assert.match(source, /createCustomAmmoAreaDamageProfiles\(allAmmo\)/);
  assert.match(source, /createCustomWeaponAreaDamageProfiles\(allWeapons\)/);
  assert.match(source, /Blast ranges and damage components cannot be edited during combat/);
  assert.doesNotMatch(source, /aoe-save-ranges|aoe-range-/);
});

test('equipment exposes a dedicated trap tab and profile-owned blast radius editors', () => {
  const equipment = readFileSync(new URL('../app/(tabs)/equipment.tsx', import.meta.url), 'utf8');
  assert.match(equipment, /key: 'traps', label: `TRAPS/);
  assert.match(equipment, /openNewTrap/);
  assert.match(equipment, /CREATE CUSTOM TRAP/);
  assert.match(equipment, /BLAST RADIUS/i);
  assert.match(equipment, /CustomAreaEffectsEditor/);
  assert.match(equipment, /initialCategory=\{initialWeaponCategory\}/);
});

test('area profiles provide per-target blast zones and a single resolver payload', () => {
  assert.match(source, /profileParts = areaProfile\s*\?/);
  assert.match(source, /testID=\{`aoe-profile-\$\{part\.key\}`\}/);
  assert.match(source, /testID=\{`aoe-zone-\$\{c\.id\}-/);
  assert.match(source, /const attackToApply: AreaAttack = areaProfile && selectedComponent/);
  assert.match(source, /onApply\(\{\s*\.\.\.attackToApply,\s*\}, applyTargetIds\)/);
});

test('device placement waits for the GM to confirm the Traps check', () => {
  assert.match(source, /GM rolls Traps/);
  assert.match(source, /CHECK SUCCEEDED — PLACE DEVICE/);
  assert.match(source, /CHECK FAILED — SPEND AP, PLACE NOTHING/);
  assert.match(source, /if \(succeeded\) \{/);
  assert.match(source, /combatDevice:\s*\{/);
});

test('legacy custom mines/traps keep their normal custom-dice path', () => {
  assert.match(source, /const isMineTrap = weapon\?\.category === 'minesTraps' \|\| \(!!weaponAreaAttack && !isVehicleCannonAreaAttack\)/);
  assert.match(source, /const usesAreaAttackProfile = !!weaponAreaAttack && !isVehicleCannonAreaAttack/);
  assert.match(source, /\{canConfigureAttack && !usesAreaAttackProfile && \(/);
  assert.doesNotMatch(source, /missing a catalog area profile yet/);
});

test('vehicle target systems and modifiers appear before rolling is unlocked', () => {
  assert.match(source, /const canConfigureAttack = !!\(/);
  assert.match(source, /const canRoll = canConfigureAttack && vehicleSystemSelectionValid/);
  assert.match(source, /\{canConfigureAttack && \(\s*<View[\s\S]*?CHANCE TO HIT/);
  assert.match(source, /\{canConfigureAttack && \(\s*<View[\s\S]*?MODIFIERS/);
  assert.match(source, /VEHICLE SYSTEM TARGET/);
  assert.match(source, /defenderVehiclePerformance\?\.systems \?\? defender\.vehicle\.systems/);
  assert.match(source, /testID=\{`vehicle-target-system-\$\{system\.id\}`\}/);
  assert.match(source, /Select a vehicle system in Modifiers before spending AP or rolling/);
});

test('vehicle cannon hits resolve blast zones instead of applying a second direct damage roll', () => {
  assert.match(source, /weaponAreaAttack\?\.profileId\?\.startsWith\('vehicle-cannon:'\)/);
  assert.match(source, /testID="resolve-vehicle-cannon-area"/);
  assert.match(source, /directHitTargetId: defender\.id/);
  assert.match(source, /!isVehicleCannonAreaAttack && shotResults\.some\(s => s\.hit\)/);
  assert.match(source, /Apply the BLAST once, plus any in-range CONCUSSION/);
  assert.match(source, /vehicleCannonMissingEffects/);
  assert.match(source, /Roll or enter positive damage for both BLAST and CONCUSSION/);
});