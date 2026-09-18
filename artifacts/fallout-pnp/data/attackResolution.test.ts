import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDefensivePerkBonuses, resolveAttackWeapon, resolveDamagePipeline, resolveDamageProtection } from './attackResolution.ts';
import { getAmmoById } from './ammo.ts';
import { resolveArmorAwareSheet } from './armorEffects.ts';
import { UNCONDITIONAL_ARMOR_CLASS_PERKS } from './unconditionalArmorClassPerks.ts';

const special = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };
const skills = {
  smallGuns: 25, bigGuns: 10, energyWeapons: 10, meleeWeapons: 20, unarmed: 20, throwing: 20,
  firstAid: 20, doctor: 10, sneak: 20, lockpick: 20, steal: 15, traps: 20,
  science: 20, repair: 15, speech: 25, barter: 20, gambling: 25, outdoorsman: 20, pilot: 20,
};
const staticArmorClassPerkDefinitions = {
  dodger: { id: 'dodger', name: 'Dodger', combatEffect: { ...UNCONDITIONAL_ARMOR_CLASS_PERKS.dodger, combatNote: '+5 AC per rank' } },
  tough_hide: { id: 'tough_hide', name: 'Tough Hide', combatEffect: { ...UNCONDITIONAL_ARMOR_CLASS_PERKS.tough_hide, combatNote: '+15 AC, +10% all resistances per rank' } },
  cyborg_systems: { id: 'cyborg_systems', name: 'Cyborg Systems', combatEffect: { ...UNCONDITIONAL_ARMOR_CLASS_PERKS.cyborg_systems, damageResistBonus: 10, combatNote: '+10% DR, +5 AC per rank' } },
} as const;
const situationalArmorClassPerkDefinitions = {
  deathclaw_rampage: { id: 'deathclaw_rampage', name: 'Deathclaw Rampage', combatEffect: { armorClassBonus: 5, combatNote: '+6 melee dmg, +5 AC when HP < 50%' } },
} as const;
const perkDefinitions = {
  ...staticArmorClassPerkDefinitions,
  ...situationalArmorClassPerkDefinitions,
} as const;
const getPerk = (id: string) => perkDefinitions[id as keyof typeof perkDefinitions];

function resolvedCombatAc(perks: Array<{ perkId: string; rank: number }>, currentHp = 100, maxHp = 100): number {
  const sheet = resolveArmorAwareSheet({ special, skills, perks, allArmor: [] });
  return sheet.armorClass + computeDefensivePerkBonuses({ perks, currentHp, maxHp }, undefined, getPerk).ac;
}

test('an explicitly selected held weapon is authoritative for the attack session', () => {
  const primary = { id: 'primary', damageType: 'normal', damageDie: 6 };
  const offhand = { id: 'offhand', damageType: 'laser', damageDie: 10 };

  assert.equal(resolveAttackWeapon(primary, null, [primary, offhand]), primary);
  assert.equal(resolveAttackWeapon(primary, offhand.id, [primary, offhand]), offhand);
});

test('a stale attack weapon selection falls back to the active weapon', () => {
  const primary = { id: 'primary' };
  assert.equal(resolveAttackWeapon(primary, 'no-longer-held', [primary]), primary);
});

test('physical initial damage is multiplied before DT and DR are applied', () => {
  assert.deepEqual(
    resolveDamagePipeline({
      initialDiceDamage: 10,
      flatDamageBonus: 2,
      criticalMultiplier: 2,
      damageThreshold: 4,
      damageResistance: 25,
    }),
    {
      baseDamage: 24,
      afterDamageThreshold: 20,
      finalDamage: 15,
    },
  );
});

test('manual creature damage can preserve printed DR above the normal 90% cap', () => {
  assert.deepEqual(
    resolveDamagePipeline({
      initialDiceDamage: 100,
      flatDamageBonus: 0,
      criticalMultiplier: 1,
      damageThreshold: 0,
      damageResistance: 95,
      damageResistanceCap: 100,
    }),
    {
      baseDamage: 100,
      afterDamageThreshold: 100,
      finalDamage: 5,
    },
  );
});

