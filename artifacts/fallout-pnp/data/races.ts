import type {
  CampaignRaceTag,
  Character,
  CustomRaceDefinition,
  NaturalProtection,
  RaceProfile,
  RaceType,
  SPECIALStats,
} from '../context/types.ts';

export interface RaceDefinition extends RaceProfile {}

export const RACES: RaceDefinition[] = [
  // ─── PLAYABLE RACES ────────────────────────────────────────────────────────
  {
    id: 'human',
    name: 'Human',
    description: 'The dominant species in the wasteland. Adaptable and resourceful.',
    specialMin: { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 },
    specialMax: { strength: 10, perception: 10, endurance: 10, charisma: 10, intelligence: 10, agility: 10, luck: 10 },
    specialDefault: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
    naturalDR: 0, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: [],
    benefits: ['Balanced stats', 'Extra skill points from Intelligence', '1 perk per 3 levels'],
    penalties: ['No natural resistances', 'No natural weapons'],
    playable: true, naturalACBonus: 0,
  },
  {
    id: 'ghoul',
    name: 'Ghoul',
    description: 'Radiation-mutated humans. Long-lived, radiation-resistant, and often brilliant.',
    specialMin: { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 },
    specialMax: { strength: 6, perception: 13, endurance: 11, charisma: 6, intelligence: 13, agility: 8, luck: 13 },
    specialDefault: { strength: 3, perception: 7, endurance: 7, charisma: 3, intelligence: 7, agility: 5, luck: 5 },
    naturalDR: 60, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: [],
    benefits: ['60% Radiation Resistance', 'High PER/INT/END maximums', 'Can take Ghoul-only perks'],
    penalties: ['Low STR/CHA maximums', 'Social penalties with non-ghouls'],
    playable: true, naturalACBonus: 0,
  },
  {
    id: 'superMutant',
    name: 'Super Mutant',
    description: 'FEV-modified humans. Incredibly tough and strong, but dim-witted and socially limited.',
    specialMin: { strength: 5, perception: 1, endurance: 5, charisma: 1, intelligence: 1, agility: 1, luck: 1 },
    specialMax: { strength: 13, perception: 11, endurance: 13, charisma: 7, intelligence: 7, agility: 8, luck: 10 },
    specialDefault: { strength: 8, perception: 5, endurance: 8, charisma: 3, intelligence: 4, agility: 5, luck: 5 },
    naturalDR: 10, naturalGasDR: 10, naturalElecDR: 0,
    naturalWeaponIds: [],
    benefits: ['Very high STR/END', '10% DR Normal and Gas', 'Can use large weapons easier'],
    penalties: ['Low INT/CHA cap limits skills', '1 perk per 4 levels', 'Cannot wear most armor'],
    playable: true, perksPerLevels: 4, naturalACBonus: 0,
  },
  {
    id: 'robot',
    name: 'Robot',
    description: 'Mechanical constructs of the pre-war era. Immune to poison and radiation but vulnerable to electricity.',
    specialMin: { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 },
    specialMax: { strength: 12, perception: 12, endurance: 12, charisma: 6, intelligence: 12, agility: 10, luck: 6 },
    specialDefault: { strength: 6, perception: 6, endurance: 8, charisma: 2, intelligence: 6, agility: 6, luck: 3 },
    naturalDR: 100, naturalGasDR: 100, naturalElecDR: -50,
    naturalWeaponIds: [],
    benefits: ['Immune to radiation and gas', 'Cannot be poisoned', 'Can repair self'],
    penalties: ['−50% Electricity resistance', 'Cannot eat or drink', 'Low CHA/LCK cap'],
    playable: true, naturalACBonus: 0,
  },
  // ─── CREATURE RACES (NPC / Bestiary) ────────────────────────────────────────
  {
    id: 'halfMutant',
    name: 'Half-Mutant',
    description: 'Born of a mutant parent and a human. Tall and strong, they can often pass for tall, ugly humans.',
    specialMin: { strength: 3, perception: 1, endurance: 2, charisma: 1, intelligence: 1, agility: 1, luck: 1 },
    specialMax: { strength: 12, perception: 10, endurance: 11, charisma: 10, intelligence: 10, agility: 8, luck: 10 },
    specialDefault: { strength: 6, perception: 5, endurance: 6, charisma: 4, intelligence: 5, agility: 5, luck: 5 },
    naturalDR: 20, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: [],
    benefits: ['High STR/END potential', '20% Radiation Resistance', 'Can use human weapons and armor'],
    penalties: ['Social stigma from both humans and mutants', 'AGI capped at 8'],
    playable: true, naturalACBonus: 0,
  },
  {
    id: 'deathclaw',
    name: 'Deathclaw',
    description: 'Semi-intelligent, enormous mutated lizards standing 3 meters tall. Some are intelligent enough to be player characters (per the manual).',
    specialMin: { strength: 6, perception: 4, endurance: 1, charisma: 1, intelligence: 1, agility: 6, luck: 1 },
    specialMax: { strength: 14, perception: 12, endurance: 13, charisma: 3, intelligence: 4, agility: 16, luck: 10 },
    specialDefault: { strength: 12, perception: 8, endurance: 10, charisma: 1, intelligence: 3, agility: 12, luck: 5 },
    naturalDR: 60, naturalGasDR: 40, naturalElecDR: 0,
    naturalWeaponIds: ['deathclaw_claw', 'deathclaw_bite'],
    benefits: ['+5 Melee Damage bonus', '40% DR & DT 4 vs Normal/Fire/Explosion', '0/40 Gas Resist', '+2 HP per level', 'Foot-long claws'],
    penalties: ['Cannot use armor', '1 perk per 4 levels', 'Attacked on sight by most humans', 'Low CHA/INT'],
    playable: true, perksPerLevels: 4, naturalACBonus: 0, bonusHPPerLevel: 2, bonusMeleeDamage: 5,
    naturalProtection: {
      dtNormal: 4, dtLaser: 0, dtFire: 4, dtPlasma: 0, dtExplosion: 4,
      drNormal: 40, drLaser: 0, drFire: 40, drPlasma: 0, drExplosion: 40,
    },
  },
  {
    id: 'dog',
    name: 'Dog',
    description: 'Four-legged, furry, loyal companions. No opposable thumbs — cannot use weapons, tools, or armor (per the manual).',
    specialMin: { strength: 1, perception: 4, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 },
    specialMax: { strength: 7, perception: 14, endurance: 6, charisma: 5, intelligence: 3, agility: 15, luck: 10 },
    specialDefault: { strength: 4, perception: 8, endurance: 4, charisma: 2, intelligence: 3, agility: 10, luck: 5 },
    naturalDR: 0, naturalGasDR: 0, naturalElecDR: 50,
    naturalWeaponIds: ['dog_bite', 'dog_claw'],
    benefits: ['1 perk per 2 levels', '+50% Electricity Resistance', 'Very high AGI/PER potential'],
    penalties: ['Cannot use weapons, tools, or armor', 'Cannot speak', 'Low INT/STR/END'],
    playable: true, perksPerLevels: 2, naturalACBonus: 0,
  },
  {
    id: 'molerat',
    name: 'Molerat',
    description: 'Mutated mole rats. Aggressive burrowers found throughout the wasteland.',
    specialMin: { strength: 2, perception: 4, endurance: 4, charisma: 1, intelligence: 1, agility: 5, luck: 2 },
    specialMax: { strength: 6, perception: 9, endurance: 8, charisma: 3, intelligence: 3, agility: 9, luck: 7 },
    specialDefault: { strength: 4, perception: 6, endurance: 6, charisma: 1, intelligence: 2, agility: 7, luck: 4 },
    naturalDR: 5, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: ['molerat_bite'],
    benefits: ['Can burrow (sneak)', 'Decent natural DR', 'Pack hunters'],
    penalties: ['Small and fragile', 'Cannot use weapons/armor'],
    playable: false, naturalACBonus: 2,
  },
  {
    id: 'yaoguai',
    name: 'Yao Guai',
    description: 'Mutated black bears. Ferocious and relentless predators of the wasteland.',
    specialMin: { strength: 7, perception: 5, endurance: 7, charisma: 1, intelligence: 1, agility: 6, luck: 3 },
    specialMax: { strength: 12, perception: 10, endurance: 12, charisma: 3, intelligence: 4, agility: 11, luck: 8 },
    specialDefault: { strength: 9, perception: 7, endurance: 9, charisma: 1, intelligence: 3, agility: 8, luck: 5 },
    naturalDR: 15, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: ['yaoguai_claw', 'yaoguai_bite'],
    benefits: ['Powerful claws and bite', '15% natural DR', 'High HP'],
    penalties: ['Cannot use weapons/armor', 'Low INT'],
    playable: false, naturalACBonus: 4,
  },
  {
    id: 'radscorpion',
    name: 'Radscorpion',
    description: 'Massive, radiation-hardened scorpions. Their sting is venomous and their claws deadly.',
    specialMin: { strength: 6, perception: 5, endurance: 7, charisma: 1, intelligence: 1, agility: 5, luck: 3 },
    specialMax: { strength: 11, perception: 11, endurance: 13, charisma: 2, intelligence: 3, agility: 10, luck: 8 },
    specialDefault: { strength: 8, perception: 8, endurance: 10, charisma: 1, intelligence: 2, agility: 7, luck: 5 },
    naturalDR: 30, naturalGasDR: 30, naturalElecDR: 0,
    naturalWeaponIds: ['scorpion_claw', 'scorpion_sting'],
    benefits: ['Venomous sting', 'High natural DR including gas', 'Chitin armor'],
    penalties: ['Cannot use weapons/armor', 'Very low INT'],
    playable: false, naturalACBonus: 6,
  },
  {
    id: 'centaur',
    name: 'Centaur',
    description: 'Multi-headed FEV monstrosities. Dangerous at range with their acidic spit.',
    specialMin: { strength: 4, perception: 4, endurance: 5, charisma: 1, intelligence: 1, agility: 2, luck: 2 },
    specialMax: { strength: 9, perception: 9, endurance: 10, charisma: 3, intelligence: 4, agility: 6, luck: 6 },
    specialDefault: { strength: 6, perception: 6, endurance: 7, charisma: 1, intelligence: 2, agility: 4, luck: 4 },
    naturalDR: 15, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: ['centaur_spit', 'centaur_tentacle'],
    benefits: ['Acid spit at range', 'Unsettling presence'],
    penalties: ['Slow movement', 'Cannot use weapons/armor'],
    playable: false, naturalACBonus: 2,
  },
  {
    id: 'floater',
    name: 'Floater',
    description: 'Gas-bag FEV mutants that float through the air. Bite and spit attacks.',
    specialMin: { strength: 4, perception: 5, endurance: 5, charisma: 1, intelligence: 1, agility: 6, luck: 3 },
    specialMax: { strength: 9, perception: 10, endurance: 9, charisma: 2, intelligence: 4, agility: 12, luck: 8 },
    specialDefault: { strength: 6, perception: 7, endurance: 7, charisma: 1, intelligence: 2, agility: 9, luck: 5 },
    naturalDR: 10, naturalGasDR: 50, naturalElecDR: 0,
    naturalWeaponIds: ['floater_bite', 'floater_spit'],
    benefits: ['50% gas DR', 'Flies (immune to floor traps)', 'High AGI'],
    penalties: ['Cannot use weapons/armor'],
    playable: false, naturalACBonus: 3,
  },
  {
    id: 'brahmin',
    name: 'Brahmin',
    description: 'Two-headed mutant cattle. Usually docile but will defend themselves.',
    specialMin: { strength: 5, perception: 3, endurance: 6, charisma: 2, intelligence: 1, agility: 3, luck: 2 },
    specialMax: { strength: 9, perception: 6, endurance: 10, charisma: 5, intelligence: 3, agility: 6, luck: 6 },
    specialDefault: { strength: 7, perception: 4, endurance: 8, charisma: 3, intelligence: 2, agility: 4, luck: 4 },
    naturalDR: 5, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: ['brahmin_horn'],
    benefits: ['High carry weight', 'Decent HP'],
    penalties: ['Very low INT', 'Cannot use weapons/armor'],
    playable: false, naturalACBonus: 1,
  },
  {
    id: 'customRace',
    name: 'Custom',
    description: 'A custom creature or character race defined by the GM.',
    specialMin: { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 },
    specialMax: { strength: 14, perception: 14, endurance: 14, charisma: 14, intelligence: 14, agility: 14, luck: 14 },
    specialDefault: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
    naturalDR: 0, naturalGasDR: 0, naturalElecDR: 0,
    naturalWeaponIds: [],
    benefits: ['GM-defined traits'],
    penalties: ['GM-defined limitations'],
    playable: true, naturalACBonus: 0,
  },
];

