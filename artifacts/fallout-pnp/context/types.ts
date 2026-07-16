// ─── Primitive Types ────────────────────────────────────────────────────────────
export type DamageType = 'normal' | 'laser' | 'fire' | 'plasma' | 'explosion';
export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  normal: 'N', laser: 'L', fire: 'F', plasma: 'P', explosion: 'E',
};
export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  normal: 'Normal', laser: 'Laser', fire: 'Fire', plasma: 'Plasma', explosion: 'Explosion',
};

export type WeaponCategory = 'smallGuns' | 'bigGuns' | 'energyWeapons' | 'meleeWeapons' | 'unarmed' | 'throwing' | 'natural';
export type ArmorSlot = 'body' | 'helmet';
export type CharacterType = 'pc' | 'npc';
export type RaceType =
  | 'human' | 'ghoul' | 'superMutant' | 'robot'
  | 'deathclaw' | 'dog' | 'molerat' | 'yaoguai'
  | 'radscorpion' | 'centaur' | 'floater' | 'brahmin' | 'customRace';
export type PositionType = 'standing' | 'crouching' | 'prone';
export type BestiaryCategory = 'human' | 'ghoul' | 'mutant' | 'robot' | 'beast' | 'custom';
export type SkillType =
  | 'smallGuns' | 'bigGuns' | 'energyWeapons' | 'meleeWeapons' | 'unarmed' | 'throwing'
  | 'firstAid' | 'doctor' | 'sneak' | 'lockpick' | 'steal' | 'traps'
  | 'science' | 'repair' | 'speech' | 'barter' | 'gambling' | 'outdoorsman' | 'pilot';

// ─── SPECIAL Stats ─────────────────────────────────────────────────────────────
export interface SPECIALStats {
  strength: number;
  perception: number;
  endurance: number;
  charisma: number;
  intelligence: number;
  agility: number;
  luck: number;
}

// ─── Character Skills (19 skills) ────────────────────────────────────────────
export interface CharacterSkills {
  // Combat
  smallGuns: number;
  bigGuns: number;
  energyWeapons: number;
  meleeWeapons: number;
  unarmed: number;
  throwing: number;
  // Support
  firstAid: number;
  doctor: number;
  sneak: number;
  lockpick: number;
  steal: number;
  traps: number;
  science: number;
  repair: number;
  speech: number;
  barter: number;
  gambling: number;
  outdoorsman: number;
  pilot: number;
}

export const DEFAULT_SKILLS: CharacterSkills = {
  smallGuns: 0, bigGuns: 0, energyWeapons: 0, meleeWeapons: 0, unarmed: 0, throwing: 0,
  firstAid: 0, doctor: 0, sneak: 0, lockpick: 0, steal: 0, traps: 0,
  science: 0, repair: 0, speech: 0, barter: 0, gambling: 0, outdoorsman: 0, pilot: 0,
};

export const SKILL_LABELS: Record<SkillType, string> = {
  smallGuns: 'Small Guns', bigGuns: 'Big Guns', energyWeapons: 'Energy Weapons',
  meleeWeapons: 'Melee Weapons', unarmed: 'Unarmed', throwing: 'Throwing',
  firstAid: 'First Aid', doctor: 'Doctor', sneak: 'Sneak', lockpick: 'Lockpick',
  steal: 'Steal', traps: 'Traps', science: 'Science', repair: 'Repair',
  speech: 'Speech', barter: 'Barter', gambling: 'Gambling', outdoorsman: 'Outdoorsman',
  pilot: 'Pilot',
};

export const COMBAT_SKILLS: SkillType[] = ['smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed', 'throwing'];
export const SUPPORT_SKILLS: SkillType[] = ['firstAid', 'doctor', 'sneak', 'lockpick', 'steal', 'traps', 'science', 'repair', 'speech', 'barter', 'gambling', 'outdoorsman', 'pilot'];

