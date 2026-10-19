// ─── Primitive Types ────────────────────────────────────────────────────────────
export type DamageType = 'normal' | 'laser' | 'fire' | 'plasma' | 'explosion';
export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  normal: 'N', laser: 'L', fire: 'F', plasma: 'P', explosion: 'E',
};
export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  normal: 'Normal', laser: 'Laser', fire: 'Fire', plasma: 'Plasma', explosion: 'Explosion',
};

export type WeaponCategory = 'smallGuns' | 'bigGuns' | 'energyWeapons' | 'meleeWeapons' | 'unarmed' | 'throwing' | 'minesTraps' | 'natural';
export type ArmorSlot = 'body' | 'helmet';
export type CharacterType = 'pc' | 'npc';
export type VehicleCategory =
  | 'car' | 'truck' | 'motorcycle' | 'boat' | 'aircraft' | 'apc' | 'tank' | 'trailer' | 'artillery';
export type VehicleSystemKind = 'structure' | 'engine' | 'controls' | 'drive' | 'tire' | 'tread' | 'other';
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

export type RuleAttackMode = 'single' | 'targeted' | 'burst';
export type RuleTagAppliesTo = 'weapon' | 'armor' | 'both';
export type CustomPerkCategory = 'combat' | 'defense' | 'utility' | 'social' | 'survival' | 'racial';
export type CustomRuleEffectKind =
  | 'toHit'
  | 'damage'
  | 'radiationExposure'
  | 'range'
  | 'attackApDiscount'
  | 'reloadAp'
  | 'magazineMultiplier'
  | 'skillBonus'
  | 'specialBonus'
  | 'armorClass'
  | 'damageResistance'
  | 'radiationResistance'
  | 'poisonResistance'
  | 'maxAP'
  | 'maxHP'
  | 'ignoreDT';

export interface CampaignRuleTag {
  id: string;
  label: string;
  appliesTo: RuleTagAppliesTo;
}

/** Empty conditions mean an unconditional perk. Each populated condition
 *  group is required; a group passes when any one of its listed values matches. */
export interface CustomRuleCondition {
  weaponTags?: string[];
  armorTags?: string[];
  attackModes?: RuleAttackMode[];
  statuses?: string[];
  attackerRaces?: RaceType[];
  attackerTraits?: string[];
}

export interface CustomRuleEffect {
  id: string;
  kind: CustomRuleEffectKind;
  value: number;
  /** Damage type for typed damage or resistance. */
  damageType?: DamageType;
  /** When true, scale numeric value and dice count by the perk rank. */
  perRank?: boolean;
  diceCount?: number;
  dieSides?: number;
  skill?: SkillType;
  special?: keyof SPECIALStats;
  description?: string;
}

export interface CustomWeaponMod {
  id: string;
  name: string;
  description: string;
  /** False keeps this as a contextual/roleplay note with no automatic math. */
  programmatic: boolean;
  appliesToTags?: string[];
  effects: CustomRuleEffect[];
}

export interface CustomPerkDefinition {
  id: string;
  name: string;
  description: string;
  category: CustomPerkCategory;
  minLevel: number;
  maxRanks: number;
  requiresRace?: RaceType[];
  excludedRaces?: RaceType[];
  requirements?: {
    stats?: Partial<SPECIALStats>;
    skills?: Partial<CharacterSkills>;
  };
  /** Optional rule: absent/empty means the perk's effects are always active. */
  conditions?: CustomRuleCondition;
  /** Description-only perks remain visible but do not alter calculations. */
  programmatic: boolean;
  effects: CustomRuleEffect[];
}

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
  /** Describes ammo capacity when the manual does not give a fixed round count. */
  ammoCapacityNote?: 'variesByTank';
  weight: number;
  minStr: number;
  rangeNormal: number;
  /** Explicit delivery when category/skill do not imply melee vs ranged. */
  attackDelivery?: 'melee' | 'ranged';
  knockdownChance: number;
  mods: string[];
  isCustom: boolean;
  /** Curated and campaign-defined classification tags; independent of skill category. */
  tags?: string[];
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
  /** Optional shared area-effect profile id. Absent on legacy/custom weapons. */
  areaAttackProfileId?: string;
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
  /** Manual gas protection pair. Omitted means this armor provides none. */
  gasResistanceInhaled?: number;
  gasResistanceContact?: number;
  acBonus: number;
  weight: number;
  isCustom: boolean;
  /** Classification tags used by conditional custom perks. */
  tags?: string[];
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
  /** One-time choices/modifiers are recorded on the perk so refunds remove
   * exactly the benefit that was granted, without rewriting purchased skills. */
  appliedSkillBonuses?: Partial<CharacterSkills>;
  bonusTaggedSkill?: SkillType;
  replacedTrait?: { removedTraitId: string; addedTraitId: string };
  appliedXpBonus?: number;
  levelBeforeXpBonus?: number;
}

