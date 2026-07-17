import { Character, CharacterSkills, SPECIALStats } from '@/context/types';

// ─── Derived Stat Formulas ────────────────────────────────────────────────────

export function calcMaxHP(special: SPECIALStats, level: number, raceBonusHPPerLevel: number = 0): number {
  const base = 15 + 2 * special.endurance + special.luck;
  const levelBonus = (level - 1) * (1 + Math.floor(special.endurance / 2) + raceBonusHPPerLevel);
  return base + levelBonus;
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

export function calcMeleeDamageBonus(special: SPECIALStats): number {
  return Math.max(0, Math.floor(special.strength / 2) - 2);
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
