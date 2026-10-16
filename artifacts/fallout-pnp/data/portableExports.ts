import type {
  Armor,
  BestiaryTemplate,
  Character,
  KarmaLogEntry,
  InitiativeEntry,
  Weapon,
} from '../context/types.ts';
import { isKarmaLogEntry, MAX_KARMA, MIN_KARMA } from './karma.ts';
import type { CampaignVisualTheme } from './campaignOptions.ts';
import type { GhoulRadiationHealingOption } from './radiation.ts';

export const PORTABLE_EXPORT_FORMAT = 'fallout-pnp-portable';
export const PORTABLE_EXPORT_VERSION = 1;
export const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024;
export const MAX_CAMPAIGN_PORTRAIT_BYTES = 25 * 1024 * 1024;
export const MAX_CAMPAIGN_FILE_CHARS = 40 * 1024 * 1024;
const SUPPORTED_PORTRAIT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface CampaignStateSnapshot {
  characters: Character[];
  customWeapons: Weapon[];
  customArmor: Armor[];
  customBestiaryTemplates: BestiaryTemplate[];
  initiativeEntries: InitiativeEntry[];
  currentRound: number;
  combatActive: boolean;
  activeEntryId: string | null;
  areaAttackReceipt?: unknown;
  conditionSemanticsV2?: boolean;
  hardcoreRadiationRules?: boolean;
  mutantGhoulRadiationRules?: boolean;
  ghoulRadiationHealingOption?: GhoulRadiationHealingOption;
  visualTheme?: CampaignVisualTheme;
  systemSoundsEnabled?: boolean;
  combatSoundsEnabled?: boolean;
  musicEnabled?: boolean;
  musicVolume?: number;
  /** Legacy import alias retained so older campaign files remain compatible. */
  fallout3RadiationDebuffs?: boolean;
}

export interface PortablePortraitAsset {
  kind: 'character-portrait';
  characterId: string;
  mimeType: string;
  base64: string;
}

export interface PortableCampaignBundle {
  format: typeof PORTABLE_EXPORT_FORMAT;
  version: typeof PORTABLE_EXPORT_VERSION;
  kind: 'campaign';
  state: CampaignStateSnapshot;
  assets: PortablePortraitAsset[];
}

export interface PortableCharacterBundle {
  format: typeof PORTABLE_EXPORT_FORMAT;
  version: typeof PORTABLE_EXPORT_VERSION;
  kind: 'character';
  character: Character;
  customWeapons: Weapon[];
  customArmor: Armor[];
  assets: PortablePortraitAsset[];
}

export interface PortableEquipmentBundle {
  format: typeof PORTABLE_EXPORT_FORMAT;
  version: typeof PORTABLE_EXPORT_VERSION;
  kind: 'equipment';
  equipmentType: 'weapon' | 'armor';
  item: Weapon | Armor;
}

export type PortableBundle =
  | PortableCampaignBundle
  | PortableCharacterBundle
  | PortableEquipmentBundle;

export type IndividualFileParseResult =
  | { ok: true; kind: 'character'; bundle: PortableCharacterBundle; ignoredAssets: number }
  | { ok: true; kind: 'equipment'; bundle: PortableEquipmentBundle }
  | { ok: false; error: string };

export type CampaignParseResult =
  | { ok: true; source: 'portable'; bundle: PortableCampaignBundle; ignoredAssets: number }
  | { ok: true; source: 'legacy'; state: CampaignStateSnapshot }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isImageMimeType(value: unknown): value is string {
  return typeof value === 'string' && SUPPORTED_PORTRAIT_MIME_TYPES.has(value.toLowerCase());
}

