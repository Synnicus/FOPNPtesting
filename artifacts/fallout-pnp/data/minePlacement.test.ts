import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { AP_COSTS, AP_COST_LIST } from './apCosts.ts';

test('Lay Mine costs six AP in the action catalog', () => {
  assert.equal(AP_COSTS.LAYING_MINE, 6);
  assert.equal(AP_COST_LIST.find(action => action.id === 'lay_mine')?.cost, 6);
});

test('placement confirmation shows effective Traps and delegates the roll to the GM', () => {
  const source = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleLayMine ='), source.indexOf('// Defend:'));
  assert.match(handler, /attackerSheet\.effectiveSkills\.traps/);
  assert.match(handler, /roll for the GM/);
  assert.match(handler, /does not roll Traps automatically or assume success/);
  assert.match(handler, /if \(window\.confirm\(message\)\) confirm\(\)/);
  assert.match(handler, /style: 'cancel'/);
  assert.match(handler, /spendAP\(attacker\.id, AP_COSTS\.LAYING_MINE\)/);
  assert.doesNotMatch(handler, /Math\.random|rollDie|rollD10/);
  assert.match(source, /label: 'LAY MINE'.*onPress: handleLayMine/);
});

test('custom editor preserves profile references and supports profile-free legacy damage', () => {
  const source = readFileSync(new URL('../app/(tabs)/equipment.tsx', import.meta.url), 'utf8');
  assert.match(source, /setAreaAttackProfileId\(w\.areaAttackProfileId\)/);
  assert.match(source, /Custom damage — no shared profile/);
  assert.match(source, /category === 'minesTraps' \? 'traps'/);
});