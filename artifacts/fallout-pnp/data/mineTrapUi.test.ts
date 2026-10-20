import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const source = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('area chooser lists explosive ammunition and only area-damage mine/trap profiles', () => {
  assert.match(source, /MINE_TRAP_PROFILES,[\s\S]*?from '@\/data\/areaEffects'/);
  assert.match(source, /ALL_BUILT_IN_AREA_DAMAGE_PROFILES/);
  assert.match(source, /profiles\.map\(profile =>/);
  assert.match(source, /testID=\{`aoe-profile-choice-/);
  assert.match(source, /Non-area traps are not listed here/);
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
  assert.match(source, /\{canRoll && !usesAreaAttackProfile && \(/);
  assert.doesNotMatch(source, /missing a catalog area profile yet/);
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