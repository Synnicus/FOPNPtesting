import { Weapon } from '@/context/types';

export const BUILT_IN_WEAPONS: Weapon[] = [
  // ─── Firearms ───────────────────────────────────────────────
  { id: 'w_10mm', name: '10mm Pistol', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 8, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_357_mag', name: '.357 Magnum', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 10, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_44_mag', name: '.44 Magnum', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 12, damageBonus: 1, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_hunting_rifle', name: 'Hunting Rifle', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 12, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_sniper_rifle', name: 'Sniper Rifle', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 12, damageBonus: 2, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_9mm_smg', name: '9mm SMG', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 0, burstLimit: 8, skill: 'firearms', isCustom: false },
  { id: 'w_assault_rifle', name: 'Assault Rifle', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 10, damageBonus: 0, burstLimit: 5, skill: 'firearms', isCustom: false },
  { id: 'w_combat_shotgun', name: 'Combat Shotgun', category: 'firearm', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 0, burstLimit: 3, skill: 'firearms', isCustom: false },
  { id: 'w_minigun', name: 'Minigun', category: 'firearm', damageType: 'normal', damageDieCount: 1, damageDie: 8, damageBonus: 0, burstLimit: 15, skill: 'firearms', isCustom: false },

  // ─── Energy Weapons ─────────────────────────────────────────
  { id: 'w_laser_pistol', name: 'Laser Pistol', category: 'energy', damageType: 'energy', damageDieCount: 1, damageDie: 10, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_plasma_pistol', name: 'Plasma Pistol', category: 'energy', damageType: 'energy', damageDieCount: 2, damageDie: 6, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_pulse_pistol', name: 'Pulse Pistol', category: 'energy', damageType: 'energy', damageDieCount: 1, damageDie: 8, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_laser_rifle', name: 'Laser Rifle', category: 'energy', damageType: 'energy', damageDieCount: 1, damageDie: 12, damageBonus: 0, burstLimit: 3, skill: 'firearms', isCustom: false },
  { id: 'w_plasma_rifle', name: 'Plasma Rifle', category: 'energy', damageType: 'energy', damageDieCount: 2, damageDie: 8, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },
  { id: 'w_gatling_laser', name: 'Gatling Laser', category: 'energy', damageType: 'energy', damageDieCount: 1, damageDie: 8, damageBonus: 0, burstLimit: 10, skill: 'firearms', isCustom: false },
  { id: 'w_tesla_cannon', name: 'Tesla Cannon', category: 'energy', damageType: 'energy', damageDieCount: 2, damageDie: 10, damageBonus: 0, burstLimit: 0, skill: 'firearms', isCustom: false },

  // ─── Melee ──────────────────────────────────────────────────
  { id: 'w_knife', name: 'Knife', category: 'melee', damageType: 'normal', damageDieCount: 1, damageDie: 4, damageBonus: 0, burstLimit: 0, skill: 'melee', isCustom: false },
  { id: 'w_combat_knife', name: 'Combat Knife', category: 'melee', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 0, burstLimit: 0, skill: 'melee', isCustom: false },
  { id: 'w_spear', name: 'Spear', category: 'melee', damageType: 'normal', damageDieCount: 1, damageDie: 8, damageBonus: 0, burstLimit: 0, skill: 'melee', isCustom: false },
  { id: 'w_baseball_bat', name: 'Baseball Bat', category: 'melee', damageType: 'normal', damageDieCount: 1, damageDie: 8, damageBonus: 0, burstLimit: 0, skill: 'melee', isCustom: false },
  { id: 'w_sledgehammer', name: 'Sledgehammer', category: 'melee', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 0, burstLimit: 0, skill: 'melee', isCustom: false },
  { id: 'w_ripper', name: 'Ripper', category: 'melee', damageType: 'normal', damageDieCount: 2, damageDie: 4, damageBonus: 0, burstLimit: 0, skill: 'melee', isCustom: false },
  { id: 'w_shishkebab', name: 'Shishkebab', category: 'melee', damageType: 'energy', damageDieCount: 1, damageDie: 8, damageBonus: 0, burstLimit: 0, skill: 'melee', isCustom: false },

  // ─── Unarmed ────────────────────────────────────────────────
  { id: 'w_fists', name: 'Bare Fists', category: 'unarmed', damageType: 'normal', damageDieCount: 1, damageDie: 2, damageBonus: 0, burstLimit: 0, skill: 'unarmed', isCustom: false },
  { id: 'w_brass_knuckles', name: 'Brass Knuckles', category: 'unarmed', damageType: 'normal', damageDieCount: 1, damageDie: 4, damageBonus: 0, burstLimit: 0, skill: 'unarmed', isCustom: false },
  { id: 'w_spiked_knuckles', name: 'Spiked Knuckles', category: 'unarmed', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 0, burstLimit: 0, skill: 'unarmed', isCustom: false },
  { id: 'w_power_fist', name: 'Power Fist', category: 'unarmed', damageType: 'normal', damageDieCount: 1, damageDie: 12, damageBonus: 0, burstLimit: 0, skill: 'unarmed', isCustom: false },
  { id: 'w_dc_gauntlet', name: 'Deathclaw Gauntlet', category: 'unarmed', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 0, burstLimit: 0, skill: 'unarmed', isCustom: false },
];

export const WEAPON_CATEGORIES: { label: string; value: WeaponCategory }[] = [
  { label: 'Firearm', value: 'firearm' },
  { label: 'Energy', value: 'energy' },
  { label: 'Melee', value: 'melee' },
  { label: 'Unarmed', value: 'unarmed' },
];

export const DAMAGE_TYPES: { label: string; value: DamageType }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Bio', value: 'bio' },
  { label: 'Energy', value: 'energy' },
];

import { WeaponCategory, DamageType } from '@/context/types';

export function formatWeaponDamage(w: Weapon): string {
  const bonus = w.damageBonus > 0 ? `+${w.damageBonus}` : w.damageBonus < 0 ? `${w.damageBonus}` : '';
  return `${w.damageDieCount}d${w.damageDie}${bonus}`;
}