function decodedBase64Bytes(base64: string): number | null {
  if (base64.length === 0 || base64.length % 4 !== 0) return null;
  if (!/^[a-z0-9+/]*={0,2}$/i.test(base64)) return null;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

function characterForBundle(character: Character): Character {
  if (!character.portrait) return character;
  const { portrait: _localPortrait, ...portableCharacter } = character;
  return portableCharacter;
}

export function parsePortraitDataUri(uri: string): { mimeType: string; base64: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(uri);
  if (!match) return null;
  const base64 = match[2].replace(/\s+/g, '');
  return base64 ? { mimeType: match[1].toLowerCase(), base64 } : null;
}

export function portraitAsset(
  characterId: string,
  mimeType: string,
  base64: string,
): PortablePortraitAsset | null {
  const normalizedBase64 = base64.replace(/\s+/g, '');
  const byteLength = decodedBase64Bytes(normalizedBase64);
  if (
    !characterId
    || characterId.length > 128
    || !isImageMimeType(mimeType)
    || byteLength === null
    || byteLength > MAX_PORTRAIT_BYTES
  ) return null;
  return {
    kind: 'character-portrait',
    characterId,
    mimeType: mimeType.toLowerCase(),
    base64: normalizedBase64,
  };
}

export function portraitDataUri(asset: PortablePortraitAsset): string {
  return `data:${asset.mimeType};base64,${asset.base64}`;
}

export function createCampaignBundle(
  state: CampaignStateSnapshot,
  assets: readonly PortablePortraitAsset[],
): PortableCampaignBundle {
  const characterIds = new Set(state.characters.map(character => character.id));
  const embeddedIds = new Set<string>();
  let totalBytes = 0;
  const validAssets: PortablePortraitAsset[] = [];
  for (const asset of assets) {
    const bytes = decodedBase64Bytes(asset.base64);
    if (
      asset.kind !== 'character-portrait'
      || !characterIds.has(asset.characterId)
      || embeddedIds.has(asset.characterId)
      || !isImageMimeType(asset.mimeType)
      || bytes === null
      || bytes > MAX_PORTRAIT_BYTES
      || totalBytes + bytes > MAX_CAMPAIGN_PORTRAIT_BYTES
    ) continue;
    validAssets.push(asset);
    embeddedIds.add(asset.characterId);
    totalBytes += bytes;
  }
  return {
    format: PORTABLE_EXPORT_FORMAT,
    version: PORTABLE_EXPORT_VERSION,
    kind: 'campaign',
    state: {
      ...(() => {
        const { fallout3RadiationDebuffs: _legacy, ...portableState } = state;
        return {
          ...portableState,
          hardcoreRadiationRules: state.hardcoreRadiationRules !== undefined
            ? state.hardcoreRadiationRules
            : state.fallout3RadiationDebuffs === true,
        };
      })(),
      characters: state.characters.map(character =>
        characterForBundle(character)),
    },
    assets: validAssets,
  };
}

function referencedCustomEquipment(
  character: Character,
  customWeapons: readonly Weapon[],
  customArmor: readonly Armor[],
): { customWeapons: Weapon[]; customArmor: Armor[] } {
  const weaponIds = new Set([
    character.equippedWeaponId,
    character.leftHandWeaponId,
    character.rightHandWeaponId,
    ...(character.inventoryWeaponIds ?? []),
    ...(character.weaponAmmoStates ?? []).map(state => state.weaponId),
  ].filter((id): id is string => !!id));
  const armorIds = new Set([
    character.equippedBodyArmorId,
    character.equippedHelmetId,
    ...(character.armorConditionStates ?? []).map(state => state.armorId),
  ].filter((id): id is string => !!id));

  return {
    customWeapons: customWeapons.filter(weapon => weaponIds.has(weapon.id)),
    customArmor: customArmor.filter(armor => armorIds.has(armor.id)),
  };
}

export function createCharacterBundle(
  character: Character,
  customWeapons: readonly Weapon[],
  customArmor: readonly Armor[],
  asset?: PortablePortraitAsset | null,
): PortableCharacterBundle {
  const validAsset = asset?.characterId === character.id
    && asset.kind === 'character-portrait'
    && isImageMimeType(asset.mimeType)
    && decodedBase64Bytes(asset.base64) !== null
    ? asset
    : null;
  const dependencies = referencedCustomEquipment(character, customWeapons, customArmor);
  return {
    format: PORTABLE_EXPORT_FORMAT,
    version: PORTABLE_EXPORT_VERSION,
    kind: 'character',
    character: characterForBundle(character),
    ...dependencies,
    assets: validAsset ? [validAsset] : [],
  };
}

export function createEquipmentBundle(
  equipmentType: 'weapon' | 'armor',
  item: Weapon | Armor,
): PortableEquipmentBundle {
  return {
    format: PORTABLE_EXPORT_FORMAT,
    version: PORTABLE_EXPORT_VERSION,
    kind: 'equipment',
    equipmentType,
    item,
  };
}

function isCampaignState(value: unknown): value is CampaignStateSnapshot {
  if (!isRecord(value)) return false;
  return Array.isArray(value.characters)
    && Array.isArray(value.customWeapons ?? [])
    && Array.isArray(value.customArmor ?? [])
    && (value.visualTheme === undefined || value.visualTheme === 'western' || value.visualTheme === 'eastern')
    && (value.systemSoundsEnabled === undefined || typeof value.systemSoundsEnabled === 'boolean')
    && (value.combatSoundsEnabled === undefined || typeof value.combatSoundsEnabled === 'boolean')
    && (value.musicEnabled === undefined || typeof value.musicEnabled === 'boolean')
    && (value.musicVolume === undefined
      || (typeof value.musicVolume === 'number' && Number.isFinite(value.musicVolume) && value.musicVolume >= 0 && value.musicVolume <= 1))
    && (value.mutantGhoulRadiationRules === undefined || typeof value.mutantGhoulRadiationRules === 'boolean')
    && (value.ghoulRadiationHealingOption === undefined
      || value.ghoulRadiationHealingOption === 1
      || value.ghoulRadiationHealingOption === 2
      || value.ghoulRadiationHealingOption === 3
      || value.ghoulRadiationHealingOption === 4);
}

const SPECIAL_KEYS = [
  'strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck',
] as const;
const SKILL_KEYS = [
  'smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed', 'throwing',
  'firstAid', 'doctor', 'sneak', 'lockpick', 'steal', 'traps', 'science', 'repair',
  'speech', 'barter', 'gambling', 'outdoorsman', 'pilot',
] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasFiniteNumbers(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) && keys.every(key => isFiniteNumber(value[key]));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function hasValidKarmaData(value: Record<string, unknown>): boolean {
  const hasKarma = value.karma !== undefined;
  const karma = value.karma;
  if (hasKarma && (
    typeof karma !== 'number'
    || !Number.isSafeInteger(karma)
    || karma < MIN_KARMA
    || karma > MAX_KARMA
  )) return false;

  if (value.karmaLog === undefined) return true;
  if (!Array.isArray(value.karmaLog)) return false;
  const entries: unknown[] = value.karmaLog;
  if (!entries.every(isKarmaLogEntry)) return false;
  const validEntries = entries as KarmaLogEntry[];
  if (new Set(validEntries.map(entry => entry.id)).size !== validEntries.length) return false;

  const historyTotal = validEntries.reduce((total, entry) => total + entry.change, 0);
  if (historyTotal < MIN_KARMA || historyTotal > MAX_KARMA) return false;
  return !hasKarma || historyTotal === karma;
}

function isCharacterRecord(value: unknown): value is Character {
  if (!isRecord(value)) return false;
  const numericFields = [
    'level', 'xp', 'maxHp', 'currentHp', 'armorClass', 'tempAC', 'maxAP', 'currentAP',
    'sequence', 'unspentSkillPoints', 'radiationResistance', 'gasResistance',
    'electricityResistance', 'knockOutRoundsLeft',
  ];
  const positionValid = value.position === 'standing'
    || value.position === 'crouching'
    || value.position === 'prone';
  return typeof value.id === 'string'
    && value.id.length > 0
    && value.id.length <= 128
    && typeof value.name === 'string'
    && (value.type === 'pc' || value.type === 'npc')
    && typeof value.race === 'string'
    && hasValidKarmaData(value)
    && numericFields.every(field => isFiniteNumber(value[field]))
    && (value.accumulatedRadiation === undefined
      || (isFiniteNumber(value.accumulatedRadiation)
        && Number.isInteger(value.accumulatedRadiation)
        && value.accumulatedRadiation >= 0
        && value.accumulatedRadiation <= 1000))
    && hasFiniteNumbers(value.special, SPECIAL_KEYS)
    && hasFiniteNumbers(value.skills, SKILL_KEYS)
    && isStringArray(value.taggedSkills)
    && Array.isArray(value.perks)
    && value.perks.every(perk => isRecord(perk)
      && typeof perk.perkId === 'string'
      && isFiniteNumber(perk.rank))
    && Array.isArray(value.weaponAmmoStates)
    && value.weaponAmmoStates.every(ammo => isRecord(ammo)
      && typeof ammo.weaponId === 'string'
      && isFiniteNumber(ammo.currentAmmo)
      && isFiniteNumber(ammo.conditionBoxes))
    && (value.armorConditionStates === undefined || (Array.isArray(value.armorConditionStates)
      && value.armorConditionStates.every(state => isRecord(state)
        && typeof state.armorId === 'string' && state.armorId.length > 0
        && isFiniteNumber(state.hitSegments) && Number.isInteger(state.hitSegments)
        && state.hitSegments >= 0 && state.hitSegments <= 50)
      && new Set(value.armorConditionStates.map(state => (state as Record<string, unknown>).armorId)).size === value.armorConditionStates.length))
    && Array.isArray(value.injuries)
    && value.injuries.every(injury => isRecord(injury)
      && typeof injury.id === 'string'
      && typeof injury.location === 'string'
      && typeof injury.severity === 'string'
      && typeof injury.description === 'string'
      && isFiniteNumber(injury.toHitPenalty)
      && isFiniteNumber(injury.movementPenalty)
      && typeof injury.isActive === 'boolean')
    && typeof value.isKnockedOut === 'boolean'
    && isStringArray(value.conditions)
    && positionValid
    && (value.effects === undefined || Array.isArray(value.effects))
    && (value.inventoryWeaponIds === undefined || isStringArray(value.inventoryWeaponIds))
    && (value.areaEffects === undefined || Array.isArray(value.areaEffects));
}

function isWeaponRecord(value: unknown): value is Weapon {
  if (!isRecord(value)) return false;
  const numericFields = [
    'damageDieCount', 'damageDie', 'damageBonus', 'burstLimit', 'magazineSize',
    'weight', 'minStr', 'rangeNormal', 'knockdownChance',
  ];
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && typeof value.category === 'string'
    && typeof value.damageType === 'string'
    && typeof value.skill === 'string'
    && numericFields.every(field => isFiniteNumber(value[field]))
    && typeof value.isDoubleShot === 'boolean'
    && typeof value.isCustom === 'boolean'
    && isStringArray(value.mods)
    && (value.compatibleAmmo === undefined || isStringArray(value.compatibleAmmo));
}

function isArmorRecord(value: unknown): value is Armor {
  if (!isRecord(value)) return false;
  const numericFields = [
    'dtNormal', 'dtLaser', 'dtFire', 'dtPlasma', 'dtExplosion',
    'drNormal', 'drLaser', 'drFire', 'drPlasma', 'drExplosion',
    'acBonus', 'weight',
  ];
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && (value.slot === 'body' || value.slot === 'helmet')
    && numericFields.every(field => isFiniteNumber(value[field]))
    && typeof value.isCustom === 'boolean';
}

function isBestiaryTemplateRecord(value: unknown): value is BestiaryTemplate {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && typeof value.category === 'string'
    && hasFiniteNumbers(value.special, SPECIAL_KEYS)
    && hasFiniteNumbers(value.skills, SKILL_KEYS)
    && ['maxHp', 'armorClass', 'maxAP', 'sequence', 'radiationResistance', 'gasResistance', 'electricityResistance']
      .every(field => isFiniteNumber(value[field]));
}

function isInitiativeRecord(value: unknown): value is InitiativeEntry {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && ['initiative', 'sequence', 'currentAP', 'maxAP', 'currentHp', 'maxHp', 'armorClass', 'tempAC']
      .every(field => isFiniteNumber(value[field]))
    && (value.position === 'standing' || value.position === 'crouching' || value.position === 'prone')
    && typeof value.hasActed === 'boolean'
    && typeof value.isActive === 'boolean';
}

function hasUniqueIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map(item => item.id)).size === items.length;
}

