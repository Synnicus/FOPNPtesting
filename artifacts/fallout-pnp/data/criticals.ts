// ─── Critical Hit System — Fallout PnP 2.0 manual ────────────────────────────
// Base Critical Chance = Luck. Perks: More Criticals +5%/rank.
// A successful attack becomes critical if the to-hit roll is <= crit chance.
// Targeted shots add a crit-chance bonus by body part and have fixed effects.
// Non-targeted crits roll 1d10 on the critical hits table.
// Sniper perk: ranged attacks crit on a successful Luck roll (1d10 <= LK).
// Slayer perk: melee/unarmed attacks crit on a successful Luck roll.
// Better Criticals: non-fatal crits deal 150% damage (in addition to other
// bonuses) and limb-damage chance +50%.

import type { Character, Weapon } from '@/context/types';

export type BodyPart = 'torso' | 'head' | 'eyes' | 'groin' | 'arms' | 'legs';

/** Crit-chance bonus for targeted shots, by body part (manual table). */
export const TARGETED_CRIT_BONUS: Record<BodyPart, number> = {
  torso: 0,
  arms: 10,
  legs: 20,
  groin: 20,
  head: 25,
  eyes: 30,
};

/** Protective helmets reduce the chance that a targeted head shot is critical. */
export const HELMET_HEAD_CRIT_REDUCTION = 15;

export function applyHelmetHeadCritReduction(
  chance: number,
  bodyPart: BodyPart | null | undefined,
  hasHelmet: boolean,
): number {
  if (bodyPart !== 'head' || !hasHelmet) return Math.max(0, chance);
  return Math.max(0, chance - HELMET_HEAD_CRIT_REDUCTION);
}

/** Effects of a critical on a TARGETED shot (manual, "Chance for Criticals"). */
export interface TargetedCritEffect {
  damageMultiplier: number;
  cripples?: 'arm' | 'leg';
  blinds?: boolean;
  knocksUnconscious?: boolean;
  label: string;
}

export const TARGETED_CRIT_EFFECTS: Record<BodyPart, TargetedCritEffect> = {
  torso: { damageMultiplier: 2, label: '2× damage' },
  head: { damageMultiplier: 3, label: '3× damage' },
  eyes: { damageMultiplier: 1, blinds: true, label: 'Blindness (PE drops to 1)' },
  groin: { damageMultiplier: 2, knocksUnconscious: true, label: '2× damage + unconscious' },
  arms: { damageMultiplier: 1, cripples: 'arm', label: 'Crippled arm' },
  legs: { damageMultiplier: 1, cripples: 'leg', label: 'Crippled leg' },
};

/** Non-targeted critical hits table (1d10). Manual calls it "Sample Critical
 *  Hits" — display WITHOUT the word "Sample". */
export interface CritTableEntry {
  roll: number;
  title: string;
  description: string;
  damageMultiplier?: number; // applied to the attack's damage
  bypassesArmor?: boolean; // ignore DT and DR
  cripples?: 'arm' | 'leg';
  blinds?: boolean;
  knockdown?: boolean;
  unconsciousTurns?: string; // dice expression, e.g. '1d4'
  instantDeath?: boolean;
}

export const CRITICAL_HIT_TABLE: CritTableEntry[] = [
  { roll: 1, title: 'Crippled Arm', description: 'The blow cripples one of the target\u2019s arms.', cripples: 'arm' },
  { roll: 2, title: 'Crippled Leg', description: 'The blow cripples one of the target\u2019s legs.', cripples: 'leg' },
  { roll: 3, title: '300% Damage', description: 'The attack deals 3 times normal damage.', damageMultiplier: 3 },
  { roll: 4, title: '200% Damage', description: 'The attack deals 2 times normal damage.', damageMultiplier: 2 },
  { roll: 5, title: '150% Damage', description: 'The attack deals 1.5 times normal damage.', damageMultiplier: 1.5 },
  { roll: 6, title: 'Unconsciousness', description: 'The target is knocked unconscious for 1d4 turns.', unconsciousTurns: '1d4' },
  { roll: 7, title: 'Bypasses Armor', description: 'The attack ignores the target\u2019s DT and DR entirely.', bypassesArmor: true },
  { roll: 8, title: 'Blindness', description: 'The target is blinded — Perception lowered to 1.', blinds: true },
  { roll: 9, title: 'Knockdown', description: 'The target is knocked down and must Get Up (4 AP).', knockdown: true },
  { roll: 10, title: 'Instant Death (!)', description: 'The target dies instantly.', instantDeath: true },
];

