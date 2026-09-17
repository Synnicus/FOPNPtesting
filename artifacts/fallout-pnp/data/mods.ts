import type { Weapon, WeaponMod } from '../context/types.ts';

// ─── Weapon Enhancements (manual "Weapon Enhancements" chapter, p.99–100) ─────
// This module OWNS the reworked weapon-mod system. It replaces the legacy
// WEAPON_MODS list that used to live in data/weapons.ts. Ammo-type "mods"
// (AP/JHP etc.) have been REMOVED — ammunition is now its own system
// (data/ammo.ts + WeaponAmmoState.ammoTypeId).
//
// NOTE for maintainers: index.tsx / equipment.tsx should import
// { WEAPON_MODS, computeModBonuses } from '@/data/mods' instead of
// '@/data/weapons'. Backward-compatible aliases are exported below so the
// migration is a one-line import swap.

export type ModAppliesTo = 'melee' | 'ranged' | 'gun' | 'blade' | 'piercing' | 'revolver' | 'pistolSmg' | 'rifle' | 'heavy' | 'any';

export type PoisonType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface PoisonSpec {
  type: PoisonType;
  effectText: string;
}

export interface WeaponModDef {
  id: string;
  name: string;
  /** What kinds of weapons this can be applied to (informational + UI filter). */
  appliesTo: ModAppliesTo;
  /** Caps/currency value from the manual, where listed. */
  value?: number;
  weight?: number;
  description: string;

  // ── Structured behaviour fields (all optional) ──────────────────────────────
  /** Flat % to-hit bonus. */
  toHitBonus?: number;
  /** Flat damage bonus (can be negative, e.g. Rifled Barrel −4). */
  damageBonus?: number;
  /** Additive range bonus in meters/squares. */
  rangeBonus?: number;
  /** Multiplicative range factor (rarely used; prefer rangeBonus). */
  rangeMult?: number;
  /** Multiplier on magazine capacity (Expanded Magazine variants). */
  magazineMult?: number;

  /** Laser Sight: negates the to-hit penalty from aimed/targeted shots.
   *  It does NOT grant a raw +% to-hit. */
  negatesAimedPenalty?: boolean;
  /** Night Sight / thermal: darkness/light modifiers are ignored. */
  ignoresLightPenalty?: boolean;
  /** Sniper's Scope: every roll to hit must be made as a targeted attack,
   *  whether or not the shooter chose to aim. */
  forcesAimed?: boolean;
  /** Silencer: no noise, good for sneaking. */
  silencer?: boolean;
  /** Speed Loader: reloading only costs 1 AP (revolvers only). */
  reloadApOverride?: number;
  /** Sling (NEW): lets a two-handed weapon be wielded with one crippled arm. */
  sling?: boolean;

  /** Poison coating (melee/piercing). */
  poison?: PoisonSpec;
  /** Festering Tip: target must roll EN (−5) or suffer a festering infection. */
  festering?: boolean;
  /** Barbed Point: weapon hooks in flesh; removing it deals 3d4 damage. */
  barbed?: boolean;

  // ── Shield fields (custom house-rule mod) ──────────────────────────────────
  /** Shield: flat AC bonus to the wielder while the weapon is in hand. */
  acBonus?: number;
  /** Shield: DT added to the wielder's protection (per damage type). */
  shieldDt?: { normal: number; laser: number; fire: number; plasma: number; explosion: number };
  /** Shield: DR% added to the wielder's protection (per damage type). */
  shieldDr?: { normal: number; laser: number; fire: number; plasma: number; explosion: number };
}

// ─── Poison type reference (manual "Poison Types and Effects", p.40) ──────────
export const POISON_TYPES: Record<PoisonType, string> = {
  A: 'Type A — mild infection. 1 HP/hour (roll EN for none); lasts 18 hours.',
  B: 'Type B — distilled Type A. 2 HP/hour (roll EN for none); lasts 18 hours.',
  C: 'Type C — abdominal cramps; incapacitates 12 hours, lowering STR/PER/AGI/EN to 2.',
  D: 'Type D — radscorpion venom. 4 HP/hour (roll EN for half); lasts 24 hours.',
  E: 'Type E — distilled radscorpion venom. 6 HP/hour (roll EN for half); lasts 24 hours.',
  F: 'Type F — victim goes into shock ~1 hour after contact, coma 1d10 days; roll EN each day untreated or die.',
  G: 'Type G — the worst poison. Death 5 minutes after exposure unless Antidote is administered.',
};

