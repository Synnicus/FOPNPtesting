import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCombatAttackSoundFamily,
  getCombatAttackSoundIntervalMs,
  getCombatAttackSoundShotCount,
} from './combatAttackSounds.ts';

test('attack sounds map firearms, energy weapons, and melee by weapon family', () => {
  assert.equal(getCombatAttackSoundFamily({
    category: 'smallGuns', damageType: 'normal', name: 'Pipe Rifle',
  }), 'firearm');
  assert.equal(getCombatAttackSoundFamily({
    category: 'energyWeapons', damageType: 'plasma', name: 'Plasma Rifle',
  }), 'laser');
  assert.equal(getCombatAttackSoundFamily({
    category: 'meleeWeapons', damageType: 'normal', name: 'Super Sledgehammer',
  }), 'blunt');
  assert.equal(getCombatAttackSoundFamily({
    category: 'meleeWeapons', damageType: 'normal', name: 'Combat Knife',
  }), 'blade');
  assert.equal(getCombatAttackSoundFamily(null, true), 'blunt');
  assert.equal(getCombatAttackSoundFamily({
    category: 'minesTraps', damageType: 'explosion', name: 'Frag Mine',
  }), null);
  assert.equal(getCombatAttackSoundFamily({
    category: 'throwing', damageType: 'normal', name: 'Throwing Knife',
  }), 'blade');
  assert.equal(getCombatAttackSoundFamily({
    category: 'natural', damageType: 'fire', name: 'Centaur Acid Spit',
  }), null);
});

test('burst and double-shot modes schedule one sound per projectile', () => {
  assert.equal(getCombatAttackSoundShotCount({
    isBurst: false, burstShots: 6, doubleShotActive: false,
  }), 1);
  assert.equal(getCombatAttackSoundShotCount({
    isBurst: false, burstShots: 6, doubleShotActive: true,
  }), 2);
  assert.equal(getCombatAttackSoundShotCount({
    isBurst: true, burstShots: 6, doubleShotActive: false,
  }), 6);
  assert.equal(getCombatAttackSoundShotCount({
    isBurst: true, burstShots: 0, doubleShotActive: true,
  }), 1);
});

test('sound spacing exceeds each short effect duration for clear sequential playback', () => {
  assert.ok(getCombatAttackSoundIntervalMs('firearm') > 230);
  assert.ok(getCombatAttackSoundIntervalMs('blade') > 360);
  assert.ok(getCombatAttackSoundIntervalMs('blunt') > 300);
  assert.ok(getCombatAttackSoundIntervalMs('laser') > 290);
});