function isCompletePortableCampaignState(value: unknown): value is CampaignStateSnapshot {
  if (!isRecord(value)
    || !Array.isArray(value.characters)
    || !Array.isArray(value.customWeapons)
    || !Array.isArray(value.customArmor)
    || !Array.isArray(value.customBestiaryTemplates)
    || !Array.isArray(value.initiativeEntries)) return false;
  if (!value.characters.every(isCharacterRecord)
    || !value.customWeapons.every(isWeaponRecord)
    || !value.customArmor.every(isArmorRecord)
    || !value.customBestiaryTemplates.every(isBestiaryTemplateRecord)
    || !value.initiativeEntries.every(isInitiativeRecord)) return false;
  return hasUniqueIds(value.characters)
    && hasUniqueIds(value.customWeapons)
    && hasUniqueIds(value.customArmor)
    && hasUniqueIds(value.customBestiaryTemplates)
    && hasUniqueIds(value.initiativeEntries)
    && isFiniteNumber(value.currentRound)
    && typeof value.combatActive === 'boolean'
    && (value.activeEntryId === null || typeof value.activeEntryId === 'string')
    && (value.visualTheme === undefined || value.visualTheme === 'western' || value.visualTheme === 'eastern')
    && (value.systemSoundsEnabled === undefined || typeof value.systemSoundsEnabled === 'boolean')
    && (value.combatSoundsEnabled === undefined || typeof value.combatSoundsEnabled === 'boolean')
    && (value.musicEnabled === undefined || typeof value.musicEnabled === 'boolean')
    && (value.musicVolume === undefined
      || (typeof value.musicVolume === 'number' && Number.isFinite(value.musicVolume) && value.musicVolume >= 0 && value.musicVolume <= 1))
    && (value.mutantGhoulRadiationRules === undefined || typeof value.mutantGhoulRadiationRules === 'boolean')
    && (value.ghoulRadiationHealingOption === undefined
      || value.ghoulRadiationHealingOption === 1
      || value.ghoulRadiationHealingOption === 2
      || value.ghoulRadiationHealingOption === 3
      || value.ghoulRadiationHealingOption === 4);
}

