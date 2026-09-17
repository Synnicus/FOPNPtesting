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
  | 'human' | 'ghoul' | 'superMutant' | 'halfMutant' | 'robot'
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

/** Numeric modifiers supplied by worn armor. Omitted keys are always zero. */
export interface ArmorEffects {
  special?: Partial<SPECIALStats>;
  skills?: Partial<CharacterSkills>;
  gasResistance?: number;
  poisonResistance?: number;
  radiationResistance?: number;
  electricityResistance?: number;
}

/** Safe compatibility default for armor created before armor effects existed. */
export const EMPTY_ARMOR_EFFECTS: ArmorEffects = {
  special: {},
  skills: {},
};

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
  /** Explicit delivery when category/skill do not imply melee vs ranged. */
  attackDelivery?: 'melee' | 'ranged';
  knockdownChance: number;
  mods: string[];
  isCustom: boolean;
  /** Hands required to wield (1 or 2). Undefined = infer (see data/weapons.ts helper). */
  hands?: 1 | 2;
  /** Compatible ammo type ids (data/ammo.ts). Undefined/empty = weapon doesn't use ammo types. */
  compatibleAmmo?: string[];
  /** AP cost for a single attack (manual "AP S"). Fallback: AP_COSTS.ATTACK_SINGLE. */
  apSingle?: number;
  /** AP cost for a targeted/aimed attack (manual "T"). null = cannot be targeted. */
  apTargeted?: number | null;
  /** AP cost for a burst attack (manual "B"). null = no burst mode. */
  apBurst?: number | null;
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
  /** Worn modifiers; absent on legacy/custom armor means no effect. */
  effects?: ArmorEffects;
  /** The suit includes its own helmet; a separately selected helmet is ignored. */
  integratedHelmet?: boolean;
  /** A separately selected helmet cannot be worn with this body armor. */
  prohibitsHelmet?: boolean;
  /** Helmet can only be worn with one of these body armor ids. */
  compatibleBodyArmorIds?: string[];
  /** This armor's optics negate darkness/light penalties. */
  ignoresLightPenalties?: boolean;
}

// ─── Character Perk ───────────────────────────────────────────────────────────
export interface CharacterPerk {
  perkId: string;
  rank: number;
  /** Level at which the perk was (first) taken — used so per-level HP perks
   *  (Lifegiver, Brutish Hulk) only count levels gained AFTER acquisition. */
  takenAtLevel?: number;
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
  /** Loaded ammo type id (data/ammo.ts). undefined = weapon's default ammo. */
  ammoTypeId?: string;
}

// ─── Active Effects (chems + other temporary effects; injuries stay in Injury[]) ─
export interface ActiveEffect {
  id: string;
  kind: 'chem' | 'other';
  /** Chem id from data/chems.ts when kind === 'chem'. */
  chemId?: string;
  name: string;
  /** Current stage index for multi-stage chems (jet, voodoo, ...). */
  stage?: number;
  description?: string;
  /** Structured stat modifiers currently applied by this effect. */
  statMods?: Partial<SPECIALStats>;
  hpMod?: number;
  acMod?: number;
  apMod?: number;
  drMod?: number;
  sequenceMod?: number;
  healingRateMod?: number;
  radResistMod?: number;
  poisonResistMod?: number;
  notes?: string[];
  isActive: boolean;
}

// ─── Natural Protection (built-in DT/DR for creatures like Deathclaws) ────────
export interface NaturalProtection {
  dtNormal: number; dtLaser: number; dtFire: number; dtPlasma: number; dtExplosion: number;
  drNormal: number; drLaser: number; drFire: number; drPlasma: number; drExplosion: number;
}

export const EMPTY_NATURAL_PROTECTION: NaturalProtection = {
  dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
  drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
};

export interface BestiaryAttack {
  weaponId: string;
  /** Printed attack chance from the manual. */
  hitChance: number;
  /** Printed rider such as poison, radiation, or knockdown. */
  notes?: string;
}

export interface ManualDerivedStats {
  armorClass: number;
  maxAP: number;
  sequence: number;
  criticalChance?: number;
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
  /** How the portrait image fits its frame ('cover' crops, 'contain' letterboxes). */
  portraitFit?: 'cover' | 'contain';
  /** Crop focus when portraitFit is 'cover': 0–1 in each axis (0.5 = centered). */
  portraitOffset?: { x: number; y: number };
  /** Trait ids from data/traits.ts — chosen at creation; max 2, never more. */
  traits?: string[];
  /** Night Person's explicitly selected period. Older saves leave this unset;
   * its effective value is day only when Night Person is selected. */
  nightPersonPeriod?: 'day' | 'night';

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
  /** Printed NPC values that take precedence over SPECIAL-derived base values. */
  manualDerivedStats?: ManualDerivedStats;

  // Skills
  skills: CharacterSkills;
  taggedSkills: SkillType[];
  unspentSkillPoints: number;

  // Perks
  perks: CharacterPerk[];
  /** Break the Rules: the next successfully spent perk point ignores normal
   * level, SPECIAL, skill, prerequisite, and race requirements. */
  breakTheRulesPending?: boolean;

  // Elemental resistances (base, before armor)
  radiationResistance: number;
  gasResistance: number;
  gasResistanceSecondary?: number;
  electricityResistance: number;
  /** Base poison resistance. Legacy saves are normalized to zero. */
  poisonResistance?: number;

  // Equipment
  equippedWeaponId?: string;
  /** Dual-wield hand slots (weapon ids). A two-handed weapon occupies both.
   *  When absent, fall back to equippedWeaponId in the right hand. */
  leftHandWeaponId?: string;
  rightHandWeaponId?: string;
  /** Carried weapons (max 5, ids incl. equipped). Absent = derive from equipped. */
  inventoryWeaponIds?: string[];
  equippedBodyArmorId?: string;
  equippedHelmetId?: string;
  weaponAmmoStates: WeaponAmmoState[];
  /** Printed creature attacks, kept separate from carried/held equipment. */
  naturalAttacks?: BestiaryAttack[];
  /** Source template for a spawned manual bestiary creature. */
  bestiaryTemplateId?: string;
  /** XP awarded for defeating this manual bestiary creature. */
  xpValue?: number;

  // Status
  injuries: Injury[];
  /** Temporary effects (chems etc.) — merged with injuries in the Effects UI. */
  effects?: ActiveEffect[];
  isKnockedOut: boolean;
  knockOutRoundsLeft: number;
  conditions: string[];

  // Biography / notes
  biography?: string;
  // Built-in natural DT/DR (for characters that don't rely on armor)
  naturalProtection?: NaturalProtection;
  // Character storage — stored characters are hidden from combat operations
  inStorage?: boolean;
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
  sequence: number;
  xpValue?: number;
  criticalChance?: number;

  skills: CharacterSkills;

  equippedWeaponId?: string;
  naturalAttacks?: BestiaryAttack[];
  /** Carried weapons incl. the equipped one — sidearms / melee / throwables. */
  inventoryWeaponIds?: string[];
  equippedBodyArmorId?: string;
  equippedHelmetId?: string;

  radiationResistance: number;
  gasResistance: number;
  /** Second number in the manual's printed GR X/Y rating. */
  gasResistanceSecondary?: number;
  electricityResistance: number;
  /** Base poison resistance. Legacy templates are normalized to zero. */
  poisonResistance?: number;

  // Built-in natural DT/DR for creatures that don't rely on armor
  naturalProtection?: NaturalProtection;

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