// ─── Weapon ───────────────────────────────────────────────────────────────────
export interface WeaponMod {
  id: string;
  name: string;
  toHitBonus: number;
  damageBonus: number;
  rangeBonus: number;
  description: string;
}

export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  damageType: DamageType;
  damageDieCount: number;
  damageDie: number;
  damageBonus: number;
  skill: SkillType;
  burstLimit: number;
  isDoubleShot: boolean;
  magazineSize: number;
  weight: number;
  minStr: number;
  rangeNormal: number;
  knockdownChance: number;
  mods: string[];
  isCustom: boolean;
}

// ─── Armor ────────────────────────────────────────────────────────────────────
export interface Armor {
  id: string;
  name: string;
  slot: ArmorSlot;
  // Damage Threshold (flat reduction before DR)
  dtNormal: number;
  dtLaser: number;
  dtFire: number;
  dtPlasma: number;
  dtExplosion: number;
  // Damage Resistance (% reduction applied after DT)
  drNormal: number;
  drLaser: number;
  drFire: number;
  drPlasma: number;
  drExplosion: number;
  acBonus: number;
  weight: number;
  isCustom: boolean;
}

// ─── Character Perk ───────────────────────────────────────────────────────────
export interface CharacterPerk {
  perkId: string;
  rank: number;
}

// ─── Injury ───────────────────────────────────────────────────────────────────
export interface Injury {
  id: string;
  location: 'head' | 'eyes' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
  severity: 'minor' | 'crippled' | 'broken';
  description: string;
  toHitPenalty: number;
  skillPenalty: Partial<CharacterSkills>;
  movementPenalty: number;
  isActive: boolean;
  source: string;
}

// ─── Weapon Ammo State ────────────────────────────────────────────────────────
export interface WeaponAmmoState {
  weaponId: string;
  currentAmmo: number;
  conditionBoxes: number;
}

// ─── Character ────────────────────────────────────────────────────────────────
export interface Character {
  id: string;
  name: string;
  type: CharacterType;
  race: RaceType;
  level: number;
  xp: number;
  portrait?: string;

  // SPECIAL
  special: SPECIALStats;

  // Derived
  maxHp: number;
  currentHp: number;
  armorClass: number;
  tempAC: number;
  maxAP: number;
  currentAP: number;
  position: PositionType;
  sequence: number;

  // Skills
  skills: CharacterSkills;
  taggedSkills: SkillType[];
  unspentSkillPoints: number;

  // Perks
  perks: CharacterPerk[];

  // Elemental resistances (base, before armor)
  radiationResistance: number;
  gasResistance: number;
  electricityResistance: number;

  // Equipment
  equippedWeaponId?: string;
  equippedBodyArmorId?: string;
  equippedHelmetId?: string;
  weaponAmmoStates: WeaponAmmoState[];

  // Status
  injuries: Injury[];
  isKnockedOut: boolean;
  knockOutRoundsLeft: number;
  conditions: string[];
}

// ─── Bestiary Template ────────────────────────────────────────────────────────
export interface BestiaryTemplate {
  id: string;
  name: string;
  category: BestiaryCategory;
  description?: string;
  isCustom?: boolean;

  special: SPECIALStats;
  maxHp: number;
  armorClass: number;
  maxAP: number;

  skills: CharacterSkills;

  equippedWeaponId?: string;
  equippedBodyArmorId?: string;
  equippedHelmetId?: string;

  radiationResistance: number;
  gasResistance: number;
  electricityResistance: number;

  portrait?: string;
}

// ─── Initiative Entry ─────────────────────────────────────────────────────────
export interface InitiativeEntry {
  id: string;
  characterId?: string;
  name: string;
  initiative: number;
  sequence: number;
  currentAP: number;
  maxAP: number;
  currentHp: number;
  maxHp: number;
  armorClass: number;
  tempAC: number;
  position: PositionType;
  hasActed: boolean;
  isActive: boolean;
}