export function getRaceById(id: string): RaceDefinition | undefined {
  return RACES.find(r => r.id === id);
}

const SPECIAL_KEYS: (keyof SPECIALStats)[] = [
  'strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck',
];
const PROTECTION_KEYS: (keyof NaturalProtection)[] = [
  'dtNormal', 'dtLaser', 'dtFire', 'dtPlasma', 'dtExplosion',
  'drNormal', 'drLaser', 'drFire', 'drPlasma', 'drExplosion',
];
const RACE_TAG_SLUG = (value: string) => value.trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const BUILT_IN_RACE_TAG_ID: Record<RaceType, string> = {
  human: 'race-human',
  ghoul: 'race-ghoul',
  superMutant: 'race-super-mutant',
  halfMutant: 'race-half-mutant',
  robot: 'race-robot',
  deathclaw: 'race-deathclaw',
  dog: 'race-dog',
  molerat: 'race-molerat',
  yaoguai: 'race-yao-guai',
  radscorpion: 'race-radscorpion',
  centaur: 'race-centaur',
  floater: 'race-floater',
  brahmin: 'race-brahmin',
  customRace: 'race-custom',
};

export interface RaceTagOption {
  id: string;
  label: string;
}

export const BUILT_IN_RACE_TAGS: RaceTagOption[] = RACES.map(race => ({
  id: BUILT_IN_RACE_TAG_ID[race.id as RaceType],
  label: race.name,
}));

