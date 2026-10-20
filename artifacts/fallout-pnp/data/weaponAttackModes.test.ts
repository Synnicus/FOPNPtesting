import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_WEAPONS, formatWeaponAP, getWeaponAttackModes } from './weapons.ts';
import type { Weapon } from '../context/types.ts';

const weaponById = (id: string) => {
  const weapon = BUILT_IN_WEAPONS.find(candidate => candidate.id === id);
  assert.ok(weapon, `Missing built-in weapon: ${id}`);
  return weapon;
};

test('all built-in miniguns allow burst only', () => {
  const miniguns = BUILT_IN_WEAPONS.filter(weapon => weapon.name.toLocaleLowerCase().includes('minigun'));
  assert.equal(miniguns.length, 5);
  for (const weapon of miniguns) {
    assert.deepEqual(getWeaponAttackModes(weapon), { single: false, targeted: false, burst: true }, weapon.name);
    assert.equal(formatWeaponAP(weapon), `Single — / Target — / Burst ${weapon.apBurst}`, weapon.name);
  }
});

test('flamethrowers and rocket launchers cannot make targeted attacks', () => {
  const restrictedIds = [
    'flamer_pistol',
    'flamer',
    'law_80_rocket_launcher',
    'rocket_launcher',
    'tow_ii_missile_defense_system',
  ];
  for (const id of restrictedIds) {
    const weapon = weaponById(id);
    assert.equal(getWeaponAttackModes(weapon).targeted, false, weapon.name);
  }
});

test('legacy built-in profiles with no targeted AP cost stay non-targetable', () => {
  for (const weapon of BUILT_IN_WEAPONS.filter(candidate => candidate.apTargeted === null)) {
    assert.equal(getWeaponAttackModes(weapon).targeted, false, weapon.name);
  }
});

test('custom attack-mode flags override legacy availability while burst needs at least three shots', () => {
  const customWeapon: Pick<Weapon, 'attackModes' | 'apSingle' | 'apTargeted' | 'apBurst' | 'burstLimit'> = {
    attackModes: { single: false, targeted: true, burst: true },
    apSingle: null,
    apTargeted: 5,
    apBurst: 6,
    burstLimit: 4,
  };
  assert.deepEqual(getWeaponAttackModes(customWeapon), { single: false, targeted: true, burst: true });
  assert.deepEqual(getWeaponAttackModes({ ...customWeapon, burstLimit: 2 }), {
    single: false, targeted: true, burst: false,
  });
  assert.equal(getWeaponAttackModes({
    ...customWeapon,
    attackModes: { single: true, targeted: false, burst: false },
    apSingle: null,
  }).single, false, 'a mode without an AP cost is not available');
});
