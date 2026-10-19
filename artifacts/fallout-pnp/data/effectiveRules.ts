/**
 * Pure, dependency-free rules for values that must be calculated without
 * writing trait/perk modifiers back into a saved character.
 *
 * The structural types in this file are intentional: Node's type-stripping
 * test runner can import it directly without resolving the application's
 * path aliases.
 */

export interface SpecialValues {
  strength: number;
  perception: number;
  endurance: number;
  charisma: number;
  intelligence: number;
  agility: number;
  luck: number;
}

export interface SpecialBounds {
  min: SpecialValues;
  max: SpecialValues;
}

export type NightPersonPeriod = 'day' | 'night';
export type NumericSkills = Record<string, number>;

export interface RankedPerk {
  perkId: string;
  rank?: number;
  appliedSkillBonuses?: Readonly<Record<string, number>>;
  bonusTaggedSkill?: string;
}

const SPECIAL_KEYS: readonly (keyof SpecialValues)[] = [
  'strength',
  'perception',
  'endurance',
  'charisma',
  'intelligence',
  'agility',
  'luck',
];

const GOOD_NATURED_BONUSES: Readonly<Record<string, number>> = {
  firstAid: 20,
  doctor: 20,
  speech: 20,
  barter: 20,
  smallGuns: -10,
  bigGuns: -10,
  energyWeapons: -10,
  unarmed: -10,
  meleeWeapons: -10,
};

const HAM_FISTED_PENALTIES = new Set([
  'smallGuns',
  'firstAid',
  'doctor',
  'repair',
  'science',
  'lockpick',
]);

const TECH_WIZARD_SKILLS = new Set(['science', 'repair', 'lockpick']);

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function normalizedSet(values: readonly string[] | undefined): Set<string> {
  return new Set((values ?? []).map(normalizeId));
}