export function getBuiltInRaceTagId(race: string): string | undefined {
  return BUILT_IN_RACE_TAG_ID[race as RaceType];
}

/** A profile's canonical tag remains stable if its display name is edited. */
export function getCustomRaceProfileTagId(id: string): string {
  return `race-profile-${RACE_TAG_SLUG(id)}`;
}

/** Resolve the mechanical race profile used by character calculations. */
export function getCharacterRaceDefinition(
  character: Pick<Character, 'race' | 'customRaceId' | 'customRaceProfile'>,
): RaceDefinition | CustomRaceDefinition | undefined {
  if (character.race === 'customRace' && character.customRaceProfile
    && (!character.customRaceId || character.customRaceProfile.id === character.customRaceId)) {
    return character.customRaceProfile;
  }
  return getRaceById(character.race);
}

export function getCharacterRaceTagIds(
  character: Pick<Character, 'race' | 'customRaceId' | 'customRaceProfile' | 'raceTags'>,
): string[] {
  const builtInTag = getBuiltInRaceTagId(character.race);
  const customProfileId = character.race === 'customRace'
    ? character.customRaceId ?? character.customRaceProfile?.id
    : undefined;
  const profileTag = customProfileId ? getCustomRaceProfileTagId(customProfileId) : undefined;
  const customTags = character.race === 'customRace' ? character.raceTags ?? [] : [];
  return [...new Set([builtInTag, profileTag, ...customTags].filter((id): id is string => !!id))];
}

