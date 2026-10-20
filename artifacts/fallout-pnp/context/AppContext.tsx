import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Directory, Paths } from 'expo-file-system';
import { Character, CharacterPerk, InitiativeEntry, Injury, PositionType, SPECIALStats, Weapon, Armor, WeaponAmmoState, ActiveEffect, BestiaryTemplate, VehicleProfile, CampaignMap, CampaignTable, CampaignRaceTag, CampaignRuleTag, CustomPerkDefinition, CustomRaceDefinition, CustomWeaponMod, CustomConsumable, CatalogPortraitSelection, CatalogPortraitSettings, EMPTY_NATURAL_PROTECTION } from '@/context/types';
import { BUILT_IN_WEAPONS, getWeaponHands } from '@/data/weapons';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { calcBaseSkills, calcMaxHP } from '@/data/derived';
import { clampConditionBoxes, CONDITION_BOXES_MAX, markConditionSemanticsV2, migrateConditionSemantics, restorePremadeWeaponCondition } from '@/data/condition';
import { computeModEffects } from '@/data/mods';
import { computeCustomWeaponModEffects } from '@/data/customRules';
import { resolveHpChange } from '@/data/conditions';
import { getCharacterRaceDefinition, validateCustomRace } from '@/data/races';
import { resolveArmorAwareSheet } from '@/data/armorEffects';
import { computeInjurySkillPenalty } from '@/data/injuries';
import { applyTightNutsRepairHealing } from '@/data/traitRules';
import { addArmorWear, normalizeArmorCondition, wornArmor } from '@/data/armorCondition';
import { applyEquipmentDamage } from '@/data/equipmentDamage';
import { sortInitiativeEntries, syncInitiativeEntrySheet } from '@/data/initiativeSync';
import {
  BUILT_IN_BESTIARY,
  normalizeCustomTemplateArmorClass,
  shouldMigrateSpawnedNpcArmorClass,
} from '@/data/bestiary';
import { isBestiaryTemplateRecord } from '@/data/portableExports';
import { AP_COSTS } from '@/data/apCosts';
import {
  advanceCombatSkillTurn,
  advanceKnockoutTimer,
  applyHealFallenOutcome,
  armorOnlyArmorClass,
  canUseHealFallenSkill,
  cancelPendingActionsForRemovedCharacters,
  getHealFallenAPCost,
  isHealFallenTarget,
  isRevivedAPRestricted,
  planTimedSkillAP,
  resolveCombatSkillOutcome,
  type CombatSkillReceipt,
  type CompleteHealFallenRequest,
  type HealFallenRequest,
  type TimedCombatSkillAction,
  type TimedSkillActionRequest,
} from '@/data/combatSkills';

// Effective max AP for a character: derived max plus active chem apMod
// (Jet grants +2 AP, etc.). Floor 1 so a crashing chem never zeroes AP.
// When a knocked-out combatant's own turn begins, one KO turn elapses; they
// wake once the counter runs out (position stays prone until they Get Up).
import { computeEffectModifiers, effectiveSpecial } from '@/data/effects';
import { computeDefensivePerkBonuses } from '@/data/attackResolution';
import { getPerkById } from '@/data/perks';
import { migrateLegacyTraitPerks } from '@/data/legacyPerkMigration';
import {
  advanceAreaEffect,
  AreaAttack,
  AreaResolution,
  isValidAreaProfileRangeOverrides,
  normalizeAreaProfileRangeOverrides,
  resolveAreaTarget,
  resolveAreaZoneTarget,
  type AreaProfileRangeOverrides,
} from '@/data/areaEffects';
import { consolidatePoisonedEffects } from '@/data/poisonEffects';
import { clearUnconsciousness, setUnconsciousness } from '@/data/unconsciousness';
import { AMMO_TYPES, filterCompatibleAmmoIds, resolveEquippedAmmoTypeId, sanitizeCustomAmmoCatalog, validateCustomAmmo, type AmmoType } from '@/data/ammo';
import {
  planPortraitImportCleanup,
  PORTRAIT_IMPORT_DIRECTORY_PREFIX,
} from '@/data/portraitStorageCleanup';
import {
  applyRadiationGain,
  ghoulRadiationHealingDivisor,
  normalizeRadiation,
  type GhoulRadiationHealingOption,
} from '@/data/radiation';
import { normalizeKarmaFields } from '@/data/karma';
import { normalizeFactionReputations } from '@/data/factionReputation';
import { applyVehicleSystemDamage, resolveVehiclePerformance } from '@/data/vehicles';
import { BUILT_IN_VEHICLES } from '@/data/vehicles';
import {
  DEFAULT_CAMPAIGN_OPTIONS,
  normalizeCampaignOptions,
  type CampaignOptions,
  type CampaignVisualTheme,
} from '@/data/campaignOptions';
import { normalizeCampaignMap, normalizeCampaignTable } from '@/data/campaignTools';
import { validateCustomPerk, validateCustomWeaponMod } from '@/data/customRules';
import { isCustomConsumableRecord, sanitizeCustomConsumables, validateCustomConsumable } from '@/data/consumables';
import {
  isCatalogImageDataUri,
  normalizeCatalogPortraitMap,
  normalizeCatalogPortraitSettings,
  normalizeCatalogPortraitSettingsMap,
} from '@/data/catalogImages';

function cleanupUnreferencedPortraitImports(activePortraitUris: ReadonlySet<string>): void {
  if (Platform.OS === 'web') return;

  try {
    const directoryByUri = new Map<string, Directory>();
    const itemByUri = new Map<string, ReturnType<Directory['list']>[number]>();
    const snapshots = Paths.document.list()
      .filter((entry): entry is Directory => entry instanceof Directory)
      .filter(directory => directory.name.startsWith(PORTRAIT_IMPORT_DIRECTORY_PREFIX))
      .flatMap(directory => {
        try {
          const contents = directory.list();
          directoryByUri.set(directory.uri, directory);
          for (const item of contents) itemByUri.set(item.uri, item);
          return [{
            uri: directory.uri,
            name: directory.name,
            contentUris: contents.map(item => item.uri),
          }];
        } catch (error) {
          console.warn(`Could not inspect imported portrait folder ${directory.uri}.`, error);
          return [];
        }
      });
    const plan = planPortraitImportCleanup(snapshots, activePortraitUris);

    for (const uri of plan.contentUris) {
      try {
        itemByUri.get(uri)?.delete();
      } catch (error) {
        console.warn(`Could not remove unreferenced imported portrait ${uri}.`, error);
      }
    }
    for (const uri of plan.directoryUris) {
      try {
        const directory = directoryByUri.get(uri);
        if (directory?.exists) directory.delete();
      } catch (error) {
        console.warn(`Could not remove unreferenced imported portrait folder ${uri}.`, error);
      }
    }
  } catch (error) {
    console.warn('Could not scan imported portrait folders for cleanup.', error);
  }
}

function koTick<T extends { currentHp: number; isKnockedOut: boolean; knockOutRoundsLeft: number }>(c: T): T {
  return advanceKnockoutTimer(c);
}

function statusTick(c: Character, allArmor: Armor[]): { character: Character; damage: number } {
  const knocked = koTick(c);
  let damage = 0;
  const areaEffects = (knocked.areaEffects ?? []).flatMap(effect => {
    const raw = Array.from({ length: effect.damageDieCount }, () => Math.floor(Math.random() * effect.damageDie) + 1)
      .reduce((sum, roll) => sum + roll, effect.damageBonus);
    const { bodyArmor: body, helmet } = wornArmor(knocked, allArmor);
    const cap = effect.damageType.charAt(0).toUpperCase() + effect.damageType.slice(1);
    const dt = ((body?.[`dt${cap}` as keyof Armor] as number) ?? 0) + ((helmet?.[`dt${cap}` as keyof Armor] as number) ?? 0);
    const dr = Math.min(90, ((body?.[`dr${cap}` as keyof Armor] as number) ?? 0) + ((helmet?.[`dr${cap}` as keyof Armor] as number) ?? 0));
    const naturalDT = (knocked.naturalProtection?.[`dt${cap}` as keyof typeof knocked.naturalProtection] as number) ?? 0;
    const naturalDR = (knocked.naturalProtection?.[`dr${cap}` as keyof typeof knocked.naturalProtection] as number) ?? 0;
    const afterDT = Math.max(0, raw - dt - naturalDT);
    damage += Math.max(0, Math.round(afterDT * (1 - Math.min(90, dr + naturalDR) / 100)));
    const advanced = advanceAreaEffect(effect);
    return advanced ? [advanced] : [];
  });
  const currentHp = Math.max(0, knocked.currentHp - damage);
  return {
    character: {
      ...knocked, currentHp, areaEffects,
      // A character reduced to zero by an end-turn hazard remains unconscious.
      ...(currentHp <= 0 ? { isKnockedOut: true } : {}),
    },
    damage,
  };
}

function resolveCharacterArmorSheet(
  c: Character,
  allArmor: readonly Armor[],
  includeTempAC = false,
  hardcoreRadiationRules = false,
  mutantGhoulRadiationRules = false,
  ghoulRadiationHealingOption: GhoulRadiationHealingOption = 1,
) {
  const race = getCharacterRaceDefinition(c);
  const sheet = resolveArmorAwareSheet({
    special: c.special,
    skills: c.skills,
    taggedSkills: c.taggedSkills,
    traits: c.traits,
    perks: c.perks,
    conditions: c.conditions,
    effects: c.effects,
    raceBounds: race ? { min: race.specialMin, max: race.specialMax } : undefined,
    raceDefinition: race,
    nightPersonPeriod: c.nightPersonPeriod,
    racialNaturalArmorClass: race?.naturalACBonus,
    naturalArmorClass: c.naturalProtection?.armorClass,
    manualDerivedStats: c.manualDerivedStats,
    usesDerivedArmorClass: c.usesDerivedArmorClass,
    tempAC: includeTempAC ? c.tempAC : 0,
    radiationResistance: c.radiationResistance,
    gasResistance: c.gasResistance,
    poisonResistance: c.poisonResistance,
    electricityResistance: c.electricityResistance,
    accumulatedRadiation: c.accumulatedRadiation,
    hardcoreRadiationRules,
    raceId: c.race,
    mutantGhoulRadiationRules,
    ghoulRadiationHealingOption,
    equippedBodyArmorId: c.equippedBodyArmorId,
    equippedHelmetId: c.equippedHelmetId,
    armorConditionStates: c.armorConditionStates,
    allArmor,
  });
  // The manual removes every AC source except worn armor while a GM-timed
  // skill is underway. This intentionally excludes Agility, unused AP, perks,
  // and temporary AC.
  return c.combatDefenseSuppressed
    ? { ...sheet, armorClass: armorOnlyArmorClass([sheet.bodyArmor?.acBonus ?? 0, sheet.helmet?.acBonus ?? 0]) }
    : sheet;
}

function applyCharacterRadiationGain(
  character: Character,
  amount: number,
  mutantGhoulRadiationRules: boolean,
  ghoulRadiationHealingOption: GhoulRadiationHealingOption,
): Pick<Character, 'accumulatedRadiation' | 'currentHp' | 'ghoulRadiationHealingRemainder'> {
  const healingDivisor = ghoulRadiationHealingDivisor(character.race, {
    mutantGhoulRadiationRules,
    ghoulRadiationHealingOption,
  });
  return applyRadiationGain(character, amount, character.maxHp, healingDivisor);
}

function charMaxAP(
  c: Character,
  allArmor: readonly Armor[],
  hardcoreRadiationRules = false,
  mutantGhoulRadiationRules = false,
  ghoulRadiationHealingOption: GhoulRadiationHealingOption = 1,
): number {
  return resolveCharacterArmorSheet(
    c, allArmor, false, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
  ).maxAP;
}

function effectiveCombatSkillValue(
  c: Character,
  skill: keyof Character['skills'],
  allArmor: readonly Armor[],
  hardcoreRadiationRules = false,
  mutantGhoulRadiationRules = false,
  ghoulRadiationHealingOption: GhoulRadiationHealingOption = 1,
): number {
  const sheetValue = resolveCharacterArmorSheet(
    c, allArmor, false, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
  ).effectiveSkills[skill];
  const injuryPenalty = computeInjurySkillPenalty(c, skill);
  return Math.max(0, sheetValue + injuryPenalty);
}

/** Mirror live character state into linked initiative entries after an atomic
 * combat-skill transaction or turn transition. */
function syncCombatSkillInitiative(
  entries: InitiativeEntry[],
  characters: Character[],
  allArmor: readonly Armor[],
  hardcoreRadiationRules = false,
  mutantGhoulRadiationRules = false,
  ghoulRadiationHealingOption: GhoulRadiationHealingOption = 1,
): InitiativeEntry[] {
  return entries.map(entry => {
    const character = entry.characterId ? characters.find(candidate => candidate.id === entry.characterId) : undefined;
    if (!character) return entry;
    const sheet = resolveCharacterArmorSheet(
      character, allArmor, false, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
    );
    return {
      ...entry,
      currentAP: character.currentAP,
      maxAP: sheet.maxAP,
      currentHp: character.currentHp,
      maxHp: character.maxHp,
      armorClass: sheet.armorClass,
      tempAC: character.tempAC,
      position: character.position,
    };
  });
}

/** Remove actions whose actor or target disappeared, then release any affected
 * actor whose remaining action list no longer needs the defense penalty. */
function cancelActionsForCharacterIds(
  characters: Character[],
  pendingActions: TimedCombatSkillAction[],
  removedCharacterIds: ReadonlySet<string>,
): { characters: Character[]; pendingActions: TimedCombatSkillAction[] } {
  const result = cancelPendingActionsForRemovedCharacters(characters, pendingActions, removedCharacterIds);
  return { characters: result.combatants, pendingActions: result.pendingActions };
}

/** Effective magazine size after mod magazineMult (extended/drum mags etc.). */
function effectiveMagazineSize(weapon: Weapon, customMods: readonly CustomWeaponMod[] = []): number {
  if (weapon.magazineSize <= 0) return weapon.magazineSize;
  const eff = computeModEffects(weapon.mods ?? []);
  const custom = computeCustomWeaponModEffects(weapon.mods ?? [], [...customMods], weapon);
  return Math.round(weapon.magazineSize * (eff.magazineMult ?? 1) * custom.magazineMult);
}