/** Critical Failure table (1d10). Manual p.31 — an attack that MISSES with a
 *  roll of 97-100% is a Critical Failure; the GM rolls 1d10 on this table.
 *  Effects apply to the ATTACKER (except 4/6 which are display-only notes).
 *  `auto` flags what the app applies automatically. */
export interface CritFailTableEntry {
  roll: number;
  title: string;
  description: string;
  /** Set current ammo to 0 (magazine discarded). */
  emptyAmmo?: boolean;
  /** Weapon jams — fills a condition box; takes 1 turn to unjam. */
  jam?: boolean;
  /** Attacker loses all remaining AP this round. */
  loseAllAP?: boolean;
  /** Explosive/energy weapons only: 3d10+7 damage to everyone within 2 hexes. */
  explode?: boolean;
  /** Half the weapon's normal damage roll to the attacker (armor applies). */
  damageSelfHalf?: boolean;
  /** Lose all AP + go prone; must get up next round; no AGI AC while down. */
  slipAndFall?: boolean;
  /** Weapon breaks beyond repair (condition set to max). */
  breaks?: boolean;
  /** 1d10 raw damage to attacker, ignoring DT and DR. */
  anvil?: boolean;
  /** Display-only note (Dropped Weapon / Hit Something Else). */
  displayOnly?: boolean;
}

export const CRITICAL_FAILURE_TABLE: CritFailTableEntry[] = [
  { roll: 1, title: 'Ammo Problems', description: 'The magazine was damaged or the ammo was bad. The gun does not fire, and the rest of the magazine must be discarded.', emptyAmmo: true },
  { roll: 2, title: 'Weapon Jammed', description: 'Should have cleaned your gun out! The weapon will take 1 turn to unjam, and the ammo inside must be discarded.', jam: true },
  { roll: 3, title: 'Loss of AP', description: 'D\u2019oh! The attacker loses all remaining AP for that round.', loseAllAP: true },
  { roll: 4, title: 'Dropped Weapon', description: 'Something slipped, and the weapon flew out of your hands and hit the ground.', displayOnly: true },
  { roll: 5, title: 'Weapon Explodes', description: 'Something nasty that happens only with explosive or energy weapons. Deals 3d10+7 damage to anyone within 2 hexes of the weapon. OUCH!', explode: true },
  { roll: 6, title: 'Hit Something Else', description: 'You didn\u2019t hit what you were aiming for, but you nailed the next closest target. Hope it wasn\u2019t your buddy...', displayOnly: true },
  { roll: 7, title: 'Damage Self', description: 'You cut yourself on your knife, or shot yourself in the foot. Half the weapon\u2019s normal damage is dealt to YOU instead.', damageSelfHalf: true },
  { roll: 8, title: 'Slip and Fall', description: 'You slip and fall. All remaining AP are gone, and next round you must get up. While down, you lose all Armor Class from Agility.', slipAndFall: true },
  { roll: 9, title: 'Weapon Breaks', description: 'The weapon breaks beyond repair. Time for a new one. Oops.', breaks: true },
  { roll: 10, title: 'Anvil', description: 'A miniature anvil falls out of the sky and strikes you on the head for 1d10 points of damage. No chance to dodge, and DT and DR are disregarded for this strange, magical attack.', anvil: true },
];

/** Damage Self uses half of the weapon's maximum printed damage, before DT/DR. */
export function criticalFailureSelfDamage(
  weapon: Pick<Weapon, 'damageDieCount' | 'damageDie' | 'damageBonus'>,
): number {
  const maximumDamage = Math.max(
    0,
    weapon.damageDieCount * weapon.damageDie + weapon.damageBonus,
  );
  return Math.floor(maximumDamage / 2);
}

/** Base critical chance for a character: Luck + More Criticals ranks ×5. */
export function baseCritChance(char: Pick<Character, 'special' | 'perks' | 'manualDerivedStats'>): number {
  if (char.manualDerivedStats?.criticalChance !== undefined) {
    return char.manualDerivedStats.criticalChance;
  }
  const luck = char.special?.luck ?? 5;
  const moreCrits = (char.perks ?? []).find((p) => p.perkId === 'more_criticals');
  return luck + (moreCrits ? moreCrits.rank * 5 : 0);
}

export function hasPerk(char: Pick<Character, 'perks'>, perkId: string): boolean {
  return (char.perks ?? []).some((p) => p.perkId === perkId);
}
