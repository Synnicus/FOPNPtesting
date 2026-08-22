/**
 * Special Unarmed Attack techniques — Fallout PnP 2.0
 * Manual citation: pp. 18–19 "Special Unarmed Attacks" table.
 *
 * Armor-piercing effect means the attacker's roll-to-hit ignores the
 * defender's Armor Class bonus.  It does NOT bypass Damage Threshold
 * or Damage Resistance — those are resolved normally after a hit lands.
 * (Manual p. 18 footnote: "the attack bypasses the target's armor class".)
 */

import type { SPECIALStats, CharacterSkills } from '@/context/types';

// ─── Group ────────────────────────────────────────────────────────────────────

/** Four groups as laid out in the manual table (p. 18–19). */
export type SpecialUnarmedGroup =
  | 'primaryPunch'
  | 'secondaryPunch'
  | 'primaryKick'
  | 'secondaryKick';

// ─── Requirements ─────────────────────────────────────────────────────────────

/**
 * Per-technique requirements exactly as printed (pp. 18–19).
 * `unarmedSkill` is the stored (pre-tagged) skill minimum.
 * The effective skill used for eligibility is stored + tagged +20 bonus
 * (see `effectiveUnarmedSkill`).
 */
export interface SpecialUnarmedRequirements {
  /** Minimum effective Unarmed skill (stored + tagged +20 if tagged). */
  unarmedSkill: number;
  /** Minimum Agility SPECIAL stat. */
  agility: number;
  /** Minimum Strength SPECIAL stat. */
  strength: number;
  /** Minimum character level. */
  level: number;
}

// ─── Technique ────────────────────────────────────────────────────────────────

