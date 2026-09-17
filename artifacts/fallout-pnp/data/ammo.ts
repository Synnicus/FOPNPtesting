import type { PoisonSpec } from './mods.ts';
import type { Weapon } from '../context/types.ts';

// ─── Ammunition — Fallout PnP 2.0 manual "Ammunition for Guns" chapter ────────
// Every entry is transcribed from the manual's ammo table (values, AC/DR
// target modifiers, Ignores DT flag, Volume, and the ammo's own Dmg dice).
// Guns list their damage in the manual as "(gun dice + Ammo)", so the base
// dice below are the AMMO's contribution; combine with the weapon's own bonus
// for a full damage breakdown.

export interface AmmoType {
  id: string;
  name: string;
  /** Caps value per the manual's "Value:" line. */
  value: number;
  /** Modifier applied to the TARGET's Armor Class (manual "AC:"). */
  acMod: number;
  /** Modifier applied to the TARGET's Damage Resistance % (manual "DR:"). */
  drMod: number;
  /** Whether the round bypasses the target's Damage Threshold (manual "Ignores DT"). */
  ignoresDT?: boolean;
  /** The ammo's own damage dice count (manual "Dmg: XdY"). 0 = special/none. */
  dmgDieCount: number;
  /** The ammo's own damage die size (manual "Dmg: XdY"). 0 = special/none. */
  dmgDie: number;
  /** Flat bonus added to the ammo's own dice (manual "Dmg: XdY+Z"). */
  dmgBonus: number;
  /** Manual "Vol:" (rounds per unit of inventory volume). */
  volume: number;
  notes?: string;
  /** Poison delivered on a successful hit after a poison-resistance roll. */
  poison?: PoisonSpec;
}