export interface CharacterPerkTracker {
  /** Manually tracked elapsed days for Fear the Reaper; the app has no clock. */
  daysElapsed?: number;
  /** Daily-use state for Divine Favor. */
  used?: boolean;
}

export interface CampaignTableEntry {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface CampaignTable {
  id: string;
  name: string;
  description: string;
  entries: CampaignTableEntry[];
}

export interface CampaignMapMarker {
  id: string;
  name: string;
  description: string;
  /** Normalized map coordinates, from 0 to 1. */
  x: number;
  y: number;
}

export interface CampaignPartyMarker {
  characterId: string;
  /** Normalized map coordinates, from 0 to 1. */
  x: number;
  y: number;
}

export interface CampaignMap {
  id: string;
  name: string;
  description: string;
  /** Embedded image data makes a campaign map portable in JSON exports. */
  imageDataUri?: string;
  locations: CampaignMapMarker[];
  party: CampaignPartyMarker[];
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
  /** Optional for injuries from older campaign exports that predate attribution. */
  source?: string;
}

export interface KarmaLogEntry {
  id: string;
  /** Actual signed change after applying the Fallout 3 Karma limits. */
  change: number;
  reason: string;
  createdAt: number;
}

export type FactionReputationKind = 'fame' | 'infamy';

export interface FactionReputationLogEntry {
  id: string;
  kind: FactionReputationKind;
  /** Signed adjustment to the corresponding Fame or Infamy total. */
  change: number;
  reason: string;
  createdAt: number;
}

export interface FactionReputation {
  id: string;
  name: string;
  /** Profile controls the four per-faction Fame and Infamy title thresholds. */
  thresholdProfile: string;
  fame: number;
  infamy: number;
  /** Optional role prefix shown before the automated New Vegas reputation title. */
  customTitle?: string;
  log: FactionReputationLogEntry[];
}

// ─── Weapon Ammo State ────────────────────────────────────────────────────────
export interface WeaponAmmoState {
  weaponId: string;
  currentAmmo: number;
  conditionBoxes: number;
  /** Loaded ammo type id (data/ammo.ts). undefined = weapon's default ammo. */
  ammoTypeId?: string;
}

export interface ArmorConditionState {
  armorId: string;
  /** Damaging hits: five hits fill one box, ten boxes maximum. */
  hitSegments: number;
}

// ─── Active Effects (chems + other temporary effects; injuries stay in Injury[]) ─
export interface ActiveEffect {
  id: string;
  kind: 'chem' | 'other';
  /** Chem id from data/chems.ts when kind === 'chem'. */
  chemId?: string;
  /** Flavor-only poison marker; poison effects never supply combat modifiers. */
  poisonType?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  /** Number of times this poison type has been applied to the character. */
  poisonCount?: number;
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

export type AreaEffectKind = 'fire' | 'acid';
export interface NaturalProtection {
  /** Editable natural Armor Class bonus, separate from Agility and racial AC. */
  armorClass?: number;
  dtNormal: number; dtLaser: number; dtFire: number; dtPlasma: number; dtExplosion: number;
  drNormal: number; drLaser: number; drFire: number; drPlasma: number; drExplosion: number;
}

export interface VehicleSystem {
  id: string;
  name: string;
  kind: VehicleSystemKind;
  currentHp: number;
  maxHp: number;
}

export interface VehicleWeaponSlot {
  id: string;
  /** Mount label, retained even when no weapon is currently assigned. */
  name: string;
  weaponId?: string;
  quantity: number;
}

/**
 * Manual vehicle profile and persistent system condition. Vehicles do not use
 * DT; their five damage-resistance percentages apply directly to each system.
 */
export interface VehicleProfile {
  id: string;
  name: string;
  category: VehicleCategory;
  description: string;
  isCustom?: boolean;
  portrait?: string;
  topSpeedKph: number | null;
  accelerationKphPerRound: number | null;
  brakingKphPerRound: number | null;
  turningRadiusMeters: number | null;
  rangeKm: number | null;
  passengers: string;
  carryingWeightLb: string;
  fuelCharges: number | null;
  armorClass: number;
  damageResistance: Record<DamageType, number>;
  systems: VehicleSystem[];
  mountedWeapons: string[];
  /** Structured mount assignments; optional for compatibility with older campaigns. */
  weaponSlots?: VehicleWeaponSlot[];
  enhancements: string[];
  notes: string[];
  terrainPilotModifier: number;
  inMotion: boolean;
}

export type VehicleTemplate = VehicleProfile;

export const EMPTY_NATURAL_PROTECTION: NaturalProtection = {
  armorClass: 0,
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
  /** Printed/template max HP at level 1. Used as the baseline for NPC leveling. */
  baseMaxHp?: number;
}

// ─── Character ────────────────────────────────────────────────────────────────
export interface Character {
  id: string;