export interface SpecialUnarmedAttack {
  /** Unique slug id, e.g. "strong_punch". */
  id: string;
  /** Display name as printed. */
  name: string;
  /** Manual group. */
  group: SpecialUnarmedGroup;
  /** AP cost of the technique (manual column "AP"). */
  ap: number;
  /** Flat damage bonus added on top of the base unarmed attack (manual column "Dam Bonus"). */
  damageBonus: number;
  /**
   * Flat critical-hit chance bonus in percentage points (manual column "Crit Bonus").
   * 0 = no crit bonus listed.
   */
  critBonus: number;
  /**
   * When true the attack ignores the defender's Armor Class for the to-hit
   * roll.  DT/DR still apply after the hit lands.
   * Manual pp. 18–19: marked "AP*" in the effects column.
   */
  armorClassPiercing: boolean;
  /** Minimum requirements to use this technique. */
  requirements: SpecialUnarmedRequirements;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * All 12 Special Unarmed Attack techniques from Fallout PnP 2.0 pp. 18–19.
 *
 * Columns reproduced verbatim:
 *   Name | Dam Bonus | Crit Bonus | AP | Unarmed% | AGI | STR | Level
 *
 * Primary Punches (p. 18):
 *   Strong Punch     | +3  |      | 3 AP | U55  | AGI6 |      | —
 *   Hammer Punch     | +5  | +5   | 3 AP | U75  | AGI6 | STR5 | L6
 *   Haymaker         | +7  | +15  | 3 AP | U100 | AGI7 | STR5 | L9
 *
 * Secondary Punches (p. 18):
 *   Jab              | +3  | +10  | 3 AP | U75  | AGI7 | STR5 | L5
 *   Palm Strike      | +7  | +20  | 6 AP | U115 | AGI7 | STR5 | L12 [AP*]
 *   Piercing Strike  | +10 | +40  | 8 AP | U130 | AGI7 | STR5 | L16 [AP*]
 *
 * Primary Kicks (p. 19):
 *   Strong Kick      | +5  |      | 4 AP | U40  | AGI6 |      | —
 *   Snap Kick        | +7  |      | 4 AP | U60  | AGI6 | STR6 | L6
 *   Power Kick       | +9  | +5   | 4 AP | U80  | AGI6 | STR6 | L9
 *
 * Secondary Kicks (p. 19):
 *   Hip Kick         | +7  |      | 7 AP | U60  | AGI7 | STR6 | L6
 *   Hook Kick        | +9  | +10  | 7 AP | U100 | AGI7 | STR6 | L12 [AP*]
 *   Piercing Kick    | +12 | +50  | 9 AP | U125 | AGI8 | STR6 | L15 [AP*]
 */
export const SPECIAL_UNARMED_ATTACKS: SpecialUnarmedAttack[] = [

  // ── Primary Punches ────────────────────────────────────────────────── p. 18

  {
    id: 'strong_punch',
    name: 'Strong Punch',
    group: 'primaryPunch',
    ap: 3,
    damageBonus: 3,
    critBonus: 0,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 55, agility: 6, strength: 1, level: 1 },
    // p. 18: "Strong Punch — +3 Dam, 3 AP, U55%, AGI6"
    // No STR requirement and no level requirement printed; using floor values.
  },
  {
    id: 'hammer_punch',
    name: 'Hammer Punch',
    group: 'primaryPunch',
    ap: 3,
    damageBonus: 5,
    critBonus: 5,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 75, agility: 6, strength: 5, level: 6 },
    // p. 18: "Hammer Punch — +5 Dam, +5 Crit, 3 AP, U75%, AGI6, STR5, L6"
  },
  {
    id: 'haymaker',
    name: 'Haymaker',
    group: 'primaryPunch',
    ap: 3,
    damageBonus: 7,
    critBonus: 15,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 100, agility: 7, strength: 5, level: 9 },
    // p. 18: "Haymaker — +7 Dam, +15 Crit, 3 AP, U100%, AGI7, STR5, L9"
  },

  // ── Secondary Punches ─────────────────────────────────────────────── p. 18

  {
    id: 'jab',
    name: 'Jab',
    group: 'secondaryPunch',
    ap: 3,
    damageBonus: 3,
    critBonus: 10,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 75, agility: 7, strength: 5, level: 5 },
    // p. 18: "Jab — +3 Dam, +10 Crit, 3 AP, U75%, AGI7, STR5, L5"
  },
  {
    id: 'palm_strike',
    name: 'Palm Strike',
    group: 'secondaryPunch',
    ap: 6,
    damageBonus: 7,
    critBonus: 20,
    armorClassPiercing: true,
    requirements: { unarmedSkill: 115, agility: 7, strength: 5, level: 12 },
    // p. 18: "Palm Strike — +7 Dam, +20 Crit, AP*, 6 AP, U115%, AGI7, STR5, L12"
    // AP* = armor-class piercing (to-hit only; DT/DR unaffected).
  },
  {
    id: 'piercing_strike',
    name: 'Piercing Strike',
    group: 'secondaryPunch',
    ap: 8,
    damageBonus: 10,
    critBonus: 40,
    armorClassPiercing: true,
    requirements: { unarmedSkill: 130, agility: 7, strength: 5, level: 16 },
    // p. 18: "Piercing Strike — +10 Dam, +40 Crit, AP*, 8 AP, U130%, AGI7, STR5, L16"
  },

  // ── Primary Kicks ─────────────────────────────────────────────────── p. 19

  {
    id: 'strong_kick',
    name: 'Strong Kick',
    group: 'primaryKick',
    ap: 4,
    damageBonus: 5,
    critBonus: 0,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 40, agility: 6, strength: 1, level: 1 },
    // p. 18: "Strong Kick — +5 Dam, 4 AP, U40%, AGI6"
    // No STR requirement and no level requirement printed; using floor values.
  },
  {
    id: 'snap_kick',
    name: 'Snap Kick',
    group: 'primaryKick',
    ap: 4,
    damageBonus: 7,
    critBonus: 0,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 60, agility: 6, strength: 6, level: 6 },
    // p. 19: "Snap Kick — +7 Dam, 4 AP, U60%, AGI6, STR6, L6"
  },
  {
    id: 'power_kick',
    name: 'Power Kick',
    group: 'primaryKick',
    ap: 4,
    damageBonus: 9,
    critBonus: 5,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 80, agility: 6, strength: 6, level: 9 },
    // p. 19: "Power Kick — +9 Dam, +5 Crit, 4 AP, U80%, AGI6, STR6, L9"
  },

  // ── Secondary Kicks ───────────────────────────────────────────────── p. 19

  {
    id: 'hip_kick',
    name: 'Hip Kick',
    group: 'secondaryKick',
    ap: 7,
    damageBonus: 7,
    critBonus: 0,
    armorClassPiercing: false,
    requirements: { unarmedSkill: 60, agility: 7, strength: 6, level: 6 },
    // p. 19: "Hip Kick — +7 Dam, 7 AP, U60%, AGI7, STR6, L6"
  },
  {
    id: 'hook_kick',
    name: 'Hook Kick',
    group: 'secondaryKick',
    ap: 7,
    damageBonus: 9,
    critBonus: 10,
    armorClassPiercing: true,
    requirements: { unarmedSkill: 100, agility: 7, strength: 6, level: 12 },
    // p. 19: "Hook Kick — +9 Dam, +10 Crit, AP*, 7 AP, U100%, AGI7, STR6, L12"
  },
  {
    id: 'piercing_kick',
    name: 'Piercing Kick',
    group: 'secondaryKick',
    ap: 9,
    damageBonus: 12,
    critBonus: 50,
    armorClassPiercing: true,
    requirements: { unarmedSkill: 125, agility: 8, strength: 6, level: 15 },
    // p. 19: "Piercing Kick — +12 Dam, +50 Crit, AP*, 9 AP, U125%, AGI8, STR6, L15"
  },
];

