import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AMMO_TYPES,
  describeAmmoAccuracyModifier,
  getAmmoById,
  type AmmoType,
} from './ammo.ts';
import {
  describeAmmoProtectionModifier,
  resolveDamageProtection,
} from './attackResolution.ts';

// Target-AC, target-DR, and DT-bypass values transcribed from the manual's
// printed Ammunition pages 101–103. N/A entries are represented as zero
// modifiers because they have no applicable target-protection effect.
const MANUAL_AMMO_PROTECTION: Record<string, readonly [ac: number, dr: number, ignoresDT: boolean]> = {
  bb: [0, 0, false],
  arrow: [0, 0, false],
  dart: [0, 0, false],
  bolt: [0, 0, false],
  speargun_bolt: [-10, 0, false],
  '22': [0, 0, false],
  '223_fmj': [0, -10, false],
  '223_ap': [-15, 0, true],
  '2mm_ec': [-20, -20, false],
  '47mm_caseless': [-10, -10, false],
  '5mm': [0, 0, false],
  '308': [-15, -20, false],
  '556mm': [0, -20, false],
  '357_magnum': [-10, -10, false],
  '762mm': [0, 0, false],
  '38': [0, 0, false],
  '44_magnum_jhp': [0, -10, false],
  '765mm': [0, 0, false],
  '44_magnum_ap': [-10, 0, true],
  '9mm_jhp': [0, -10, false],
  '45': [0, -5, false],
  '9mm_ap': [-10, 0, true],
  '50': [-10, -10, false],
  '9mm_ball': [0, -10, false],
  '50_uc': [-30, -50, false],
  '10mm_jhp': [0, -10, false],
  '50_bmg': [-10, -20, false],
  '10mm_ap': [-10, 0, true],
  '14mm_jhp': [0, -20, false],
  '14mm_ap': [-20, 0, true],
  '12ga_buckshot': [0, 0, false],
  '12ga_slugs': [0, 0, false],
  '12ga_emp': [0, 0, false],
  '12ga_rubber': [0, 0, false],
  hn_needler: [0, 0, false],
  hn_needler_ap: [0, 0, true],
  hn_needler_poison: [0, 0, false],
  hn_needler_biotoxin: [0, 0, false],
  rocket_explosive: [0, 0, false],
  rocket_ap: [-10, 0, true],
  rocket_emp: [0, 0, false],
  tow_ii_rocket: [-20, -20, true],
  '40mm_frag': [0, 0, false],
  '40mm_plasma': [0, 0, false],
  '40mm_pulse': [0, 0, false],
  '51mm_explosive_mortar': [0, 0, false],
  '51mm_gas_mortar': [0, 0, false],
  '60mm_explosive_mortar': [0, 0, false],
  '60mm_plasma_mortar': [0, 0, false],
  '60mm_pulse_mortar': [0, 0, false],
  flamer_fire_pack: [0, -10, false],
  flamer_plasma_pack: [-10, -10, false],
  flamer_poison_gas_pack: [0, 0, false],
  small_energy_cell: [0, 0, false],
  micro_fusion_cell: [0, 0, false],
};

test('every built-in ammo AC, DR, and DT-bypass modifier matches manual pages 101–103', () => {
  assert.equal(Object.keys(MANUAL_AMMO_PROTECTION).length, AMMO_TYPES.length);
  assert.deepEqual(
    AMMO_TYPES.map(ammo => ammo.id).sort(),
    Object.keys(MANUAL_AMMO_PROTECTION).sort(),
    'the manual fixture must cover exactly the built-in ammo catalog',
  );

  for (const ammo of AMMO_TYPES) {
    const [ac, dr, ignoresDT] = MANUAL_AMMO_PROTECTION[ammo.id];
    assert.deepEqual(
      [ammo.acMod, ammo.drMod, !!ammo.ignoresDT],
      [ac, dr, ignoresDT],
      `${ammo.name}: manual target AC / target DR / Ignores DT`,
    );
  }
});

test('ammo AC is explained separately with its opposite chance-to-hit adjustment', () => {
  const apAmmo = getAmmoById('10mm_ap');
  assert.ok(apAmmo);
  assert.deepEqual(describeAmmoAccuracyModifier(apAmmo), {
    category: 'AP Ammo',
    chanceToHitAdjustment: 10,
    targetACModifier: -10,
    adjustmentText: '+10% chance to hit · target AC -10',
  });

  const customPositiveAC: Pick<AmmoType, 'name' | 'acMod' | 'ignoresDT'> = {
    name: 'Custom ammo',
    acMod: 10,
    ignoresDT: false,
  };
  assert.deepEqual(describeAmmoAccuracyModifier(customPositiveAC), {
    category: 'Ammo',
    chanceToHitAdjustment: -10,
    targetACModifier: 10,
    adjustmentText: '-10% chance to hit · target AC +10',
  });
  assert.equal(describeAmmoAccuracyModifier({ name: '5mm', acMod: 0 }), null);
  assert.equal(describeAmmoAccuracyModifier(undefined), null);
});

test('damage explanation names ammo DT bypass and DR changes, then reports effective protection', () => {
  const apAmmo = getAmmoById('10mm_ap');
  assert.ok(apAmmo);
  const apProtection = resolveDamageProtection({
    baseDT: 6,
    baseDR: 35,
    ammoIgnoresDT: apAmmo.ignoresDT,
    ammoDRModifier: apAmmo.drMod,
  });
  assert.equal(
    describeAmmoProtectionModifier(apProtection, apAmmo.name),
    'Ammo — 10mm AP: ignores DT (6 → 0)',
  );
  assert.deepEqual([apProtection.effectiveDT, apProtection.effectiveDR], [0, 35]);

  const customPositiveDR = resolveDamageProtection({
    baseDT: 4,
    baseDR: 30,
    ammoDRModifier: 10,
    damageResistanceCap: 100,
  });
  assert.equal(
    describeAmmoProtectionModifier(customPositiveDR, 'Custom ammo'),
    'Ammo — Custom ammo: DR +10%',
  );
  assert.deepEqual([customPositiveDR.effectiveDT, customPositiveDR.effectiveDR], [4, 40]);

  const combined = resolveDamageProtection({
    baseDT: 8,
    baseDR: 50,
    ammoIgnoresDT: true,
    ammoDRModifier: -20,
    damageResistanceCap: 100,
  });
  assert.equal(
    describeAmmoProtectionModifier(combined, 'TOW-II Rocket'),
    'Ammo — TOW-II Rocket: ignores DT (8 → 0) · DR -20%',
  );
  assert.deepEqual([combined.effectiveDT, combined.effectiveDR], [0, 30]);
});

test('neutral ammo has no separate protection line and leaves effective DT/DR unchanged', () => {
  const neutralAmmo = getAmmoById('5mm');
  assert.ok(neutralAmmo);
  const protection = resolveDamageProtection({
    baseDT: 4,
    baseDR: 25,
    ammoIgnoresDT: neutralAmmo.ignoresDT,
    ammoDRModifier: neutralAmmo.drMod,
  });
  assert.equal(describeAmmoProtectionModifier(protection, neutralAmmo.name), null);
  assert.deepEqual([protection.effectiveDT, protection.effectiveDR], [4, 25]);
});