test('flamer fuel explains the Sentry Bot fire DR reduction without changing its base protection', () => {
  const firePack = getAmmoById('flamer_fire_pack');
  assert.ok(firePack);
  assert.deepEqual(
    resolveDamageProtection({
      baseDT: 8,
      baseDR: 40,
      ammoIgnoresDT: firePack.ignoresDT,
      ammoDRModifier: firePack.drMod,
      damageResistanceCap: 100,
    }),
    {
      baseDT: 8,
      baseDR: 40,
      ammoIgnoresDT: false,
      ammoDRModifier: -10,
      ignoredDT: 0,
      defenderDRModifier: 0,
      effectiveDT: 8,
      effectiveDR: 30,
      bypassesArmor: false,
    },
  );
});

test('armor-piercing ammo reports DT bypass while preserving base DT for the explanation', () => {
  const armorPiercing = getAmmoById('10mm_ap');
  assert.ok(armorPiercing);
  const protection = resolveDamageProtection({
    baseDT: 6,
    baseDR: 35,
    ammoIgnoresDT: armorPiercing.ignoresDT,
    ammoDRModifier: armorPiercing.drMod,
  });

  assert.equal(protection.baseDT, 6);
  assert.equal(protection.ammoIgnoresDT, true);
  assert.equal(protection.effectiveDT, 0);
  assert.equal(protection.effectiveDR, 35);
});

test('neutral ammo leaves effective protection unchanged and has no modifier values', () => {
  const neutralAmmo = getAmmoById('5mm');
  assert.ok(neutralAmmo);
  const protection = resolveDamageProtection({
    baseDT: 4,
    baseDR: 25,
    ammoIgnoresDT: neutralAmmo.ignoresDT,
    ammoDRModifier: neutralAmmo.drMod,
  });

  assert.equal(protection.ammoIgnoresDT, false);
  assert.equal(protection.ammoDRModifier, 0);
  assert.equal(protection.effectiveDT, protection.baseDT);
  assert.equal(protection.effectiveDR, protection.baseDR);
});

test('combat attack resolution counts one Dodger rank as exactly +5 AC', () => {
  assert.equal(resolvedCombatAc([{ perkId: 'dodger', rank: 1 }]), 10);
});

test('static combat AC perk fixtures match the shared unconditional rules', () => {
  for (const perkId of Object.keys(UNCONDITIONAL_ARMOR_CLASS_PERKS) as Array<keyof typeof UNCONDITIONAL_ARMOR_CLASS_PERKS>) {
    assert.equal(
      staticArmorClassPerkDefinitions[perkId].combatEffect.armorClassBonus,
      UNCONDITIONAL_ARMOR_CLASS_PERKS[perkId].armorClassBonus,
      `${perkId} combat fixture must use the shared unconditional AC bonus`,
    );
  }
});

test('combat attack resolution counts ranked static AC perks exactly once', () => {
  assert.equal(resolvedCombatAc([{ perkId: 'dodger', rank: 2 }]), 15);
  assert.equal(resolvedCombatAc([{ perkId: 'tough_hide', rank: 2 }]), 35);
  assert.equal(resolvedCombatAc([{ perkId: 'cyborg_systems', rank: 2 }]), 15);
});

test('HP-conditional AC remains combat-only and activates strictly below half HP', () => {
  const perks = [{ perkId: 'deathclaw_rampage', rank: 1 }];
  const sheet = resolveArmorAwareSheet({ special, skills, perks, allArmor: [] });

  assert.equal(sheet.armorClass, 5);
  assert.equal(resolvedCombatAc(perks, 50, 100), 5);
  assert.equal(resolvedCombatAc(perks, 49, 100), 10);
});