export const AMMO_TYPES: AmmoType[] = [
  // ─── Basic / primitive ────────────────────────────────────────────
  { id: 'bb', name: 'BBs', value: 100, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 4, dmgBonus: 0, volume: 100 },
  { id: 'arrow', name: 'Arrow', value: 5, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 4, dmgBonus: 0, volume: 5 },
  { id: 'dart', name: 'Dart', value: 5, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 3, dmgBonus: 0, volume: 5 },
  { id: 'bolt', name: 'Bolt', value: 5, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 5 },
  { id: 'speargun_bolt', name: 'Speargun Bolt', value: 5, acMod: -10, drMod: 0, dmgDieCount: 3, dmgDie: 4, dmgBonus: 0, volume: 1 },

  // ─── Pistol / rifle calibers ──────────────────────────────────────
  { id: '22', name: '.22', value: 150, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 50 },
  { id: '223_fmj', name: '.223 FMJ', value: 400, acMod: 0, drMod: -10, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 20 },
  { id: '223_ap', name: '.223 AP', value: 400, acMod: -15, drMod: 0, ignoresDT: true, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 20 },
  { id: '2mm_ec', name: '2mm EC', value: 2000, acMod: -20, drMod: -20, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 20 },
  { id: '47mm_caseless', name: '4.7mm Caseless', value: 1000, acMod: -10, drMod: -10, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 20 },
  { id: '5mm', name: '5mm', value: 500, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 50 },
  { id: '308', name: '.308', value: 400, acMod: -15, drMod: -20, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 50 },
  { id: '556mm', name: '5.56mm', value: 600, acMod: 0, drMod: -20, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 50 },
  { id: '357_magnum', name: '.357 Magnum', value: 150, acMod: -10, drMod: -10, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 50 },
  { id: '762mm', name: '7.62mm', value: 300, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 50 },
  { id: '38', name: '.38 Caliber', value: 100, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 10 },
  { id: '44_magnum_jhp', name: '.44 Magnum JHP', value: 200, acMod: 0, drMod: -10, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 20 },
  { id: '765mm', name: '7.65mm', value: 300, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 50 },
  { id: '44_magnum_ap', name: '.44 Magnum AP', value: 250, acMod: -10, drMod: 0, ignoresDT: true, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 20 },
  { id: '9mm_jhp', name: '9mm JHP', value: 200, acMod: 0, drMod: -10, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 20 },
  { id: '45', name: '.45 Caliber', value: 150, acMod: 0, drMod: -5, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 50 },
  { id: '9mm_ap', name: '9mm AP', value: 250, acMod: -10, drMod: 0, ignoresDT: true, dmgDieCount: 1, dmgDie: 4, dmgBonus: 0, volume: 20 },
  { id: '50', name: '.50', value: 800, acMod: -10, drMod: -10, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 100 },
  { id: '9mm_ball', name: '9mm Ball', value: 300, acMod: 0, drMod: -10, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 20 },
  { id: '50_uc', name: '.50 UC (Uranium Coated)', value: 1600, acMod: -30, drMod: -50, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 100 },
  { id: '10mm_jhp', name: '10mm JHP', value: 300, acMod: 0, drMod: -10, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 20 },
  { id: '50_bmg', name: '.50 BMG', value: 1000, acMod: -10, drMod: -20, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, volume: 100 },
  { id: '10mm_ap', name: '10mm AP', value: 350, acMod: -10, drMod: 0, ignoresDT: true, dmgDieCount: 1, dmgDie: 4, dmgBonus: 0, volume: 20 },
  { id: '14mm_jhp', name: '14mm JHP', value: 1000, acMod: 0, drMod: -20, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 20 },
  { id: '14mm_ap', name: '14mm AP', value: 1200, acMod: -20, drMod: 0, ignoresDT: true, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 20 },

  // ─── Shotgun shells (12 gauge) ────────────────────────────────────
  { id: '12ga_buckshot', name: '12 Gauge Shotgun Shells (Buckshot)', value: 150, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 20 },
  { id: '12ga_slugs', name: '12 Gauge Shotgun Shells (Slugs)', value: 150, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 8, dmgBonus: 0, volume: 20 },
  { id: '12ga_emp', name: '12 Gauge Shotgun Shells (EMP)', value: 500, acMod: 0, drMod: 0, dmgDieCount: 2, dmgDie: 20, dmgBonus: 0, volume: 20, notes: 'Non-biological targets only.' },
  { id: '12ga_rubber', name: '12 Gauge Shotgun Shells (Rubber)', value: 100, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 4, dmgBonus: 0, volume: 20 },

  // ─── HN Needler ───────────────────────────────────────────────────
  { id: 'hn_needler', name: 'HN Needler (Normal)', value: 1500, acMod: 0, drMod: 0, dmgDieCount: 3, dmgDie: 10, dmgBonus: 0, volume: 10 },
  { id: 'hn_needler_ap', name: 'HN Needler AP (Normal)', value: 2000, acMod: 0, drMod: 0, ignoresDT: true, dmgDieCount: 2, dmgDie: 8, dmgBonus: 0, volume: 10 },
  { id: 'hn_needler_poison', name: 'HN Needler Poison', value: 2300, acMod: 0, drMod: 0, dmgDieCount: 0, dmgDie: 0, dmgBonus: 0, volume: 10, notes: 'Poison Type G.', poison: { type: 'G', effectText: 'Type G — the worst poison. Death 5 minutes after exposure unless Antidote is administered.' } },
  { id: 'hn_needler_biotoxin', name: 'HN Needler Biotoxin', value: 4000, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 10, dmgBonus: 0, volume: 10, notes: '1d10 per round for 10 rounds.' },

  // ─── Rockets ──────────────────────────────────────────────────────
  { id: 'rocket_explosive', name: 'Rocket (Explosive)', value: 2000, acMod: 0, drMod: 0, dmgDieCount: 6, dmgDie: 8, dmgBonus: 0, volume: 10 },
  { id: 'rocket_ap', name: 'Rocket (AP)', value: 2500, acMod: -10, drMod: 0, ignoresDT: true, dmgDieCount: 6, dmgDie: 6, dmgBonus: 0, volume: 10 },
  { id: 'rocket_emp', name: 'Rocket (EMP)', value: 3000, acMod: 0, drMod: 0, dmgDieCount: 3, dmgDie: 20, dmgBonus: 0, volume: 10, notes: 'Non-biological targets only.' },
  { id: 'tow_ii_rocket', name: 'TOW-II Rocket', value: 5000, acMod: -20, drMod: -20, ignoresDT: true, dmgDieCount: 10, dmgDie: 10, dmgBonus: 200, volume: 5 },

  // ─── Ordinance: grenades for launchers & mortars ──────────────────
  { id: '40mm_frag', name: '40mm Fragmentation Grenade', value: 1000, acMod: 0, drMod: 0, dmgDieCount: 1, dmgDie: 12, dmgBonus: 22, volume: 5, notes: '1d6 Conc., 1d6 Frag.' },
  { id: '40mm_plasma', name: '40mm Plasma Grenade', value: 2000, acMod: 0, drMod: 0, dmgDieCount: 5, dmgDie: 10, dmgBonus: 40, volume: 5, notes: '1d6 Conc.' },
  { id: '40mm_pulse', name: '40mm Pulse Grenade', value: 2000, acMod: 0, drMod: 0, dmgDieCount: 5, dmgDie: 10, dmgBonus: 100, volume: 5, notes: 'Non-biological targets only.' },
  { id: '51mm_explosive_mortar', name: '51mm Explosive Mortar Shell', value: 4000, acMod: 0, drMod: 0, dmgDieCount: 10, dmgDie: 10, dmgBonus: 0, volume: 5, notes: '10d10 within 20m; 1d6 concussion within 50m.' },
  { id: '51mm_gas_mortar', name: '51mm Gas Mortar Shell', value: 6000, acMod: 0, drMod: 0, dmgDieCount: 7, dmgDie: 10, dmgBonus: 0, volume: 5, notes: '7d10 + unconsciousness to all within 100m.' },
  { id: '60mm_explosive_mortar', name: '60mm Explosive Mortar Shell', value: 3000, acMod: 0, drMod: 0, dmgDieCount: 10, dmgDie: 10, dmgBonus: 0, volume: 5, notes: '10d10 within 20m; 1d6 concussion within 50m.' },
  { id: '60mm_plasma_mortar', name: '60mm Plasma Mortar Shell', value: 5000, acMod: 0, drMod: 0, dmgDieCount: 10, dmgDie: 20, dmgBonus: 0, volume: 5, notes: '10d20 to everything within 20m.' },
  { id: '60mm_pulse_mortar', name: '60mm Pulse Mortar Shell', value: 7000, acMod: 0, drMod: 0, dmgDieCount: 20, dmgDie: 20, dmgBonus: 0, volume: 5, notes: '20d20 to non-biological things within 20m.' },

  // ─── Flamer fuel packs ────────────────────────────────────────────
  { id: 'flamer_fire_pack', name: 'Flamer Fire Pack (10 shots)', value: 2000, acMod: 0, drMod: -10, dmgDieCount: 3, dmgDie: 8, dmgBonus: 0, volume: 10, notes: 'Plus fire.' },
  { id: 'flamer_plasma_pack', name: 'Flamer Plasma Pack (10 Shots)', value: 3000, acMod: -10, drMod: -10, dmgDieCount: 5, dmgDie: 10, dmgBonus: 40, volume: 10 },
  { id: 'flamer_poison_gas_pack', name: 'Flamer Poison Gas Pack', value: 5000, acMod: 0, drMod: 0, dmgDieCount: 0, dmgDie: 0, dmgBonus: 0, volume: 5, notes: 'Poison Type F to all non-protected critters in 4 hexes of stream.', poison: { type: 'F', effectText: 'Type F — victim goes into shock ~1 hour after contact, coma 1d10 days; roll EN each day untreated or die.' } },

  // ─── Energy weapon cells ──────────────────────────────────────────
  { id: 'small_energy_cell', name: 'Small Energy Cell', value: 2000, acMod: 0, drMod: 0, dmgDieCount: 0, dmgDie: 0, dmgBonus: 0, volume: 20, notes: 'Recharges the weapon; no inherent damage dice.' },
  { id: 'micro_fusion_cell', name: 'Micro Fusion Cell', value: 2000, acMod: 0, drMod: 0, dmgDieCount: 0, dmgDie: 0, dmgBonus: 0, volume: 20, notes: 'Recharges the weapon; no inherent damage dice.' },
];

