import { Weapon, DamageType, WeaponCategory, SkillType } from '@/context/types';

export const CONDITION_MAX = 5;

export const WEAPON_CATEGORIES: Record<string, WeaponCategory> = {
  'Small Guns': 'smallGuns',
  'Big Guns': 'bigGuns',
  'Energy Weapons': 'energyWeapons',
  'Melee Weapons': 'meleeWeapons',
  'Unarmed': 'unarmed',
  'Throwing': 'throwing',
  'Natural': 'natural',
};

export const DAMAGE_TYPES: Record<string, DamageType> = {
  'Normal (N)': 'normal',
  'Laser (L)': 'laser',
  'Fire (F)': 'fire',
  'Plasma (P)': 'plasma',
  'Explosion (E)': 'explosion',
};

export const WEAPON_MODS = [
  { id: 'scope', name: 'Scope', toHitBonus: 15, damageBonus: 0, rangeBonus: 5, description: '+15% to-hit at range, +5 range squares' },
  { id: 'silencer', name: 'Silencer', toHitBonus: 0, damageBonus: 0, rangeBonus: 0, description: 'Silent fire, no noise alerts' },
  { id: 'extended_mag', name: 'Extended Magazine', toHitBonus: 0, damageBonus: 0, rangeBonus: 0, description: '+50% magazine capacity' },
  { id: 'laser_sight', name: 'Laser Sight', toHitBonus: 10, damageBonus: 0, rangeBonus: 0, description: '+10% to-hit in normal light' },
  { id: 'sharpened', name: 'Sharpened Blade', toHitBonus: 5, damageBonus: 2, rangeBonus: 0, description: '+5% to-hit, +2 damage (melee)' },
  { id: 'weighted', name: 'Weighted Head', toHitBonus: 0, damageBonus: 3, rangeBonus: 0, description: '+3 damage (melee blunt)' },
  { id: 'ammo_type_ap', name: 'AP Ammo', toHitBonus: 0, damageBonus: 0, rangeBonus: 0, description: 'Armour piercing: ignore 5 DT' },
  { id: 'ammo_type_jhp', name: 'JHP Ammo', toHitBonus: 0, damageBonus: 4, rangeBonus: 0, description: '+4 damage vs unarmoured' },
  { id: 'bipod', name: 'Bipod', toHitBonus: 20, damageBonus: 0, rangeBonus: 3, description: '+20% to-hit and +3 range when prone' },
];

export const MOD_TO_HIT_BONUS: Record<string, number> = {};
export const MOD_DAMAGE_BONUS: Record<string, number> = {};
WEAPON_MODS.forEach(m => {
  MOD_TO_HIT_BONUS[m.id] = m.toHitBonus;
  MOD_DAMAGE_BONUS[m.id] = m.damageBonus;
});