// ─── Lookup ───────────────────────────────────────────────────────────────────

/** Look up a technique by id. Returns undefined when not found. */
export function getSpecialUnarmedAttack(id: string): SpecialUnarmedAttack | undefined {
  return SPECIAL_UNARMED_ATTACKS.find(t => t.id === id);
}

/** Return all techniques belonging to a given group. */
export function getSpecialUnarmedAttacksByGroup(
  group: SpecialUnarmedGroup,
): SpecialUnarmedAttack[] {
  return SPECIAL_UNARMED_ATTACKS.filter(t => t.group === group);
}

// ─── Effective Unarmed Skill Helper ──────────────────────────────────────────

/**
 * Returns the effective Unarmed skill used for requirement checks.
 *
 * Per the manual (p. 10, Tagged Skills): a tagged skill receives a free +20
 * bonus at character creation.  Stored `skills.unarmed` already incorporates
 * all spent points; this helper adds the +20 if the skill is tagged.
 *
 * @param skills       The character's current skill totals (stored values).
 * @param taggedSkills The list of skill ids the character has tagged.
 */
export function effectiveUnarmedSkill(
  skills: Pick<CharacterSkills, 'unarmed'>,
  taggedSkills: readonly string[],
): number {
  const base = skills.unarmed;
  const tagBonus = taggedSkills.includes('unarmed') ? 20 : 0;
  return base + tagBonus;
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

/** Result of evaluating a single requirement gate. */
export interface RequirementCheck {
  label: string;
  current: number;
  required: number;
  met: boolean;
}

/** Full eligibility result for one technique. */
export interface EligibilityResult {
  techniqueId: string;
  eligible: boolean;
  checks: RequirementCheck[];
}

/**
 * Evaluate whether a character meets all requirements for a given technique.
 *
 * @param technique    The technique to check.
 * @param level        Character level.
 * @param special      Character SPECIAL stats.
 * @param skills       Character skill values (stored, pre-tagged).
 * @param taggedSkills Skill ids that are tagged (for the +20 effective bonus).
 *
 * Returns an `EligibilityResult` with per-requirement current/required/met
 * comparisons, suitable for UI display or unit testing.
 */
export function evaluateEligibility(
  technique: SpecialUnarmedAttack,
  level: number,
  special: SPECIALStats,
  skills: Pick<CharacterSkills, 'unarmed'>,
  taggedSkills: readonly string[],
): EligibilityResult {
  const req = technique.requirements;
  const effUnarmed = effectiveUnarmedSkill(skills, taggedSkills);

  const checks: RequirementCheck[] = [
    {
      label: 'Unarmed%',
      current: effUnarmed,
      required: req.unarmedSkill,
      met: effUnarmed >= req.unarmedSkill,
    },
    {
      label: 'AGI',
      current: special.agility,
      required: req.agility,
      met: special.agility >= req.agility,
    },
    {
      label: 'STR',
      current: special.strength,
      required: req.strength,
      met: special.strength >= req.strength,
    },
    {
      label: 'Level',
      current: level,
      required: req.level,
      met: level >= req.level,
    },
  ];

  return {
    techniqueId: technique.id,
    eligible: checks.every(c => c.met),
    checks,
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Returns a concise human-readable summary of a technique's combat effects.
 *
 * Example outputs:
 *   "Damage +3"
 *   "Damage +7, Crit +20%, Armor Class Piercing (to-hit only)"
 */
export function formatEffects(technique: SpecialUnarmedAttack): string {
  const parts: string[] = [];
  parts.push(`Damage +${technique.damageBonus}`);
  if (technique.critBonus > 0) {
    parts.push(`Crit +${technique.critBonus}%`);
  }
  if (technique.armorClassPiercing) {
    parts.push('Armor Class Piercing (to-hit only)');
  }
  parts.push(`${technique.ap} AP`);
  return parts.join(', ');
}

/**
 * Returns a concise human-readable summary of a technique's requirements.
 *
 * Example output: "U75%, AGI7, STR5, L5"
 */
export function formatRequirements(technique: SpecialUnarmedAttack): string {
  const { unarmedSkill, agility, strength, level } = technique.requirements;
  const parts: string[] = [`U${unarmedSkill}%`, `AGI${agility}`];
  if (strength > 1) parts.push(`STR${strength}`);
  if (level > 1) parts.push(`L${level}`);
  return parts.join(', ');
}
