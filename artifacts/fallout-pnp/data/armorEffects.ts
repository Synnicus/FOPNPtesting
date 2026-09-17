/**
 * Pure armor-effect aggregation and sheet resolver.  It deliberately has no
 * React, storage, or catalogue dependency: callers provide the armor list.
 */
import type { Armor, ArmorEffects, CharacterSkills, ManualDerivedStats, SPECIALStats } from '../context/types.ts';
import {
  applyImmediateTraitSpecial,
  applyNightPersonSpecial,
  calculateCarryWeight,
  calculateMaxActionPoints,
  calculateNaturalArmorClass,
  calculateRebasedEffectiveSkills,
  calculateSequence,
} from './effectiveRules.ts';
import { calcBaseSkills } from './derived.ts';
import { computeConditionModifiers } from './conditions.ts';

const SPECIAL_KEYS: (keyof SPECIALStats)[] = [
  'strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck',
];
const RESISTANCE_KEYS = [
  'gasResistance', 'poisonResistance', 'radiationResistance', 'electricityResistance',
] as const;

export const EMPTY_ARMOR_EFFECTS: Required<Pick<ArmorEffects, 'special' | 'skills'>> & ArmorEffects = {
  special: {},
  skills: {},
};

export interface ArmorEffectSource {
  armorId: string;
  armorName: string;
  slot: 'body' | 'helmet';
  effects: ArmorEffects;
}