export const BUILT_IN_WEAPONS: Weapon[] = [
  // ─── SMALL GUNS ────────────────────────────────────────────────────────────
  { id: 'pipe_pistol', name: 'Pipe Pistol', category: 'smallGuns', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 1, skill: 'smallGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 6, weight: 3, minStr: 3, rangeNormal: 10, knockdownChance: 0, mods: [], isCustom: false },
  { id: '10mm_pistol', name: '10mm Pistol', category: 'smallGuns', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 3, skill: 'smallGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 12, weight: 3, minStr: 3, rangeNormal: 15, knockdownChance: 0, mods: [], isCustom: false },
  { id: '10mm_smg', name: '10mm SMG', category: 'smallGuns', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 3, skill: 'smallGuns', burstLimit: 5, isDoubleShot: false, magazineSize: 30, weight: 5, minStr: 4, rangeNormal: 12, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'desert_eagle', name: 'Desert Eagle', category: 'smallGuns', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 2, skill: 'smallGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 8, weight: 4, minStr: 4, rangeNormal: 20, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'magnum_revolver', name: '.44 Magnum Revolver', category: 'smallGuns', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 4, skill: 'smallGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 6, weight: 4, minStr: 5, rangeNormal: 18, knockdownChance: 10, mods: [], isCustom: false },
  { id: 'shotgun', name: 'Shotgun', category: 'smallGuns', damageType: 'normal', damageDieCount: 3, damageDie: 8, damageBonus: 0, skill: 'smallGuns', burstLimit: 1, isDoubleShot: true, magazineSize: 8, weight: 6, minStr: 5, rangeNormal: 10, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'combat_shotgun', name: 'Combat Shotgun', category: 'smallGuns', damageType: 'normal', damageDieCount: 3, damageDie: 8, damageBonus: 2, skill: 'smallGuns', burstLimit: 4, isDoubleShot: false, magazineSize: 12, weight: 7, minStr: 5, rangeNormal: 10, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'hunting_rifle', name: 'Hunting Rifle', category: 'smallGuns', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 5, skill: 'smallGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 5, weight: 7, minStr: 5, rangeNormal: 30, knockdownChance: 10, mods: [], isCustom: false },
  { id: 'sniper_rifle', name: 'Sniper Rifle', category: 'smallGuns', damageType: 'normal', damageDieCount: 2, damageDie: 10, damageBonus: 5, skill: 'smallGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 8, weight: 9, minStr: 6, rangeNormal: 50, knockdownChance: 10, mods: [], isCustom: false },
  { id: 'assault_rifle', name: 'Assault Rifle', category: 'smallGuns', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 2, skill: 'smallGuns', burstLimit: 8, isDoubleShot: false, magazineSize: 24, weight: 8, minStr: 5, rangeNormal: 25, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'hk_caws', name: 'HK CAWS', category: 'smallGuns', damageType: 'normal', damageDieCount: 4, damageDie: 8, damageBonus: 2, skill: 'smallGuns', burstLimit: 5, isDoubleShot: false, magazineSize: 10, weight: 9, minStr: 6, rangeNormal: 12, knockdownChance: 25, mods: [], isCustom: false },
  { id: 'fn_fal', name: 'FN FAL', category: 'smallGuns', damageType: 'normal', damageDieCount: 2, damageDie: 10, damageBonus: 2, skill: 'smallGuns', burstLimit: 5, isDoubleShot: false, magazineSize: 20, weight: 9, minStr: 6, rangeNormal: 28, knockdownChance: 10, mods: [], isCustom: false },

  // ─── BIG GUNS ──────────────────────────────────────────────────────────────
  { id: 'flamer', name: 'Flamer', category: 'bigGuns', damageType: 'fire', damageDieCount: 3, damageDie: 8, damageBonus: 0, skill: 'bigGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 10, weight: 15, minStr: 7, rangeNormal: 5, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'improved_flamer', name: 'Improved Flamer', category: 'bigGuns', damageType: 'fire', damageDieCount: 4, damageDie: 8, damageBonus: 5, skill: 'bigGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 10, weight: 15, minStr: 7, rangeNormal: 6, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'minigun', name: 'Minigun', category: 'bigGuns', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 2, skill: 'bigGuns', burstLimit: 12, isDoubleShot: false, magazineSize: 120, weight: 28, minStr: 7, rangeNormal: 20, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'rocket_launcher', name: 'Rocket Launcher', category: 'bigGuns', damageType: 'explosion', damageDieCount: 8, damageDie: 10, damageBonus: 10, skill: 'bigGuns', burstLimit: 1, isDoubleShot: false, magazineSize: 1, weight: 22, minStr: 6, rangeNormal: 35, knockdownChance: 50, mods: [], isCustom: false },
  { id: 'bozar', name: 'Bozar', category: 'bigGuns', damageType: 'normal', damageDieCount: 3, damageDie: 10, damageBonus: 5, skill: 'bigGuns', burstLimit: 8, isDoubleShot: false, magazineSize: 30, weight: 22, minStr: 7, rangeNormal: 35, knockdownChance: 15, mods: [], isCustom: false },
  { id: 'light_support_weapon', name: 'Light Support Weapon', category: 'bigGuns', damageType: 'normal', damageDieCount: 2, damageDie: 10, damageBonus: 5, skill: 'bigGuns', burstLimit: 10, isDoubleShot: false, magazineSize: 50, weight: 18, minStr: 6, rangeNormal: 30, knockdownChance: 10, mods: [], isCustom: false },
  { id: 'm60', name: 'M60 Machine Gun', category: 'bigGuns', damageType: 'normal', damageDieCount: 2, damageDie: 10, damageBonus: 0, skill: 'bigGuns', burstLimit: 10, isDoubleShot: false, magazineSize: 50, weight: 20, minStr: 6, rangeNormal: 28, knockdownChance: 10, mods: [], isCustom: false },

  // ─── ENERGY WEAPONS ────────────────────────────────────────────────────────
  { id: 'laser_pistol', name: 'Laser Pistol', category: 'energyWeapons', damageType: 'laser', damageDieCount: 2, damageDie: 6, damageBonus: 0, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 12, weight: 3, minStr: 3, rangeNormal: 25, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'magneto_laser', name: 'Magneto-Laser Pistol', category: 'energyWeapons', damageType: 'laser', damageDieCount: 2, damageDie: 6, damageBonus: 3, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 12, weight: 3, minStr: 3, rangeNormal: 28, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'laser_rifle', name: 'Laser Rifle', category: 'energyWeapons', damageType: 'laser', damageDieCount: 4, damageDie: 8, damageBonus: 0, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 12, weight: 9, minStr: 6, rangeNormal: 40, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'plasma_pistol', name: 'Plasma Pistol', category: 'energyWeapons', damageType: 'plasma', damageDieCount: 3, damageDie: 6, damageBonus: 0, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 16, weight: 4, minStr: 4, rangeNormal: 15, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'plasma_rifle', name: 'Plasma Rifle', category: 'energyWeapons', damageType: 'plasma', damageDieCount: 5, damageDie: 8, damageBonus: 0, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 16, weight: 11, minStr: 6, rangeNormal: 25, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'turbo_plasma', name: 'Turbo Plasma Rifle', category: 'energyWeapons', damageType: 'plasma', damageDieCount: 5, damageDie: 10, damageBonus: 5, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 16, weight: 11, minStr: 6, rangeNormal: 30, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'gatling_laser', name: 'Gatling Laser', category: 'energyWeapons', damageType: 'laser', damageDieCount: 4, damageDie: 8, damageBonus: 0, skill: 'energyWeapons', burstLimit: 8, isDoubleShot: false, magazineSize: 30, weight: 20, minStr: 6, rangeNormal: 35, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'pulse_pistol', name: 'Pulse Pistol', category: 'energyWeapons', damageType: 'laser', damageDieCount: 4, damageDie: 8, damageBonus: 8, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 10, weight: 5, minStr: 4, rangeNormal: 12, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'pulse_rifle', name: 'Pulse Rifle', category: 'energyWeapons', damageType: 'laser', damageDieCount: 4, damageDie: 10, damageBonus: 12, skill: 'energyWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 10, weight: 12, minStr: 6, rangeNormal: 30, knockdownChance: 0, mods: [], isCustom: false },

  // ─── THROWING ──────────────────────────────────────────────────────────────
  { id: 'throwing_knife', name: 'Throwing Knife', category: 'throwing', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 2, skill: 'throwing', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 1, minStr: 3, rangeNormal: 8, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'frag_grenade', name: 'Frag Grenade', category: 'throwing', damageType: 'explosion', damageDieCount: 4, damageDie: 8, damageBonus: 0, skill: 'throwing', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 1, minStr: 4, rangeNormal: 10, knockdownChance: 40, mods: [], isCustom: false },
  { id: 'plasma_grenade', name: 'Plasma Grenade', category: 'throwing', damageType: 'plasma', damageDieCount: 6, damageDie: 8, damageBonus: 5, skill: 'throwing', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 1, minStr: 4, rangeNormal: 10, knockdownChance: 30, mods: [], isCustom: false },
  { id: 'incendiary_grenade', name: 'Incendiary Grenade', category: 'throwing', damageType: 'fire', damageDieCount: 3, damageDie: 8, damageBonus: 0, skill: 'throwing', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 1, minStr: 4, rangeNormal: 10, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'molotov', name: 'Molotov Cocktail', category: 'throwing', damageType: 'fire', damageDieCount: 2, damageDie: 6, damageBonus: 0, skill: 'throwing', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 2, minStr: 3, rangeNormal: 8, knockdownChance: 10, mods: [], isCustom: false },

  // ─── MELEE WEAPONS ────────────────────────────────────────────────────────
  { id: 'knife', name: 'Knife', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 1, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 1, minStr: 2, rangeNormal: 1, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'combat_knife', name: 'Combat Knife', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 0, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 2, minStr: 3, rangeNormal: 1, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'baseball_bat', name: 'Baseball Bat', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 2, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 4, minStr: 4, rangeNormal: 1, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'lead_pipe', name: 'Lead Pipe', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 2, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 5, minStr: 4, rangeNormal: 1, knockdownChance: 25, mods: [], isCustom: false },
  { id: 'crowbar', name: 'Crowbar', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 4, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 5, minStr: 4, rangeNormal: 1, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'fire_axe', name: 'Fire Axe', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 3, damageDie: 8, damageBonus: 2, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 6, minStr: 5, rangeNormal: 1, knockdownChance: 30, mods: [], isCustom: false },
  { id: 'sledgehammer', name: 'Sledgehammer', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 3, damageDie: 8, damageBonus: 6, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 10, minStr: 6, rangeNormal: 1, knockdownChance: 40, mods: [], isCustom: false },
  { id: 'cattle_prod', name: 'Cattle Prod', category: 'meleeWeapons', damageType: 'laser', damageDieCount: 2, damageDie: 8, damageBonus: 0, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 4, minStr: 4, rangeNormal: 1, knockdownChance: 15, mods: [], isCustom: false },
  { id: 'super_sledge', name: 'Super Sledge', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 4, damageDie: 10, damageBonus: 10, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 15, minStr: 7, rangeNormal: 1, knockdownChance: 60, mods: [], isCustom: false },
  { id: 'spear', name: 'Spear', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 0, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 4, minStr: 4, rangeNormal: 1, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'ripper', name: 'Ripper', category: 'meleeWeapons', damageType: 'normal', damageDieCount: 4, damageDie: 8, damageBonus: 4, skill: 'meleeWeapons', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 7, minStr: 5, rangeNormal: 1, knockdownChance: 15, mods: [], isCustom: false },

  // ─── UNARMED ──────────────────────────────────────────────────────────────
  { id: 'unarmed', name: 'Unarmed Strike', category: 'unarmed', damageType: 'normal', damageDieCount: 1, damageDie: 4, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'brass_knuckles', name: 'Brass Knuckles', category: 'unarmed', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 1, minStr: 2, rangeNormal: 1, knockdownChance: 10, mods: [], isCustom: false },
  { id: 'spiked_knuckles', name: 'Spiked Knuckles', category: 'unarmed', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 2, minStr: 2, rangeNormal: 1, knockdownChance: 10, mods: [], isCustom: false },
  { id: 'power_fist', name: 'Power Fist', category: 'unarmed', damageType: 'normal', damageDieCount: 3, damageDie: 8, damageBonus: 4, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 8, minStr: 4, rangeNormal: 1, knockdownChance: 30, mods: [], isCustom: false },
  { id: 'mega_power_fist', name: 'Mega Power Fist', category: 'unarmed', damageType: 'normal', damageDieCount: 4, damageDie: 10, damageBonus: 10, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 10, minStr: 6, rangeNormal: 1, knockdownChance: 50, mods: [], isCustom: false },

  // ─── NATURAL WEAPONS (creature weapons) ───────────────────────────────────
  { id: 'deathclaw_claw', name: 'Deathclaw Claw', category: 'natural', damageType: 'normal', damageDieCount: 3, damageDie: 8, damageBonus: 5, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 35, mods: [], isCustom: false },
  { id: 'deathclaw_bite', name: 'Deathclaw Bite', category: 'natural', damageType: 'normal', damageDieCount: 2, damageDie: 10, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'dog_bite', name: 'Dog Bite', category: 'natural', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 1, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'dog_claw', name: 'Dog Claw', category: 'natural', damageType: 'normal', damageDieCount: 1, damageDie: 4, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'molerat_bite', name: 'Molerat Bite', category: 'natural', damageType: 'normal', damageDieCount: 1, damageDie: 8, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 5, mods: [], isCustom: false },
  { id: 'yaoguai_claw', name: 'Yao Guai Claw', category: 'natural', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 2, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 25, mods: [], isCustom: false },
  { id: 'yaoguai_bite', name: 'Yao Guai Bite', category: 'natural', damageType: 'normal', damageDieCount: 1, damageDie: 10, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 10, mods: [], isCustom: false },
  { id: 'scorpion_claw', name: 'Radscorpion Claw', category: 'natural', damageType: 'normal', damageDieCount: 2, damageDie: 8, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'scorpion_sting', name: 'Radscorpion Sting (Venom)', category: 'natural', damageType: 'fire', damageDieCount: 1, damageDie: 6, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'centaur_spit', name: 'Centaur Acid Spit', category: 'natural', damageType: 'fire', damageDieCount: 1, damageDie: 8, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 6, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'centaur_tentacle', name: 'Centaur Tentacle', category: 'natural', damageType: 'normal', damageDieCount: 1, damageDie: 6, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'floater_bite', name: 'Floater Bite', category: 'natural', damageType: 'normal', damageDieCount: 1, damageDie: 8, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'floater_spit', name: 'Floater Noxious Spit', category: 'natural', damageType: 'fire', damageDieCount: 1, damageDie: 6, damageBonus: 0, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 4, knockdownChance: 0, mods: [], isCustom: false },
  { id: 'brahmin_horn', name: 'Brahmin Horn', category: 'natural', damageType: 'normal', damageDieCount: 1, damageDie: 8, damageBonus: 2, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 20, mods: [], isCustom: false },
  { id: 'super_mutant_fist', name: 'Super Mutant Fist', category: 'natural', damageType: 'normal', damageDieCount: 2, damageDie: 6, damageBonus: 3, skill: 'unarmed', burstLimit: 1, isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 1, knockdownChance: 20, mods: [], isCustom: false },
];

export function getWeaponById(id: string): Weapon | undefined {
  return BUILT_IN_WEAPONS.find(w => w.id === id);
}

export function isMeleeWeapon(w: Weapon): boolean {
  return w.category === 'meleeWeapons' || w.category === 'unarmed' || w.category === 'natural';
}

export function isRangedWeapon(w: Weapon): boolean {
  return !isMeleeWeapon(w) && w.category !== 'throwing';
}

export function formatWeaponDamage(w: Weapon): string {
  const base = `${w.damageDieCount}d${w.damageDie}`;
  const bonus = w.damageBonus !== 0 ? (w.damageBonus > 0 ? `+${w.damageBonus}` : `${w.damageBonus}`) : '';
  const type = `(${w.damageType === 'normal' ? 'N' : w.damageType === 'laser' ? 'L' : w.damageType === 'fire' ? 'F' : w.damageType === 'plasma' ? 'P' : 'E'})`;
  return `${base}${bonus} ${type}`;
}

export function computeModBonuses(modIds: string[]): { toHit: number; damage: number; range: number } {
  let toHit = 0, damage = 0, range = 0;
  for (const id of modIds) {
    const mod = WEAPON_MODS.find(m => m.id === id);
    if (mod) { toHit += mod.toHitBonus; damage += mod.damageBonus; range += mod.rangeBonus; }
  }
  return { toHit, damage, range };
}