function isCompletePortableCharacterBundle(value: unknown): value is PortableCharacterBundle {
  if (!isRecord(value)
    || !isCharacterRecord(value.character)
    || !Array.isArray(value.customWeapons)
    || !Array.isArray(value.customArmor)
    || !Array.isArray(value.assets)) return false;
  return value.customWeapons.every(item => isWeaponRecord(item) && item.isCustom)
    && value.customArmor.every(item => isArmorRecord(item) && item.isCustom)
    && hasUniqueIds(value.customWeapons)
    && hasUniqueIds(value.customArmor);
}

function isCompletePortableEquipmentBundle(value: unknown): value is PortableEquipmentBundle {
  if (!isRecord(value)
    || (value.equipmentType !== 'weapon' && value.equipmentType !== 'armor')
    || !isRecord(value.item)
    || value.item.isCustom !== true) return false;
  return value.equipmentType === 'weapon'
    ? isWeaponRecord(value.item)
    : isArmorRecord(value.item);
}

function isPortablePortraitAsset(value: unknown): value is PortablePortraitAsset {
  const bytes = isRecord(value) && typeof value.base64 === 'string'
    ? decodedBase64Bytes(value.base64)
    : null;
  return isRecord(value)
    && value.kind === 'character-portrait'
    && typeof value.characterId === 'string'
    && isImageMimeType(value.mimeType)
    && typeof value.base64 === 'string'
    && bytes !== null
    && bytes <= MAX_PORTRAIT_BYTES;
}