// ─── Mod definitions ──────────────────────────────────────────────────────────
export const WEAPON_MOD_DEFS: WeaponModDef[] = [
  // ── Melee Weapon Enhancements ──────────────────────────────────────────────
  {
    id: 'sharpened_blade', name: 'Sharpened Blade', appliesTo: 'blade',
    description: 'A bladed weapon meticulously filed with a sharpening stone. Adds +4 to damage.',
    damageBonus: 4,
  },
  {
    id: 'festering_tip', name: 'Festering Tip', appliesTo: 'piercing',
    description: 'A piercing weapon smeared with feces or rotting carcass. On a hit, the target must roll against Endurance at −5 or suffer a festering infection.',
    festering: true,
  },
  {
    id: 'barbed_point', name: 'Barbed Point', appliesTo: 'piercing',
    description: 'Twisted metal barbs hook the weapon inside the target like a fishhook. Removing the weapon deals an extra 3d4 damage.',
    barbed: true,
  },
  // ── Poison coatings — one per manual poison type (melee/piercing only) ───────
  {
    id: 'poison_a', name: 'Poison (Type A)', appliesTo: 'piercing',
    description: `Coat a piercing blade with Type A poison. ${POISON_TYPES.A}`,
    poison: { type: 'A', effectText: POISON_TYPES.A },
  },
  {
    id: 'poison_b', name: 'Poison (Type B)', appliesTo: 'piercing',
    description: `Coat a piercing blade with Type B poison. ${POISON_TYPES.B}`,
    poison: { type: 'B', effectText: POISON_TYPES.B },
  },
  {
    id: 'poison_c', name: 'Poison (Type C)', appliesTo: 'piercing',
    description: `Coat a piercing blade with Type C poison. ${POISON_TYPES.C}`,
    poison: { type: 'C', effectText: POISON_TYPES.C },
  },
  {
    id: 'poison_d', name: 'Poison (Type D)', appliesTo: 'piercing',
    description: `Coat a piercing blade with Type D (radscorpion) poison. ${POISON_TYPES.D}`,
    poison: { type: 'D', effectText: POISON_TYPES.D },
  },
  {
    id: 'poison_e', name: 'Poison (Type E)', appliesTo: 'piercing',
    description: `Coat a piercing blade with Type E (distilled radscorpion) poison. ${POISON_TYPES.E}`,
    poison: { type: 'E', effectText: POISON_TYPES.E },
  },
  {
    id: 'poison_f', name: 'Poison (Type F)', appliesTo: 'piercing',
    description: `Coat a piercing blade with the rare Type F venom. ${POISON_TYPES.F}`,
    poison: { type: 'F', effectText: POISON_TYPES.F },
  },
  {
    id: 'poison_g', name: 'Poison (Type G)', appliesTo: 'piercing',
    description: `Coat a piercing blade with lab-made Type G poison. ${POISON_TYPES.G}`,
    poison: { type: 'G', effectText: POISON_TYPES.G },
  },

  // ── Gun Enhancements ─────────────────────────────────────────────────────────
  {
    id: 'tripod', name: 'Tripod', appliesTo: 'heavy', value: 500, weight: 7,
    description: 'A collapsible device to balance and support larger weapons. If a weapon can benefit, its description lists improved range statistics.',
    rangeBonus: 20,
  },
  {
    id: 'stock', name: 'Stock', appliesTo: 'pistolSmg', value: 500,
    description: 'Attaches to pistols and SMGs only (rifles/assault rifles already have stocks). Lets the shooter brace the weapon: +5 meters range.',
    rangeBonus: 5,
  },
  {
    id: 'silencer', name: 'Silencer', appliesTo: 'gun', value: 500,
    description: 'Fits over the barrel of almost any gun, reducing or eliminating the report. Good for sneaking and not alerting a whole town.',
    silencer: true,
  },
  {
    id: 'speed_loader', name: 'Speed Loader', appliesTo: 'revolver', value: 3000,
    description: 'A speed loader for a revolver only. Reloading takes just 1 AP.',
    reloadApOverride: 1,
  },
  {
    id: 'rifled_barrel', name: 'Rifled Barrel', appliesTo: 'pistolSmg', value: 1000,
    description: 'A barrel extension for pistols and SMGs only. Increases range by 20 meters, but reduces damage by 4.',
    rangeBonus: 20, damageBonus: -4,
  },
  {
    id: 'night_sight', name: 'Night Sight', appliesTo: 'gun', value: 2000,
    description: 'A thermal scope showing the world in heatwaves rather than normal light. While equipped, darkness/light modifiers are ignored.',
    ignoresLightPenalty: true,
  },
  {
    id: 'sniper_scope', name: "Sniper's Scope", appliesTo: 'gun', value: 3000,
    description: 'Increases range by 20 meters, but ALL rolls to hit must be made as if making a targeted attack, whether the shooter aims or not. (Sniper rifles already have this.)',
    rangeBonus: 20, forcesAimed: true,
  },
  {
    id: 'laser_sight', name: 'Laser Sight', appliesTo: 'gun', value: 3000,
    description: 'A device under the barrel that lets you target body parts without penalty. Targeted rolls are made as a normal single roll with no targeting penalty. Does NOT add raw to-hit.',
    negatesAimedPenalty: true,
  },
  // ── Expanded Magazine — three variants (+20% / +50% / +100%) ─────────────────
  {
    id: 'expanded_mag_20', name: 'Expanded Magazine (+20%)', appliesTo: 'rifle', value: 5000,
    description: 'A weaponsmith expands the magazine of some rifles and assault rifles. This variant increases capacity by 20%.',
    magazineMult: 1.2,
  },
  {
    id: 'expanded_mag_50', name: 'Expanded Magazine (+50%)', appliesTo: 'rifle', value: 5000,
    description: 'A weaponsmith expands the magazine of some rifles and assault rifles. This variant increases capacity by 50%.',
    magazineMult: 1.5,
  },
  {
    id: 'expanded_mag_100', name: 'Expanded Magazine (+100%)', appliesTo: 'rifle', value: 5000,
    description: 'A weaponsmith expands the magazine of some rifles and assault rifles. This variant doubles capacity (+100%).',
    magazineMult: 2.0,
  },

  // ── Sling (NEW) ──────────────────────────────────────────────────────────────
  {
    id: 'sling', name: 'Sling', appliesTo: 'any',
    description: 'A strap that supports a two-handed weapon against the body, letting it be wielded even with one crippled arm.',
    sling: true,
  },

  // ── Shields (NEW house rule) ────────────────────────────────────────────────
  // A shield strapped to a weapon (or arm) buffs the wielder's AC/DT/DR while
  // the weapon is in hand. Defensive stats mirror the equivalent-tier helmet.
  {
    id: 'shield_t1', name: 'Shield T1 (Primitive)', appliesTo: 'any', weight: 4,
    description: 'A crude shield of hide and scrap wood. Grants the defensive stats of a leather helmet (+5 AC) while the weapon is held.',
    acBonus: 5,
    shieldDt: { normal: 1, laser: 0, fire: 0, plasma: 0, explosion: 0 },
    shieldDr: { normal: 10, laser: 10, fire: 5, plasma: 5, explosion: 10 },
  },
  {
    id: 'shield_t2', name: 'Shield T2 (Metal)', appliesTo: 'any', weight: 7,
    description: 'A hammered-metal shield. Grants the defensive stats of a metal helmet (+5 AC) while the weapon is held.',
    acBonus: 5,
    shieldDt: { normal: 3, laser: 0, fire: 1, plasma: 0, explosion: 1 },
    shieldDr: { normal: 15, laser: 10, fire: 10, plasma: 5, explosion: 15 },
  },
  {
    id: 'shield_t3', name: 'Shield T3 (Combat/Riot)', appliesTo: 'any', weight: 6,
    description: 'A polymer riot shield. Grants the defensive stats of a combat helmet (+10 AC) while the weapon is held.',
    acBonus: 10,
    shieldDt: { normal: 4, laser: 2, fire: 2, plasma: 2, explosion: 3 },
    shieldDr: { normal: 25, laser: 20, fire: 20, plasma: 15, explosion: 25 },
  },
  {
    id: 'shield_t4', name: 'Shield T4 (Advanced/Power)', appliesTo: 'any', weight: 10,
    description: 'A powered composite shield. Grants the defensive stats of a power armor helmet (+13 AC) while the weapon is held.',
    acBonus: 13,
    shieldDt: { normal: 8, laser: 6, fire: 6, plasma: 8, explosion: 8 },
    shieldDr: { normal: 30, laser: 40, fire: 20, plasma: 30, explosion: 30 },
  },
];