function normalizeCharacterAmmoStates(
  character: Character,
  allWeapons: readonly Weapon[],
  allAmmo: readonly AmmoType[] = AMMO_TYPES,
  customMods: readonly CustomWeaponMod[] = [],
): Character {
  const existingByWeapon = new Map((character.weaponAmmoStates ?? []).map(state => [state.weaponId, state]));
  const weaponIds = new Set([
    ...existingByWeapon.keys(),
    character.equippedWeaponId,
    character.leftHandWeaponId,
    character.rightHandWeaponId,
    ...(character.inventoryWeaponIds ?? []),
  ].filter((id): id is string => !!id));
  const weaponAmmoStates: WeaponAmmoState[] = [];

  for (const weaponId of weaponIds) {
    const existing = existingByWeapon.get(weaponId);
    const weapon = allWeapons.find(candidate => candidate.id === weaponId);
    if (!weapon) {
      if (existing) weaponAmmoStates.push(existing);
      continue;
    }
    weaponAmmoStates.push({
      weaponId,
      currentAmmo: existing?.currentAmmo ?? effectiveMagazineSize(weapon, customMods),
      conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0),
      ammoTypeId: resolveEquippedAmmoTypeId(weapon, existing?.ammoTypeId, allAmmo),
    });
  }
  const inventoryWeaponIds = character.inventoryWeaponIds ?? [...new Set([
    character.leftHandWeaponId, character.rightHandWeaponId, character.equippedWeaponId,
  ].filter((id): id is string => !!id))].slice(0, 5);
  return {
    ...character,
    ...normalizeKarmaFields(character),
    factionReputations: normalizeFactionReputations(character.factionReputations),
    inventoryWeaponIds,
    weaponAmmoStates,
    armorConditionStates: normalizeArmorCondition(character.armorConditionStates),
  };
}

// v4 — new damage types (N/L/F/P/E), DR added to armor, pilot skill, custom bestiary
const STORAGE_KEY = '@fallout_pnp_v4';

interface AppState extends CampaignOptions {
  campaignName: string;
  characters: Character[];
  customWeapons: Weapon[];
  customArmor: Armor[];
  customAmmo: AmmoType[];
  customConsumables: CustomConsumable[];
  customVehicles: VehicleProfile[];
  customBestiaryTemplates: BestiaryTemplate[];
  builtInBestiaryOverrides: BestiaryTemplate[];
  removedBuiltInBestiaryTemplateIds: string[];
  bestiaryPortraits: Record<string, string>;
  vehicleCatalogPortraits: Record<string, string>;
  bestiaryPortraitSettings: Record<string, CatalogPortraitSettings>;
  vehicleCatalogPortraitSettings: Record<string, CatalogPortraitSettings>;
  customWeaponMods: CustomWeaponMod[];
  customPerks: CustomPerkDefinition[];
  campaignRuleTags: CampaignRuleTag[];
  customRaces: CustomRaceDefinition[];
  campaignRaceTags: CampaignRaceTag[];
  lootTables: CampaignTable[];
  encounterTables: CampaignTable[];
  campaignMaps: CampaignMap[];
  initiativeEntries: InitiativeEntry[];
  currentRound: number;
  combatActive: boolean;
  activeEntryId: string | null;
  /** Ephemeral receipt for the last atomic AoE transaction. */
  areaAttackReceipt?: { requestId: string; results: AreaResolution[] };
  /** GM-defined blast ranges for profiles whose manual entries omit a distance. */
  areaProfileRangeOverrides: AreaProfileRangeOverrides;
  /** Recent attack transactions; duplicate UI submissions must not charge HP/wear twice. */
  damageReceiptIds?: string[];
  /** Pending actions resolve only at the start of their actor's own turn. */
  pendingCombatSkillActions: TimedCombatSkillAction[];
  /** Ephemeral receipt for the latest timed skill or Heal Fallen transaction. */
  combatSkillReceipt?: CombatSkillReceipt;
  /** true once weapon conditionBoxes use the manual's FILLED 0–10 semantics
   *  (legacy saves stored 0–5 "remaining boxes"). */
  conditionSemanticsV2?: boolean;
  /** Legacy import alias; normalized into the canonical Hardcore field. */
  fallout3RadiationDebuffs?: boolean;
  hardcoreRadiationRules: boolean;
}

const CAMPAIGN_COLLECTIONS = [
  'customWeapons',
  'customArmor',
  'customAmmo',
  'customConsumables',
  'customVehicles',
  'customBestiaryTemplates',
  'builtInBestiaryOverrides',
  'customWeaponMods',
  'customPerks',
  'campaignRuleTags',
  'customRaces',
  'campaignRaceTags',
  'initiativeEntries',
  'pendingCombatSkillActions',
] as const;

