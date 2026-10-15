import assert from 'node:assert/strict';
import test from 'node:test';
import { AMMO_TYPES } from './ammo.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';

// Damage dice, flat bonuses, and exceptional damage text transcribed from the
// printed Ammunition pages 101–103. TOW-II damage is listed on its weapon entry,
// not on the ammunition page, so the rocket contributes no additional damage.
const MANUAL_AMMO_DAMAGE: Record<string, readonly [dice: number, die: number, bonus: number, note: string | null]> = {
  bb: [1, 4, 0, null],
  arrow: [1, 4, 0, null],
  dart: [1, 3, 0, null],
  bolt: [1, 6, 0, null],
  speargun_bolt: [3, 4, 0, null],
  '22': [1, 6, 0, null],
  '223_fmj': [1, 10, 0, null],
  '223_ap': [1, 6, 0, null],
  '2mm_ec': [1, 10, 0, null],
  '47mm_caseless': [1, 10, 0, null],
  '5mm': [1, 8, 0, null],
  '308': [1, 10, 0, null],
  '556mm': [1, 8, 0, null],
  '357_magnum': [1, 6, 0, null],
  '762mm': [1, 10, 0, null],
  '38': [1, 6, 0, null],
  '44_magnum_jhp': [1, 8, 0, null],
  '765mm': [1, 8, 0, null],
  '44_magnum_ap': [1, 6, 0, null],
  '9mm_jhp': [1, 6, 0, null],
  '45': [1, 6, 0, null],
  '9mm_ap': [1, 4, 0, null],
  '50': [1, 8, 0, null],
  '9mm_ball': [1, 6, 0, null],
  '50_uc': [1, 8, 0, null],
  '10mm_jhp': [1, 6, 0, null],
  '50_bmg': [1, 6, 0, null],
  '10mm_ap': [1, 4, 0, null],
  '14mm_jhp': [1, 10, 0, null],
  '14mm_ap': [1, 8, 0, null],
  '12ga_buckshot': [1, 10, 0, null],
  '12ga_slugs': [1, 8, 0, null],
  '12ga_emp': [2, 20, 0, 'Non-biological targets only.'],
  '12ga_rubber': [1, 4, 0, null],
  hn_needler: [3, 10, 0, null],
  hn_needler_ap: [2, 8, 0, null],
  hn_needler_poison: [0, 0, 0, 'Poison Type G.'],
  hn_needler_biotoxin: [1, 10, 0, '1d10 per round for 10 rounds.'],
  rocket_explosive: [6, 8, 0, null],
  rocket_ap: [6, 6, 0, null],
  rocket_emp: [3, 20, 0, 'Non-biological targets only.'],
  tow_ii_rocket: [0, 0, 0, 'Damage is listed on the TOW-II Missile Defense System, not the rocket.'],
  '40mm_frag': [1, 12, 22, '1d6 Conc., 1d6 Frag.'],
  '40mm_plasma': [5, 10, 40, '1d6 Conc.'],
  '40mm_pulse': [5, 10, 100, 'Non-biological targets only.'],
  '51mm_explosive_mortar': [10, 10, 0, '10d10 within 20m; 1d6 concussion within 50m.'],
  '51mm_gas_mortar': [7, 10, 0, '7d10 + unconsciousness to all within 100m.'],
  '60mm_explosive_mortar': [10, 10, 0, '10d10 within 20m; 1d6 concussion within 50m.'],
  '60mm_plasma_mortar': [10, 20, 0, '10d20 to everything within 20m.'],
  '60mm_pulse_mortar': [20, 20, 0, '20d20 to non-biological things within 20m.'],
  flamer_fire_pack: [3, 8, 0, 'Plus fire.'],
  flamer_plasma_pack: [5, 10, 40, null],
  flamer_poison_gas_pack: [0, 0, 0, 'Poison Type F to all non-protected critters in 4 hexes of stream.'],
  small_energy_cell: [0, 0, 0, 'Recharges the weapon; no inherent damage dice.'],
  micro_fusion_cell: [0, 0, 0, 'Recharges the weapon; no inherent damage dice.'],
};

test('every built-in ammo damage contribution and special note matches manual pages 101–103', () => {
  assert.equal(Object.keys(MANUAL_AMMO_DAMAGE).length, AMMO_TYPES.length);
  assert.deepEqual(
    AMMO_TYPES.map(ammo => ammo.id).sort(),
    Object.keys(MANUAL_AMMO_DAMAGE).sort(),
    'the manual fixture must cover exactly the built-in ammo catalog',
  );

  for (const ammo of AMMO_TYPES) {
    assert.deepEqual(
      [ammo.dmgDieCount, ammo.dmgDie, ammo.dmgBonus, ammo.notes ?? null],
      MANUAL_AMMO_DAMAGE[ammo.id],
      `${ammo.name}: manual damage dice, flat bonus, and special note`,
    );
  }
});

test('TOW-II rocket does not repeat damage already printed on its launcher', () => {
  const rocket = AMMO_TYPES.find(ammo => ammo.id === 'tow_ii_rocket');
  const launcher = BUILT_IN_WEAPONS.find(weapon => weapon.id === 'tow_ii_missile_defense_system');
  assert.ok(rocket);
  assert.ok(launcher);

  assert.deepEqual([rocket.dmgDieCount, rocket.dmgDie, rocket.dmgBonus], [0, 0, 0]);
  assert.deepEqual([launcher.damageDieCount, launcher.damageDie, launcher.damageBonus], [10, 10, 200]);
});