export function evaluateRaceTagPerkEligibility(
  character: Pick<Character, 'race' | 'customRaceId' | 'customRaceProfile' | 'raceTags'>,
  requiredTags: readonly string[] = [],
  excludedTags: readonly string[] = [],
): { missingRequiredTag: boolean; excludedTagMatched: boolean } {
  const raceTags = new Set(getCharacterRaceTagIds(character));
  return {
    missingRequiredTag: requiredTags.length > 0 && !requiredTags.some(tag => raceTags.has(tag)),
    excludedTagMatched: excludedTags.some(tag => raceTags.has(tag)),
  };
}

export function getSelectableRaceTags(
  customRaces: readonly CustomRaceDefinition[] = [],
  campaignTags: readonly CampaignRaceTag[] = [],
  characters: readonly Pick<Character, 'race' | 'customRaceId' | 'customRaceProfile' | 'raceTags'>[] = [],
  selectedIds: readonly string[] = [],
): RaceTagOption[] {
  const tags = new Map<string, RaceTagOption>();
  for (const tag of BUILT_IN_RACE_TAGS) tags.set(tag.id, tag);
  for (const race of customRaces) {
    const id = getCustomRaceProfileTagId(race.id);
    tags.set(id, { id, label: race.name });
  }
  for (const tag of campaignTags) tags.set(tag.id, { id: tag.id, label: tag.label });
  for (const character of characters) {
    if (character.race === 'customRace' && character.customRaceProfile
      && (!character.customRaceId || character.customRaceProfile.id === character.customRaceId)) {
      const id = getCustomRaceProfileTagId(character.customRaceProfile.id);
      if (!tags.has(id)) tags.set(id, { id, label: character.customRaceProfile.name });
    }
    for (const tagId of getCharacterRaceTagIds(character)) {
      if (!tags.has(tagId)) tags.set(tagId, { id: tagId, label: tagId });
    }
  }
  for (const id of selectedIds) {
    if (!tags.has(id)) tags.set(id, { id, label: id });
  }
  return [...tags.values()];
}

