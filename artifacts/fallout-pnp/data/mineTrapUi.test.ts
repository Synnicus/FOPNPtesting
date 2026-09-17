import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const source = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('generic area modal exposes every catalog mine/trap profile', () => {
  assert.match(source, /import .*MINE_TRAP_PROFILES.*from '@\/data\/weapons'/);
  assert.match(source, /Object\.entries\(MINE_TRAP_PROFILES\)\.map/);
  assert.match(source, /testID=\{`aoe-mine-profile-\$\{profileId\}`\}/);
  assert.match(source, /setCatalogProfileId\(profileId\)/);
  assert.match(source, /activeProfile = initialAttack \?\? \(catalogProfileId \? MINE_TRAP_PROFILES\[catalogProfileId\]/);
});

test('catalog profiles share the component picker and area resolver payload', () => {
  assert.match(source, /profileParts = activeProfile \?/);
  assert.match(source, /testID=\{`aoe-profile-\$\{part\.key\}`\}/);
  assert.match(source, /const attackToApply: AreaAttack = activeProfile && selectedComponent/);
  assert.match(source, /onApply\(\{\s*\.\.\.attackToApply,\s*\}, targets\)/);
});

test('legacy custom mines/traps keep their normal custom-dice path', () => {
  assert.match(source, /const isMineTrap = weapon\?\.category === 'minesTraps'/);
  assert.match(source, /const usesAreaAttackProfile = !!weaponAreaAttack/);
  assert.match(source, /\{canRoll && !usesAreaAttackProfile && \(/);
  assert.doesNotMatch(source, /missing a catalog area profile yet/);
});