import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactWeaponCombatLabel } from './weapons.ts';

test('combat controls use concise weapon-family names for long catalog names', () => {
  assert.equal(
    compactWeaponCombatLabel({ name: 'Winchester Model P94 Plasma Rifle' }),
    'Plasma Rifle',
  );
  assert.equal(
    compactWeaponCombatLabel({ name: 'Winchester Combat Shotgun' }),
    'Combat Shotgun',
  );
});

test('short weapon names stay unchanged and unknown long names are bounded', () => {
  assert.equal(compactWeaponCombatLabel({ name: '10mm Pistol' }), '10mm Pistol');
  const label = compactWeaponCombatLabel({ name: 'A very long custom weapon label without a known family' });
  assert.ok(label.length <= 26);
  assert.ok(label.endsWith('…'));
});