export function validateCustomRace(value: unknown): value is CustomRaceDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const race = value as Record<string, unknown>;
  const validSpecial = (candidate: unknown): candidate is SPECIALStats =>
    !!candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    && SPECIAL_KEYS.every(key => Number.isFinite((candidate as Record<string, unknown>)[key]));
  if (typeof race.id !== 'string' || !race.id.trim() || race.id.length > 128
    || typeof race.name !== 'string' || !race.name.trim() || race.name.length > 80
    || typeof race.description !== 'string' || race.description.length > 1000
    || typeof race.playable !== 'boolean'
    || !validSpecial(race.specialMin) || !validSpecial(race.specialMax) || !validSpecial(race.specialDefault)
    || !Array.isArray(race.naturalWeaponIds) || !race.naturalWeaponIds.every(item => typeof item === 'string')
    || !Array.isArray(race.benefits) || !race.benefits.every(item => typeof item === 'string')
    || !Array.isArray(race.penalties) || !race.penalties.every(item => typeof item === 'string')
    || !['naturalDR', 'naturalGasDR', 'naturalElecDR', 'naturalACBonus']
      .every(key => typeof race[key] === 'number' && Number.isFinite(race[key]))
    || (race.perksPerLevels !== undefined && (!Number.isInteger(race.perksPerLevels) || (race.perksPerLevels as number) < 1 || (race.perksPerLevels as number) > 99))
    || (race.bonusHPPerLevel !== undefined && (!Number.isFinite(race.bonusHPPerLevel) || (race.bonusHPPerLevel as number) < 0 || (race.bonusHPPerLevel as number) > 100))
    || (race.bonusMeleeDamage !== undefined && (!Number.isFinite(race.bonusMeleeDamage) || (race.bonusMeleeDamage as number) < 0 || (race.bonusMeleeDamage as number) > 100))) return false;
  if (![race.naturalDR, race.naturalGasDR, race.naturalElecDR].every(value => (value as number) >= -100 && (value as number) <= 100)
    || (race.naturalACBonus as number) < 0 || (race.naturalACBonus as number) > 100) return false;
  for (const key of SPECIAL_KEYS) {
    const min = race.specialMin[key];
    const max = race.specialMax[key];
    const base = race.specialDefault[key];
    if (min < 1 || max > 20 || min > base || base > max) return false;
  }
  if (race.naturalProtection !== undefined) {
    if (!race.naturalProtection || typeof race.naturalProtection !== 'object' || Array.isArray(race.naturalProtection)) return false;
    const protection = race.naturalProtection as Record<string, unknown>;
    if (!PROTECTION_KEYS.every(key => typeof protection[key] === 'number' && Number.isFinite(protection[key])
      && (protection[key] as number) >= 0 && (protection[key] as number) <= 100)) return false;
    if (protection.armorClass !== undefined && (typeof protection.armorClass !== 'number'
      || !Number.isFinite(protection.armorClass) || protection.armorClass < 0 || protection.armorClass > 100)) return false;
  }
  return true;
}

export const PLAYABLE_RACES = RACES.filter(r => r.playable);
export const CREATURE_RACES = RACES.filter(r => !r.playable);
