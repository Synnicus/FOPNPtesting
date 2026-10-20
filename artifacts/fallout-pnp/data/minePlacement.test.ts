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
  const modal = source.slice(source.indexOf('function MineTrapPlacementModal'), source.indexOf('function AreaAttackModal'));
  const placement = source.slice(source.indexOf('const resolveLayDeviceAttempt'), source.indexOf('const setVehicleMoving'));
  assert.match(modal, /effectiveTraps/);
  assert.match(modal, /Roll Traps yourself/);
  assert.match(modal, /only places the device after a successful check/);
  assert.match(modal, /CHECK SUCCEEDED — PLACE DEVICE/);
  assert.match(modal, /CHECK FAILED — SPEND AP, PLACE NOTHING/);
  assert.match(placement, /spendAP\(attacker\.id, AP_COSTS\.LAYING_MINE\)/);
  assert.match(placement, /if \(succeeded\) \{/);
  assert.doesNotMatch(modal, /Math\.random|rollDie|rollD10/);
  assert.match(source, /label: 'LAY MINE'.*onPress: handleLayMine/);
});

test('custom editor preserves profile references and supports profile-free legacy damage', () => {
  const source = readFileSync(new URL('../app/(tabs)/equipment.tsx', import.meta.url), 'utf8');
  assert.match(source, /setAreaAttackProfileId\(w\.areaAttackProfileId\)/);
  assert.match(source, /Custom profile/);
  assert.match(source, /category === 'minesTraps' \? 'traps'/);
});