export interface AggregatedArmorEffects {
  special: Partial<SPECIALStats>;
  skills: Partial<CharacterSkills>;
  gasResistance: number;
  poisonResistance: number;
  radiationResistance: number;
  electricityResistance: number;
  /** Individual, unmodified contributions for display/audit use. */
  sources: ArmorEffectSource[];
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Adds worn body and helmet effects without modifying either armor object. */
export function aggregateArmorEffects(
  bodyArmor?: Armor | null,
  helmet?: Armor | null,
): AggregatedArmorEffects {
  const result: AggregatedArmorEffects = {
    special: {},
    skills: {},
    gasResistance: 0,
    poisonResistance: 0,
    radiationResistance: 0,
    electricityResistance: 0,
    sources: [],
  };
  for (const armor of [bodyArmor, helmet]) {
    if (!armor) continue;
    const effects = armor.effects ?? EMPTY_ARMOR_EFFECTS;
    result.sources.push({
      armorId: armor.id,
      armorName: armor.name,
      slot: armor.slot,
      effects,
    });
    for (const key of SPECIAL_KEYS) {
      const modifier = numeric(effects.special?.[key]);
      if (modifier) result.special[key] = (result.special[key] ?? 0) + modifier;
    }
    for (const [skill, modifier] of Object.entries(effects.skills ?? {})) {
      const value = numeric(modifier);
      if (value) result.skills[skill as keyof CharacterSkills] =
        (result.skills[skill as keyof CharacterSkills] ?? 0) + value;
    }
    for (const key of RESISTANCE_KEYS) result[key] += numeric(effects[key]);
  }
  return result;
}

export interface ArmorResolverInput {
  special: SPECIALStats;
  skills: CharacterSkills;
  taggedSkills?: readonly string[];
  traits?: readonly string[];
  perks?: readonly { perkId: string; rank?: number }[];
  conditions?: readonly string[];
  effects?: readonly {
    isActive?: boolean;
    statMods?: Partial<SPECIALStats>;
    apMod?: number;
    acMod?: number;
    sequenceMod?: number;
    radResistMod?: number;
    poisonResistMod?: number;
  }[];
  raceBounds?: { min: SPECIALStats; max: SPECIALStats };
  nightPersonPeriod?: 'day' | 'night';
  racialNaturalArmorClass?: number;
  manualDerivedStats?: ManualDerivedStats;
  tempAC?: number;
  radiationResistance?: number;
  gasResistance?: number;
  poisonResistance?: number;
  electricityResistance?: number;
  equippedBodyArmorId?: string;
  equippedHelmetId?: string;
  allArmor: readonly Armor[];
}

export interface ResolvedArmorSheet {
  bodyArmor?: Armor;
  helmet?: Armor;
  armorEffects: AggregatedArmorEffects;
  effectiveSpecial: SPECIALStats;
  effectiveSkills: CharacterSkills;
  maxAP: number;
  armorClass: number;
  /** Resolved AC before body/helmet AC, used for transparent equipment summaries. */
  armorClassWithoutEquipment: number;
  sequence: number;
  criticalChance: number;
  meleeDamage: number;
  carryWeight: number;
  gasResistance: number;
  poisonResistance: number;
  radiationResistance: number;
  electricityResistance: number;
  ignoresLightPenalties: boolean;
}

function hasTrait(traits: readonly string[] | undefined, trait: string): boolean {
  return (traits ?? []).some(value => value.trim().toLowerCase().replace(/[-\s]+/g, '_') === trait);
}

function perkBonus(perks: ArmorResolverInput['perks'], id: string): number {
  return (perks ?? []).reduce((total, perk) => total + (perk.perkId === id ? numeric(perk.rank ?? 1) : 0), 0);
}

/** Resolves sheet values from stored character data; it never writes to it. */
export function resolveArmorAwareSheet(input: ArmorResolverInput): ResolvedArmorSheet {
  const bodyArmor = input.equippedBodyArmorId
    ? input.allArmor.find(armor => armor.id === input.equippedBodyArmorId && armor.slot === 'body')
    : undefined;
  const selectedHelmet = input.equippedHelmetId
    ? input.allArmor.find(armor => armor.id === input.equippedHelmetId && armor.slot === 'helmet')
    : undefined;
  // Integrated/prohibited suits and suit-only helmets are validated here, before
  // any AC/protection/effect aggregation. The selected objects are untouched.
  const helmet = bodyArmor?.integratedHelmet || bodyArmor?.prohibitsHelmet
    ? undefined
    : selectedHelmet?.compatibleBodyArmorIds
      && (!bodyArmor || !selectedHelmet.compatibleBodyArmorIds.includes(bodyArmor.id))
        ? undefined
        : selectedHelmet;
  const armorEffects = aggregateArmorEffects(bodyArmor, helmet);

  // Trait → permanent Gain-X perk → bounded Night Person → active effects →
  // armor. This retains the existing intentional trait/perk/chem ordering.
  const withTraits = applyImmediateTraitSpecial(input.special, input.traits);
  const withPerks = { ...withTraits };
  const gainPerks: Record<keyof SPECIALStats, string> = {
    strength: 'gain_strength', perception: 'gain_perception', endurance: 'gain_endurance',
    charisma: 'gain_charisma', intelligence: 'gain_intelligence', agility: 'gain_agility', luck: 'gain_luck',
  };
  for (const key of SPECIAL_KEYS) withPerks[key] += perkBonus(input.perks, gainPerks[key]);
  const nightPerson = applyNightPersonSpecial(
    withPerks, input.traits, hasTrait(input.traits, 'night_person') ? input.nightPersonPeriod ?? 'day' : undefined, input.raceBounds,
  );
  const effectiveSpecial = { ...nightPerson };
  const conditionStats = computeConditionModifiers({ conditions: [...(input.conditions ?? [])] }).statMods;
  let apMod = 0;
  let acMod = 0;
  let sequenceMod = 0;
  let radEffectMod = 0;
  let poisonEffectMod = 0;
  for (const key of SPECIAL_KEYS) effectiveSpecial[key] += numeric(conditionStats[key]);
  for (const effect of input.effects ?? []) {
    if (effect.isActive === false) continue;
    for (const key of SPECIAL_KEYS) effectiveSpecial[key] += numeric(effect.statMods?.[key]);
    apMod += numeric(effect.apMod);
    acMod += numeric(effect.acMod);
    sequenceMod += numeric(effect.sequenceMod);
    radEffectMod += numeric(effect.radResistMod);
    poisonEffectMod += numeric(effect.poisonResistMod);
  }
  for (const key of SPECIAL_KEYS) effectiveSpecial[key] = Math.max(1, effectiveSpecial[key] + (armorEffects.special[key] ?? 0));

  const effectiveSkills = calculateRebasedEffectiveSkills<CharacterSkills>({
    savedSkills: input.skills,
    savedBaseSkills: calcBaseSkills(input.special),
    effectiveBaseSkills: calcBaseSkills(effectiveSpecial),
    options: { traits: input.traits, perks: input.perks, conditions: input.conditions, taggedSkills: input.taggedSkills, includeTagBonus: true },
  });
  for (const key of Object.keys(effectiveSkills) as (keyof CharacterSkills)[]) {
    effectiveSkills[key] = Math.max(0, effectiveSkills[key] + (armorEffects.skills[key] ?? 0));
  }

  const armorAC = numeric(bodyArmor?.acBonus) + numeric(helmet?.acBonus);
  const sequencePerk = perkBonus(input.perks, 'earlier_sequence') * 2;
  const manual = input.manualDerivedStats;
  const baseAP = calculateMaxActionPoints(input.special.agility, input.traits);
  const baseAC = calculateNaturalArmorClass(input.special.agility, input.traits, input.racialNaturalArmorClass);
  const baseSequence = calculateSequence(input.special.perception, input.traits);
  const maxAP = manual
    ? manual.maxAP + calculateMaxActionPoints(effectiveSpecial.agility, input.traits) - baseAP
      + perkBonus(input.perks, 'action_boy_girl') + apMod
    : calculateMaxActionPoints(effectiveSpecial.agility, input.traits)
      + perkBonus(input.perks, 'action_boy_girl') + apMod;
  const armorClass = manual
    ? manual.armorClass + calculateNaturalArmorClass(effectiveSpecial.agility, input.traits, input.racialNaturalArmorClass)
      - baseAC + armorAC + numeric(input.tempAC) + acMod
    : calculateNaturalArmorClass(effectiveSpecial.agility, input.traits, input.racialNaturalArmorClass)
      + armorAC + numeric(input.tempAC) + acMod;
  const sequence = manual
    ? manual.sequence + calculateSequence(effectiveSpecial.perception, input.traits) - baseSequence
      + sequencePerk + sequenceMod
    : calculateSequence(effectiveSpecial.perception, input.traits, sequencePerk) + sequenceMod;
  return {
    bodyArmor,
    helmet,
    armorEffects,
    effectiveSpecial,
    effectiveSkills,
    maxAP: Math.max(1, maxAP),
    armorClass: Math.max(0, armorClass),
    armorClassWithoutEquipment: Math.max(0, armorClass - armorAC),
    sequence: Math.max(0, sequence),
    criticalChance: Math.max(0, manual?.criticalChance ?? Math.floor(effectiveSpecial.luck / 2)),
    meleeDamage: Math.max(1, effectiveSpecial.strength - 5),
    carryWeight: calculateCarryWeight(effectiveSpecial.strength, input.traits),
    gasResistance: clamp(numeric(input.gasResistance) + armorEffects.gasResistance, 0, 100),
    poisonResistance: clamp(numeric(input.poisonResistance) + poisonEffectMod + armorEffects.poisonResistance, 0, 100),
    radiationResistance: clamp(numeric(input.radiationResistance) + (hasTrait(input.traits, 'glowing_one') ? 50 : 0) + radEffectMod + armorEffects.radiationResistance, 0, 100),
    electricityResistance: clamp(numeric(input.electricityResistance) + armorEffects.electricityResistance, 0, 100),
    ignoresLightPenalties: Boolean(bodyArmor?.ignoresLightPenalties || helmet?.ignoresLightPenalties),
  };
}