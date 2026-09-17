import assert from 'node:assert/strict';
import test from 'node:test';
import { MANUAL_BESTIARY } from './bestiary.ts';
import { computeModEffects } from './mods.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';

const manualBestiary = MANUAL_BESTIARY.filter(template => template.naturalAttacks?.length);

const weaponById = (id: string) => {
  const weapon = BUILT_IN_WEAPONS.find(candidate => candidate.id === id);
  assert.ok(weapon, `missing natural weapon ${id}`);
  return weapon;
};

test('manual poison notes resolve to the matching natural-weapon poison mod', () => {
  const expected = [
    ['giant_rat', 'giant_rat_bite', 'A'],
    ['lesser_molerat', 'lesser_molerat_bite', 'A'],
    ['greater_molerat', 'greater_molerat_bite', 'B'],
    ['lesser_pigrat', 'lesser_pigrat_bite', 'A'],
    ['greater_pigrat', 'greater_pigrat_bite', 'B'],
    ['giant_cockroaches', 'cockroach_mandible', 'B'],
    ['giant_ants', 'giant_ant_mandibles', 'A'],
    ['mantis', 'mantis_mandible', 'B'],
    ['flailer', 'flailer_bite', 'D'],
    ['lesser_radscorpion', 'lesser_radscorpion_tail', 'D'],
    ['greater_radscorpion', 'greater_radscorpion_tail', 'D'],
    ['fire_gecko', 'fire_gecko_bite', 'B'],
  ] as const;

  for (const [templateId, weaponId, poisonType] of expected) {
    const template = manualBestiary.find(candidate => candidate.id === templateId);
    assert.ok(template, `missing manual creature ${templateId}`);
    const attack = template.naturalAttacks?.find(candidate => candidate.weaponId === weaponId);
    assert.ok(attack, `${templateId} missing natural attack ${weaponId}`);
    assert.match(attack.notes ?? '', new RegExp(`Poison Type ${poisonType}`));

    const weapon = weaponById(weaponId);
    assert.deepEqual(weapon.mods, [`poison_${poisonType.toLowerCase()}`]);
    assert.deepEqual(computeModEffects(weapon).poisons.map(poison => poison.type), [poisonType]);
  }
});

test('variant natural attacks do not inherit poison from their shared species', () => {
  const radRatBite = weaponById('rad_rat_bite');
  const normalGeckoBite = weaponById('gecko_bite');
  const fireGeckoBite = weaponById('fire_gecko_bite');

  assert.equal(manualBestiary.find(template => template.id === 'rad_rat')?.naturalAttacks?.[1].weaponId, 'rad_rat_bite');
  assert.equal(manualBestiary.find(template => template.id === 'gecko')?.naturalAttacks?.[1].weaponId, 'gecko_bite');
  assert.deepEqual(computeModEffects(radRatBite).poisons, []);
  assert.deepEqual(computeModEffects(normalGeckoBite).poisons, []);
  assert.deepEqual(computeModEffects(fireGeckoBite).poisons.map(poison => poison.type), ['B']);
});