export function parseIndividualFile(json: string): IndividualFileParseResult {
  if (json.length > MAX_CAMPAIGN_FILE_CHARS) {
    return { ok: false, error: 'The selected file is too large to import safely.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The selected file is not valid JSON.' };
  }
  if (!isRecord(parsed)
    || parsed.format !== PORTABLE_EXPORT_FORMAT
    || parsed.version !== PORTABLE_EXPORT_VERSION) {
    return { ok: false, error: 'The selected file is not an individual Fallout PnP export.' };
  }

  if (parsed.kind === 'character') {
    if (!isCompletePortableCharacterBundle(parsed)) {
      return { ok: false, error: 'The character export is incomplete or damaged.' };
    }
    const validAssets: PortablePortraitAsset[] = [];
    let ignoredAssets = 0;
    for (const candidate of parsed.assets) {
      if (
        !isPortablePortraitAsset(candidate)
        || candidate.characterId !== parsed.character.id
        || validAssets.length > 0
      ) {
        ignoredAssets += 1;
        continue;
      }
      validAssets.push(candidate);
    }
    return {
      ok: true,
      kind: 'character',
      ignoredAssets,
      bundle: {
        format: PORTABLE_EXPORT_FORMAT,
        version: PORTABLE_EXPORT_VERSION,
        kind: 'character',
        character: characterForBundle(parsed.character),
        customWeapons: parsed.customWeapons,
        customArmor: parsed.customArmor,
        assets: validAssets,
      },
    };
  }

  if (parsed.kind === 'equipment') {
    if (!isCompletePortableEquipmentBundle(parsed)) {
      return { ok: false, error: 'The equipment export is incomplete, damaged, or not custom equipment.' };
    }
    return {
      ok: true,
      kind: 'equipment',
      bundle: {
        format: PORTABLE_EXPORT_FORMAT,
        version: PORTABLE_EXPORT_VERSION,
        kind: 'equipment',
        equipmentType: parsed.equipmentType,
        item: parsed.item,
      },
    };
  }

  return { ok: false, error: 'The selected file is not an individual Fallout PnP export.' };
}

