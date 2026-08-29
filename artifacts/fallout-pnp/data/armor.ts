import type { Armor } from '@/context/types';

// Damage formula: finalDmg = max(0, (baseDmg - DT) * (1 - DR/100))
// DT = flat threshold, DR = percentage resistance

export const BUILT_IN_ARMOR: Armor[] = [
  // ─── BODY ARMOR ─────────────────────────────────────────────────────────────
  // Legacy convenience option; not a printed armor-table entry.
  {
    id: 'clothing', name: 'Clothing', slot: 'body',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 0, weight: 2, isCustom: false,
  },
  {
    id: 'robe', name: 'Robe', slot: 'body',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 20, drLaser: 25, drFire: 10, drPlasma: 10, drExplosion: 10,
    acBonus: 5, weight: 10, isCustom: false,
  },
  {
    id: 'leather_jacket', name: 'Leather Jacket', slot: 'body',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 20, drLaser: 20, drFire: 10, drPlasma: 10, drExplosion: 20,
    acBonus: 8, weight: 5, isCustom: false,
  },
  {
    id: 'raider_armor', name: 'Raider Armor', slot: 'body',
    dtNormal: 2, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 25, drLaser: 25, drFire: 15, drPlasma: 25, drExplosion: 20,
    acBonus: 8, weight: 10, isCustom: false,
  },
  {
    id: 'leather_armor', name: 'Leather Armor', slot: 'body',
    dtNormal: 2, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 25, drLaser: 20, drFire: 20, drPlasma: 10, drExplosion: 20,
    acBonus: 15, weight: 8, isCustom: false,
  },
  {
    id: 'leather_armor_mk2', name: 'Leather Armor Mk II', slot: 'body',
    dtNormal: 3, dtLaser: 1, dtFire: 1, dtPlasma: 1, dtExplosion: 1,
    drNormal: 25, drLaser: 30, drFire: 17, drPlasma: 30, drExplosion: 25,
    acBonus: 20, weight: 10, isCustom: false,
  },
  {
    id: 'vandal_armor', name: 'Vandal Armor', slot: 'body',
    dtNormal: 3, dtLaser: 1, dtFire: 1, dtPlasma: 1, dtExplosion: 1,
    drNormal: 25, drLaser: 30, drFire: 17, drPlasma: 30, drExplosion: 25,
    acBonus: 15, weight: 25, isCustom: false,
  },
  {
    id: 'combat_leather_jacket', name: 'Combat Leather Jacket', slot: 'body',
    dtNormal: 2, dtLaser: 0, dtFire: 2, dtPlasma: 0, dtExplosion: 0,
    drNormal: 30, drLaser: 20, drFire: 25, drPlasma: 10, drExplosion: 20,
    acBonus: 20, weight: 7, isCustom: false,
  },
  {
    id: 'metal_armor', name: 'Metal Armor', slot: 'body',
    dtNormal: 4, dtLaser: 6, dtFire: 4, dtPlasma: 4, dtExplosion: 4,
    drNormal: 30, drLaser: 75, drFire: 10, drPlasma: 20, drExplosion: 25,
    acBonus: 10, weight: 35, isCustom: false, effects: { skills: { sneak: -25 } },
  },
  {
    id: 'combat_armor', name: 'Combat Armor', slot: 'body',
    dtNormal: 5, dtLaser: 8, dtFire: 4, dtPlasma: 4, dtExplosion: 6,
    drNormal: 40, drLaser: 60, drFire: 30, drPlasma: 50, drExplosion: 40,
    acBonus: 20, weight: 20, isCustom: false, integratedHelmet: true, effects: { radiationResistance: 20 },
  },
  {
    id: 'combat_armor_mk2', name: 'Combat Armor Mk II', slot: 'body',
    dtNormal: 6, dtLaser: 6, dtFire: 5, dtPlasma: 5, dtExplosion: 9,
    drNormal: 40, drLaser: 65, drFire: 35, drPlasma: 50, drExplosion: 45,
    acBonus: 25, weight: 20, isCustom: false, integratedHelmet: true, effects: { radiationResistance: 20 },
  },
  {
    // Manual "Tesla Armor" (p.106): W35 AC15 N4/20 L19/90 F4/10 P10/80 E4/20
    id: 'tesla_armor', name: 'Tesla Armor', slot: 'body',
    dtNormal: 4, dtLaser: 19, dtFire: 4, dtPlasma: 10, dtExplosion: 4,
    drNormal: 20, drLaser: 90, drFire: 10, drPlasma: 80, drExplosion: 20,
    acBonus: 15, weight: 35, isCustom: false, effects: { skills: { sneak: -20 } },
  },
  {
    id: 'brotherhood_armor', name: 'Brotherhood Leather Armor', slot: 'body',
    dtNormal: 2, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 25, drLaser: 25, drFire: 15, drPlasma: 25, drExplosion: 20,
    acBonus: 15, weight: 10, isCustom: false,
  },
  {
    id: 'brotherhood_leather_armor_mk2', name: 'Brotherhood Leather Armor Mk II', slot: 'body',
    dtNormal: 3, dtLaser: 1, dtFire: 1, dtPlasma: 1, dtExplosion: 1,
    drNormal: 30, drLaser: 25, drFire: 30, drPlasma: 15, drExplosion: 30,
    acBonus: 23, weight: 11, isCustom: false,
  },
  // ── Missing body armors from the manual armor chapter (p.105–108) ──────────
  {
    // Reaver Banding (p.105): W10 AC20 N4/30 L3/40 F1/40 P3/20 E3/30
    id: 'reaver_banding', name: 'Reaver Banding', slot: 'body',
    dtNormal: 4, dtLaser: 3, dtFire: 1, dtPlasma: 3, dtExplosion: 3,
    drNormal: 30, drLaser: 40, drFire: 40, drPlasma: 20, drExplosion: 30,
    acBonus: 20, weight: 10, isCustom: false,
  },
  {
    // Greater Banding (p.106): W18 AC25 N5/50 L2/40 F4/30 P3/30 E5/60
    id: 'greater_banding', name: 'Greater Banding', slot: 'body',
    dtNormal: 5, dtLaser: 2, dtFire: 4, dtPlasma: 3, dtExplosion: 5,
    drNormal: 50, drLaser: 40, drFire: 30, drPlasma: 30, drExplosion: 60,
    acBonus: 25, weight: 18, isCustom: false, effects: { skills: { sneak: -15 } },
  },
  {
    // Ghoul Armor (p.105): W10 AC10 N0/20 L0/25 F0/10 P0/25 E0/25 (ghouls/small humans)
    id: 'ghoul_armor', name: 'Ghoul Armor', slot: 'body',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 20, drLaser: 25, drFire: 10, drPlasma: 25, drExplosion: 25,
    acBonus: 10, weight: 10, isCustom: false,
  },
  {
    // Superior Ghoul Armor (p.105): W10 AC20 N3/25 L1/25 F1/15 P1/25 E1/20
    id: 'superior_ghoul_armor', name: 'Superior Ghoul Armor', slot: 'body',
    dtNormal: 3, dtLaser: 1, dtFire: 1, dtPlasma: 1, dtExplosion: 1,
    drNormal: 25, drLaser: 25, drFire: 15, drPlasma: 25, drExplosion: 20,
    acBonus: 20, weight: 10, isCustom: false,
  },
  {
    // Brotherhood Metal Armor (p.106): W35 AC15 N4/30 L3/37 F4/15 P3/37 E4/25
    id: 'brotherhood_metal_armor', name: 'Brotherhood Metal Armor', slot: 'body',
    dtNormal: 4, dtLaser: 3, dtFire: 4, dtPlasma: 3, dtExplosion: 4,
    drNormal: 30, drLaser: 37, drFire: 15, drPlasma: 37, drExplosion: 25,
    acBonus: 15, weight: 35, isCustom: false, effects: { skills: { sneak: -25 } },
  },
  {
    // Metal Armor MK II (p.106): W35 AC15 N4/35 L7/80 F4/15 P4/25 E4/30
    id: 'metal_armor_mk2', name: 'Metal Armor Mk II', slot: 'body',
    dtNormal: 4, dtLaser: 7, dtFire: 4, dtPlasma: 4, dtExplosion: 4,
    drNormal: 35, drLaser: 80, drFire: 15, drPlasma: 25, drExplosion: 30,
    acBonus: 15, weight: 35, isCustom: false, effects: { skills: { sneak: -20 } },
  },
  {
    // Brotherhood Metal Armor MK II (p.106): W35 AC15 N4/35 L4/35 F4/20 P4/45 E4/30
    id: 'brotherhood_metal_armor_mk2', name: 'Brotherhood Metal Armor Mk II', slot: 'body',
    dtNormal: 4, dtLaser: 4, dtFire: 4, dtPlasma: 4, dtExplosion: 4,
    drNormal: 35, drLaser: 35, drFire: 20, drPlasma: 45, drExplosion: 30,
    acBonus: 15, weight: 35, isCustom: false, effects: { skills: { sneak: -20 } },
  },
  {
    // Mutant Plate Armor (p.106): W40 AC10 N4/30 L3/37 F4/15 P3/37 E4/25 (mutants only)
    id: 'mutant_plate_armor', name: 'Mutant Plate Armor', slot: 'body',
    dtNormal: 4, dtLaser: 3, dtFire: 4, dtPlasma: 3, dtExplosion: 4,
    drNormal: 30, drLaser: 37, drFire: 15, drPlasma: 37, drExplosion: 25,
    acBonus: 10, weight: 40, isCustom: false,
  },
  {
    // Spiked Mutant Plate Armor (p.106): W50 AC15 N4/35 L4/45 F4/20 P4/45 E4/30 (mutants only)
    id: 'spiked_mutant_plate_armor', name: 'Spiked Mutant Plate Armor', slot: 'body',
    dtNormal: 4, dtLaser: 4, dtFire: 4, dtPlasma: 4, dtExplosion: 4,
    drNormal: 35, drLaser: 45, drFire: 20, drPlasma: 45, drExplosion: 30,
    acBonus: 15, weight: 50, isCustom: false,
  },
  {
    // Brotherhood Tesla Armor (p.106): W35 AC15 N4/20 L15/85 F7/45 P15/85 E4/20
    id: 'brotherhood_tesla_armor', name: 'Brotherhood Tesla Armor', slot: 'body',
    dtNormal: 4, dtLaser: 15, dtFire: 7, dtPlasma: 15, dtExplosion: 4,
    drNormal: 20, drLaser: 85, drFire: 45, drPlasma: 85, drExplosion: 20,
    acBonus: 15, weight: 35, isCustom: false, effects: { skills: { sneak: -20 } },
  },
  {
    // Brotherhood Combat Armor (p.106): W25 AC20 N8/40 L8/70 F7/50 P7/60 E8/40 (+20% RR, incl. helmet)
    id: 'brotherhood_combat_armor', name: 'Brotherhood Combat Armor', slot: 'body',
    dtNormal: 8, dtLaser: 8, dtFire: 7, dtPlasma: 7, dtExplosion: 8,
    drNormal: 40, drLaser: 70, drFire: 50, drPlasma: 60, drExplosion: 40,
    acBonus: 20, weight: 25, isCustom: false, integratedHelmet: true, effects: { radiationResistance: 20 },
  },
  {
    // Radiation Suit (p.107): W20 AC15 N4/30 L0/30 F10/60 P0/20 E4/40 (100% RR, 100/100 GR; no helmet)
    id: 'radiation_suit', name: 'Radiation Suit', slot: 'body',
    dtNormal: 4, dtLaser: 0, dtFire: 10, dtPlasma: 0, dtExplosion: 4,
    drNormal: 30, drLaser: 30, drFire: 60, drPlasma: 20, drExplosion: 40,
    acBonus: 15, weight: 20, isCustom: false, prohibitsHelmet: true, effects: { radiationResistance: 100, gasResistance: 100, skills: { sneak: -30 } },
  },
  {
    // Brotherhood Environmental Armor (p.107): W30 AC18 N5/40 L5/55 F4/40 P5/55 E6/40
    id: 'brotherhood_env_armor', name: 'Brotherhood Environmental Armor', slot: 'body',
    dtNormal: 5, dtLaser: 5, dtFire: 4, dtPlasma: 5, dtExplosion: 6,
    drNormal: 40, drLaser: 55, drFire: 40, drPlasma: 55, drExplosion: 40,
    acBonus: 18, weight: 30, isCustom: false, integratedHelmet: true, effects: { gasResistance: 100, radiationResistance: 60, poisonResistance: 50, skills: { sneak: -50, doctor: -10, lockpick: -10, steal: -10, repair: -10, firstAid: -5, science: -5 } },
  },
  {
    // Brotherhood Environmental Armor MK II (p.107): W35 AC20 N6/40 L6/60 F5/42 P6/60 E9/45
    id: 'brotherhood_env_armor_mk2', name: 'Brotherhood Environmental Armor Mk II', slot: 'body',
    dtNormal: 6, dtLaser: 6, dtFire: 5, dtPlasma: 6, dtExplosion: 9,
    drNormal: 40, drLaser: 60, drFire: 42, drPlasma: 60, drExplosion: 45,
    acBonus: 20, weight: 35, isCustom: false, integratedHelmet: true, effects: { special: { perception: -1 }, gasResistance: 100, radiationResistance: 90, poisonResistance: 75, skills: { sneak: -50, doctor: -11, lockpick: -11, repair: -10, steal: -10, firstAid: -7, science: -5, pilot: -2 } },
  },
  {
    // Pseudo-Chitin Armor (p.107): W20 AC30 N10/50 L4/20 F10/60 P4/20 E5/50 (no helmet)
    id: 'pseudo_chitin_armor', name: 'Pseudo-Chitin Armor', slot: 'body',
    dtNormal: 10, dtLaser: 4, dtFire: 10, dtPlasma: 4, dtExplosion: 5,
    drNormal: 50, drLaser: 20, drFire: 60, drPlasma: 20, drExplosion: 50,
    acBonus: 30, weight: 20, isCustom: false, prohibitsHelmet: true, effects: { radiationResistance: 20 },
  },
  {
    // Brotherhood Power Armor (p.108): W42 AC28 N13/50 L16/70 F13/60 P16/70 E20/60
    id: 'brotherhood_power_armor', name: 'Brotherhood Power Armor', slot: 'body',
    dtNormal: 13, dtLaser: 16, dtFire: 13, dtPlasma: 16, dtExplosion: 20,
    drNormal: 50, drLaser: 70, drFire: 60, drPlasma: 70, drExplosion: 60,
    acBonus: 28, weight: 42, isCustom: false, integratedHelmet: true, effects: { special: { strength: 3, perception: -1 }, gasResistance: 100, poisonResistance: 15, radiationResistance: 30, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
  },
  {
    // Brotherhood Advanced Power Armor (p.108): W50 AC35 N18/55 L17/75 F15/65 P17/75 E20/65
    id: 'brotherhood_adv_power_armor', name: 'Brotherhood Advanced Power Armor', slot: 'body',
    dtNormal: 18, dtLaser: 17, dtFire: 15, dtPlasma: 17, dtExplosion: 20,
    drNormal: 55, drLaser: 75, drFire: 65, drPlasma: 75, drExplosion: 65,
    acBonus: 35, weight: 50, isCustom: false, integratedHelmet: true, ignoresLightPenalties: true, effects: { special: { strength: 4, perception: -2 }, gasResistance: 100, poisonResistance: 20, radiationResistance: 60, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
  },
  {
    // Power Armor (p.107): W35 AC25 N12/40 L18/80 F12/60 P10/40 E20/50
    id: 'power_armor', name: 'Power Armor', slot: 'body',
    dtNormal: 12, dtLaser: 18, dtFire: 12, dtPlasma: 10, dtExplosion: 20,
    drNormal: 40, drLaser: 80, drFire: 60, drPlasma: 40, drExplosion: 50,
    acBonus: 25, weight: 35, isCustom: false, integratedHelmet: true, effects: { special: { strength: 3 }, gasResistance: 100, poisonResistance: 15, radiationResistance: 30, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
  },
  {
    // Hardened Power Armor (p.107): W50 AC25 N13/50 L19/90 F14/70 P13/50 E20/60
    id: 'hardened_power_armor', name: 'Hardened Power Armor', slot: 'body',
    dtNormal: 13, dtLaser: 19, dtFire: 14, dtPlasma: 13, dtExplosion: 20,
    drNormal: 50, drLaser: 90, drFire: 70, drPlasma: 50, drExplosion: 60,
    acBonus: 25, weight: 50, isCustom: false, integratedHelmet: true, effects: { special: { strength: 3 }, gasResistance: 100, poisonResistance: 15, radiationResistance: 30, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
  },
  {
    // Advanced Power Armor (p.108): W30 AC30 N15/55 L19/90 F16/70 P15/60 E20/65
    id: 'adv_power_armor', name: 'Advanced Power Armor', slot: 'body',
    dtNormal: 15, dtLaser: 19, dtFire: 16, dtPlasma: 15, dtExplosion: 20,
    drNormal: 55, drLaser: 90, drFire: 70, drPlasma: 60, drExplosion: 65,
    acBonus: 30, weight: 30, isCustom: false, integratedHelmet: true, ignoresLightPenalties: true, effects: { special: { strength: 4 }, gasResistance: 100, poisonResistance: 20, radiationResistance: 60, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
  },
  {
    // Advanced Power Armor MK II (p.108): W50 AC35 N18/60 L19/90 F16/70 P18/60 E20/70
    id: 'adv_power_armor_mk2', name: 'Advanced Power Armor Mk II', slot: 'body',
    dtNormal: 18, dtLaser: 19, dtFire: 16, dtPlasma: 18, dtExplosion: 20,
    drNormal: 60, drLaser: 90, drFire: 70, drPlasma: 60, drExplosion: 70,
    acBonus: 35, weight: 50, isCustom: false,
    integratedHelmet: true, ignoresLightPenalties: true,
    effects: { special: { strength: 4 }, gasResistance: 100, poisonResistance: 40, radiationResistance: 75, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
  },
  // ─── HELMETS ─────────────────────────────────────────────────────────────────
  {
    id: 'no_helmet', name: 'No Helmet', slot: 'helmet',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 0, weight: 0, isCustom: false,
  },
  {
    // Leather Cap (p.108): a simple Brahmin-hide cap. AC:3
    id: 'leather_cap', name: 'Leather Cap', slot: 'helmet',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 3, weight: 0, isCustom: false,
  },
  {
    id: 'metal_helmet', name: 'Metal Helmet', slot: 'helmet',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 6, weight: 0, isCustom: false,
  },
  {
    id: 'combat_helmet', name: 'Combat Helmet', slot: 'helmet',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 9, weight: 0, isCustom: false,
  },
  {
    // Environmental Helmet (p.109): part of environmental armor; AC:11, GR:100/10
    id: 'environmental_helmet', name: 'Environmental Helmet', slot: 'helmet',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 11, weight: 0, isCustom: false,
    compatibleBodyArmorIds: ['brotherhood_env_armor', 'brotherhood_env_armor_mk2'],
    effects: { gasResistance: 100 },
  },
  {
    id: 'power_helmet', name: 'Power Armor Helmet', slot: 'helmet',
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    acBonus: 13, weight: 0, isCustom: false,
    compatibleBodyArmorIds: ['brotherhood_power_armor', 'brotherhood_adv_power_armor', 'power_armor', 'hardened_power_armor', 'adv_power_armor', 'adv_power_armor_mk2'],
    effects: { gasResistance: 100 },
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
