import type { Character, CharacterSkills, SPECIALStats } from '@/context/types';

// ─── Derived Stat Formulas ────────────────────────────────────────────────────

export function calcMaxHP(special: SPECIALStats, level: number, raceBonusHPPerLevel: number = 0): number {
  const base = 15 + 2 * special.endurance + special.luck;
  const levelBonus = (level - 1) * (1 + Math.floor(special.endurance / 2) + raceBonusHPPerLevel);
  return base + levelBonus;
}

/** NPCs preserve their printed/template HP at level 1, then gain HP using the
 * normal per-level formula instead of replacing that baseline with PC HP. */
export function calcNpcMaxHP(
  baseMaxHp: number,
  special: SPECIALStats,
  level: number,
  raceBonusHPPerLevel: number = 0,
): number {
  const levelsGained = Math.max(0, level - 1);
  return baseMaxHp + levelsGained * (1 + Math.floor(special.endurance / 2) + raceBonusHPPerLevel);
}

export function calcMaxAP(special: SPECIALStats): number {
  return 5 + Math.floor(special.agility / 2);
}

export function calcBaseAC(special: SPECIALStats): number {
  return special.agility;
}

export function calcSequence(special: SPECIALStats): number {
  return special.perception * 2;
}

export function calcHealingRate(special: SPECIALStats): number {
  return Math.max(1, Math.floor(special.endurance / 3));
}

export function calcCriticalChance(special: SPECIALStats): number {
  return Math.floor(special.luck / 2);
}

// Manual: "5 + (2 X IN) skill points to distribute among their skills" per level
export function calcSkillPointsPerLevel(special: SPECIALStats): number {
  return 5 + 2 * special.intelligence;
}

// ─── XP Table (from the manual) ───────────────────────────────────────────────
// Level 1: 0, 2: 1,000, 3: 3,000 ... triangular progression; 22+: +40,000/level
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 21) return 500 * level * (level - 1); // 1k, 3k, 6k, 10k ... 210k at 21
  return 210000 + (level - 21) * 40000;
}

export function levelForXP(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 99) level++;
  return level;
}

export function calcCarryWeight(special: SPECIALStats): number {
  return 25 + special.strength * 25;
}

/** Melee Damage (MD) per the manual's STR table: STR 1-6 → 1, then +1 per
 *  point above 6 (7→2, 8→3, … "and so on"). Minimum 1. */
export function calcMeleeDamageBonus(special: SPECIALStats): number {
  return Math.max(1, special.strength - 5);
}

// ─── Base Skill Values from SPECIAL ──────────────────────────────────────────

export function calcBaseSkills(special: SPECIALStats): CharacterSkills {
  const { strength: str, perception: per, endurance: end, charisma: cha, intelligence: int, agility: agi, luck: lck } = special;
  return {
    smallGuns:     5 + agi * 4,
    bigGuns:       agi * 2,
    energyWeapons: agi * 2,
    meleeWeapons:  str * 2 + agi * 2,
    unarmed:       agi * 2 + str * 2,
    throwing:      agi * 4,
    firstAid:      per * 2 + int * 2,
    doctor:        per + int,
    sneak:         5 + agi * 3,
    lockpick:      10 + per + agi,
    steal:         agi * 3,
    traps:         10 + per + agi,
    science:       int * 4,
    repair:        int * 3,
    speech:        cha * 5,
    barter:        cha * 4,
    gambling:      lck * 5,
    outdoorsman:   end * 2 + int * 2,
    pilot:         per * 2 + int * 2,
  };
}

// ─── Tagged Skill Bonus (+20%) ────────────────────────────────────────────────

export function applyTaggedBonus(skills: CharacterSkills, taggedSkills: string[]): CharacterSkills {
  const result = { ...skills };
  for (const tag of taggedSkills) {
    const k = tag as keyof CharacterSkills;
    if (k in result) result[k] = result[k] + 20;
  }
  return result;
}

