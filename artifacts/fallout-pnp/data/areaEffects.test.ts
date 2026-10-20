import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceAreaEffect,
  areaProfileRange,
  countdownStatus,
  areaDamageProfileToAttack,
  createCustomAmmoAreaDamageProfiles,
  createCustomWeaponAreaDamageProfile,
  EXPLOSIVE_AMMO_AREA_PROFILES,
  formatAreaResolution,
  normalizeAreaProfileRangeOverrides,
  resolveAreaTarget,
} from './areaEffects.ts';

const target = {
  id: 't1', name: 'Target', endurance: 5,
  gasInhaledResistance: 40, gasContactResistance: 10,
  electricityResistance: 30, dt: 5, dr: 20,
};

test('protection is applied independently to each AoE target', () => {
  const armored = resolveAreaTarget({ kind: 'explosion', rawDamage: 25 }, target);
  const unarmored = resolveAreaTarget({ kind: 'explosion', rawDamage: 25 }, { ...target, id: 't2', dt: 0, dr: 0 });
  assert.equal(armored.damage, 16);
  assert.equal(unarmored.damage, 25);
});

test('inhaled and contact gas use gas resistance and report exposure', () => {
  const inhaled = resolveAreaTarget({ kind: 'gasInhaled', rawDamage: 12 }, target, () => 20);
  const contact = resolveAreaTarget({ kind: 'gasContact', rawDamage: 12 }, target, () => 80);
  assert.equal(inhaled.damage, 0);
  assert.equal(inhaled.resisted, true);
  assert.equal(contact.damage, 12);
  assert.match(contact.notes.join(' '), /Contact exposure/);
});

test('electricity checks resistance then Endurance and rolls unconscious duration', () => {
  const dice = [8, 7];
  const result = resolveAreaTarget(
    { kind: 'electricity', rawDamage: 10 },
    target,
    () => 90,
    () => dice.shift()!,
  );
  assert.equal(result.damage, 7);
  assert.equal(result.enduranceRoll, 8);
  assert.equal(result.unconsciousRounds, 7);
});

test('electricity resistance reduces damage but never skips the Endurance check', () => {
  const result = resolveAreaTarget(
    { kind: 'electricity', rawDamage: 20 },
    { ...target, electricityResistance: 100 },
    () => 1,
    sides => sides === 10 ? 6 : 1,
  );
  assert.equal(result.damage, 0);
  assert.equal(result.enduranceRoll, 6);
  assert.ok(result.unconsciousRounds > 0);
});

test('electricity uses the supplied current effective Endurance', () => {
  const boosted = resolveAreaTarget(
    { kind: 'electricity', rawDamage: 10 },
    { ...target, endurance: 7 },
    () => 100,
    () => 6,
  );
  assert.equal(boosted.enduranceRoll, 6);
  assert.equal(boosted.unconsciousRounds, 0);
  assert.match(boosted.notes.join(' '), /Endurance 7/);
});

test('fire and acid always create persistent manual 1d6 ongoing effects', () => {
  const fire = resolveAreaTarget(
    { kind: 'flamethrower', rawDamage: 20, ongoingRounds: 0, gmAdjudicatedLanding: true },
    target,
  );
  const acid = resolveAreaTarget({ kind: 'acid', rawDamage: 20, ongoingRounds: 0 }, target);
  assert.deepEqual([fire.ongoing?.kind, fire.ongoing?.damageDie, fire.ongoing?.persistent], ['fire', 6, true]);
  assert.deepEqual([acid.ongoing?.kind, acid.ongoing?.damageDie, acid.ongoing?.persistent], ['acid', 6, true]);
  assert.match(fire.notes.join(' '), /chosen by GM/);
});

test('persistent acid survives round ticks until explicitly removed', () => {
  const acid = {
    id: 'acid', kind: 'acid' as const, name: 'Covered in Acid',
    persistent: true, damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'fire' as const,
  };
  assert.equal(advanceAreaEffect(acid), acid);
});

test('fire marked after a full-turn extinguish action ends after its final tick', () => {
  const fire = {
    id: 'fire', kind: 'fire' as const, name: 'On Fire',
    persistent: true, removeAfterTick: true,
    damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'fire' as const,
  };
  assert.equal(advanceAreaEffect(fire), null);
});

test('summary includes damage, unconsciousness, and ongoing duration', () => {
  const text = formatAreaResolution({
    targetId: 't1', targetName: 'Target', damage: 9, resisted: false,
    unconsciousRounds: 4,
    ongoing: { kind: 'fire', persistent: true, damageDieCount: 1, damageDie: 6, damageBonus: 0, damageType: 'fire' },
    notes: [],
  });
  assert.match(text, /9 damage/);
  assert.match(text, /unconscious 4 rounds/);
  assert.match(text, /fire \(1d6\/round until removed\)/);
});

