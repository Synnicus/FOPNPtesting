import assert from 'node:assert/strict';
import test from 'node:test';
import { getAmmoById } from './ammo.ts';
import { makePoisonedEffect, mergePoisonedEffect, poisonEffectName, poisonExposuresForAttack } from './poisonEffects.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';

const weapon = (id: string) => {
  const found = BUILT_IN_WEAPONS.find(candidate => candidate.id === id);
  assert.ok(found, `missing weapon ${id}`);
  return found;
};

test('poisoned natural and coated weapons expose their poison on a hit', () => {
  assert.deepEqual(poisonExposuresForAttack(weapon('giant_rat_bite'), null).map(p => p.type), ['A']);
  assert.deepEqual(poisonExposuresForAttack({
    ...weapon('knife'),
    mods: ['poison_d'],
  }, null).map(p => p.type), ['D']);
});

test('poison ammunition exposes its poison independently of damage', () => {
  const poisonAmmo = getAmmoById('hn_needler_poison');
  assert.ok(poisonAmmo);
  assert.equal(poisonAmmo.dmgDieCount, 0);
  assert.deepEqual(poisonExposuresForAttack(weapon('needler_pistol'), poisonAmmo).map(p => p.type), ['G']);
});

test('poison effects are persistent flavor statuses with no combat modifiers', () => {
  const effect = makePoisonedEffect(
    { type: 'B', effectText: 'Type B poison description.' },
    'Mantis Mandible',
  );
  assert.equal(effect.kind, 'other');
  assert.equal(effect.poisonType, 'B');
  assert.equal(effect.name, 'Poisoned with Type B X1');
  assert.equal(effect.poisonCount, 1);
  assert.equal(effect.isActive, true);
  assert.match(effect.notes?.join(' ') ?? '', /Flavor only/);
  assert.equal(effect.statMods, undefined);
  assert.equal(effect.hpMod, undefined);
  assert.equal(effect.apMod, undefined);
  assert.equal(effect.acMod, undefined);
  assert.equal(effect.drMod, undefined);
});

test('repeated exposure consolidates into a poison multiplier', () => {
  const first = makePoisonedEffect({ type: 'D', effectText: 'Type D poison description.' }, 'Radscorpion Tail');
  const second = makePoisonedEffect({ type: 'D', effectText: 'Type D poison description.' }, 'Radscorpion Tail');
  const third = makePoisonedEffect({ type: 'D', effectText: 'Type D poison description.' }, 'Radscorpion Tail');
  const merged = mergePoisonedEffect(mergePoisonedEffect(first, second), third);

  assert.equal(poisonEffectName('D', 3), 'Poisoned with Type D X3');
  assert.equal(merged.name, 'Poisoned with Type D X3');
  assert.equal(merged.poisonCount, 3);
  assert.equal(merged.statMods, undefined);
  assert.equal(merged.notes?.filter(note => note.startsWith('Source:')).length, 3);
});