export function getAmmoById(id: string): AmmoType | undefined {
  return AMMO_TYPES.find(a => a.id === id);
}

/** Resolve a persisted selection, falling back to the weapon's first valid
 * compatible ammo type. This makes legacy/empty ammo states mechanically use
 * the same default round shown in the UI. */
export function resolveEquippedAmmoType(
  weapon: Pick<Weapon, 'compatibleAmmo'> | null | undefined,
  ammoTypeId?: string,
): AmmoType | undefined {
  const compatibleIds = weapon?.compatibleAmmo ?? [];
  if (ammoTypeId && compatibleIds.includes(ammoTypeId)) {
    const selected = getAmmoById(ammoTypeId);
    if (selected) return selected;
  }
  for (const compatibleId of compatibleIds) {
    const fallback = getAmmoById(compatibleId);
    if (fallback) return fallback;
  }
  return undefined;
}

export function resolveEquippedAmmoTypeId(
  weapon: Pick<Weapon, 'compatibleAmmo'> | null | undefined,
  ammoTypeId?: string,
): string | undefined {
  return resolveEquippedAmmoType(weapon, ammoTypeId)?.id;
}

/** Human-readable modifier summary for combat breakdowns, e.g. "AC -15, ignores DT, +1d6". */
export function describeAmmoMods(ammo: AmmoType): string {
  const parts: string[] = [];
  if (ammo.acMod !== 0) parts.push(`Target AC ${ammo.acMod > 0 ? '+' : ''}${ammo.acMod}`);
  if (ammo.drMod !== 0) parts.push(`Target DR ${ammo.drMod > 0 ? '+' : ''}${ammo.drMod}%`);
  if (ammo.ignoresDT) parts.push('ignores DT');
  if (ammo.dmgDieCount > 0 && ammo.dmgDie > 0) {
    const bonus = ammo.dmgBonus !== 0 ? `${ammo.dmgBonus > 0 ? '+' : ''}${ammo.dmgBonus}` : '';
    parts.push(`+${ammo.dmgDieCount}d${ammo.dmgDie}${bonus} dmg`);
  } else if (ammo.dmgBonus !== 0) {
    parts.push(`${ammo.dmgBonus > 0 ? '+' : ''}${ammo.dmgBonus} dmg`);
  }
  if (parts.length === 0) return ammo.notes ? ammo.notes : 'No combat modifiers';
  return parts.join(', ');
}
