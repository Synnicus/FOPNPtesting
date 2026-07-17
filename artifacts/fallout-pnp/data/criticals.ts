// ─── Critical Hit System — Fallout PnP 2.0 manual ────────────────────────────
// Base Critical Chance = Luck. Perks: More Criticals +5%/rank.
// A successful attack becomes critical if the to-hit roll is <= crit chance.
// Targeted shots add a crit-chance bonus by body part and have fixed effects.
// Non-targeted crits roll 1d10 on the critical hits table.
// Sniper perk: ranged attacks crit on a successful Luck roll (1d10 <= LK).
// Slayer perk: melee/unarmed attacks crit on a successful Luck roll.
// Better Criticals: non-fatal crits deal 150% damage (in addition to other
// bonuses) and limb-damage chance +50%.

import type { Character } from '@/context/types';

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

/** Base critical chance for a character: Luck + More Criticals ranks ×5. */
export function baseCritChance(char: Pick<Character, 'special' | 'perks'>): number {
  const luck = char.special?.luck ?? 5;
  const moreCrits = (char.perks ?? []).find((p) => p.perkId === 'more_criticals');
  return luck + (moreCrits ? moreCrits.rank * 5 : 0);
}

export function hasPerk(char: Pick<Character, 'perks'>, perkId: string): boolean {
  return (char.perks ?? []).some((p) => p.perkId === perkId);
}