function hasPerk(perks: readonly (string | RankedPerk)[] | undefined, id: string): boolean {
  return (perks ?? []).some((perk) =>
    normalizeId(typeof perk === 'string' ? perk : perk.perkId) === id
    && (typeof perk === 'string' || (perk.rank ?? 1) > 0));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Applies permanent/immediate trait SPECIAL changes to a fresh object.
 * Stored SPECIAL is never changed. Night Person is separate because it is
 * time-dependent and uniquely constrained by racial bounds.
 */
export function applyImmediateTraitSpecial(
  special: Readonly<SpecialValues>,
  traits: readonly string[] | undefined,
): SpecialValues {
  const selected = normalizedSet(traits);
  const result: SpecialValues = { ...special };

  if (selected.has('small_frame')) result.agility += 1;
  if (selected.has('bruiser')) result.strength += 2;
  if (selected.has('gifted')) {
    for (const key of SPECIAL_KEYS) result[key] += 1;
  }
  if (selected.has('tech_wizard')) result.perception -= 1;
  if (selected.has('domesticated')) result.intelligence += 1;

  return result;
}

/** Applies Night Person's bounded PER/IN adjustment to a fresh object. */
export function applyNightPersonSpecial(
  special: Readonly<SpecialValues>,
  traits: readonly string[] | undefined,
  period: NightPersonPeriod | undefined,
  bounds: Readonly<SpecialBounds> | undefined,
): SpecialValues {
  const result: SpecialValues = { ...special };
  if (!period || !bounds || !normalizedSet(traits).has('night_person')) return result;

  const delta = period === 'night' ? 1 : -1;
  result.perception = clamp(
    result.perception + delta,
    bounds.min.perception,
    bounds.max.perception,
  );
  result.intelligence = clamp(
    result.intelligence + delta,
    bounds.min.intelligence,
    bounds.max.intelligence,
  );
  return result;
}

/** Composes immediate and time-dependent SPECIAL rules in their proper order. */
export function calculateEffectiveSpecial(input: {
  special: Readonly<SpecialValues>;
  traits?: readonly string[];
  nightPersonPeriod?: NightPersonPeriod;
  racialBounds?: Readonly<SpecialBounds>;
}): SpecialValues {
  const immediate = applyImmediateTraitSpecial(input.special, input.traits);
  return applyNightPersonSpecial(
    immediate,
    input.traits,
    input.nightPersonPeriod,
    input.racialBounds,
  );
}

export function calculateCarryWeight(
  workingStrength: number,
  traits?: readonly string[],
): number {
  return normalizedSet(traits).has('small_frame')
    ? 15 * workingStrength
    : 25 + 25 * workingStrength;
}

export function calculateMaxActionPoints(
  workingAgility: number,
  traits?: readonly string[],
): number {
  return 5 + Math.floor(workingAgility / 2)
    + (normalizedSet(traits).has('bruiser') ? -2 : 0);
}

/**
 * Returns natural AC before worn armor and temporary AC. Kamikaze suppresses
 * agility-derived AC, but not other natural bonuses such as Vat Skin.
 */
export function calculateNaturalArmorClass(
  workingAgility: number,
  traits?: readonly string[],
  racialNaturalArmorClass = 0,
): number {
  const selected = normalizedSet(traits);
  const agilityAC = selected.has('kamikaze') ? 0 : workingAgility;
  return agilityAC + racialNaturalArmorClass + (selected.has('vat_skin') ? 10 : 0);
}

/**
 * Replace the permanent natural-AC component persisted in armorClass with the
 * current trait/condition-aware value.
 */
export function replaceStoredNaturalArmorClass(
  storedArmorClass: number,
  storedPermanentAgility: number,
  workingAgility: number,
  traits?: readonly string[],
  racialNaturalArmorClass = 0,
): number {
  const preservedArmor = Math.max(
    0,
    storedArmorClass - storedPermanentAgility - racialNaturalArmorClass,
  );
  return preservedArmor + calculateNaturalArmorClass(
    workingAgility,
    traits,
    racialNaturalArmorClass,
  );
}

/** Fast Shot applies to every weapon skill except HtH and Melee Weapons. */
export function fastShotAppliesToSkill(skill: string | undefined): boolean {
  return skill !== undefined && skill !== 'unarmed' && skill !== 'meleeWeapons';
}

export function calculateSequence(
  workingPerception: number,
  traits?: readonly string[],
  otherBonus = 0,
): number {
  return workingPerception * 2
    + (normalizedSet(traits).has('kamikaze') ? 5 : 0)
    + otherBonus;
}

export function calculateHealingRate(
  workingEndurance: number,
  traits?: readonly string[],
  currentStateBonus = 0,
  perkBonus = 0,
): number {
  return Math.max(1, Math.floor(workingEndurance / 3))
    + (normalizedSet(traits).has('fast_metabolism') ? 2 : 0)
    + currentStateBonus
    + perkBonus;
}

/**
 * Applies trait and current-state radiation modifiers to the character's
 * existing racial/base resistance. Fast Metabolism's zero starting value does
 * not erase racial resistance, which has already been stored in this value.
 */
export function calculateRadiationResistance(
  storedRacialOrBaseResistance: number,
  traits?: readonly string[],
  currentStateBonus = 0,
): number {
  return storedRacialOrBaseResistance
    + (normalizedSet(traits).has('glowing_one') ? 50 : 0)
    + currentStateBonus;
}

export interface EffectiveSkillOptions {
  traits?: readonly string[];
  perks?: readonly (string | RankedPerk)[];
  conditions?: readonly string[];
  taggedSkills?: readonly string[];
  includeTagBonus?: boolean;
}

/** Skill increases granted on acquisition; keeping these as a separate layer
 * means a refund removes the effect without undoing purchased skill points. */
export function oneTimePerkSkillBonuses(perkId: string): Record<string, number> {
  switch (normalizeId(perkId)) {
    case 'master_thief': return { lockpick: 15, steal: 15 };
    case 'master_trader': return { barter: 30 };
    case 'medic': return { firstAid: 10, doctor: 10 };
    case 'mr_fixit': return { repair: 10, science: 10 };
    case 'negotiator': return { speech: 10, barter: 10 };
    case 'salesman': return { barter: 20 };
    case 'speaker': return { speech: 20 };
    case 'thief': return { sneak: 10, lockpick: 10, steal: 10, traps: 10 };
    case 'gambler': return { gambling: 20 };
    default: return {};
  }
}

/**
 * Applies one-time trait adjustments and conditional perk adjustments.
 * Input skills are copied, and adjusted values are clamped at zero.
 */
export function calculateEffectiveSkills<T extends object>(
  skills: Readonly<T> & { readonly [K in keyof T]: number },
  options: Readonly<EffectiveSkillOptions> = {},
): T {
  const selected = normalizedSet(options.traits);
  const tagged = normalizedSet(options.taggedSkills);
  const conditions = normalizedSet(options.conditions);
  const perkSkillBonuses: Record<string, number> = {};
  for (const owned of options.perks ?? []) {
    if (typeof owned === 'string') continue;
    if (owned.bonusTaggedSkill) tagged.add(normalizeId(owned.bonusTaggedSkill));
    const id = normalizeId(owned.perkId);
    const rank = Math.max(0, owned.rank ?? 1);
    for (const [skill, amount] of Object.entries(owned.appliedSkillBonuses ?? oneTimePerkSkillBonuses(id))) {
      perkSkillBonuses[skill] = (perkSkillBonuses[skill] ?? 0) + amount;
    }
    if (id === 'ranger') perkSkillBonuses.outdoorsman = (perkSkillBonuses.outdoorsman ?? 0) + 15 * rank;
    if (id === 'living_anatomy') perkSkillBonuses.doctor = (perkSkillBonuses.doctor ?? 0) + 10 * rank;
    if (id === 'jack_of_all_trades') {
      for (const skill of Object.keys(skills)) {
        perkSkillBonuses[skill] = (perkSkillBonuses[skill] ?? 0) + 5 * rank;
      }
    }
  }
  const drunk = conditions.has('drunk') || conditions.has('intoxicated');
  const drunkenMaster = hasPerk(options.perks, 'drunken_master');
  const result: NumericSkills = {};

  for (const [skill, value] of Object.entries(skills) as [string, number][]) {
    let adjusted = value;
    if (selected.has('gifted')) adjusted -= 10;
    if (selected.has('skilled')) adjusted += 10;
    if (selected.has('good_natured')) adjusted += GOOD_NATURED_BONUSES[skill] ?? 0;
    if (selected.has('ham_fisted') && HAM_FISTED_PENALTIES.has(skill)) adjusted -= 20;
    if (selected.has('tech_wizard') && TECH_WIZARD_SKILLS.has(skill)) adjusted += 15;
    if (skill === 'unarmed' && drunkenMaster && drunk) adjusted += 20;
    adjusted += perkSkillBonuses[skill] ?? 0;
    if (options.includeTagBonus && tagged.has(normalizeId(skill))) adjusted += 20;
    result[skill] = Math.max(0, adjusted);
  }

  return result as unknown as T;
}

/**
 * Rebase saved skill purchases from the saved SPECIAL skill base to an
 * effective SPECIAL skill base, then layer the non-persisted trait/perk rules.
 * This is deliberately separate from `calculateEffectiveSkills`: callers that
 * already have a rebased skill map can continue to use that smaller helper.
 */
export function calculateRebasedEffectiveSkills<T extends object>(input: {
  savedSkills: Readonly<T> & { readonly [K in keyof T]: number };
  savedBaseSkills: Readonly<T> & { readonly [K in keyof T]: number };
  effectiveBaseSkills: Readonly<T> & { readonly [K in keyof T]: number };
  options?: Readonly<EffectiveSkillOptions>;
}): T {
  const rebased: NumericSkills = {};
  const savedBase = input.savedBaseSkills as Readonly<Record<string, number>>;
  const effectiveBase = input.effectiveBaseSkills as Readonly<Record<string, number>>;
  for (const [skill, value] of Object.entries(input.savedSkills) as [string, number][]) {
    rebased[skill] = (effectiveBase[skill] ?? 0)
      + (value - (savedBase[skill] ?? 0));
  }
  return calculateEffectiveSkills(
    rebased as T & { readonly [K in keyof T]: number },
    input.options,
  ) as T;
}

export interface TagSkillRules {
  selectableCapacity: number;
  freeTagSkills: string[];
  totalCapacity: number;
}

export function calculateTagSkillRules(
  traits?: readonly string[],
  baseSelectableCapacity = 3,
  perks?: readonly (string | RankedPerk)[],
): TagSkillRules {
  const selected = normalizedSet(traits);
  const perkCapacity = (perks ?? []).reduce((total, perk) => {
    const id = typeof perk === 'string' ? perk : perk.perkId;
    const rank = typeof perk === 'string' ? 1 : perk.rank ?? 1;
    return total + (normalizeId(id) === 'tag' ? Math.max(0, rank) : 0);
  }, 0);
  const selectableCapacity = baseSelectableCapacity
    + (selected.has('beta_software') ? 1 : 0)
    + perkCapacity;
  const freeTagSkills = [
    ...(selected.has('ham_fisted') ? ['unarmed'] : []),
    ...(perks ?? []).flatMap(perk => typeof perk === 'string' || !perk.bonusTaggedSkill ? [] : [perk.bonusTaggedSkill]),
  ];
  return {
    selectableCapacity,
    freeTagSkills,
    totalCapacity: selectableCapacity + freeTagSkills.length,
  };
}

export function calculateSkillPointsPerLevel(
  workingIntelligence: number,
  traits?: readonly string[],
): number {
  const selected = normalizedSet(traits);
  const traitDelta = (selected.has('gifted') ? -5 : 0) + (selected.has('skilled') ? 5 : 0);
  return Math.max(0, 5 + 2 * workingIntelligence + traitDelta);
}

/**
 * Calculates "one perk every N levels". Fear the Reaper substitutes the human
 * cadence before Skilled makes that cadence one level slower.
 */
export function calculatePerkCadence(
  racialLevelsPerPerk: number,
  traits?: readonly string[],
  humanLevelsPerPerk = 3,
): number {
  const selected = normalizedSet(traits);
  const base = selected.has('fear_the_reaper') ? humanLevelsPerPerk : racialLevelsPerPerk;
  return base + (selected.has('skilled') ? 1 : 0);
}