  name: string;

  type: CharacterType;

  race: RaceType;

  level: number;

  xp: number;

  /** Fallout 3-style Karma total, from −1000 to +1000. */
  karma?: number;
  /** Chronological history of Karma changes and neutral actions; entries may be deleted. */
  karmaLog?: KarmaLogEntry[];
  /** Fallout: New Vegas-style faction Fame/Infamy totals, histories, and title overrides. */
  factionReputations?: FactionReputation[];

  portrait?: string;
  /** How the portrait image fits its frame ('cover' crops, 'contain' letterboxes). */

  portraitFit?: 'cover' | 'contain';
  /** Crop focus when portraitFit is 'cover': 0–1 in each axis (0.5 = centered). */

  portraitOffset?: { x: number; y: number };
  /** Present when this saved NPC-shaped combat record is a persistent vehicle. */
  vehicle?: VehicleProfile;
  /** Crew assignments belong to this deployed vehicle, not its reusable template. */
  vehicleCrew?: {
    pilotCharacterId?: string;
    gunnerCharacterId?: string;
  };
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
  /** Accumulated radiation exposure. This never modifies HP automatically. */
  accumulatedRadiation?: number;
  /** Unused absorbed radiation points carried toward the next optional ghoul-healing point. */
  ghoulRadiationHealingRemainder?: number;

  armorClass: number;

  tempAC: number;

  maxAP: number;

  currentAP: number;

  position: PositionType;

  sequence: number;
  /** Printed NPC values that take precedence over SPECIAL-derived base values. */

  manualDerivedStats?: ManualDerivedStats;
  /** Bestiary humanoids derive AC like PCs while retaining other printed derived stats. */
  usesDerivedArmorClass?: boolean;

  // Skills

  skills: CharacterSkills;

  taggedSkills: SkillType[];

  unspentSkillPoints: number;

  // Perks

  perks: CharacterPerk[];
  /** Manual counters and daily-use state for perks that need GM tracking. */
  perkTrackers?: Record<string, CharacterPerkTracker>;
  /** Break the Rules: the next successfully spent perk point ignores normal
   * level, SPECIAL, skill, prerequisite, and race requirements. */

  breakTheRulesPending?: boolean;

  // Elemental resistances (base, before armor)

  radiationResistance: number;

  gasResistance: number;
  /** Optional split values; old saves use gasResistance for both exposures. */

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

  armorConditionStates?: ArmorConditionState[];
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
  /** Timed combat skill actions remove Agility and unused-AP AC until this
   * combatant's next own turn begins. */
  combatDefenseSuppressed?: boolean;
  /** A Heal Fallen success grants no AP through this combat round; the normal
   * turn-start refresh is permitted only in the following round. */
  revivedNoAPUntilRound?: number;
  /** Fire/acid and similar hazards tick at the end of this combatant's turn. */

  conditions: string[];

  // Biography / notes

  biography?: string;
  // Built-in natural DT/DR (for characters that don't rely on armor)

  naturalProtection?: NaturalProtection;
  // Character storage — stored characters are hidden from combat operations

  inStorage?: boolean;

  gasResistanceInhaled?: number;

  gasResistanceContact?: number;

  areaEffects?: TimedAreaEffect[];
}

// ─── Bestiary Template ────────────────────────────────────────────────────────
export interface BestiaryTemplate {
  id: string;
  name: string;
  category: BestiaryCategory;
  /** Explicit biological race for built-in templates where category is broader than race. */
  race?: RaceType;
  description?: string;
  isCustom?: boolean;

  special: SPECIALStats;
  maxHp: number;
  armorClass: number;
  /** Derive AC from Agility, natural AC, equipment, and effects instead of printed AC. */
  usesDerivedArmorClass?: boolean;
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

export interface TimedAreaEffect {
  id: string;
  kind: AreaEffectKind;
  name: string;
  /** Legacy finite effects may still carry a countdown. Manual fire/acid persist until removed. */
  roundsLeft?: number;
  persistent?: boolean;
  /** Fire is removed only after its final 1d6 tick during the extinguishing turn. */
  removeAfterTick?: boolean;
  damageDieCount: number;
  damageDie: number;
  damageBonus: number;
  damageType: DamageType;
  notes?: string[];
}
