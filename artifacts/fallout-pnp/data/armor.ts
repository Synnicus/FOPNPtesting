import { Armor } from '@/context/types';

// Damage formula: finalDmg = max(0, (baseDmg - DT) * (1 - DR/100))
// DT = flat threshold, DR = percentage resistance

export const BUILT_IN_ARMOR: Armor[] = [
  // ─── BODY ARMOR ─────────────────────────────────────────────────────────────
  {
    id: 'clothing', name: 'Clothing', slot: 'body',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 0, weight: 2, isCustom: false,
  },
  {
    id: 'leather_armor', name: 'Leather Armor', slot: 'body',
    dtNormal: 2, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 25, drLaser: 20, drFire: 10, drPlasma: 10, drExplosion: 20,
    acBonus: 15, weight: 15, isCustom: false,
  },
  {
    id: 'leather_armor_mk2', name: 'Leather Armor Mk II', slot: 'body',
    dtNormal: 3, dtLaser: 0, dtFire: 1, dtPlasma: 0, dtExplosion: 0,
    drNormal: 30, drLaser: 20, drFire: 20, drPlasma: 10, drExplosion: 25,
    acBonus: 20, weight: 18, isCustom: false,
  },
  {
    id: 'metal_armor', name: 'Metal Armor', slot: 'body',
    dtNormal: 4, dtLaser: 0, dtFire: 2, dtPlasma: 0, dtExplosion: 2,
    drNormal: 30, drLaser: 25, drFire: 25, drPlasma: 10, drExplosion: 25,
    acBonus: 10, weight: 35, isCustom: false,
  },
  {
    id: 'combat_armor', name: 'Combat Armor', slot: 'body',
    dtNormal: 5, dtLaser: 2, dtFire: 2, dtPlasma: 2, dtExplosion: 3,
    drNormal: 40, drLaser: 30, drFire: 30, drPlasma: 20, drExplosion: 30,
    acBonus: 20, weight: 25, isCustom: false,
  },
  {
    id: 'combat_armor_mk2', name: 'Combat Armor Mk II', slot: 'body',
    dtNormal: 6, dtLaser: 3, dtFire: 3, dtPlasma: 3, dtExplosion: 4,
    drNormal: 45, drLaser: 35, drFire: 35, drPlasma: 25, drExplosion: 35,
    acBonus: 22, weight: 28, isCustom: false,
  },
  {
    id: 'tesla_armor', name: 'Tesla Armor', slot: 'body',
    dtNormal: 4, dtLaser: 8, dtFire: 2, dtPlasma: 6, dtExplosion: 2,
    drNormal: 35, drLaser: 90, drFire: 20, drPlasma: 80, drExplosion: 20,
    acBonus: 15, weight: 22, isCustom: false,
  },
  {
    id: 'brotherhood_armor', name: 'Brotherhood Armor', slot: 'body',
    dtNormal: 7, dtLaser: 4, dtFire: 4, dtPlasma: 4, dtExplosion: 5,
    drNormal: 40, drLaser: 40, drFire: 30, drPlasma: 35, drExplosion: 35,
    acBonus: 20, weight: 20, isCustom: false,
  },
  {
    id: 'power_armor', name: 'Power Armor', slot: 'body',
    dtNormal: 12, dtLaser: 8, dtFire: 8, dtPlasma: 8, dtExplosion: 10,
    drNormal: 40, drLaser: 60, drFire: 30, drPlasma: 50, drExplosion: 40,
    acBonus: 25, weight: 50, isCustom: false,
  },
  {
    id: 'hardened_power_armor', name: 'Hardened Power Armor', slot: 'body',
    dtNormal: 13, dtLaser: 8, dtFire: 10, dtPlasma: 10, dtExplosion: 12,
    drNormal: 50, drLaser: 60, drFire: 30, drPlasma: 50, drExplosion: 50,
    acBonus: 25, weight: 50, isCustom: false,
  },
  {
    id: 'adv_power_armor', name: 'Advanced Power Armor', slot: 'body',
    dtNormal: 15, dtLaser: 10, dtFire: 10, dtPlasma: 12, dtExplosion: 12,
    drNormal: 50, drLaser: 75, drFire: 40, drPlasma: 65, drExplosion: 50,
    acBonus: 25, weight: 50, isCustom: false,
  },
  {
    id: 'adv_power_armor_mk2', name: 'Advanced Power Armor Mk II', slot: 'body',
    dtNormal: 18, dtLaser: 12, dtFire: 12, dtPlasma: 14, dtExplosion: 15,
    drNormal: 60, drLaser: 80, drFire: 50, drPlasma: 75, drExplosion: 60,
    acBonus: 30, weight: 55, isCustom: false,
  },
  // ─── HELMETS ─────────────────────────────────────────────────────────────────
  {
    id: 'no_helmet', name: 'No Helmet', slot: 'helmet',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 0, weight: 0, isCustom: false,
  },
  {
    id: 'leather_helmet', name: 'Leather Helmet', slot: 'helmet',
    dtNormal: 1, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 10, drLaser: 10, drFire: 5, drPlasma: 5, drExplosion: 10,
    acBonus: 5, weight: 3, isCustom: false,
  },
  {
    id: 'metal_helmet', name: 'Metal Helmet', slot: 'helmet',
    dtNormal: 3, dtLaser: 0, dtFire: 1, dtPlasma: 0, dtExplosion: 1,
    drNormal: 15, drLaser: 10, drFire: 10, drPlasma: 5, drExplosion: 15,
    acBonus: 5, weight: 6, isCustom: false,
  },
  {
    id: 'combat_helmet', name: 'Combat Helmet', slot: 'helmet',
    dtNormal: 4, dtLaser: 2, dtFire: 2, dtPlasma: 2, dtExplosion: 3,
    drNormal: 25, drLaser: 20, drFire: 20, drPlasma: 15, drExplosion: 25,
    acBonus: 10, weight: 5, isCustom: false,
  },
  {
    id: 'power_helmet', name: 'Power Armor Helmet', slot: 'helmet',
    dtNormal: 8, dtLaser: 6, dtFire: 6, dtPlasma: 8, dtExplosion: 8,
    drNormal: 30, drLaser: 40, drFire: 20, drPlasma: 30, drExplosion: 30,
    acBonus: 10, weight: 8, isCustom: false,
  },
  {
    id: 'adv_power_helmet', name: 'Adv. Power Armor Helmet', slot: 'helmet',
    dtNormal: 10, dtLaser: 8, dtFire: 8, dtPlasma: 10, dtExplosion: 10,
    drNormal: 40, drLaser: 50, drFire: 30, drPlasma: 40, drExplosion: 40,
    acBonus: 15, weight: 10, isCustom: false,
  },
];

export function getArmorById(id: string): Armor | undefined {
  return BUILT_IN_ARMOR.find(a => a.id === id);
}

// Helper to compute total DT+DR for a damage type from body + helmet
export function computeCombinedProtection(
  bodyArmor: Armor | null | undefined,
  helmet: Armor | null | undefined,
  dmgType: 'normal' | 'laser' | 'fire' | 'plasma' | 'explosion',
): { dt: number; dr: number } {
  const key = dmgType.charAt(0).toUpperCase() + dmgType.slice(1) as Capitalize<typeof dmgType>;
  const dtKey = `dt${key}` as keyof Armor;
  const drKey = `dr${key}` as keyof Armor;
  const dt = ((bodyArmor?.[dtKey] as number) ?? 0) + ((helmet?.[dtKey] as number) ?? 0);
  const dr = Math.min(90, ((bodyArmor?.[drKey] as number) ?? 0) + ((helmet?.[drKey] as number) ?? 0));
  return { dt, dr };
}

// Apply DT then DR to get final damage
export function applyProtection(rawDamage: number, dt: number, dr: number): number {
  const afterDT = Math.max(0, rawDamage - dt);
  return Math.max(0, Math.round(afterDT * (1 - dr / 100)));
}