export function parseCampaignFile(json: string): CampaignParseResult {
  if (json.length > MAX_CAMPAIGN_FILE_CHARS) {
    return { ok: false, error: 'The campaign file is too large to import safely.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The selected file is not valid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'The selected file does not contain campaign data.' };
  }

  if (parsed.format !== PORTABLE_EXPORT_FORMAT) {
    return isCampaignState(parsed)
      ? { ok: true, source: 'legacy', state: parsed }
      : { ok: false, error: 'The selected file is not a campaign export.' };
  }
  if (parsed.version !== PORTABLE_EXPORT_VERSION) {
    return { ok: false, error: `Campaign export version ${String(parsed.version)} is not supported.` };
  }
  if (parsed.kind !== 'campaign') {
    return { ok: false, error: 'Choose a campaign export rather than an individual asset file.' };
  }
  if (!isCompletePortableCampaignState(parsed.state) || !Array.isArray(parsed.assets)) {
    return { ok: false, error: 'The campaign export is incomplete or damaged.' };
  }

  const ids = parsed.state.characters.map(character => character.id);

  const characterIds = new Set(ids);
  const assetCharacterIds = new Set<string>();
  const validAssets: PortablePortraitAsset[] = [];
  let ignoredAssets = 0;
  let totalBytes = 0;
  for (const candidate of parsed.assets) {
    if (!isPortablePortraitAsset(candidate)
      || !characterIds.has(candidate.characterId)
      || assetCharacterIds.has(candidate.characterId)) {
      ignoredAssets += 1;
      continue;
    }
    const bytes = decodedBase64Bytes(candidate.base64)!;
    if (totalBytes + bytes > MAX_CAMPAIGN_PORTRAIT_BYTES) {
      return { ok: false, error: 'The campaign contains too much portrait data to import safely.' };
    }
    validAssets.push(candidate);
    assetCharacterIds.add(candidate.characterId);
    totalBytes += bytes;
  }

  return {
    ok: true,
    source: 'portable',
    bundle: {
      format: PORTABLE_EXPORT_FORMAT,
      version: PORTABLE_EXPORT_VERSION,
      kind: 'campaign',
      state: {
        ...parsed.state,
        characters: parsed.state.characters.map(character => characterForBundle(character)),
      },
      assets: validAssets,
    },
    ignoredAssets,
  };
}

export async function restoreCharacterPortrait(
  bundle: PortableCharacterBundle,
  materialize: (asset: PortablePortraitAsset) => Promise<string>,
): Promise<{ character: Character; restored: number; failed: number }> {
  const asset = bundle.assets[0];
  if (!asset) return { character: bundle.character, restored: 0, failed: 0 };
  try {
    const portrait = await materialize(asset);
    if (!portrait) throw new Error('Portrait materializer returned an empty URI');
    return { character: { ...bundle.character, portrait }, restored: 1, failed: 0 };
  } catch {
    return { character: bundle.character, restored: 0, failed: 1 };
  }
}

export async function restoreCampaignPortraits(
  bundle: PortableCampaignBundle,
  materialize: (asset: PortablePortraitAsset) => Promise<string>,
): Promise<{ state: CampaignStateSnapshot; restored: number; failed: number }> {
  const assetsByCharacter = new Map<string, PortablePortraitAsset>();
  for (const asset of bundle.assets) {
    if (!assetsByCharacter.has(asset.characterId)) assetsByCharacter.set(asset.characterId, asset);
  }

  let restored = 0;
  let failed = 0;
  const characters: Character[] = [];
  for (const character of bundle.state.characters) {
    const asset = assetsByCharacter.get(character.id);
    if (!asset) {
      characters.push(character);
      continue;
    }
    try {
      const portrait = await materialize(asset);
      if (!portrait) throw new Error('Portrait materializer returned an empty URI');
      restored += 1;
      characters.push({ ...character, portrait });
    } catch {
      failed += 1;
      characters.push(character);
    }
  }

  return {
    state: { ...bundle.state, characters },
    restored,
    failed,
  };
}