// ─── Lookups ──────────────────────────────────────────────────────────────────
export function getModById(id: string): WeaponModDef | undefined {
  return WEAPON_MOD_DEFS.find(m => m.id === id);
}

// ─── Aggregate structured effects from a weapon's applied mods ────────────────
export interface AggregatedModEffects {
  toHit: number;
  damage: number;
  range: number;
  /** Effective magazine multiplier (product of all magazineMult variants). */
  magazineMult: number;
  negatesAimedPenalty: boolean;
  ignoresLightPenalty: boolean;
  forcesAimed: boolean;
  silencer: boolean;
  sling: boolean;
  festering: boolean;
  barbed: boolean;
  /** Reload AP override (lowest wins), or undefined if none. */
  reloadApOverride?: number;
  /** All poison coatings currently applied. */
  poisons: PoisonSpec[];
  /** Shield: AC bonus to the wielder while the weapon is in hand. */
  acBonus: number;
  /** Shield: summed DT/DR added to the wielder's protection, in the same
   *  dtNormal/drNormal… field shape as Armor (null when no shield mods). */
  shieldProtection: {
    dtNormal: number; dtLaser: number; dtFire: number; dtPlasma: number; dtExplosion: number;
    drNormal: number; drLaser: number; drFire: number; drPlasma: number; drExplosion: number;
  } | null;
  /** Ids that were not recognised. */
  unknownIds: string[];
}

