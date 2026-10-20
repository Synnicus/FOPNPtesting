import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import {
  getCombatAttackSoundFamily,
  getCombatAttackSoundIntervalMs,
  getCombatAttackSoundShotCount,
} from './combatAttackSounds.ts';

const combatScreen = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('attack sounds map explosive attacks, thrown items, and existing weapon families', () => {
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
  }), 'blast');
  assert.equal(getCombatAttackSoundFamily({
    category: 'minesTraps', damageType: 'normal', name: 'Silent Alarm',
  }), null);
  assert.equal(getCombatAttackSoundFamily({
    category: 'minesTraps', damageType: 'normal', name: 'Custom Explosive Trap',
  }, false, true), 'blast');
  assert.equal(getCombatAttackSoundFamily({
    category: 'smallGuns', damageType: 'explosion', name: 'M-78 Grenade Launcher',
  }), 'blast');
  assert.equal(getCombatAttackSoundFamily({
    category: 'throwing', damageType: 'explosion', name: 'Frag Grenade',
  }), 'blast');
  assert.equal(getCombatAttackSoundFamily({
    category: 'throwing', damageType: 'normal', name: 'Throwing Knife',
  }), 'blade');
  assert.equal(getCombatAttackSoundFamily({
    category: 'throwing', damageType: 'normal', name: 'Rock',
  }), 'throw');
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
  assert.ok(getCombatAttackSoundIntervalMs('blast') > 640);
  assert.ok(getCombatAttackSoundIntervalMs('throw') > 420);
});

test('new attack cues are connected to audio players and still follow Combat Sounds', () => {
  assert.match(combatScreen, /useAudioPlayer\(require\('\.\.\/\.\.\/assets\/combat-blast\.wav'\)\)/);
  assert.match(combatScreen, /useAudioPlayer\(require\('\.\.\/\.\.\/assets\/combat-throw\.wav'\)\)/);
  assert.match(combatScreen, /blast: combatBlastPlayer/);
  assert.match(combatScreen, /throw: combatThrowPlayer/);
  assert.match(combatScreen, /if \(!family \|\| !combatSoundsEnabledRef\.current\) return/);
  assert.match(combatScreen, /sequenceId === attackSoundSequenceIdRef\.current && combatSoundsEnabledRef\.current/);
});

test('triggered mines and traps play their weapon cue through area resolution', () => {
  const areaApplyHandler = combatScreen.slice(
    combatScreen.indexOf('const handleAreaAttackApply'),
    combatScreen.indexOf('const selectAttackWeapon'),
  );
  assert.match(areaApplyHandler, /weapon\?\.category === 'minesTraps'/);
  assert.match(areaApplyHandler, /attack\.kind === 'explosion'[\s\S]*?attack\.kind === 'fragmentation'[\s\S]*?attack\.kind === 'concussion'/);
  assert.match(areaApplyHandler, /getCombatAttackSoundFamily\(\s*weapon,\s*isMeleeOrUnarmed,\s*isExplosiveAreaAttack/);
  assert.match(areaApplyHandler, /playCombatAttackSounds\(soundFamily, 1\)/);
});