const CHARACTER_RECORD_COLLECTIONS = [
  'karmaLog',
  'factionReputations',
  'perks',
  'weaponAmmoStates',
  'armorConditionStates',
  'naturalAttacks',
  'injuries',
  'effects',
  'areaEffects',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function hasRecordCollection(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function hasValidCharacterRecord(value: unknown): value is Character {
  if (!isRecord(value)) return false;
  const character = value;
  const finiteNumber = (field: string) =>
    typeof character[field] === 'number' && Number.isFinite(character[field]);
  const stringFields = ['id', 'name'] as const;
  if (stringFields.some(field => typeof character[field] !== 'string' || character[field] === '')) return false;
  if (character.type !== 'pc' && character.type !== 'npc') return false;
  if (typeof character.race !== 'string' || character.race === '') return false;
  if (!['standing', 'crouching', 'prone'].includes(character.position as string)) return false;
  if (typeof character.isKnockedOut !== 'boolean') return false;
  if ([
    'level', 'xp', 'maxHp', 'currentHp', 'armorClass', 'tempAC', 'maxAP', 'currentAP',
    'sequence', 'unspentSkillPoints', 'radiationResistance', 'gasResistance',
    'electricityResistance', 'knockOutRoundsLeft',
  ].some(field => !finiteNumber(field))) return false;

  const specialKeys = ['strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck'];
  const skillKeys = [
    'smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed', 'throwing',
    'firstAid', 'doctor', 'sneak', 'lockpick', 'steal', 'traps', 'science', 'repair',
    'speech', 'barter', 'gambling', 'outdoorsman', 'pilot',
  ];
  const special = character.special;
  const skills = character.skills;
  if (!isRecord(special)
    || specialKeys.some(key => typeof special[key] !== 'number'
      || !Number.isFinite(special[key]))) return false;
  if (!isRecord(skills)
    || skillKeys.some(key => typeof skills[key] !== 'number'
      || !Number.isFinite(skills[key]))) return false;

  if (!isStringArray(character.taggedSkills) || !isStringArray(character.conditions)) return false;
  for (const field of CHARACTER_RECORD_COLLECTIONS) {
    const collection = character[field];
    if (collection !== undefined && !hasRecordCollection(collection)) return false;
  }
  for (const field of ['traits', 'inventoryWeaponIds'] as const) {
    const collection = character[field];
    if (collection !== undefined && !isStringArray(collection)) return false;
  }
  if (character.customRaceId !== undefined
    && (typeof character.customRaceId !== 'string' || character.customRaceId.length > 128
      || character.race !== 'customRace')) return false;
  if (character.raceTags !== undefined && !isStringArray(character.raceTags)) return false;
  if (character.raceNaturalWeaponIds !== undefined && !isStringArray(character.raceNaturalWeaponIds)) return false;
  if (character.customRaceProfile !== undefined
    && (!validateCustomRace(character.customRaceProfile)
      || character.race !== 'customRace'
      || (character.customRaceId !== undefined && character.customRaceProfile.id !== character.customRaceId))) return false;
  if (character.combatDevice !== undefined) {
    const device = character.combatDevice;
    if (!isRecord(device)
      || (device.kind !== 'mine' && device.kind !== 'trap')
      || typeof device.weaponId !== 'string' || !device.weaponId
      || typeof device.ownerCharacterId !== 'string' || !device.ownerCharacterId
      || (device.status !== 'armed' && device.status !== 'triggered')) return false;
  }
  return true;
}

function hasValidCampaignImport(value: unknown): value is AppState {
  if (!isRecord(value) || !Array.isArray(value.characters)
    || !value.characters.every(hasValidCharacterRecord)) return false;
  for (const field of CAMPAIGN_COLLECTIONS) {
    const collection = value[field];
    if (collection !== undefined && !hasRecordCollection(collection)) return false;
  }
  if (value.customWeaponMods !== undefined
    && (!Array.isArray(value.customWeaponMods) || !value.customWeaponMods.every(validateCustomWeaponMod))) return false;
  if (value.customPerks !== undefined
    && (!Array.isArray(value.customPerks) || !value.customPerks.every(validateCustomPerk))) return false;
  if (value.customConsumables !== undefined
    && (!Array.isArray(value.customConsumables)
      || !value.customConsumables.every(isCustomConsumableRecord)
      || sanitizeCustomConsumables(value.customConsumables).length !== value.customConsumables.length)) return false;
  if (value.campaignRuleTags !== undefined
    && (!Array.isArray(value.campaignRuleTags) || !value.campaignRuleTags.every(tag =>
      isRecord(tag) && typeof tag.id === 'string' && typeof tag.label === 'string'
      && ['weapon', 'armor', 'both'].includes(tag.appliesTo as string)))) return false;
  if (value.customRaces !== undefined
    && (!Array.isArray(value.customRaces) || !value.customRaces.every(validateCustomRace))) return false;
  if (value.campaignRaceTags !== undefined
    && (!Array.isArray(value.campaignRaceTags) || !value.campaignRaceTags.every(tag =>
      isRecord(tag) && typeof tag.id === 'string' && !!tag.id
      && typeof tag.label === 'string' && !!tag.label.trim()))) return false;
  if (value.builtInBestiaryOverrides !== undefined
    && (!Array.isArray(value.builtInBestiaryOverrides)
      || !value.builtInBestiaryOverrides.every(isBestiaryTemplateRecord))) return false;
  if (value.removedBuiltInBestiaryTemplateIds !== undefined
    && !isStringArray(value.removedBuiltInBestiaryTemplateIds)) return false;
  if (value.damageReceiptIds !== undefined && !isStringArray(value.damageReceiptIds)) return false;
  if (!isValidAreaProfileRangeOverrides(value.areaProfileRangeOverrides)) return false;
  return true;
}

function reconcileInitiativeCharacters(parsed: AppState): AppState {
  const currentRound = parsed.currentRound ?? 1;
  const characters = (parsed.characters ?? []).map(character => ({
    ...character,
    // Migrate finite fire/acid saves from the earlier implementation to the
    // manual lifecycle: both persist until their explicit removal action.
    currentAP: isRevivedAPRestricted(character, currentRound) ? 0 : character.currentAP,
    areaEffects: (character.areaEffects ?? []).map(effect =>
      effect.kind === 'fire' || effect.kind === 'acid'
        ? { ...effect, persistent: true, roundsLeft: undefined, removeAfterTick: false }
        : effect),
  }));
  return {
    ...parsed,
    characters,
    initiativeEntries: (parsed.initiativeEntries ?? []).map(entry => {
      const character = characters.find(c => c.id === entry.characterId);
      if (!character) return entry;
      return {
        ...entry,
        currentHp: character.currentHp,
        maxHp: character.maxHp,
        position: character.position,
        currentAP: character.isKnockedOut || isRevivedAPRestricted(character, currentRound) ? 0 : entry.currentAP,
      };
    }),
  };
}

/** Add only newly introduced zero/default fields to persisted/imported data. */
function normalizeArmorEffectsData(parsed: AppState): AppState {
  const customTemplateIds = new Set((parsed.customBestiaryTemplates ?? []).map(template => template.id));
  const normalizeArmor = (armor: Armor): Armor => armor.effects
    ? armor
    : { ...armor, effects: { special: {}, skills: {} } };
  const normalizeCharacter = (character: Character): Character => {
    let normalized = migrateLegacyTraitPerks(character);
    if (typeof normalized.poisonResistance !== 'number') {
      normalized = { ...normalized, poisonResistance: 0 };
    }
    const accumulatedRadiation = normalizeRadiation(normalized.accumulatedRadiation);
    if (accumulatedRadiation !== normalized.accumulatedRadiation) {
      normalized = { ...normalized, accumulatedRadiation };
    }
    const effects = consolidatePoisonedEffects(normalized.effects ?? []);
    if (effects.length !== (normalized.effects ?? []).length
      || effects.some((effect, index) => effect !== normalized.effects?.[index])) {
      normalized = { ...normalized, effects };
    }
    // Break the Rules had no implemented effect before this flag existed, so
    // an older owner necessarily still has the one-time selection available.
    if (
      normalized.breakTheRulesPending === undefined
      && (normalized.perks ?? []).some(perk => perk.perkId === 'break_the_rules')
    ) {
      normalized = { ...normalized, breakTheRulesPending: true };
    }
    // Existing spawned bestiary saves predate the explicit derived-AC policy.
    // Use durable template identity so edited/renamed humanoids migrate safely
    // without changing a coincidentally similar custom NPC.
    if (normalized.type === 'npc' && normalized.usesDerivedArmorClass === undefined) {
      if (shouldMigrateSpawnedNpcArmorClass(normalized, customTemplateIds)) {
        normalized = { ...normalized, usesDerivedArmorClass: true };
      }
    }
    if (normalized.race === 'robot' && normalized.poisonResistance !== 100) {
      normalized = { ...normalized, poisonResistance: 100 };
    }
    // bestiaryTemplateId is provenance only: spawned NPCs are snapshots, not
    // live references. Never re-apply the built-in source template on reload.
    return normalized;
  };
  const normalizeTemplate = (template: BestiaryTemplate): BestiaryTemplate => {
    const portraitSettings = normalizeCatalogPortraitSettings(template);
    return {
      ...normalizeCustomTemplateArmorClass(template),
      // Preserve explicit fixed-AC choices; older templates still default to derived.
      portrait: isCatalogImageDataUri(template.portrait) ? template.portrait : undefined,
      portraitFit: portraitSettings?.portraitFit,
      portraitOffset: portraitSettings?.portraitOffset,
      poisonResistance: template.poisonResistance ?? 0,
      sequence: template.sequence ?? template.special.perception * 2,
    };
  };
  const normalizedTemplates = (parsed.customBestiaryTemplates ?? []).map(normalizeTemplate);
  const builtInTemplateIds = new Set(BUILT_IN_BESTIARY.map(template => template.id));
  const normalizedBuiltInOverrides = (parsed.builtInBestiaryOverrides ?? [])
    .filter(template => isBestiaryTemplateRecord(template) && builtInTemplateIds.has(template.id))
    .map(normalizeTemplate);
  const removedBuiltInBestiaryTemplateIds = Array.from(new Set(
    (parsed.removedBuiltInBestiaryTemplateIds ?? []).filter((id): id is string =>
      typeof id === 'string' && builtInTemplateIds.has(id),
    ),
  ));
  const bestiaryPortraits = normalizeCatalogPortraitMap({
    ...Object.fromEntries([...normalizedTemplates, ...normalizedBuiltInOverrides]
      .filter(template => isCatalogImageDataUri(template.portrait))
      .map(template => [template.id, template.portrait!])),
    ...(parsed.bestiaryPortraits ?? {}),
  });
  const bestiaryPortraitSettings = normalizeCatalogPortraitSettingsMap({
    ...Object.fromEntries([...normalizedTemplates, ...normalizedBuiltInOverrides]
      .map(template => [template.id, template])),
    ...(parsed.bestiaryPortraitSettings ?? {}),
  });

  return {
    ...parsed,
    characters: (parsed.characters ?? []).map(normalizeCharacter),
    customArmor: (parsed.customArmor ?? []).map(normalizeArmor),
    customBestiaryTemplates: normalizedTemplates.map(({ portrait: _portrait, ...template }) => template),
    builtInBestiaryOverrides: normalizedBuiltInOverrides.map(({ portrait: _portrait, ...template }) => template),
    removedBuiltInBestiaryTemplateIds,
    bestiaryPortraits,
    bestiaryPortraitSettings,
    vehicleCatalogPortraits: normalizeCatalogPortraitMap(parsed.vehicleCatalogPortraits),
    vehicleCatalogPortraitSettings: normalizeCatalogPortraitSettingsMap(parsed.vehicleCatalogPortraitSettings),
  };
}

function normalizeCustomAmmo(parsed: AppState): AppState {
  return { ...parsed, customAmmo: sanitizeCustomAmmoCatalog(parsed.customAmmo) };
}

function normalizePersistedState(parsed: AppState): AppState {
  const normalized = normalizeCustomAmmo(normalizeArmorEffectsData(migrateConditionSemantics(parsed)));
  const { fallout3RadiationDebuffs: legacyRadiationRules, ...currentState } = normalized;
  const allAmmo = [...AMMO_TYPES, ...(normalized.customAmmo ?? [])];
  const customWeapons = (normalized.customWeapons ?? []).map(weapon => ({
    ...weapon,
    compatibleAmmo: filterCompatibleAmmoIds(weapon.compatibleAmmo, allAmmo),
  }));
  const allWeapons = [...BUILT_IN_WEAPONS, ...customWeapons];
  const customRaces = (normalized.customRaces ?? []).filter(validateCustomRace);
  const campaignRaceTags = (normalized.campaignRaceTags ?? []).filter(tag =>
    typeof tag?.id === 'string' && !!tag.id && typeof tag.label === 'string' && !!tag.label.trim());
  return {
    ...currentState,
    campaignName: typeof normalized.campaignName === 'string' && normalized.campaignName.trim()
      ? normalized.campaignName.trim().slice(0, 80)
      : 'My Campaign',
    ...normalizeCampaignOptions(normalized),
    customConsumables: sanitizeCustomConsumables(normalized.customConsumables),
    areaProfileRangeOverrides: normalizeAreaProfileRangeOverrides(normalized.areaProfileRangeOverrides),
    hardcoreRadiationRules: normalized.hardcoreRadiationRules !== undefined
      ? normalized.hardcoreRadiationRules === true
      : legacyRadiationRules === true,
    customWeapons,
    customWeaponMods: (normalized.customWeaponMods ?? []).filter(validateCustomWeaponMod),
    customPerks: (normalized.customPerks ?? []).filter(validateCustomPerk),
    customRaces,
    campaignRaceTags,
    campaignRuleTags: (normalized.campaignRuleTags ?? []).filter(tag =>
      typeof tag?.id === 'string' && typeof tag.label === 'string'
      && ['weapon', 'armor', 'both'].includes(tag.appliesTo)),
    customVehicles: (parsed.customVehicles ?? []).map(vehicle => ({
      ...vehicle,
      ...(normalizeCatalogPortraitSettings(vehicle) ?? {}),
      isCustom: true,
      damageResistance: { ...vehicle.damageResistance },
      systems: (vehicle.systems ?? []).map(system => ({
        ...system,
        maxHp: Math.max(1, Math.floor(system.maxHp ?? 1)),
        currentHp: Math.max(0, Math.min(system.maxHp ?? 1, Math.floor(system.currentHp ?? system.maxHp ?? 1))),
      })),
      mountedWeapons: [...(vehicle.mountedWeapons ?? [])],
      enhancements: [...(vehicle.enhancements ?? [])],
      notes: [...(vehicle.notes ?? [])],
    })),
    lootTables: (parsed.lootTables ?? []).map(normalizeCampaignTable).filter((table): table is CampaignTable => table !== null),
    encounterTables: (parsed.encounterTables ?? []).map(normalizeCampaignTable).filter((table): table is CampaignTable => table !== null),
    campaignMaps: (parsed.campaignMaps ?? []).map(normalizeCampaignMap).filter((map): map is CampaignMap => map !== null),
    characters: (normalized.characters ?? []).map(character => {
      const currentProfile = character.customRaceId
        ? customRaces.find(race => race.id === character.customRaceId)
        : undefined;
      const withRaceProfile = currentProfile
        ? { ...character, customRaceProfile: currentProfile }
        : character;
      return normalizeCharacterAmmoStates({
        ...withRaceProfile,
        ...(Array.isArray(character.raceTags) ? { raceTags: [...new Set(character.raceTags)] } : {}),
      }, allWeapons, allAmmo, normalized.customWeaponMods ?? []);
    }),
  };
}

interface AppContextValue extends AppState {
  loaded: boolean;
  allWeapons: Weapon[];
  allArmor: Armor[];
  allAmmo: AmmoType[];
  allVehicles: VehicleProfile[];

  addCharacter: (char: Character) => void;
  updateCharacter: (char: Character) => void;
  deleteCharacter: (id: string) => void;
  cloneCharacter: (id: string) => void;
  moveCharacter: (characterId: string, targetCharacterId: string) => void;

  applyDamage: (characterId: string, damage: number) => void;
  applyCombatDamage: (requestId: string, characterId: string, damage: number, damagingHits: number, location?: string, vehicleSystemId?: string, attackerCharacterId?: string) => void;
  healCharacter: (characterId: string, amount: number) => void;
  adjustRadiation: (characterId: string, delta: number) => void;
  hardcoreRadiationRules: boolean;
  setHardcoreRadiationRules: (enabled: boolean) => void;
  setAreaProfileRangeOverride: (profileId: string, effectId: string, range: number) => void;
  setMutantGhoulRadiationRules: (enabled: boolean) => void;
  setGhoulRadiationHealingOption: (option: GhoulRadiationHealingOption) => void;
  setVisualTheme: (theme: CampaignVisualTheme) => void;
  setSystemSoundsEnabled: (enabled: boolean) => void;
  setCombatSoundsEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  spendAP: (characterId: string, amount: number) => boolean;
  restoreAP: (characterId: string, amount?: number) => void;
  /** Start a GM-timed combat skill. See TimedSkillActionRequest for AP/round timing. */
  startTimedSkillAction: (request: TimedSkillActionRequest) => string;
  /** Atomically spends AP, resolves or queues a Heal Fallen action, and syncs initiative. */
  resolveHealFallen: (request: HealFallenRequest) => string;
  /** Resolve a ready delayed Heal Fallen action without spending more AP. */
  completeHealFallen: (request: CompleteHealFallenRequest) => string;
  /** Cancel a ready delayed Heal Fallen action; AP already spent are never refunded. */
  cancelCombatSkillAction: (actionId: string) => string;
  setPosition: (characterId: string, position: PositionType) => void;
  setKnockedOut: (characterId: string, rounds: number) => void;
  applyAreaAttack: (attack: AreaAttack, characterIds: string[]) => string;
  markAreaEffectForRemoval: (characterId: string, effectId: string) => void;
  removeAreaEffect: (characterId: string, effectId: string) => void;
  addTempAC: (characterId: string, ac: number) => void;
  clearTempAC: (characterId: string) => void;

  spendAmmo: (characterId: string, weaponId: string, shots: number) => boolean;
  reloadWeapon: (characterId: string, weaponId: string) => void;
  jamWeapon: (characterId: string, weaponId: string) => void;
  setWeaponCondition: (characterId: string, weaponId: string, filledBoxes: number) => void;
  restorePremadeWeaponCondition: (characterId: string, weaponId: string) => void;
  setAmmoType: (characterId: string, weaponId: string, ammoTypeId: string | undefined) => void;
  equipWeapon: (characterId: string, weaponId: string, hand?: 'left' | 'right' | 'both') => void;
  setActiveWeapon: (characterId: string, weaponId: string) => void;

  addEffect: (characterId: string, effect: ActiveEffect) => void;
  removeEffect: (characterId: string, effectId: string) => void;
  applyChem: (characterId: string, effect: ActiveEffect) => void;

  addInjury: (characterId: string, injury: Injury) => void;
  removeInjury: (characterId: string, injuryId: string) => void;
  toggleInjury: (characterId: string, injuryId: string) => void;

  startCombat: (entries: InitiativeEntry[]) => void;
  endCombat: () => void;
  addInitiativeEntry: (entry: InitiativeEntry) => void;
  removeInitiativeEntry: (id: string) => void;
  updateInitiativeEntry: (entry: InitiativeEntry) => void;
  moveInitiativeEntry: (id: string, direction: 'up' | 'down') => void;
  nextTurn: () => void;
  nextRound: () => void;
  setActiveEntry: (id: string) => void;

  addCustomWeapon: (w: Weapon) => void;
  updateCustomWeapon: (w: Weapon) => void;
  deleteCustomWeapon: (id: string) => void;
  addCustomArmor: (a: Armor) => void;
  updateCustomArmor: (a: Armor) => void;
  deleteCustomArmor: (id: string) => void;
  addCustomAmmo: (a: AmmoType) => void;
  updateCustomAmmo: (a: AmmoType) => void;
  deleteCustomAmmo: (id: string) => void;
  addCustomConsumable: (consumable: CustomConsumable) => void;
  updateCustomConsumable: (consumable: CustomConsumable) => void;
  deleteCustomConsumable: (id: string) => void;
  addCustomVehicle: (vehicle: VehicleProfile) => void;
  updateCustomVehicle: (vehicle: VehicleProfile) => void;
  deleteCustomVehicle: (id: string) => void;

  addCustomBestiaryTemplate: (t: BestiaryTemplate) => void;
  removeCustomBestiaryTemplate: (id: string) => void;
  saveBuiltInBestiaryOverride: (t: BestiaryTemplate) => void;
  removeBuiltInBestiaryTemplate: (id: string) => void;
  restoreBuiltInBestiaryDefaults: () => void;
  setBestiaryPortrait: (id: string, selection: CatalogPortraitSelection) => void;
  setVehicleCatalogPortrait: (id: string, selection: CatalogPortraitSelection) => void;

  exportCampaign: () => string;
  importCampaign: (json: string) => Promise<boolean>;
  saveCampaignTools: (tools: {
    lootTables: CampaignTable[];
    encounterTables: CampaignTable[];
    campaignMaps: CampaignMap[];
  }) => void;
  saveCustomRules: (rules: {
    customWeaponMods: CustomWeaponMod[];
    customPerks: CustomPerkDefinition[];
    campaignRuleTags: CampaignRuleTag[];
  }) => void;
  saveCustomRaces: (races: CustomRaceDefinition[]) => void;
  saveCampaignRaceTags: (tags: CampaignRaceTag[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const defaultState: AppState = markConditionSemanticsV2({
  campaignName: 'My Campaign',
  characters: [],
  customWeapons: [],
  customArmor: [],
  customAmmo: [],
  customConsumables: [],
  customVehicles: [],
  customBestiaryTemplates: [],
  builtInBestiaryOverrides: [],
  removedBuiltInBestiaryTemplateIds: [],
  bestiaryPortraits: {},
  vehicleCatalogPortraits: {},
  bestiaryPortraitSettings: {},
  vehicleCatalogPortraitSettings: {},
  customWeaponMods: [],
  customPerks: [],
  campaignRuleTags: [],
  customRaces: [],
  campaignRaceTags: [],
  lootTables: [],
  encounterTables: [],
  campaignMaps: [],
  areaProfileRangeOverrides: {},
  initiativeEntries: [],
  currentRound: 1,
  combatActive: false,
  activeEntryId: null,
  pendingCombatSkillActions: [],
  hardcoreRadiationRules: false,
  ...DEFAULT_CAMPAIGN_OPTIONS,
});

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const skipNextPersistRef = useRef<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = reconcileInitiativeCharacters(normalizePersistedState(JSON.parse(raw) as AppState));
          setState({ ...defaultState, ...parsed });
        } catch (_) {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const serialized = JSON.stringify(state);
    if (skipNextPersistRef.current === serialized) {
      skipNextPersistRef.current = null;
      return;
    }
    skipNextPersistRef.current = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const activePortraitUris = state.characters
    .map(character => character.portrait)
    .filter((uri): uri is string => !!uri);
  const customVehiclePortraitUris = state.customVehicles
    .map(vehicle => vehicle.portrait)
    .filter((uri): uri is string => !!uri);
  const activePortraitSignature = [...activePortraitUris, ...customVehiclePortraitUris].sort().join('\n');
  useEffect(() => {
    if (!loaded) return;
    cleanupUnreferencedPortraitImports(new Set([...activePortraitUris, ...customVehiclePortraitUris]));
  }, [loaded, activePortraitSignature]);

  // ─── Character CRUD ─────────────────────────────────────────────────────────

  const addCharacter = useCallback((char: Character) => {
    const migratedCharacter = migrateLegacyTraitPerks(char);
    setState(s => ({
      ...markConditionSemanticsV2(s),
      characters: [
        ...s.characters,
        normalizeCharacterAmmoStates(migratedCharacter, [...BUILT_IN_WEAPONS, ...s.customWeapons], [...AMMO_TYPES, ...s.customAmmo], s.customWeaponMods),
      ],
    }));
  }, []);

  const updateCharacter = useCallback((char: Character) => {
    const migratedCharacter = migrateLegacyTraitPerks(char);
    setState(s => {
      const allArmor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const sheet = resolveCharacterArmorSheet(
        migratedCharacter, allArmor, false, s.hardcoreRadiationRules, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
      );
      const vehicleStructure = migratedCharacter.vehicle?.systems.find(system => system.kind === 'structure')
        ?? migratedCharacter.vehicle?.systems[0];
      const normalized = normalizeCharacterAmmoStates(
        {
          ...migratedCharacter,
          ...(migratedCharacter.vehicle && vehicleStructure ? {
            maxHp: vehicleStructure.maxHp,
            currentHp: vehicleStructure.currentHp,
            armorClass: migratedCharacter.vehicle.armorClass,
            manualDerivedStats: { ...migratedCharacter.manualDerivedStats, armorClass: migratedCharacter.vehicle.armorClass, maxAP: 0, sequence: 0 },
          } : {}),
          currentAP: migratedCharacter.vehicle ? 0 : Math.min(migratedCharacter.currentAP, sheet.maxAP),
        },
        [...BUILT_IN_WEAPONS, ...s.customWeapons],
        [...AMMO_TYPES, ...s.customAmmo],
      );
      return {
        ...s,
        characters: s.characters.map(c => c.id === migratedCharacter.id ? normalized : c),
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry =>
          entry.characterId === migratedCharacter.id
            ? migratedCharacter.vehicle
              ? {
                  ...syncInitiativeEntrySheet(entry, sheet),
                  currentHp: normalized.currentHp,
                  maxHp: normalized.maxHp,
                  armorClass: migratedCharacter.vehicle.armorClass,
                  maxAP: 0,
                  currentAP: 0,
                }
              : syncInitiativeEntrySheet(entry, sheet)
            : entry
        )),
      };
    });
  }, []);

  const deleteCharacter = useCallback((id: string) => {
    setState(s => {
      const canceled = cancelActionsForCharacterIds(
        s.characters.filter(c => c.id !== id),
        s.pendingCombatSkillActions,
        new Set([id]),
      );
      return {
        ...s,
        characters: canceled.characters,
        initiativeEntries: syncCombatSkillInitiative(
          s.initiativeEntries.filter(e => e.characterId !== id),
          canceled.characters,
          [...BUILT_IN_ARMOR, ...s.customArmor],
          s.hardcoreRadiationRules,
        ),
        pendingCombatSkillActions: canceled.pendingActions,
      };
    });
  }, []);

  const cloneCharacter = useCallback((id: string) => {
    setState(s => {
      const sourceIndex = s.characters.findIndex(character => character.id === id);
      if (sourceIndex < 0) return s;
      const source = s.characters[sourceIndex];
      const characters = [...s.characters];
      characters.splice(sourceIndex + 1, 0, {
        ...source,
        id: genId(),
        name: `${source.name} (Clone)`,
      });
      return { ...s, characters };
    });
  }, []);

  const moveCharacter = useCallback((characterId: string, targetCharacterId: string) => {
    setState(s => {
      const fromIndex = s.characters.findIndex(character => character.id === characterId);
      const targetIndex = s.characters.findIndex(character => character.id === targetCharacterId);
      if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return s;
      if (!!s.characters[fromIndex].inStorage !== !!s.characters[targetIndex].inStorage) return s;
      const characters = [...s.characters];
      [characters[fromIndex], characters[targetIndex]] = [characters[targetIndex], characters[fromIndex]];
      return { ...s, characters };
    });
  }, []);

  // ─── Combat Stats ────────────────────────────────────────────────────────────

  const applyDamage = useCallback((characterId: string, damage: number) => {
    setState(s => {
      const characters = s.characters.map(character => {
        if (character.id !== characterId) return character;
        if (!character.vehicle) return { ...character, currentHp: Math.max(0, character.currentHp - damage) };
        const updatedVehicle = applyVehicleSystemDamage(character.vehicle, 'structure', damage);
        const structure = updatedVehicle.systems.find(system => system.kind === 'structure') ?? updatedVehicle.systems[0];
        return {
          ...character,
          vehicle: updatedVehicle,
          currentHp: structure?.currentHp ?? character.currentHp,
          maxHp: structure?.maxHp ?? character.maxHp,
        };
      });
      const updated = characters.find(character => character.id === characterId);
      return {
        ...s,
        characters,
        initiativeEntries: s.initiativeEntries.map(entry => entry.characterId === characterId
          ? { ...entry, currentHp: updated?.currentHp ?? entry.currentHp, maxHp: updated?.maxHp ?? entry.maxHp }
          : entry),
      };
    });
  }, []);

  const applyCombatDamage = useCallback((
    requestId: string,
    characterId: string,
    damage: number,
    damagingHits: number,
    location?: string,
    vehicleSystemId?: string,
    attackerCharacterId?: string,
  ) => {
    setState(s => {
      if (s.damageReceiptIds?.includes(requestId)) return s;
      const target = s.characters.find(character => character.id === characterId);
      if (!target) return s;
      if (!target.vehicle) {
        const damagedState = applyEquipmentDamage(s, [...BUILT_IN_ARMOR, ...s.customArmor],
          requestId, characterId, damage, damagingHits, location);
        const damagedTarget = damagedState.characters.find(character => character.id === characterId);
        const attacker = attackerCharacterId
          ? damagedState.characters.find(character => character.id === attackerCharacterId)
          : undefined;
        if (!attacker || target.currentHp <= 0 || damagedTarget?.currentHp !== 0
          || !(attacker.traits ?? []).includes('rabid')) return damagedState;
        const maximumAP = charMaxAP(attacker, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules);
        const nextAP = Math.min(maximumAP, attacker.currentAP + 5);
        return {
          ...damagedState,
          characters: damagedState.characters.map(character => character.id === attacker.id
            ? { ...character, currentAP: nextAP }
            : character),
          initiativeEntries: damagedState.initiativeEntries.map(entry => entry.characterId === attacker.id
            ? { ...entry, currentAP: nextAP }
            : entry),
        };
      }
      const systemId = target.vehicle.systems.some(system => system.id === vehicleSystemId)
        ? vehicleSystemId!
        : (target.vehicle.systems.find(system => system.kind === 'structure')?.id ?? target.vehicle.systems[0]?.id);
      if (!systemId) return s;
      const updatedVehicle = applyVehicleSystemDamage(target.vehicle, systemId, damage);
      const structure = updatedVehicle.systems.find(system => system.kind === 'structure') ?? updatedVehicle.systems[0];
      const characters = s.characters.map(character => character.id === characterId
        ? {
            ...character,
            vehicle: updatedVehicle,
            currentHp: structure?.currentHp ?? character.currentHp,
            maxHp: structure?.maxHp ?? character.maxHp,
          }
        : character);
      return {
        ...s,
        characters,
        initiativeEntries: s.initiativeEntries.map(entry => entry.characterId === characterId
          ? { ...entry, currentHp: structure?.currentHp ?? entry.currentHp, maxHp: structure?.maxHp ?? entry.maxHp }
          : entry),
        damageReceiptIds: [...(s.damageReceiptIds ?? []), requestId].slice(-64),
      };
    });
  }, []);

  const healCharacter = useCallback((characterId: string, amount: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const nextHp = resolveHpChange(char, Math.max(0, amount));
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId ? { ...c, currentHp: nextHp } : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, currentHp: Math.min(e.maxHp, nextHp) }
          : e),
      };
    });
  }, []);

  const spendAP = useCallback((characterId: string, amount: number): boolean => {
    let success = false;
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char || char.currentAP < amount) { success = false; return s; }
      success = true;
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId
          ? { ...c, currentAP: c.currentAP - amount }
          : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, currentAP: e.currentAP - amount }
          : e),
      };
    });
    return success;
  }, []);

  const restoreAP = useCallback((characterId: string, amount?: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      if (isRevivedAPRestricted(char, s.currentRound)) return s;
      const maxAP = charMaxAP(
        char, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
        s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
      );
      const currentAP = amount !== undefined ? Math.min(maxAP, char.currentAP + amount) : maxAP;
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId ? { ...c, currentAP } : c),
        initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
          ? { ...e, maxAP, currentAP: amount !== undefined ? Math.min(maxAP, e.currentAP + amount) : maxAP }
          : e),
      };
    });
  }, []);

  const startTimedSkillAction = useCallback((request: TimedSkillActionRequest): string => {
    const requestId = genId();
    setState(s => {
      const actor = s.characters.find(c => c.id === request.actorId);
      const reject = (reason: string) => ({ ...s, combatSkillReceipt: { requestId, kind: 'general' as const, status: 'rejected' as const, actorId: request.actorId, spentAP: 0, reason } });
      if (!actor) return reject('The acting character was not found.');
      if (!s.combatActive || !s.initiativeEntries.some(entry => entry.characterId === actor.id)) return reject('Timed skills require an active, tracked combatant.');
      if (s.pendingCombatSkillActions.some(action => action.actorId === actor.id)) return reject('This combatant already has a pending skill action.');
      if (!request.label.trim()) return reject('Enter a label for the timed skill action.');
      const plan = planTimedSkillAP({ availableAP: actor.currentAP, apCost: request.apCost, durationRounds: request.durationRounds, confirmSpendAllRemaining: request.confirmSpendAllRemaining });
      if (!plan.valid) return reject(plan.reason ?? 'This skill action cannot begin.');
      const completesOnRound = s.currentRound + plan.completionRoundOffset;
      const action: TimedCombatSkillAction = { id: requestId, kind: 'general', actorId: actor.id, label: request.label.trim(), startedRound: s.currentRound, completesOnRound, apCost: request.apCost, spentAP: plan.spentAP, armorOnlyAC: plan.armorOnlyAC };
      const updated = { ...actor, currentAP: actor.currentAP - plan.spentAP, combatDefenseSuppressed: plan.armorOnlyAC || actor.combatDefenseSuppressed };
      const characters = s.characters.map(c => c.id === actor.id ? updated : c);
      return {
        ...s, characters,
        initiativeEntries: syncCombatSkillInitiative(
          s.initiativeEntries, characters, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
        pendingCombatSkillActions: plan.completionRoundOffset ? [...s.pendingCombatSkillActions, action] : s.pendingCombatSkillActions,
        combatSkillReceipt: { requestId, kind: 'general', status: plan.completionRoundOffset ? 'pending' : 'completed', actorId: actor.id, spentAP: plan.spentAP, completesOnRound },
      };
    });
    return requestId;
  }, []);

  const resolveHealFallen = useCallback((request: HealFallenRequest): string => {
    const requestId = genId();
    setState(s => {
      const actor = s.characters.find(c => c.id === request.actorId);
      const target = s.characters.find(c => c.id === request.targetId);
      const reject = (reason: string) => ({ ...s, combatSkillReceipt: { requestId, kind: 'healFallen' as const, status: 'rejected' as const, actorId: request.actorId, targetId: request.targetId, spentAP: 0, reason } });
      if (!actor || !target) return reject('The healer or unconscious target was not found.');
      if (actor.isKnockedOut) return reject('An unconscious healer cannot use Heal Fallen.');
      if (s.pendingCombatSkillActions.some(action => action.actorId === actor.id)) return reject('This combatant already has a pending skill action.');
      if (!isHealFallenTarget(target)) return reject('Heal Fallen can only be used on an unconscious target.');
      if (!canUseHealFallenSkill(target, request.skill)) return reject(target.race === 'robot' ? 'Robots require Science or Repair for Heal Fallen.' : 'Living targets require First Aid or Doctor for Heal Fallen.');
      const apCost = getHealFallenAPCost(actor);
      const plan = planTimedSkillAP({ availableAP: actor.currentAP, apCost, durationRounds: 1, confirmSpendAllRemaining: request.confirmSpendAllRemaining });
      if (!plan.valid) return reject(plan.reason ?? 'Heal Fallen cannot begin.');
      if (plan.completionRoundOffset > 0 && request.resolution) {
        return reject('Underfunded Heal Fallen resolves at the healer’s next own turn; do not supply an outcome yet.');
      }
      if (plan.completionRoundOffset > 0 && (!s.combatActive || !s.initiativeEntries.some(entry => entry.characterId === actor.id))) {
        return reject('Delayed Heal Fallen requires an active, tracked combatant.');
      }
      const allArmor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const resolution = request.resolution
        ? resolveCombatSkillOutcome(request.resolution, effectiveCombatSkillValue(
          actor, request.skill, allArmor, s.hardcoreRadiationRules, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ))
        : undefined;
      if (request.resolution && !resolution) return reject('A d100 result from 1 to 100 is required for Roll d100.');
      if (!plan.completionRoundOffset && !resolution) return reject('A d100 result from 1 to 100 is required for Roll d100.');
      const completesOnRound = s.currentRound + plan.completionRoundOffset;
      const action: TimedCombatSkillAction = { id: requestId, kind: 'healFallen', actorId: actor.id, targetId: target.id, skill: request.skill, label: 'Heal Fallen', startedRound: s.currentRound, completesOnRound, apCost, spentAP: plan.spentAP, armorOnlyAC: plan.armorOnlyAC, resolution: resolution ?? undefined };
      const updated = { ...actor, currentAP: actor.currentAP - plan.spentAP, combatDefenseSuppressed: plan.armorOnlyAC || actor.combatDefenseSuppressed };
      let characters = s.characters.map(c => c.id === actor.id ? updated : c);
      if (!plan.completionRoundOffset && resolution?.success) {
        const restoredHp = request.skill === 'repair'
          ? applyTightNutsRepairHealing(1, target.race, target.traits)
          : 1;
        characters = applyHealFallenOutcome(characters, target.id, true, s.currentRound, restoredHp).combatants;
      }
      return {
        ...s, characters,
        initiativeEntries: syncCombatSkillInitiative(
          s.initiativeEntries, characters, allArmor, s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
        pendingCombatSkillActions: plan.completionRoundOffset ? [...s.pendingCombatSkillActions, action] : s.pendingCombatSkillActions,
        combatSkillReceipt: { requestId, kind: 'healFallen', status: plan.completionRoundOffset ? 'pending' : 'completed', actorId: actor.id, targetId: target.id, spentAP: plan.spentAP, completesOnRound, success: plan.completionRoundOffset ? undefined : resolution?.success },
      };
    });
    return requestId;
  }, []);

  const completeHealFallen = useCallback((request: CompleteHealFallenRequest): string => {
    const requestId = genId();
    setState(s => {
      const action = s.pendingCombatSkillActions.find(candidate =>
        candidate.id === request.actionId && candidate.kind === 'healFallen' && candidate.readyToResolve,
      );
      const reject = (reason: string) => ({
        ...s,
        combatSkillReceipt: { requestId, kind: 'healFallen' as const, status: 'rejected' as const, actorId: action?.actorId ?? '', targetId: action?.targetId, spentAP: 0, reason },
      });
      if (!action || !action.targetId || !action.skill) return reject('That Heal Fallen action is not ready to resolve.');
      const actor = s.characters.find(c => c.id === action.actorId);
      const target = s.characters.find(c => c.id === action.targetId);
      const finishWithoutHealing = (reason: string) => ({
        ...s,
        pendingCombatSkillActions: s.pendingCombatSkillActions.filter(candidate => candidate.id !== action.id),
        combatSkillReceipt: { requestId, kind: 'healFallen' as const, status: 'completed' as const, actorId: action.actorId, targetId: action.targetId, spentAP: 0, completesOnRound: action.completesOnRound, success: false, reason },
      });
      if (!actor || actor.isKnockedOut) return finishWithoutHealing('The healer cannot complete Heal Fallen while unconscious or absent.');
      if (!target || !target.isKnockedOut) return finishWithoutHealing('Heal Fallen cannot affect a missing or conscious target.');
      const resolution = resolveCombatSkillOutcome(
        request.resolution,
        effectiveCombatSkillValue(
          actor, action.skill, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
      );
      if (!resolution) return reject('A d100 result from 1 to 100 is required for Roll d100.');
      const restoredHp = action.skill === 'repair'
        ? applyTightNutsRepairHealing(1, target.race, target.traits)
        : 1;
      const outcome = applyHealFallenOutcome(s.characters, target.id, resolution.success, s.currentRound, restoredHp);
      const characters = outcome.combatants;
      return {
        ...s,
        characters,
        initiativeEntries: syncCombatSkillInitiative(
          s.initiativeEntries, characters, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
        pendingCombatSkillActions: s.pendingCombatSkillActions.filter(candidate => candidate.id !== action.id),
        combatSkillReceipt: { requestId, kind: 'healFallen', status: 'completed', actorId: actor.id, targetId: target.id, spentAP: 0, completesOnRound: action.completesOnRound, success: resolution.success },
      };
    });
    return requestId;
  }, []);

  const cancelCombatSkillAction = useCallback((actionId: string): string => {
    const requestId = genId();
    setState(s => {
      const action = s.pendingCombatSkillActions.find(candidate =>
        candidate.id === actionId && candidate.kind === 'healFallen' && candidate.readyToResolve,
      );
      if (!action) {
        return {
          ...s,
          combatSkillReceipt: {
            requestId, kind: 'healFallen', status: 'rejected', actorId: '', spentAP: 0,
            reason: 'Only a ready Heal Fallen action can be cancelled.',
          },
        };
      }
      const pendingCombatSkillActions = s.pendingCombatSkillActions.filter(candidate => candidate.id !== action.id);
      const characters = s.characters.map(character => character.id === action.actorId
        && !pendingCombatSkillActions.some(candidate =>
          candidate.actorId === character.id && candidate.armorOnlyAC && !candidate.readyToResolve,
        )
        ? { ...character, combatDefenseSuppressed: false, tempAC: 0 }
        : character);
      return {
        ...s,
        characters,
        initiativeEntries: syncCombatSkillInitiative(
          s.initiativeEntries, characters, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
        pendingCombatSkillActions,
        combatSkillReceipt: {
          requestId, kind: 'healFallen', status: 'completed', actorId: action.actorId,
          targetId: action.targetId, spentAP: 0, completesOnRound: action.completesOnRound,
          success: false, reason: 'Heal Fallen was cancelled; spent AP are not refunded.',
        },
      };
    });
    return requestId;
  }, []);

  // Knock a character unconscious for N of their own turns. 0 rounds wakes them.
  const setKnockedOut = useCallback((characterId: string, rounds: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? {
          ...setUnconsciousness(c, rounds),
          ...(rounds > 0 ? { position: 'prone' as const, currentAP: 0, revivedNoAPUntilRound: undefined } : {}),
        }
        : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId
        ? { ...e, ...(rounds > 0 ? { position: 'prone' as const, currentAP: 0 } : {}) }
        : e),
    }));
  }, []);

  const applyAreaAttack = useCallback((attack: AreaAttack, characterIds: string[]): string => {
    const requestId = genId();
    // Generate all entropy and IDs before queueing. The updater below resolves
    // against its exact input state and remains deterministic if React replays it.
    const rolls = Object.fromEntries(characterIds.map(id => [id, {
      resistance: Math.floor(Math.random() * 100) + 1,
      endurance: Math.floor(Math.random() * 10) + 1,
      unconscious: Math.floor(Math.random() * 10) + 1,
      componentRolls: (attack.components ?? []).flatMap(component =>
        Array.from({ length: component.dmgDieCount }, () => Math.floor(Math.random() * component.dmgDie) + 1)),
      effectId: genId(),
    }]));
    setState(s => {
      const armor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const allWeapons = [...BUILT_IN_WEAPONS, ...s.customWeapons];
      const results = characterIds.flatMap(id => {
        const c = s.characters.find(char => char.id === id);
        if (!c) return [];
        const zoneId = attack.targetZones?.[id];
        const zone = attack.zones?.find(candidate => candidate.id === zoneId);
        if (attack.zones?.length && !zone) return [];
        if (attack.nonBiologicalOnly && c.race !== 'robot' && !c.vehicle) {
          return [{
            targetId: c.id,
            targetName: c.name,
            damage: 0,
            resisted: true,
            unconsciousRounds: 0,
            statuses: [],
            notes: ['This profile only affects non-biological targets.'],
            ...(zone ? { zoneId: zone.id, zoneLabel: zone.label } : {}),
          } satisfies AreaResolution];
        }
        const { bodyArmor: body, helmet } = wornArmor(c, armor);
        const vehiclePerformance = c.vehicle ? resolveVehiclePerformance(c.vehicle) : null;
        const natural = vehiclePerformance
          ? {
              ...(c.naturalProtection ?? EMPTY_NATURAL_PROTECTION),
              drNormal: vehiclePerformance.damageResistance.normal,
              drLaser: vehiclePerformance.damageResistance.laser,
              drFire: vehiclePerformance.damageResistance.fire,
              drPlasma: vehiclePerformance.damageResistance.plasma,
              drExplosion: vehiclePerformance.damageResistance.explosion,
            }
          : c.naturalProtection;
        const cap = attack.damageType === 'normal' ? 'Normal'
          : attack.damageType === 'laser' ? 'Laser'
          : attack.damageType === 'fire' ? 'Fire'
          : attack.damageType === 'plasma' ? 'Plasma'
          : attack.damageType === 'explosion' ? 'Explosion'
          : (attack.kind === 'flamethrower' || attack.kind === 'acid' ? 'Fire'
            : attack.kind === 'electricity' ? 'Laser'
            : attack.kind === 'fragmentation' ? 'Normal' : 'Explosion');
        const dt = ((body?.[`dt${cap}` as keyof Armor] as number) ?? 0)
          + ((helmet?.[`dt${cap}` as keyof Armor] as number) ?? 0)
          + ((natural?.[`dt${cap}` as keyof typeof natural] as number) ?? 0);
        const dr = Math.min(90, ((body?.[`dr${cap}` as keyof Armor] as number) ?? 0)
          + ((helmet?.[`dr${cap}` as keyof Armor] as number) ?? 0)
          + ((natural?.[`dr${cap}` as keyof typeof natural] as number) ?? 0));
        // The manual's Environmental Helmet only filters gas with its matching suit.
        const helmetGasActive = helmet?.id !== 'environmental_helmet'
          || body?.id === 'brotherhood_env_armor'
          || body?.id === 'brotherhood_env_armor_mk2';
        const gasInhaled = Math.min(100,
          (c.gasResistanceInhaled ?? c.gasResistance ?? 0)
          + (body?.gasResistanceInhaled ?? 0) + (helmetGasActive ? (helmet?.gasResistanceInhaled ?? 0) : 0));
        const gasContact = Math.min(100,
          (c.gasResistanceContact ?? c.gasResistance ?? 0)
          + (body?.gasResistanceContact ?? 0) + (helmetGasActive ? (helmet?.gasResistanceContact ?? 0) : 0));
        const fixed = rolls[id];
        let dieIndex = 0;
        const dieRolls = [...fixed.componentRolls, fixed.endurance, fixed.unconscious];
        const armorSheet = resolveCharacterArmorSheet(
          c, armor, false, s.hardcoreRadiationRules, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        );
        const protectionByType = (['normal', 'laser', 'fire', 'plasma', 'explosion'] as const).reduce((out, damageType) => {
          const typeCap = damageType.charAt(0).toUpperCase() + damageType.slice(1);
          let shieldDT = 0;
          let shieldDR = 0;
          const heldIds = new Set([c.leftHandWeaponId, c.rightHandWeaponId, c.equippedWeaponId].filter((id): id is string => !!id));
          for (const heldId of heldIds) {
            const shield = computeModEffects(allWeapons.find(weapon => weapon.id === heldId)?.mods ?? []).shieldProtection;
            shieldDT += (shield?.[`dt${typeCap}` as keyof typeof shield] as number) ?? 0;
            shieldDR += (shield?.[`dr${typeCap}` as keyof typeof shield] as number) ?? 0;
          }
          const defensivePerks = computeDefensivePerkBonuses(c, damageType, getPerkById);
          const effectDR = computeEffectModifiers(c).drMod ?? 0;
          out[damageType] = {
            dt: ((body?.[`dt${typeCap}` as keyof Armor] as number) ?? 0)
              + ((helmet?.[`dt${typeCap}` as keyof Armor] as number) ?? 0)
              + ((natural?.[`dt${typeCap}` as keyof typeof natural] as number) ?? 0)
              + shieldDT,
            dr: ((body?.[`dr${typeCap}` as keyof Armor] as number) ?? 0)
              + ((helmet?.[`dr${typeCap}` as keyof Armor] as number) ?? 0)
              + ((natural?.[`dr${typeCap}` as keyof typeof natural] as number) ?? 0)
              + shieldDR + defensivePerks.dr + effectDR,
          };
          return out;
        }, {} as Record<'normal' | 'laser' | 'fire' | 'plasma' | 'explosion', { dt: number; dr: number }>);
        const areaTarget = {
          id: c.id, name: c.name, endurance: armorSheet.effectiveSpecial.endurance,
          gasInhaledResistance: gasInhaled,
          gasContactResistance: gasContact,
          electricityResistance: c.electricityResistance ?? 0,
          dt, dr,
          radiationResistance: armorSheet.radiationResistance,
          protectionByType,
          damageResistanceCap: c.manualDerivedStats ? 100 : 90,
        };
        const result = zone
          ? resolveAreaZoneTarget(zone, areaTarget, () => fixed.resistance, () => dieRolls[Math.min(dieIndex++, dieRolls.length - 1)])
          : resolveAreaTarget(attack, areaTarget, () => fixed.resistance, () => dieRolls[Math.min(dieIndex++, dieRolls.length - 1)]);
        const physicalExposure = zone
          ? zone.effects.some(effect => effect.kind !== 'gasInhaled' && effect.kind !== 'gasContact')
          : attack.kind !== 'gasInhaled' && attack.kind !== 'gasContact';
        if (physicalExposure && result.damage > 0) {
          result.notes.push('Armor condition: one damaging area exposure recorded on body armor (aggregate result). Adjust individual hits in Equipment if the GM rules otherwise.');
        }
        return [{
          ...result,
          ...(attack.directHitTargetId === c.id ? { directHit: true } : {}),
          ...(zone ? { zoneId: zone.id, zoneLabel: zone.label } : {}),
        }];
      });
      const byId = new Map(results.map(r => [r.targetId, r]));
      const characters = s.characters.map(c => {
        if (c.id === attack.sourceDeviceId && c.combatDevice) {
          return { ...c, combatDevice: { ...c.combatDevice, status: 'triggered' as const } };
        }
        const result = byId.get(c.id);
        if (!result) return c;
        const areaEffects = result.ongoing
          ? [...(c.areaEffects ?? []), {
              id: rolls[c.id].effectId, kind: result.ongoing.kind,
              name: result.ongoing.kind === 'fire' ? 'On Fire' : 'Covered in Acid',
              persistent: true,
              damageDieCount: result.ongoing.damageDieCount, damageDie: result.ongoing.damageDie,
              damageBonus: result.ongoing.damageBonus, damageType: result.ongoing.damageType,
            }]
          : c.areaEffects;
        const physicalExposure = attack.kind !== 'gasInhaled' && attack.kind !== 'gasContact';
        const updated = {
          ...addArmorWear(c, armor, physicalExposure && result.damage > 0 ? 1 : 0),
          ...applyCharacterRadiationGain(
            { ...c, currentHp: Math.max(0, c.currentHp - result.damage) },
            result.radiationExposure ?? 0, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ),
          areaEffects,
          ...(result.unconsciousRounds > 0 ? {
            isKnockedOut: true, knockOutRoundsLeft: result.unconsciousRounds,
            position: 'prone' as const, currentAP: 0,
          } : {}),
        };
        if (!s.hardcoreRadiationRules) return updated;
        const maxAP = charMaxAP(
          updated, armor, true, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        );
        return { ...updated, currentAP: Math.min(updated.currentAP, maxAP) };
      });
      const initiativeEntries = sortInitiativeEntries(s.initiativeEntries.map(e => {
        const result = e.characterId ? byId.get(e.characterId) : undefined;
        if (!result) return e;
        const updatedCharacter = characters.find(c => c.id === e.characterId);
        if (updatedCharacter && s.hardcoreRadiationRules) {
          return syncInitiativeEntrySheet(
            e,
            resolveCharacterArmorSheet(
              updatedCharacter, armor, false, true, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
            ),
          );
        }
        return {
          ...e,
          currentHp: updatedCharacter?.currentHp ?? Math.max(0, e.currentHp - result.damage),
          position: updatedCharacter?.position ?? e.position,
          ...(result.unconsciousRounds > 0 ? { currentAP: 0 } : {}),
        };
      }));
      return { ...s, characters, initiativeEntries, areaAttackReceipt: { requestId, results } };
    });
    return requestId;
  }, []);

  const markAreaEffectForRemoval = useCallback((characterId: string, effectId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? {
        ...c,
        position: 'prone',
        currentAP: 0,
        areaEffects: (c.areaEffects ?? []).map(effect =>
          effect.id === effectId && effect.kind === 'fire'
            ? { ...effect, removeAfterTick: true }
            : effect),
      } : c),
      initiativeEntries: s.initiativeEntries.map(entry => entry.characterId === characterId
        ? { ...entry, position: 'prone', currentAP: 0 }
        : entry),
    }));
  }, []);

  const removeAreaEffect = useCallback((characterId: string, effectId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, areaEffects: (c.areaEffects ?? []).filter(effect => effect.id !== effectId) }
        : c),
    }));
  }, []);

  const setPosition = useCallback((characterId: string, position: PositionType) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, position: c.isKnockedOut ? 'prone' : position } : c),
      initiativeEntries: s.initiativeEntries.map(e => {
        if (e.characterId !== characterId) return e;
        const c = s.characters.find(char => char.id === characterId);
        return { ...e, position: c?.isKnockedOut ? 'prone' : position };
      }),
    }));
  }, []);

  const addTempAC = useCallback((characterId: string, ac: number) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, tempAC: c.tempAC + ac } : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId ? { ...e, tempAC: e.tempAC + ac } : e),
    }));
  }, []);

  const clearTempAC = useCallback((characterId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId ? { ...c, tempAC: 0 } : c),
      initiativeEntries: s.initiativeEntries.map(e => e.characterId === characterId ? { ...e, tempAC: 0 } : e),
    }));
  }, []);

  // ─── Weapon Ammo ────────────────────────────────────────────────────────────

  const spendAmmo = useCallback((characterId: string, weaponId: string, shots: number): boolean => {
    let success = false;
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) { success = false; return s; }
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon || weapon.magazineSize === 0) { success = true; return s; }
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const current = existing ? existing.currentAmmo : effectiveMagazineSize(weapon, s.customWeaponMods);
      if (current < shots) { success = false; return s; }
      success = true;
      const newStates: WeaponAmmoState[] = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
       newStates.push({ weaponId, currentAmmo: current - shots, conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0), ammoTypeId: resolveEquippedAmmoTypeId(weapon, existing?.ammoTypeId, [...AMMO_TYPES, ...s.customAmmo]) });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
    return success;
  }, []);

  const reloadWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon) return s;
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
       newStates.push({ weaponId, currentAmmo: effectiveMagazineSize(weapon, s.customWeaponMods), conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0), ammoTypeId: resolveEquippedAmmoTypeId(weapon, existing?.ammoTypeId, [...AMMO_TYPES, ...s.customAmmo]) });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Ammo type (loaded round) ─────────────────────────────────────────────────
  const setAmmoType = useCallback((characterId: string, weaponId: string, ammoTypeId: string | undefined) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({
        weaponId,
        currentAmmo: existing?.currentAmmo ?? (weapon ? effectiveMagazineSize(weapon, s.customWeaponMods) : 0),
        conditionBoxes: clampConditionBoxes(existing?.conditionBoxes ?? 0),
        ammoTypeId: resolveEquippedAmmoTypeId(weapon, ammoTypeId, [...AMMO_TYPES, ...s.customAmmo]),
      });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // ─── Weapon equip / switch (hand slots + inventory) ───────────────────────────
  const equipWeapon = useCallback((characterId: string, weaponId: string, hand: 'left' | 'right' | 'both' = 'both') => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      if (!weapon) return s;
      const hands = getWeaponHands(weapon);
      // Two-handed weapons always occupy both hands regardless of the request.
      const useBoth = hands === 2 || hand === 'both';
      let leftHandWeaponId = char.leftHandWeaponId;
      let rightHandWeaponId = char.rightHandWeaponId;
      if (useBoth) {
        leftHandWeaponId = weaponId;
        rightHandWeaponId = weaponId;
      } else {
        // Placing a 1-handed weapon in one hand: if the OTHER hand currently
        // holds a two-handed weapon (same id in both hands), it must be
        // stowed — clear it so the 1H weapon doesn't share hands with a 2H.
        const otherId = hand === 'left' ? rightHandWeaponId : leftHandWeaponId;
        const otherWeapon = otherId ? [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === otherId) : undefined;
        const otherIsTwoHanded = otherWeapon ? getWeaponHands(otherWeapon) === 2 : false;
        // Also never let a 1-handed weapon occupy both hand slots — if the
        // other hand already holds this same weapon id, clear it.
        if (hand === 'left') {
          leftHandWeaponId = weaponId;
          if (otherIsTwoHanded || rightHandWeaponId === weaponId) rightHandWeaponId = undefined;
        } else {
          rightHandWeaponId = weaponId;
          if (otherIsTwoHanded || leftHandWeaponId === weaponId) leftHandWeaponId = undefined;
        }
      }
      // Keep the inventory (max 5, ids incl. equipped) in sync.
      const inv = (char.inventoryWeaponIds ?? (char.equippedWeaponId ? [char.equippedWeaponId] : []));
      const inventoryWeaponIds = inv.includes(weaponId) ? inv : [...inv, weaponId].slice(0, 5);
      const equippedCharacter = normalizeCharacterAmmoStates({
        ...char,
        equippedWeaponId: weaponId,
        leftHandWeaponId,
        rightHandWeaponId,
        inventoryWeaponIds,
        }, [...BUILT_IN_WEAPONS, ...s.customWeapons], [...AMMO_TYPES, ...s.customAmmo], s.customWeaponMods);
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId
          ? equippedCharacter
          : c),
      };
    });
  }, []);

  // Switch the ACTIVE weapon between weapons already held in the hands —
  // does not touch hand assignments or inventory.
  const setActiveWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => {
        if (c.id !== characterId) return c;
        const held = [c.leftHandWeaponId, c.rightHandWeaponId, c.equippedWeaponId];
        if (!held.includes(weaponId)) return c;
        return { ...c, equippedWeaponId: weaponId };
      }),
    }));
  }, []);

  // ─── Active effects (chems) ───────────────────────────────────────────────────
  const addEffect = useCallback((characterId: string, effect: ActiveEffect) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, effects: [...(c.effects ?? []), effect] }
        : c),
    }));
  }, []);

  const removeEffect = useCallback((characterId: string, effectId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, effects: (c.effects ?? []).filter(e => e.id !== effectId) }
        : c),
    }));
  }, []);

  // Apply a chem: add its ActiveEffect and immediately resolve any HP heal/damage
  // (hpMod on the effect: positive heals, negative damages).
  const applyChem = useCallback((characterId: string, effect: ActiveEffect) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => {
        if (c.id !== characterId) return c;
        const hpMod = effect.hpMod ?? 0;
        let currentHp = c.currentHp;
        currentHp = resolveHpChange(c, hpMod);
        // Immediate AP boost/drain (Jet +2 AP, crash −AP) applies right away.
        const apMod = effect.apMod ?? 0;
        const withEffect = { ...c, currentHp, effects: [...(c.effects ?? []), effect] };
        const currentAP = apMod !== 0
          ? Math.max(0, Math.min(charMaxAP(
            withEffect, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
            s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ), c.currentAP + apMod))
          : c.currentAP;
        return { ...withEffect, currentAP };
      }),
      initiativeEntries: s.initiativeEntries.map(e => {
        if (e.characterId !== characterId) return e;
        const hpMod = effect.hpMod ?? 0;
        let currentHp = e.currentHp;
        const sourceCharacter = s.characters.find(c => c.id === characterId);
        if (sourceCharacter) {
          currentHp = Math.min(e.maxHp, resolveHpChange({ ...sourceCharacter, currentHp: e.currentHp, maxHp: e.maxHp }, hpMod));
        }
        // Keep entry AP in sync with the character (Jet +AP, crash −AP).
        const apMod = effect.apMod ?? 0;
        const maxAP = sourceCharacter
          ? charMaxAP(
            { ...sourceCharacter, effects: [...(sourceCharacter.effects ?? []), effect] },
            [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
            s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          )
          : Math.max(1, e.maxAP + apMod);
        const currentAP = apMod !== 0
          ? Math.max(0, Math.min(maxAP, e.currentAP + apMod))
          : e.currentAP;
        return { ...e, currentHp, maxAP, currentAP };
      }),
    }));
  }, []);

  // A jam/miss FILLS one condition box (0 pristine … 10 jammed).
  const jamWeapon = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(candidate => candidate.id === weaponId);
      newStates.push({ weaponId, currentAmmo: existing?.currentAmmo ?? 0, conditionBoxes: clampConditionBoxes((existing?.conditionBoxes ?? 0) + 1), ammoTypeId: resolveEquippedAmmoTypeId(weapon, existing?.ammoTypeId, [...AMMO_TYPES, ...s.customAmmo]) });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  // Directly set FILLED condition boxes (0 pristine … CONDITION_BOXES_MAX jammed).
  const setWeaponCondition = useCallback((characterId: string, weaponId: string, filledBoxes: number) => {
    setState(s => {
      const char = s.characters.find(c => c.id === characterId);
      if (!char) return s;
      const weapon = [...BUILT_IN_WEAPONS, ...s.customWeapons].find(w => w.id === weaponId);
      const existing = char.weaponAmmoStates.find(a => a.weaponId === weaponId);
      const newStates = char.weaponAmmoStates.filter(a => a.weaponId !== weaponId);
      newStates.push({
        weaponId,
        currentAmmo: existing?.currentAmmo ?? (weapon ? effectiveMagazineSize(weapon, s.customWeaponMods) : 0),
        conditionBoxes: clampConditionBoxes(filledBoxes),
        ammoTypeId: resolveEquippedAmmoTypeId(weapon, existing?.ammoTypeId, [...AMMO_TYPES, ...s.customAmmo]),
      });
      return { ...s, characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates: newStates } : c) };
    });
  }, []);

  const restorePremadeWeaponConditionForCharacter = useCallback((characterId: string, weaponId: string) => {
    setState(s => {
      const character = s.characters.find(c => c.id === characterId);
      if (!character) return s;
      const weaponAmmoStates = restorePremadeWeaponCondition(character.weaponAmmoStates, weaponId);
      if (weaponAmmoStates === character.weaponAmmoStates) return s;
      return {
        ...s,
        characters: s.characters.map(c => c.id === characterId ? { ...c, weaponAmmoStates } : c),
      };
    });
  }, []);

  // ─── Injuries ────────────────────────────────────────────────────────────────

  const addInjury = useCallback((characterId: string, injury: Injury) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: [...(c.injuries ?? []), injury] }
        : c),
    }));
  }, []);

  const removeInjury = useCallback((characterId: string, injuryId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: (c.injuries ?? []).filter(i => i.id !== injuryId) }
        : c),
    }));
  }, []);

  const toggleInjury = useCallback((characterId: string, injuryId: string) => {
    setState(s => ({
      ...s,
      characters: s.characters.map(c => c.id === characterId
        ? { ...c, injuries: (c.injuries ?? []).map(i => i.id === injuryId ? { ...i, isActive: !i.isActive } : i) }
        : c),
    }));
  }, []);

  // ─── Initiative / Rounds ─────────────────────────────────────────────────────

  const startCombat = useCallback((entries: InitiativeEntry[]) => {
    const sorted = sortInitiativeEntries(entries);
    setState(s => ({
      ...s,
      initiativeEntries: sorted.map((e, i) => ({ ...e, isActive: i === 0, hasActed: false })),
      currentRound: 1,
      combatActive: true,
      activeEntryId: sorted[0]?.id ?? null,
    }));
  }, []);

  const endCombat = useCallback(() => {
    setState(s => ({
      ...s,
      // Reset every character to full AP (derived max) and clear temp AC.
      characters: s.characters.map(c => {
        const maxAP = charMaxAP(
          c, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        );
        return {
          ...clearUnconsciousness(c),
          currentAP: maxAP,
          tempAC: 0,
          combatDefenseSuppressed: false,
          revivedNoAPUntilRound: undefined,
        };
      }),
      initiativeEntries: [],
      currentRound: 1,
      combatActive: false,
      activeEntryId: null,
      pendingCombatSkillActions: [],
    }));
  }, []);

  const addInitiativeEntry = useCallback((entry: InitiativeEntry) => {
    setState(s => {
      const entries = sortInitiativeEntries([...s.initiativeEntries, entry]);
      return { ...s, initiativeEntries: entries };
    });
  }, []);

  const removeInitiativeEntry = useCallback((id: string) => {
    setState(s => {
      const removed = s.initiativeEntries.find(entry => entry.id === id);
      const canceled = removed?.characterId
        ? cancelActionsForCharacterIds(s.characters, s.pendingCombatSkillActions, new Set([removed.characterId]))
        : { characters: s.characters, pendingActions: s.pendingCombatSkillActions };
      const entries = s.initiativeEntries.filter(entry => entry.id !== id);
      return {
        ...s,
        characters: canceled.characters,
        initiativeEntries: syncCombatSkillInitiative(
          entries, canceled.characters, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
        pendingCombatSkillActions: canceled.pendingActions,
        activeEntryId: s.activeEntryId === id ? (entries[0]?.id ?? null) : s.activeEntryId,
      };
    });
  }, []);

  const updateInitiativeEntry = useCallback((entry: InitiativeEntry) => {
    setState(s => ({
      ...s,
      initiativeEntries: s.initiativeEntries.map(e => e.id === entry.id ? entry : e),
    }));
  }, []);

  const setActiveEntry = useCallback((id: string) => {
    setState(s => ({ ...s, activeEntryId: id }));
  }, []);

  const nextTurn = useCallback(() => {
    setState(s => {
      if (s.initiativeEntries.length === 0) return s;
      const activeIdx = s.initiativeEntries.findIndex(e => e.id === s.activeEntryId);
      const currentActive = s.initiativeEntries[activeIdx];
      const activeDefenseSuppressed = !!s.characters.find(c => c.id === currentActive?.characterId)?.combatDefenseSuppressed;
      // Convert unspent AP to tempAC for the current entry
      let entries = s.initiativeEntries.map(e => {
        if (e.id === currentActive?.id) {
          return { ...e, hasActed: true, tempAC: activeDefenseSuppressed ? 0 : e.tempAC + e.currentAP, currentAP: 0 };
        }
        return e;
      });
      // End of the current combatant's turn: convert AP → tempAC and, if
      // knocked out, consume one KO turn NOW (their skipped turn is over).
      let chars = s.characters.map(c => {
        if (c.id === currentActive?.characterId) {
          return statusTick({
            ...c,
            tempAC: c.combatDefenseSuppressed ? 0 : c.tempAC + c.currentAP,
            currentAP: 0,
          }, [...BUILT_IN_ARMOR, ...s.customArmor]).character;
        }
        return c;
      });
      entries = entries.map(e => {
        const c = chars.find(char => char.id === e.characterId);
        return c ? { ...e, currentHp: c.currentHp, position: c.position } : e;
      });
      // If all entries have acted, advance to next round.
      // NOTE: AP/tempAC are NOT reset for everyone — each combatant keeps their
      // tempAC (from unspent AP) until their own turn comes around again.
      if (entries.every(e => e.hasActed)) {
        const round = s.currentRound + 1;
        const firstChar0 = entries[0]?.characterId;
        const advancement = firstChar0
          ? advanceCombatSkillTurn(chars, s.pendingCombatSkillActions, firstChar0, round)
          : { combatants: chars, pendingActions: s.pendingCombatSkillActions, completed: [] };
        chars = advancement.combatants as Character[];
        // Turn start: KO'd combatants get no AP (they can't act this turn).
        const firstKO = !!chars.find(c => c.id === firstChar0)?.isKnockedOut;
        entries = entries.map((e, i) => ({
          ...e, hasActed: false, isActive: i === 0,
          // Only the new active combatant replenishes AP and loses tempAC
          ...(i === 0 ? {
            currentAP: firstKO || isRevivedAPRestricted(chars.find(c => c.id === firstChar0) ?? { revivedNoAPUntilRound: -1 }, round) ? 0 : e.maxAP,
            tempAC: 0,
          } : {}),
        }));
        if (firstChar0) {
          chars = chars.map(c => c.id === firstChar0 ? {
            ...c,
            currentAP: c.isKnockedOut || isRevivedAPRestricted(c, round) ? 0 : charMaxAP(
              c, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
              s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
            ),
            tempAC: 0,
            ...(isRevivedAPRestricted(c, round) ? {} : { revivedNoAPUntilRound: undefined }),
          } : c);
        }
        const completed = advancement.completed;
        const lastCompleted = completed[completed.length - 1];
        return {
          ...s,
          initiativeEntries: syncCombatSkillInitiative(
            entries, chars, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
            s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ),
          characters: chars, currentRound: round, activeEntryId: entries[0].id,
          pendingCombatSkillActions: advancement.pendingActions,
          combatSkillReceipt: lastCompleted ? {
            requestId: lastCompleted.id, kind: lastCompleted.kind, status: 'completed',
            actorId: lastCompleted.actorId, targetId: lastCompleted.targetId,
            spentAP: lastCompleted.spentAP, completesOnRound: lastCompleted.completesOnRound,
            success: lastCompleted.completionSuccess ?? lastCompleted.resolution?.success,
            reason: lastCompleted.completionReason,
          } : s.combatSkillReceipt,
        };
      }
      // Find next unacted entry
      let nextIdx = (activeIdx + 1) % entries.length;
      let loops = 0;
      while (entries[nextIdx]?.hasActed && loops < entries.length) {
        nextIdx = (nextIdx + 1) % entries.length;
        loops++;
      }
      // Turn start: KO'd combatants get no AP (they can't act this turn) —
      // mirrored on both the initiative entry and the character.
      const nextCharacterId = entries[nextIdx]?.characterId;
      const advancement = nextCharacterId
        ? advanceCombatSkillTurn(chars, s.pendingCombatSkillActions, nextCharacterId, s.currentRound)
        : { combatants: chars, pendingActions: s.pendingCombatSkillActions, completed: [] };
      chars = advancement.combatants as Character[];
      const nextCharacter = chars.find(c => c.id === nextCharacterId);
      const nextKO = !!nextCharacter?.isKnockedOut;
      entries = entries.map((e, i) => ({
        ...e,
        isActive: i === nextIdx,
        ...(i === nextIdx ? {
          tempAC: 0,
          currentAP: nextKO || isRevivedAPRestricted(nextCharacter ?? { revivedNoAPUntilRound: -1 }, s.currentRound) ? 0 : e.maxAP,
        } : {}),
      }));
      const nextActive = entries[nextIdx];
      if (nextActive?.characterId) {
        chars = chars.map(c => c.id === nextActive.characterId ? {
          ...c,
          currentAP: c.isKnockedOut || isRevivedAPRestricted(c, s.currentRound) ? 0 : charMaxAP(
            c, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
            s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ),
          tempAC: 0,
          ...(isRevivedAPRestricted(c, s.currentRound) ? {} : { revivedNoAPUntilRound: undefined }),
        } : c);
      }
      const completed = advancement.completed;
      const lastCompleted = completed[completed.length - 1];
      return {
        ...s,
        initiativeEntries: syncCombatSkillInitiative(
          entries, chars, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
        characters: chars, activeEntryId: nextActive?.id ?? null,
        pendingCombatSkillActions: advancement.pendingActions,
        combatSkillReceipt: lastCompleted ? {
          requestId: lastCompleted.id, kind: lastCompleted.kind, status: 'completed',
          actorId: lastCompleted.actorId, targetId: lastCompleted.targetId,
          spentAP: lastCompleted.spentAP, completesOnRound: lastCompleted.completesOnRound,
          success: lastCompleted.completionSuccess ?? lastCompleted.resolution?.success,
          reason: lastCompleted.completionReason,
        } : s.combatSkillReceipt,
      };
    });
  }, []);

  const nextRound = useCallback(() => {
    setState(s => {
      if (s.initiativeEntries.length === 0) return s;
      const firstChar = s.initiativeEntries[0]?.characterId;
      const round = s.currentRound + 1;
      // Skipping ahead completes every unacted turn so timed status counters
      // cannot be bypassed by ending the round early.
      const skippedCharacterIds = new Set(
        s.initiativeEntries.filter(entry => !entry.hasActed).map(entry => entry.characterId),
      );
      let chars = s.characters.map(c => {
        let out = skippedCharacterIds.has(c.id)
          ? statusTick(c, [...BUILT_IN_ARMOR, ...s.customArmor]).character
          : c;
        if (out.id === firstChar) {
          out = {
            ...out,
            currentAP: out.isKnockedOut || isRevivedAPRestricted(out, round) ? 0 : charMaxAP(
              out, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
              s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
            ),
            tempAC: 0,
          };
        }
        return out;
      });
      const advancement = firstChar
        ? advanceCombatSkillTurn(chars, s.pendingCombatSkillActions, firstChar, round)
        : { combatants: chars, pendingActions: s.pendingCombatSkillActions, completed: [] };
      chars = advancement.combatants as Character[];
      if (firstChar) {
        chars = chars.map(c => c.id === firstChar ? {
          ...c,
          currentAP: c.isKnockedOut || isRevivedAPRestricted(c, round) ? 0 : charMaxAP(
            c, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
            s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ),
          tempAC: 0,
          ...(isRevivedAPRestricted(c, round) ? {} : { revivedNoAPUntilRound: undefined }),
        } : c);
      }
      // Only the new active (first) combatant replenishes AP / clears tempAC —
      // everyone else keeps their tempAC until their own turn starts. A still-
      // KO'd first combatant gets no AP (mirrored on entry and character).
      const firstCharacter = chars.find(c => c.id === firstChar);
      const firstKO = !!firstCharacter?.isKnockedOut;
      const entries = s.initiativeEntries.map((e, i) => ({
        ...e, hasActed: false, isActive: i === 0,
        ...(i === 0 ? {
          currentAP: firstKO || isRevivedAPRestricted(firstCharacter ?? { revivedNoAPUntilRound: -1 }, round) ? 0 : e.maxAP,
          tempAC: 0,
        } : {}),
      })).map(e => {
        const c = chars.find(char => char.id === e.characterId);
        return c ? { ...e, currentHp: c.currentHp, position: c.position } : e;
      });
      const completed = advancement.completed;
      const lastCompleted = completed[completed.length - 1];
      return {
        ...s,
        initiativeEntries: syncCombatSkillInitiative(
          entries, chars, [...BUILT_IN_ARMOR, ...s.customArmor], s.hardcoreRadiationRules,
          s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        ),
        characters: chars, currentRound: round, activeEntryId: entries[0]?.id ?? null,
        pendingCombatSkillActions: advancement.pendingActions,
        combatSkillReceipt: lastCompleted ? {
          requestId: lastCompleted.id, kind: lastCompleted.kind, status: 'completed',
          actorId: lastCompleted.actorId, targetId: lastCompleted.targetId,
          spentAP: lastCompleted.spentAP, completesOnRound: lastCompleted.completesOnRound,
          success: lastCompleted.completionSuccess ?? lastCompleted.resolution?.success,
          reason: lastCompleted.completionReason,
        } : s.combatSkillReceipt,
      };
    });
  }, []);

  // Move an initiative entry up/down in the turn order
  const moveInitiativeEntry = useCallback((id: string, direction: 'up' | 'down') => {
    setState(s => {
      const idx = s.initiativeEntries.findIndex(e => e.id === id);
      if (idx < 0) return s;
      const swap = direction === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= s.initiativeEntries.length) return s;
      const entries = [...s.initiativeEntries];
      [entries[idx], entries[swap]] = [entries[swap], entries[idx]];
      return { ...s, initiativeEntries: entries };
    });
  }, []);

  // ─── Custom Equipment ────────────────────────────────────────────────────────

  const addCustomWeapon = useCallback((w: Weapon) => {
    setState(s => ({ ...s, customWeapons: [...s.customWeapons, w] }));
  }, []);
  const updateCustomWeapon = useCallback((w: Weapon) => {
    setState(s => ({ ...s, customWeapons: s.customWeapons.map(x => x.id === w.id ? w : x) }));
  }, []);
  const deleteCustomWeapon = useCallback((id: string) => {
    setState(s => ({ ...s, customWeapons: s.customWeapons.filter(w => w.id !== id) }));
  }, []);
  const addCustomArmor = useCallback((a: Armor) => {
    setState(s => ({
      ...s,
      customArmor: [...s.customArmor, a.effects ? a : { ...a, effects: { special: {}, skills: {} } }],
    }));
  }, []);
  const updateCustomArmor = useCallback((a: Armor) => {
    setState(s => {
      const normalizedArmor = a.effects ? a : { ...a, effects: { special: {}, skills: {} } };
      const customArmor = s.customArmor.map(x => x.id === a.id ? normalizedArmor : x);
      const allArmor = [...BUILT_IN_ARMOR, ...customArmor];
      const characters = s.characters.map(character => {
        const maxAP = charMaxAP(
          character, allArmor, s.hardcoreRadiationRules, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        );
        return { ...character, currentAP: Math.min(character.currentAP, maxAP) };
      });
      return {
        ...s,
        customArmor,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          if (!character) return entry;
          return syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(
            character, allArmor, false, s.hardcoreRadiationRules,
            s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ));
        })),
      };
    });
  }, []);
  const deleteCustomArmor = useCallback((id: string) => {
    setState(s => {
      const customArmor = s.customArmor.filter(a => a.id !== id);
      const allArmor = [...BUILT_IN_ARMOR, ...customArmor];
      const characters = s.characters.map(character => {
        const maxAP = charMaxAP(
          character, allArmor, s.hardcoreRadiationRules, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        );
        return { ...character, currentAP: Math.min(character.currentAP, maxAP) };
      });
      return {
        ...s,
        customArmor,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          if (!character) return entry;
          return syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(
            character, allArmor, false, s.hardcoreRadiationRules,
            s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ));
        })),
      };
    });
  }, []);

  // ─── Custom Ammunition ───────────────────────────────────────────────────────
  const addCustomAmmo = useCallback((ammo: AmmoType) => {
    setState(s => {
      const candidate = { ...ammo, isCustom: true };
      if (validateCustomAmmo(candidate, [...AMMO_TYPES, ...s.customAmmo]).length > 0) return s;
      return { ...s, customAmmo: [...s.customAmmo, candidate] };
    });
  }, []);
  const updateCustomAmmo = useCallback((ammo: AmmoType) => {
    setState(s => {
      const candidate = { ...ammo, isCustom: true };
      const catalog = [...AMMO_TYPES, ...s.customAmmo.filter(existing => existing.id !== ammo.id)];
      if (validateCustomAmmo(candidate, catalog).length > 0) return s;
      return { ...s, customAmmo: s.customAmmo.map(existing => existing.id === ammo.id ? candidate : existing) };
    });
  }, []);
  const deleteCustomAmmo = useCallback((id: string) => {
    setState(s => {
      if (!s.customAmmo.some(ammo => ammo.id === id)) return s;
      const customAmmo = s.customAmmo.filter(ammo => ammo.id !== id);
      const customWeapons = s.customWeapons.map(weapon => weapon.compatibleAmmo?.includes(id)
        ? { ...weapon, compatibleAmmo: weapon.compatibleAmmo.filter(ammoId => ammoId !== id) }
        : weapon);
      const allWeapons = [...BUILT_IN_WEAPONS, ...customWeapons];
      const allAmmo = [...AMMO_TYPES, ...customAmmo];
      const characters = s.characters.map(character =>
        normalizeCharacterAmmoStates(character, allWeapons, allAmmo, s.customWeaponMods));
      return { ...s, customAmmo, customWeapons, characters };
    });
  }, []);

  // ─── Custom Consumables ────────────────────────────────────────────────────
  const addCustomConsumable = useCallback((consumable: CustomConsumable) => {
    setState(s => {
      const candidate = { ...consumable, isCustom: true };
      if (validateCustomConsumable(candidate, s.customConsumables).length > 0) return s;
      return { ...s, customConsumables: [...s.customConsumables, candidate] };
    });
  }, []);
  const updateCustomConsumable = useCallback((consumable: CustomConsumable) => {
    setState(s => {
      const candidate = { ...consumable, isCustom: true };
      const catalog = s.customConsumables.filter(existing => existing.id !== candidate.id);
      if (validateCustomConsumable(candidate, catalog).length > 0) return s;
      return {
        ...s,
        customConsumables: s.customConsumables.map(existing =>
          existing.id === candidate.id ? candidate : existing),
      };
    });
  }, []);
  const deleteCustomConsumable = useCallback((id: string) => {
    setState(s => ({
      ...s,
      customConsumables: s.customConsumables.filter(consumable => consumable.id !== id),
    }));
  }, []);

  const addCustomVehicle = useCallback((vehicle: VehicleProfile) => {
    setState(s => ({
      ...s,
      customVehicles: [...s.customVehicles, {
        ...vehicle,
        isCustom: true,
        systems: vehicle.systems.map(system => ({ ...system, currentHp: system.maxHp })),
      }],
    }));
  }, []);
  const updateCustomVehicle = useCallback((vehicle: VehicleProfile) => {
    setState(s => ({
      ...s,
      customVehicles: s.customVehicles.map(existing => existing.id === vehicle.id
        ? { ...vehicle, isCustom: true }
        : existing),
    }));
  }, []);
  const deleteCustomVehicle = useCallback((id: string) => {
    setState(s => ({ ...s, customVehicles: s.customVehicles.filter(vehicle => vehicle.id !== id) }));
  }, []);

  // ─── Custom Bestiary ─────────────────────────────────────────────────────────

  const addCustomBestiaryTemplate = useCallback((t: BestiaryTemplate) => {
    setState(s => ({
      ...s,
      customBestiaryTemplates: [...s.customBestiaryTemplates, {
        ...t,
        isCustom: true,
        poisonResistance: t.poisonResistance ?? 0,
      }],
    }));
  }, []);
  const removeCustomBestiaryTemplate = useCallback((id: string) => {
    setState(s => ({ ...s, customBestiaryTemplates: s.customBestiaryTemplates.filter(t => t.id !== id) }));
  }, []);
  const saveBuiltInBestiaryOverride = useCallback((template: BestiaryTemplate) => {
    if (!BUILT_IN_BESTIARY.some(defaultTemplate => defaultTemplate.id === template.id)) return;
    setState(s => ({
      ...s,
      builtInBestiaryOverrides: [
        ...s.builtInBestiaryOverrides.filter(existing => existing.id !== template.id),
        { ...template, isCustom: false, poisonResistance: template.poisonResistance ?? 0 },
      ],
      removedBuiltInBestiaryTemplateIds: s.removedBuiltInBestiaryTemplateIds.filter(id => id !== template.id),
    }));
  }, []);
  const removeBuiltInBestiaryTemplate = useCallback((id: string) => {
    if (!BUILT_IN_BESTIARY.some(template => template.id === id)) return;
    setState(s => ({
      ...s,
      builtInBestiaryOverrides: s.builtInBestiaryOverrides.filter(template => template.id !== id),
      removedBuiltInBestiaryTemplateIds: s.removedBuiltInBestiaryTemplateIds.includes(id)
        ? s.removedBuiltInBestiaryTemplateIds
        : [...s.removedBuiltInBestiaryTemplateIds, id],
    }));
  }, []);
  const restoreBuiltInBestiaryDefaults = useCallback(() => {
    setState(s => ({
      ...s,
      builtInBestiaryOverrides: [],
      removedBuiltInBestiaryTemplateIds: [],
    }));
  }, []);
  const setBestiaryPortrait = useCallback((id: string, selection: CatalogPortraitSelection) => {
    setState(s => {
      const bestiaryPortraits = { ...s.bestiaryPortraits };
      const bestiaryPortraitSettings = { ...s.bestiaryPortraitSettings };
      if (selection.portrait) {
        bestiaryPortraits[id] = selection.portrait;
        bestiaryPortraitSettings[id] = normalizeCatalogPortraitSettings(selection) ?? {
          portraitFit: 'cover',
          portraitOffset: { x: 0.5, y: 0.5 },
        };
      } else {
        delete bestiaryPortraits[id];
        delete bestiaryPortraitSettings[id];
      }
      return { ...s, bestiaryPortraits, bestiaryPortraitSettings };
    });
  }, []);
  const setVehicleCatalogPortrait = useCallback((id: string, selection: CatalogPortraitSelection) => {
    setState(s => {
      const vehicleCatalogPortraits = { ...s.vehicleCatalogPortraits };
      const vehicleCatalogPortraitSettings = { ...s.vehicleCatalogPortraitSettings };
      if (selection.portrait) {
        vehicleCatalogPortraits[id] = selection.portrait;
        vehicleCatalogPortraitSettings[id] = normalizeCatalogPortraitSettings(selection) ?? {
          portraitFit: 'cover',
          portraitOffset: { x: 0.5, y: 0.5 },
        };
      } else {
        delete vehicleCatalogPortraits[id];
        delete vehicleCatalogPortraitSettings[id];
      }
      return { ...s, vehicleCatalogPortraits, vehicleCatalogPortraitSettings };
    });
  }, []);

  // ─── Campaign ────────────────────────────────────────────────────────────────

  const exportCampaign = useCallback((): string => {
    const { fallout3RadiationDebuffs: _legacy, ...portableState } = {
      ...state,
      hardcoreRadiationRules: state.hardcoreRadiationRules,
    };
    return JSON.stringify(portableState, null, 2);
  }, [state]);

  const saveCampaignTools = useCallback((tools: {
    lootTables: CampaignTable[];
    encounterTables: CampaignTable[];
    campaignMaps: CampaignMap[];
  }) => {
    setState(s => ({
      ...s,
      lootTables: tools.lootTables.map(normalizeCampaignTable).filter((table): table is CampaignTable => table !== null),
      encounterTables: tools.encounterTables.map(normalizeCampaignTable).filter((table): table is CampaignTable => table !== null),
      campaignMaps: tools.campaignMaps.map(normalizeCampaignMap).filter((map): map is CampaignMap => map !== null),
    }));
  }, []);
  const saveCustomRules = useCallback((rules: {
    customWeaponMods: CustomWeaponMod[];
    customPerks: CustomPerkDefinition[];
    campaignRuleTags: CampaignRuleTag[];
  }) => {
    setState(s => ({
      ...s,
      customWeaponMods: rules.customWeaponMods.filter(validateCustomWeaponMod),
      customPerks: rules.customPerks.filter(validateCustomPerk),
      campaignRuleTags: rules.campaignRuleTags.filter(tag => !!tag.id && !!tag.label),
    }));
  }, []);
  const saveCustomRaces = useCallback((races: CustomRaceDefinition[]) => {
    const validRaces = races.filter(validateCustomRace);
    setState(s => {
      const byId = new Map(validRaces.map(race => [race.id, race]));
      const knownWeaponIds = new Set([...BUILT_IN_WEAPONS, ...s.customWeapons].map(weapon => weapon.id));
      return {
        ...s,
        customRaces: validRaces,
        characters: s.characters.map(character => {
          if (character.race !== 'customRace' || !character.customRaceId) return character;
          const updatedProfile = byId.get(character.customRaceId);
          if (!updatedProfile) return character;
          const previouslyGranted = new Set(character.raceNaturalWeaponIds ?? []);
          const inventoryBeforeGrant = (character.inventoryWeaponIds ?? [])
            .filter(id => !previouslyGranted.has(id));
          const requestedWeapons = updatedProfile.naturalWeaponIds.filter(id => knownWeaponIds.has(id));
          const grantedNow = requestedWeapons.filter(id => !inventoryBeforeGrant.includes(id));
          const inventoryWeaponIds = [...new Set([...inventoryBeforeGrant, ...requestedWeapons])];
          const equippedWasRemoved = !!character.equippedWeaponId
            && previouslyGranted.has(character.equippedWeaponId)
            && !requestedWeapons.includes(character.equippedWeaponId);
          const rightHandWasRemoved = !!character.rightHandWeaponId
            && previouslyGranted.has(character.rightHandWeaponId)
            && !requestedWeapons.includes(character.rightHandWeaponId);
          const leftHandWasRemoved = !!character.leftHandWeaponId
            && previouslyGranted.has(character.leftHandWeaponId)
            && !requestedWeapons.includes(character.leftHandWeaponId);
          return {
            ...character,
            customRaceProfile: updatedProfile,
            raceNaturalWeaponIds: grantedNow,
            inventoryWeaponIds,
            equippedWeaponId: equippedWasRemoved
              ? requestedWeapons[0]
              : character.equippedWeaponId ?? requestedWeapons[0],
            rightHandWeaponId: rightHandWasRemoved
              ? requestedWeapons[0]
              : character.rightHandWeaponId ?? requestedWeapons[0],
            leftHandWeaponId: leftHandWasRemoved
              ? requestedWeapons[1]
              : character.leftHandWeaponId ?? requestedWeapons[1],
          };
        }),
      };
    });
  }, []);
  const saveCampaignRaceTags = useCallback((tags: CampaignRaceTag[]) => {
    const seen = new Set<string>();
    const validTags = tags.filter(tag => {
      if (!tag || typeof tag.id !== 'string' || !tag.id.trim()
        || typeof tag.label !== 'string' || !tag.label.trim() || seen.has(tag.id)) return false;
      seen.add(tag.id);
      return true;
    }).map(tag => ({ id: tag.id.trim(), label: tag.label.trim().slice(0, 80) }));
    setState(s => ({ ...s, campaignRaceTags: validTags }));
  }, []);
  const importCampaign = useCallback(async (json: string): Promise<boolean> => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (!hasValidCampaignImport(parsed)) return false;
      const importedState = {
        ...defaultState,
        ...reconcileInitiativeCharacters(normalizePersistedState(parsed)),
      };
      const serialized = JSON.stringify(importedState);
      await AsyncStorage.setItem(STORAGE_KEY, serialized);
      skipNextPersistRef.current = serialized;
      setState(importedState);
      return true;
    } catch (_) { return false; }
  }, []);

  const adjustRadiation = useCallback((characterId: string, delta: number) => {
    setState(s => {
      const allArmor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const characters = s.characters.map(character => {
        if (character.id !== characterId) return character;
        const withRadiation = {
          ...character,
          ...applyCharacterRadiationGain(
            character, delta, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
          ),
        };
        if (!s.hardcoreRadiationRules) return withRadiation;
        const maxAP = charMaxAP(
          withRadiation, allArmor, true, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        );
        return { ...withRadiation, currentAP: Math.min(withRadiation.currentAP, maxAP) };
      });
      if (!s.hardcoreRadiationRules) return { ...s, characters };
      return {
        ...s,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          return character?.id === characterId
            ? syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(
              character, allArmor, false, true, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
            ))
            : entry;
        })),
      };
    });
  }, []);

  const setHardcoreRadiationRules = useCallback((enabled: boolean) => {
    setState(s => {
      const allArmor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const characters = s.characters.map(character => {
        const maxAP = charMaxAP(
          character, allArmor, enabled, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
        );
        return { ...character, currentAP: Math.min(character.currentAP, maxAP) };
      });
      return {
        ...s,
        hardcoreRadiationRules: enabled,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          return character
            ? syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(
              character, allArmor, false, enabled, s.mutantGhoulRadiationRules, s.ghoulRadiationHealingOption,
            ))
            : entry;
        })),
      };
    });
  }, []);

  const setMutantGhoulRadiationRules = useCallback((enabled: boolean) => {
    setState(s => {
      const allArmor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const characters = s.characters.map(character => {
        const updated = { ...character, ghoulRadiationHealingRemainder: undefined };
        const maxAP = charMaxAP(
          updated, allArmor, s.hardcoreRadiationRules, enabled, s.ghoulRadiationHealingOption,
        );
        return { ...updated, currentAP: Math.min(updated.currentAP, maxAP) };
      });
      return {
        ...s,
        mutantGhoulRadiationRules: enabled,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          return character
            ? syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(
              character, allArmor, false, s.hardcoreRadiationRules, enabled, s.ghoulRadiationHealingOption,
            ))
            : entry;
        })),
      };
    });
  }, []);

  const setGhoulRadiationHealingOption = useCallback((option: GhoulRadiationHealingOption) => {
    setState(s => {
      const allArmor = [...BUILT_IN_ARMOR, ...s.customArmor];
      const characters = s.characters.map(character => ({
        ...character,
        ghoulRadiationHealingRemainder: undefined,
      }));
      return {
        ...s,
        ghoulRadiationHealingOption: option,
        characters,
        initiativeEntries: sortInitiativeEntries(s.initiativeEntries.map(entry => {
          const character = characters.find(candidate => candidate.id === entry.characterId);
          return character
            ? syncInitiativeEntrySheet(entry, resolveCharacterArmorSheet(
              character, allArmor, false, s.hardcoreRadiationRules,
              s.mutantGhoulRadiationRules, option,
            ))
            : entry;
        })),
      };
    });
  }, []);

  const setVisualTheme = useCallback((visualTheme: CampaignVisualTheme) => {
    setState(s => ({ ...s, visualTheme }));
  }, []);

  const setSystemSoundsEnabled = useCallback((systemSoundsEnabled: boolean) => {
    setState(s => ({ ...s, systemSoundsEnabled }));
  }, []);

  const setCombatSoundsEnabled = useCallback((combatSoundsEnabled: boolean) => {
    setState(s => ({ ...s, combatSoundsEnabled }));
  }, []);

  const setMusicEnabled = useCallback((musicEnabled: boolean) => {
    setState(s => ({ ...s, musicEnabled }));
  }, []);

  const setMusicVolume = useCallback((musicVolume: number) => {
    const normalizedVolume = Number.isFinite(musicVolume)
      ? Math.max(0, Math.min(1, musicVolume))
      : DEFAULT_CAMPAIGN_OPTIONS.musicVolume;
    setState(s => ({ ...s, musicVolume: normalizedVolume }));
  }, []);

  const setAreaProfileRangeOverride = useCallback((profileId: string, effectId: string, range: number) => {
    if (!profileId || !effectId || !Number.isInteger(range) || range < 0 || range > 100000) return;
    setState(s => ({
      ...s,
      areaProfileRangeOverrides: {
        ...s.areaProfileRangeOverrides,
        [profileId]: {
          ...(s.areaProfileRangeOverrides[profileId] ?? {}),
          [effectId]: range,
        },
      },
    }));
  }, []);

  const allWeapons = [...BUILT_IN_WEAPONS, ...state.customWeapons];
  const allArmor = [...BUILT_IN_ARMOR, ...state.customArmor];
  const allAmmo = [...AMMO_TYPES, ...state.customAmmo];
  const allVehicles = [...BUILT_IN_VEHICLES, ...state.customVehicles];

  return (
    <AppContext.Provider value={{
      ...state,
      loaded,
      allWeapons, allArmor, allAmmo, allVehicles,
       addCharacter, updateCharacter, deleteCharacter, cloneCharacter, moveCharacter,
        applyDamage, applyCombatDamage, healCharacter, adjustRadiation, setHardcoreRadiationRules,
        setMutantGhoulRadiationRules, setGhoulRadiationHealingOption, setAreaProfileRangeOverride,
        hardcoreRadiationRules: state.hardcoreRadiationRules,
          setVisualTheme, setSystemSoundsEnabled, setCombatSoundsEnabled, setMusicEnabled, setMusicVolume,
        spendAP, restoreAP, startTimedSkillAction, resolveHealFallen, completeHealFallen, cancelCombatSkillAction, setPosition, setKnockedOut, applyAreaAttack, markAreaEffectForRemoval, removeAreaEffect, addTempAC, clearTempAC,
      spendAmmo, reloadWeapon, jamWeapon, setWeaponCondition,
      restorePremadeWeaponCondition: restorePremadeWeaponConditionForCharacter,
      setAmmoType, equipWeapon, setActiveWeapon,
      addEffect, removeEffect, applyChem,
      addInjury, removeInjury, toggleInjury,
      startCombat, endCombat, addInitiativeEntry, removeInitiativeEntry,
      updateInitiativeEntry, moveInitiativeEntry, nextTurn, nextRound, setActiveEntry,
      addCustomWeapon, updateCustomWeapon, deleteCustomWeapon, addCustomArmor, updateCustomArmor, deleteCustomArmor,
      addCustomAmmo, updateCustomAmmo, deleteCustomAmmo,
      addCustomConsumable, updateCustomConsumable, deleteCustomConsumable,
      addCustomVehicle, updateCustomVehicle, deleteCustomVehicle,
      addCustomBestiaryTemplate, removeCustomBestiaryTemplate,
       saveBuiltInBestiaryOverride, removeBuiltInBestiaryTemplate, restoreBuiltInBestiaryDefaults,
      setBestiaryPortrait, setVehicleCatalogPortrait,
      exportCampaign, importCampaign, saveCampaignTools, saveCustomRules, saveCustomRaces, saveCampaignRaceTags,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