// ─── Perk-driven derived-stat bonuses ────────────────────────────────────────
// Structured numeric perk effects that change character-sheet numbers.
export interface PerkDerivedBonuses {
  maxHP: number;          // Lifegiver: +4 max HP per level per rank
  sequence: number;       // Earlier Sequence: +2 per rank
  healingRate: number;    // Faster Healing / Fast Metabolism / Cancerous Growth
  carryWeight: number;    // Pack Rat: +10 lbs and Strong Back: +50 lbs per rank
  doubleHPPerLevel: boolean; // Brutish Hulk: double HP gained per level
  /** Levels gained since Brutish Hulk was taken (for the doubled HP). */
  doubleHPLevels: number;
  notes: string[];
}

export function computePerkDerivedBonuses(
  perks: { perkId: string; rank: number; takenAtLevel?: number }[] | undefined,
  level: number,
): PerkDerivedBonuses {
  const out: PerkDerivedBonuses = { maxHP: 0, sequence: 0, healingRate: 0, carryWeight: 0, doubleHPPerLevel: false, doubleHPLevels: 0, notes: [] };
  for (const cp of perks ?? []) {
    // Per-level HP perks only count levels gained AFTER the perk was taken
    // (no retroactive award). Older saves without takenAtLevel get 0 until
    // the character levels up again.
    const levelsSince = Math.max(0, level - (cp.takenAtLevel ?? level));
    switch (cp.perkId) {
      case 'lifegiver':
        out.maxHP += 4 * cp.rank * levelsSince;
        out.notes.push(`Lifegiver: +${4 * cp.rank} max HP per level (from Lv ${cp.takenAtLevel ?? level})`);
        break;
      case 'earlier_sequence':
        out.sequence += 2 * cp.rank;
        out.notes.push(`Earlier Sequence: +${2 * cp.rank} Sequence`);
        break;
      case 'faster_healing':
        out.healingRate += 2 * cp.rank;
        out.notes.push(`Faster Healing: +${2 * cp.rank} Healing Rate`);
        break;
      case 'cancerous_growth':
        out.healingRate += 2;
        out.notes.push('Cancerous Growth: +2 Healing Rate');
        break;
      case 'pack_rat':
        out.carryWeight += 10 * cp.rank;
        out.notes.push(`Pack Rat: +${10 * cp.rank} lbs carry weight`);
        break;
      case 'strong_back':
        out.carryWeight += 50 * cp.rank;
        out.notes.push(`Strong Back: +${50 * cp.rank} lbs carry weight`);
        break;
      case 'brutish_hulk':
        out.doubleHPPerLevel = true;
        out.doubleHPLevels = levelsSince;
        out.notes.push('Brutish Hulk: double HP gained per level');
        break;
    }
  }
  return out;
}

/** Extra max HP from Brutish Hulk = the per-level HP gain again, for each
 *  level gained since the perk was taken (no retroactive award). */
export function brutishHulkExtraHP(special: SPECIALStats, levelsSince: number, raceBonusHPPerLevel: number = 0): number {
  return Math.max(0, levelsSince) * (1 + Math.floor(special.endurance / 2) + raceBonusHPPerLevel);
}

// ─── Effective AC (position + armor + tempAC) ────────────────────────────────

export function calcEffectiveAC(
  special: SPECIALStats,
  position: Character['position'],
  armorACBonus: number,
  tempAC: number,
): number {
  // Base AC from agility, modified by position
  let baseAC = special.agility;
  if (position === 'crouching') baseAC = Math.min(baseAC, 3);
  else if (position === 'prone') baseAC = Math.min(baseAC, 1);
  return baseAC + armorACBonus + tempAC;
}

// ─── STR Requirement Penalty ─────────────────────────────────────────────────
// For normal characters: -20% per point below minStr
// For Super Mutants: -20% per point below 5 (threshold)
export function calcStrRequirementPenalty(
  charStr: number,
  weaponMinStr: number,
  raceThreshold: number = 0,
  racePenaltyPerPoint: number = 0,
): number {
  const normalPenalty = charStr < weaponMinStr ? (weaponMinStr - charStr) * 20 : 0;
  const racePenalty   = raceThreshold > 0 && charStr < raceThreshold
    ? (raceThreshold - charStr) * racePenaltyPerPoint
    : 0;
  return Math.max(normalPenalty, racePenalty);
}