test('unconscious and ongoing counters expire automatically without going negative', () => {
  assert.deepEqual(countdownStatus(2, true), { roundsLeft: 1, isActive: true });
  assert.deepEqual(countdownStatus(1, true), { roundsLeft: 0, isActive: false });
  assert.deepEqual(countdownStatus(0, true), { roundsLeft: 0, isActive: false });
});

test('blast range overrides normalize malformed values and never replace printed distances', () => {
  assert.deepEqual(normalizeAreaProfileRangeOverrides(undefined), {});
  assert.deepEqual(normalizeAreaProfileRangeOverrides({
    'ammo:rocket_explosive': { main: 45, invalid: -1, fractional: 2.5, tooLarge: 100001, text: 'far' },
    broken: null,
  }), { 'ammo:rocket_explosive': { main: 45 } });

  const manualProfile = EXPLOSIVE_AMMO_AREA_PROFILES.find(profile => profile.id === 'ammo:51mm_explosive_mortar')!;
  assert.equal(areaProfileRange(manualProfile, manualProfile.effects[0], {
    'ammo:51mm_explosive_mortar': { main: 999 },
  }), 20);
});

test('EMP explosive profiles are marked non-biological and preserve EMP behavior when opened', () => {
  for (const id of ['ammo:rocket_emp', 'ammo:40mm_pulse']) {
    assert.equal(EXPLOSIVE_AMMO_AREA_PROFILES.some(candidate => candidate.id === id), false, `${id} has no manual blast radius`);
  }
  const profile = EXPLOSIVE_AMMO_AREA_PROFILES.find(candidate => candidate.id === 'ammo:60mm_pulse_mortar');
  assert.ok(profile, 'the manual-ranged EMP mortar remains available');
  assert.equal(profile.emp, true);
  assert.equal(profile.nonBiologicalOnly, true);
  const attack = areaDamageProfileToAttack(profile);

  assert.equal(attack.emp, true);
  assert.equal(attack.nonBiologicalOnly, true);
});

test('custom EMP ammunition and mine profiles preserve EMP behavior when resolved', () => {
  const blast = {
    id: 'blast',
    label: 'Pulse blast',
    kind: 'explosion' as const,
    damageType: 'explosion' as const,
    damageDieCount: 1,
    damageDie: 6,
    damageBonus: 0,
    radius: 4,
  };
  const customAmmo = {
    id: 'custom-pulse',
    name: 'Custom Pulse Charge',
    value: 0,
    acMod: 0,
    drMod: 0,
    dmgDieCount: 1,
    dmgDie: 6,
    dmgBonus: 0,
    volume: 0,
    components: [{ id: 'damage', label: 'Damage', type: 'explosion' as const, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0 }],
    areaEffects: [blast],
    hasBlastRadius: true,
    emp: true,
    isCustom: true,
  };
  const ammoProfile = createCustomAmmoAreaDamageProfiles([customAmmo])[0];
  assert.equal(ammoProfile?.emp, true);
  assert.equal(areaDamageProfileToAttack(ammoProfile!).emp, true);
  assert.equal(areaProfileRange(ammoProfile!, ammoProfile!.effects[0], {}), 4);
  assert.equal(createCustomAmmoAreaDamageProfiles([{ ...customAmmo, hasBlastRadius: false }]).length, 0);

  const customMine = {
    id: 'custom-pulse-mine',
    name: 'Pulse Mine',
    category: 'minesTraps' as const,
    damageType: 'explosion' as const,
    damageDieCount: 1,
    damageDie: 6,
    damageBonus: 0,
    skill: 'traps' as const,
    burstLimit: 1,
    isDoubleShot: false,
    magazineSize: 0,
    weight: 0,
    minStr: 0,
    rangeNormal: 0,
    knockdownChance: 0,
    mods: [],
    isCustom: true,
    customAreaEffects: [blast],
    hasBlastRadius: true,
    emp: true,
  };

  const mineProfile = createCustomWeaponAreaDamageProfile(customMine);
  assert.equal(mineProfile?.emp, true);
  assert.equal(areaDamageProfileToAttack(mineProfile!).emp, true);
  assert.equal(areaProfileRange(mineProfile!, mineProfile!.effects[0], {}), 4);
  assert.equal(createCustomWeaponAreaDamageProfile({ ...customMine, hasBlastRadius: false }), undefined);
});