export function computeModEffects(weaponOrIds: Weapon | string[] | null | undefined): AggregatedModEffects {
  const ids: string[] = Array.isArray(weaponOrIds)
    ? weaponOrIds
    : (weaponOrIds?.mods ?? []);

  const eff: AggregatedModEffects = {
    toHit: 0, damage: 0, range: 0, magazineMult: 1,
    negatesAimedPenalty: false, ignoresLightPenalty: false, forcesAimed: false,
    silencer: false, sling: false, festering: false, barbed: false,
    reloadApOverride: undefined, poisons: [], acBonus: 0, shieldProtection: null, unknownIds: [],
  };

  for (const id of ids) {
    const mod = getModById(id);
    if (!mod) { eff.unknownIds.push(id); continue; }
    if (mod.toHitBonus) eff.toHit += mod.toHitBonus;
    if (mod.damageBonus) eff.damage += mod.damageBonus;
    if (mod.rangeBonus) eff.range += mod.rangeBonus;
    if (mod.magazineMult) eff.magazineMult *= mod.magazineMult;
    if (mod.negatesAimedPenalty) eff.negatesAimedPenalty = true;
    if (mod.ignoresLightPenalty) eff.ignoresLightPenalty = true;
    if (mod.forcesAimed) eff.forcesAimed = true;
    if (mod.silencer) eff.silencer = true;
    if (mod.sling) eff.sling = true;
    if (mod.festering) eff.festering = true;
    if (mod.barbed) eff.barbed = true;
    if (mod.reloadApOverride !== undefined) {
      eff.reloadApOverride = eff.reloadApOverride === undefined
        ? mod.reloadApOverride
        : Math.min(eff.reloadApOverride, mod.reloadApOverride);
    }
    if (mod.poison) eff.poisons.push(mod.poison);
    if (mod.acBonus) eff.acBonus += mod.acBonus;
    if (mod.shieldDt || mod.shieldDr) {
      const p = eff.shieldProtection ?? {
        dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
        drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
      };
      if (mod.shieldDt) {
        p.dtNormal += mod.shieldDt.normal; p.dtLaser += mod.shieldDt.laser; p.dtFire += mod.shieldDt.fire;
        p.dtPlasma += mod.shieldDt.plasma; p.dtExplosion += mod.shieldDt.explosion;
      }
      if (mod.shieldDr) {
        p.drNormal += mod.shieldDr.normal; p.drLaser += mod.shieldDr.laser; p.drFire += mod.shieldDr.fire;
        p.drPlasma += mod.shieldDr.plasma; p.drExplosion += mod.shieldDr.explosion;
      }
      eff.shieldProtection = p;
    }
  }

  return eff;
}

// ─── Backward-compatible exports (legacy WeaponMod shape) ─────────────────────
// These preserve the API previously exported from data/weapons.ts so callers
// can swap their import path with no other changes.
export const WEAPON_MODS: WeaponMod[] = WEAPON_MOD_DEFS.map(m => ({
  id: m.id,
  name: m.name,
  toHitBonus: m.toHitBonus ?? 0,
  damageBonus: m.damageBonus ?? 0,
  rangeBonus: m.rangeBonus ?? 0,
  description: m.description,
}));

export const MOD_TO_HIT_BONUS: Record<string, number> = {};
export const MOD_DAMAGE_BONUS: Record<string, number> = {};
WEAPON_MOD_DEFS.forEach(m => {
  MOD_TO_HIT_BONUS[m.id] = m.toHitBonus ?? 0;
  MOD_DAMAGE_BONUS[m.id] = m.damageBonus ?? 0;
});

export function computeModBonuses(modIds: string[]): { toHit: number; damage: number; range: number } {
  const eff = computeModEffects(modIds);
  return { toHit: eff.toHit, damage: eff.damage, range: eff.range };
}
