import { resolveArmorAwareSheet } from '@/data/armorEffects';
import { getCharacterRaceDefinition } from '@/data/races';
import type { Character } from '@/context/types';

type SheetInput = Parameters<typeof resolveArmorAwareSheet>[0];
export interface PilotContext {
  allArmor: SheetInput['allArmor'];
  hardcoreRadiationRules: boolean;
  mutantGhoulRadiationRules: boolean;
  ghoulRadiationHealingOption: 1 | 2 | 3 | 4;
}

/** Mirrors the calculator's resolveCombatSheet inputs; returns the armor-aware effective Pilot skill. */
export function effectivePilotSkill(character: Character, ctx: PilotContext): number {
  const race = getCharacterRaceDefinition(character);
  const sheet = resolveArmorAwareSheet({
    special: character.special, skills: character.skills, taggedSkills: character.taggedSkills, traits: character.traits,
    perks: character.perks, conditions: character.conditions, effects: character.effects,
    raceBounds: race ? { min: race.specialMin, max: race.specialMax } : undefined, raceDefinition: race,
    nightPersonPeriod: character.nightPersonPeriod, racialNaturalArmorClass: race?.naturalACBonus,
    naturalArmorClass: character.naturalProtection?.armorClass, manualDerivedStats: character.manualDerivedStats,
    usesDerivedArmorClass: character.usesDerivedArmorClass, tempAC: character.tempAC,
    radiationResistance: character.radiationResistance, gasResistance: character.gasResistance,
    wearingGasMask: character.wearingGasMask, poisonResistance: character.poisonResistance,
    electricityResistance: character.electricityResistance, accumulatedRadiation: character.accumulatedRadiation,
    hardcoreRadiationRules: ctx.hardcoreRadiationRules, raceId: character.race,
    mutantGhoulRadiationRules: ctx.mutantGhoulRadiationRules, ghoulRadiationHealingOption: ctx.ghoulRadiationHealingOption,
    equippedBodyArmorId: character.equippedBodyArmorId, equippedHelmetId: character.equippedHelmetId,
    armorConditionStates: character.armorConditionStates, allArmor: ctx.allArmor,
  });
  return sheet.effectiveSkills.pilot;
}
