import type {
  Armor,
  CampaignRuleTag,
  Character,
  CustomPerkDefinition,
  CustomPerkGrant,
  CustomRuleCondition,
  CustomRuleEffect,
  CustomWeaponMod,
  DamageType,
  RuleAttackMode,
  SkillType,
  Weapon,
} from '../context/types';
import type { Perk as BuiltInPerk } from './perks';
import { calcBaseSkills } from './derived.ts';
import { rebaseSkillValue } from './skillAdvancement.ts';
import { getCharacterRaceTagIds } from './races.ts';

export const BUILT_IN_RULE_TAGS: CampaignRuleTag[] = [
  { id: 'unarmed', label: 'Unarmed', appliesTo: 'weapon' },
  { id: 'natural-attack', label: 'Natural Attack', appliesTo: 'weapon' },
  { id: 'melee-weapons', label: 'Melee Weapons', appliesTo: 'weapon' },
  { id: 'small-guns', label: 'Small Guns', appliesTo: 'weapon' },
  { id: 'big-guns', label: 'Big Guns', appliesTo: 'weapon' },
  { id: 'energy-weapons', label: 'Energy Weapons', appliesTo: 'weapon' },
  { id: 'throwing', label: 'Throwing', appliesTo: 'weapon' },
  { id: 'mines-traps', label: 'Mines & Traps', appliesTo: 'weapon' },
  { id: 'pistol', label: 'Pistol', appliesTo: 'weapon' },
  { id: 'revolver', label: 'Revolver', appliesTo: 'weapon' },
  { id: 'shotgun', label: 'Shotgun', appliesTo: 'weapon' },
  { id: 'smg', label: 'Submachine Gun', appliesTo: 'weapon' },
  { id: 'rifle', label: 'Rifle', appliesTo: 'weapon' },
  { id: 'single-shot-rifle', label: 'Single-shot Rifle', appliesTo: 'weapon' },
  { id: 'assault-rifle', label: 'Assault Rifle', appliesTo: 'weapon' },
  { id: 'battle-rifle', label: 'Battle Rifle', appliesTo: 'weapon' },
  { id: 'carbine', label: 'Carbine', appliesTo: 'weapon' },
  { id: 'sniper-rifle', label: 'Sniper Rifle', appliesTo: 'weapon' },
  { id: 'launcher', label: 'Launcher', appliesTo: 'weapon' },
  { id: 'grenade-launcher', label: 'Grenade Launcher', appliesTo: 'weapon' },
  { id: 'missile-rocket-launcher', label: 'Missile/Rocket Launcher', appliesTo: 'weapon' },
  { id: 'mortar', label: 'Mortar', appliesTo: 'weapon' },
  { id: 'cannon', label: 'Cannon', appliesTo: 'weapon' },
  { id: 'flamethrower', label: 'Flamethrower', appliesTo: 'weapon' },
  { id: 'bow', label: 'Bow', appliesTo: 'weapon' },
  { id: 'crossbow', label: 'Crossbow', appliesTo: 'weapon' },
  { id: 'blowgun', label: 'Blowgun', appliesTo: 'weapon' },
  { id: 'sling', label: 'Sling', appliesTo: 'weapon' },
  { id: 'heavy-weapon', label: 'Heavy Weapon', appliesTo: 'weapon' },
  { id: 'energy-pistol', label: 'Energy Pistol', appliesTo: 'weapon' },
  { id: 'energy-rifle', label: 'Energy Rifle', appliesTo: 'weapon' },
  { id: 'burst-capable', label: 'Burst-capable', appliesTo: 'weapon' },
  { id: 'explosive', label: 'Explosive', appliesTo: 'weapon' },
  { id: 'grenade', label: 'Grenade', appliesTo: 'weapon' },
  { id: 'mine', label: 'Mine', appliesTo: 'weapon' },
  { id: 'trap', label: 'Trap', appliesTo: 'weapon' },
  { id: 'armor', label: 'Armor', appliesTo: 'armor' },
  { id: 'body-armor', label: 'Body Armor', appliesTo: 'armor' },
  { id: 'power-armor', label: 'Power Armor', appliesTo: 'armor' },
  { id: 'combat-armor', label: 'Combat Armor', appliesTo: 'armor' },
  { id: 'leather-armor', label: 'Leather Armor', appliesTo: 'armor' },
  { id: 'metal-armor', label: 'Metal Armor', appliesTo: 'armor' },
  { id: 'chitin-armor', label: 'Chitin Armor', appliesTo: 'armor' },
  { id: 'environmental-armor', label: 'Environmental Armor', appliesTo: 'armor' },
  { id: 'clothing', label: 'Clothing', appliesTo: 'armor' },
  { id: 'helmet', label: 'Helmet', appliesTo: 'armor' },
  { id: 'radiation-suit', label: 'Radiation Suit', appliesTo: 'armor' },
];

export function getSelectableWeaponTags(
  campaignTags: readonly CampaignRuleTag[],
  selectedTagIds: readonly string[] = [],
): CampaignRuleTag[] {
  const tags = new Map<string, CampaignRuleTag>();
  const isWeaponTag = (tag: CampaignRuleTag) => tag.appliesTo === 'weapon' || tag.appliesTo === 'both';

  for (const tag of BUILT_IN_RULE_TAGS) {
    if (isWeaponTag(tag)) tags.set(tag.id, tag);
  }
  for (const tag of campaignTags) {
    if (isWeaponTag(tag) && !tags.has(tag.id)) tags.set(tag.id, tag);
  }
  for (const tagId of selectedTagIds) {
    if (!tags.has(tagId)) tags.set(tagId, { id: tagId, label: tagId, appliesTo: 'weapon' });
  }

  return [...tags.values()];
}

export function getSelectableArmorTags(
  campaignTags: readonly CampaignRuleTag[],
  selectedTagIds: readonly string[] = [],
): CampaignRuleTag[] {
  const tags = new Map<string, CampaignRuleTag>();
  const isArmorTag = (tag: CampaignRuleTag) => tag.appliesTo === 'armor' || tag.appliesTo === 'both';

  for (const tag of BUILT_IN_RULE_TAGS) {
    if (isArmorTag(tag)) tags.set(tag.id, tag);
  }
  for (const tag of campaignTags) {
    if (isArmorTag(tag) && !tags.has(tag.id)) tags.set(tag.id, tag);
  }
  for (const tagId of selectedTagIds) {
    if (!tags.has(tagId)) tags.set(tagId, { id: tagId, label: tagId, appliesTo: 'armor' });
  }

  return [...tags.values()];
}

export function normalizeRuleTag(value: string): string {
  return value.trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseRuleTagList(value: string): string[] {
  return [...new Set(value.split(',').map(normalizeRuleTag).filter(Boolean))];
}

export function inferWeaponTags(weapon: Weapon): string[] {
  const categoryTag: Record<Weapon['category'], string> = {
    unarmed: 'unarmed',
    natural: 'natural-attack',
    meleeWeapons: 'melee-weapons',
    smallGuns: 'small-guns',
    bigGuns: 'big-guns',
    energyWeapons: 'energy-weapons',
    throwing: 'throwing',
    minesTraps: 'mines-traps',
  };
  const tags = new Set<string>([normalizeRuleTag(weapon.skill), categoryTag[weapon.category]]);
  const name = weapon.name.toLowerCase();
  const id = weapon.id.toLowerCase();
  const category = weapon.category;

  if (category === 'natural') tags.add('unarmed');
  if (category === 'bigGuns') tags.add('heavy-weapon');
  // Retain the old broad condition tag for campaign perks already saved with "traps".
  if (category === 'minesTraps') tags.add('traps');

  if (category === 'unarmed') tags.add('unarmed');
  if (category === 'meleeWeapons') tags.add('melee-weapons');
  if (category === 'throwing') tags.add('throwing');
  if (category === 'minesTraps') {
    if (/mine/.test(id) || /\bmine\b/.test(name)) tags.add('mine');
    else tags.add('trap');
  }
  if (weapon.burstLimit > 1) tags.add('burst-capable');

  if (/shotgun|12[- ]?guage|12[- ]?gauge/.test(name)) tags.add('shotgun');
  if (/\bsmg\b|submachine|machine pistol/.test(name)
    || ['sten_gun', 'mp_38', 'handk_mp_5', 'm3a1_grease_gun_smg', 'walther_mpl', 'handk_p90c'].includes(id)) {
    tags.add('smg');
  }
  if (/revolver/.test(name)) {
    tags.add('revolver');
    tags.add('pistol');
  }
  if (/pistol|sidearm/.test(name) || id === 'calico_m_950') {
    tags.add(category === 'energyWeapons' ? 'energy-pistol' : 'pistol');
  }
  const isKnownRifle = /rifle|carbine|battle rifle/.test(name)
    || ['ruger_ac556f', 'ak_74', 'm16a2', 'steyr_aug', 'xl70e3', 'handk_g11_e', 'svd_4000'].includes(id);
  if (isKnownRifle) tags.add('rifle');
  if (/carbine/.test(name)) tags.add('carbine');
  if (/battle rifle/.test(name) || ['m14', 'fn_fal'].includes(id)) tags.add('battle-rifle');
  if (/assault/.test(name) || [
    'ruger_ac556f', 'ak_74', 'm16a2', 'steyr_aug', 'xl70e3', 'handk_g11_e',
  ].includes(id)) tags.add('assault-rifle');
  if (/sniper|marksman/.test(name) || id === 'svd_4000') tags.add('sniper-rifle');
  if (category === 'energyWeapons' && isKnownRifle) tags.add('energy-rifle');
  if (/single[- ]?shot|bolt[- ]?action|lever[- ]?action/.test(name)) {
    tags.add('single-shot-rifle');
  }

  const isGrenadeLauncher = /grenade (launcher|rifle)/.test(name)
    || ['m203', 'mk_19_personal_artillery_device', 'bg_1_grenade_launcher', 'ags_17_grenade_launcher'].includes(id);
  const isMissileRocketLauncher = /missile|rocket/.test(name) || id === 'vehicle_152mm_shillelagh';
  const isMortar = /mortar/.test(name);
  if (isGrenadeLauncher || isMissileRocketLauncher || isMortar || /launcher/.test(name)) tags.add('launcher');
  if (isGrenadeLauncher) tags.add('grenade-launcher');
  if (isMissileRocketLauncher) tags.add('missile-rocket-launcher');
  if (isMortar) tags.add('mortar');
  if (/cannon/.test(name) || /\d+mm gun/.test(name)) {
    tags.add('cannon');
    tags.add('heavy-weapon');
  }
  if (/gatling/.test(name)) tags.add('heavy-weapon');
  if (/flamethrower|flamer/.test(name)) tags.add('flamethrower');
  if (/bow/.test(name)) tags.add('bow');
  if (/crossbow/.test(name)) tags.add('crossbow');
  if (/blowgun/.test(name)) tags.add('blowgun');
  if (/sling/.test(name)) tags.add('sling');
  if (category === 'throwing' && /grenade/.test(name)) tags.add('grenade');
  if (category === 'minesTraps') {
    if (tags.has('mine')) tags.add('explosive');
    if (tags.has('trap') && /explosive|claymore/.test(name)) tags.add('explosive');
  } else if (weapon.damageType === 'explosion' || /explosive/.test(name)) {
    tags.add('explosive');
  }
  return [...new Set([...(weapon.tags ?? []).map(normalizeRuleTag), ...tags])];
}

export function inferArmorTags(armor: Armor): string[] {
  const tags = new Set<string>(['armor']);
  if (armor.slot === 'helmet') tags.add('helmet');
  else if (armor.id !== 'clothing') tags.add('body-armor');
  const name = armor.name.toLowerCase();
  if (/power armor|powered armor|power armour/.test(name)) tags.add('power-armor');
  if (/combat (armor|armour|helmet)/.test(name)) tags.add('combat-armor');
  if (/radiation|hazmat/.test(name)) tags.add('radiation-suit');
  if (/environmental/.test(name)) tags.add('environmental-armor');
  if (/leather/.test(name)) tags.add('leather-armor');
  if (/metal/.test(name)) tags.add('metal-armor');
  if (/chitin/.test(name)) tags.add('chitin-armor');
  if (armor.id === 'clothing') tags.add('clothing');
  return [...new Set([...(armor.tags ?? []).map(normalizeRuleTag), ...tags])];
}

export function weaponMatchesTags(weapon: Weapon | null | undefined, required: string[] = []): boolean {
  if (required.length === 0) return true;
  if (!weapon) return false;
  const available = new Set(inferWeaponTags(weapon));
  return required.some(tag => available.has(normalizeRuleTag(tag)));
}

export function armorMatchesTags(armor: Armor[], required: string[] = []): boolean {
  if (required.length === 0) return true;
  const available = new Set(armor.flatMap(inferArmorTags));
  return required.some(tag => available.has(normalizeRuleTag(tag)));
}

export function customRuleConditionMatches(
  character: Character,
  weapon: Weapon | null | undefined,
  wornArmor: Armor[],
  mode: RuleAttackMode | null,
  condition?: CustomRuleCondition,
): boolean {
  if (!condition) return true;
  if (!weaponMatchesTags(weapon, condition.weaponTags)) return false;
  if (!armorMatchesTags(wornArmor, condition.armorTags)) return false;
  if (condition.attackModes?.length && (!mode || !condition.attackModes.includes(mode))) return false;
  if (condition.statuses?.length) {
    const active = new Set((character.conditions ?? []).map(normalizeRuleTag));
    if (!condition.statuses.some(status => active.has(normalizeRuleTag(status)))) return false;
  }
  if (condition.attackerRaces?.length
    && !condition.attackerRaces.some(race => race === character.race)) return false;
  if (condition.attackerRaceTags?.length) {
    const raceTags = new Set(getCharacterRaceTagIds(character));
    if (!condition.attackerRaceTags.some(tag => raceTags.has(tag))) return false;
  }
  if (condition.attackerTraits?.length) {
    const traits = new Set(character.traits ?? []);
    if (!condition.attackerTraits.some(trait => traits.has(trait))) return false;
  }
  return true;
}

export interface CustomDamageComponent {
  id: string;
  label: string;
  type: DamageType | 'radiation';
  dmgDieCount: number;
  dmgDie: number;
  dmgBonus: number;
}

export interface CustomWeaponModTotals {
  toHit: number;
  damage: number;
  range: number;
  apDiscount: number;
  ignoreDT: number;
  reloadApOverride?: number;
  magazineMult: number;
  damageComponents: CustomDamageComponent[];
}

export function computeCustomWeaponModEffects(
  modIds: string[],
  definitions: CustomWeaponMod[],
  weapon?: Weapon | null,
): CustomWeaponModTotals {
  const result: CustomWeaponModTotals = {
    toHit: 0, damage: 0, range: 0, apDiscount: 0, ignoreDT: 0, magazineMult: 1, damageComponents: [],
  };
  for (const mod of definitions) {
    if (!modIds.includes(mod.id) || !mod.programmatic
      || (mod.appliesToTags?.length && !weaponMatchesTags(weapon, mod.appliesToTags))) continue;
    for (const effect of mod.effects) {
      switch (effect.kind) {
        case 'toHit': result.toHit += effect.value; break;
        case 'range': result.range += effect.value; break;
        case 'damage':
        case 'radiationExposure':
          result.damageComponents.push({
            id: `${mod.id}-${effect.id}`,
            label: `${mod.name}${effect.description ? ` · ${effect.description}` : ''}`,
            type: effect.kind === 'radiationExposure' ? 'radiation' : (effect.damageType ?? 'normal'),
            dmgDieCount: Math.max(0, Math.floor(effect.diceCount ?? 0)),
            dmgDie: Math.max(0, Math.floor(effect.dieSides ?? 0)),
            dmgBonus: effect.value,
          });
          break;
        case 'attackApDiscount': result.apDiscount += effect.value; break;
        case 'ignoreDT': result.ignoreDT += effect.value; break;
        case 'reloadAp': result.reloadApOverride = effect.value; break;
        case 'magazineMultiplier':
          if (effect.value > 0) result.magazineMult *= effect.value;
          break;
        default: break;
      }
    }
  }
  return result;
}

export interface CustomPerkTotals {
  toHit: number;
  damage: number;
  apDiscount: number;
  range: number;
  armorClass: number;
  maxAP: number;
  maxHP: number;
  ignoreDT: number;
  damageComponents: CustomDamageComponent[];
  damageResistance: Partial<Record<DamageType, number>>;
  radiationResistance: number;
  poisonResistance: number;
  skillBonuses: Partial<Record<SkillType, number>>;
  specialBonuses: Partial<Record<string, number>>;
}

function applyCustomPerkGrant(character: Character, grant: CustomPerkGrant, direction: 1 | -1): Character {
  const amount = grant.amount * direction;
  // Keep these outside purchased skill values so they never affect refunds or tag locks.
  if (grant.kind === 'skillBonus') return character;
  if (grant.kind === 'specialBonus' && grant.special) {
    const oldBase = calcBaseSkills(character.special);
    const special = { ...character.special, [grant.special]: character.special[grant.special] + amount };
    const newBase = calcBaseSkills(special);
    const skills = { ...character.skills };
    for (const skill of Object.keys(skills) as (keyof typeof skills)[]) {
      skills[skill] = rebaseSkillValue(skills[skill], oldBase[skill], newBase[skill]);
    }
    return { ...character, special, skills };
  }
  return character;
}

/**
 * Apply newly gained custom-perk ranks or reverse ranks removed from an owned
 * perk. Recorded grants make repeated calls idempotent and survive definition edits.
 */
export function syncCustomPerkOneTimeGrants(
  character: Character,
  definition: CustomPerkDefinition,
  previousRank: number,
  targetRank: number,
): Character {
  const owned = character.perks.find(perk => perk.perkId === definition.id);
  if (!owned) return character;

  let nextCharacter = character;
  let grants = [...(owned.appliedCustomPerkGrants ?? [])];
  const rank = Math.max(0, Math.floor(targetRank));

  if (rank < previousRank) {
    const removed = grants.filter(grant => grant.rank > rank);
    for (const grant of removed) nextCharacter = applyCustomPerkGrant(nextCharacter, grant, -1);
    grants = grants.filter(grant => grant.rank <= rank);
  } else if (definition.programmatic) {
    for (let grantRank = Math.max(0, Math.floor(previousRank)) + 1; grantRank <= rank; grantRank++) {
      for (const effect of definition.effects) {
        if (effect.application !== 'oneTime'
          || (effect.kind !== 'skillBonus' && effect.kind !== 'specialBonus')
          || (effect.perRank === false && grantRank > 1)) continue;
        if (grants.some(grant => grant.effectId === effect.id && grant.rank === grantRank)) continue;
        const grant: CustomPerkGrant = {
          effectId: effect.id,
          rank: grantRank,
          kind: effect.kind,
          amount: effect.value,
          ...(effect.kind === 'skillBonus' && effect.skill ? { skill: effect.skill } : {}),
          ...(effect.kind === 'specialBonus' && effect.special ? { special: effect.special } : {}),
        };
        if ((grant.kind === 'skillBonus' && !grant.skill)
          || (grant.kind === 'specialBonus' && !grant.special)) continue;
        nextCharacter = applyCustomPerkGrant(nextCharacter, grant, 1);
        grants.push(grant);
      }
    }
  }

  return {
    ...nextCharacter,
    perks: nextCharacter.perks.map(perk => perk.perkId === definition.id
      ? { ...perk, rank, appliedCustomPerkGrants: grants }
      : perk),
  };
}

/** Reverse all recorded custom gains for a perk, even if its definition was deleted. */
export function reverseCustomPerkOneTimeGrants(character: Character, perkId: string): Character {
  const owned = character.perks.find(perk => perk.perkId === perkId);
  if (!owned?.appliedCustomPerkGrants?.length) return character;
  let nextCharacter = character;
  for (const grant of owned.appliedCustomPerkGrants) {
    nextCharacter = applyCustomPerkGrant(nextCharacter, grant, -1);
  }
  return {
    ...nextCharacter,
    perks: nextCharacter.perks.map(perk => perk.perkId === perkId
      ? { ...perk, appliedCustomPerkGrants: [] }
      : perk),
  };
}

export function computeCustomPerkEffects(
  character: Character | null | undefined,
  definitions: CustomPerkDefinition[],
  context: { weapon?: Weapon | null; armor?: Armor[]; mode?: RuleAttackMode | null } = {},
): CustomPerkTotals {
  const result: CustomPerkTotals = {
    toHit: 0, damage: 0, apDiscount: 0, range: 0, armorClass: 0, maxAP: 0, maxHP: 0,
    ignoreDT: 0, damageComponents: [], damageResistance: {}, radiationResistance: 0,
    poisonResistance: 0, skillBonuses: {}, specialBonuses: {},
  };
  if (!character) return result;
  const equipped = new Map(definitions.map(definition => [definition.id, definition]));
  for (const owned of character.perks ?? []) {
    for (const grant of owned.appliedCustomPerkGrants ?? []) {
      if (grant.kind === 'skillBonus' && grant.skill) {
        result.skillBonuses[grant.skill] = (result.skillBonuses[grant.skill] ?? 0) + grant.amount;
      }
    }
    const perk = equipped.get(owned.perkId);
    if (!perk?.programmatic
      || !customRuleConditionMatches(
        character, context.weapon, context.armor ?? [],
        context.mode === undefined ? 'single' : context.mode, perk.conditions,
      )) continue;
    for (const effect of perk.effects) {
      if (effect.application === 'oneTime') continue;
      const multiplier = effect.perRank === false ? 1 : Math.max(1, owned.rank);
      const amount = effect.value * multiplier;
      switch (effect.kind) {
        case 'toHit': result.toHit += amount; break;
        case 'damage': result.damageComponents.push({
          id: `${perk.id}-${effect.id}`,
          label: perk.name,
          type: effect.damageType ?? 'normal',
          dmgDieCount: Math.max(0, Math.floor((effect.diceCount ?? 0) * multiplier)),
          dmgDie: Math.max(0, Math.floor(effect.dieSides ?? 0)),
          dmgBonus: amount,
        }); break;
        case 'radiationExposure': result.damageComponents.push({
          id: `${perk.id}-${effect.id}`,
          label: perk.name,
          type: 'radiation',
          dmgDieCount: Math.max(0, Math.floor((effect.diceCount ?? 0) * multiplier)),
          dmgDie: Math.max(0, Math.floor(effect.dieSides ?? 0)),
          dmgBonus: amount,
        }); break;
        case 'range': result.range += amount; break;
        case 'attackApDiscount': result.apDiscount += amount; break;
        case 'armorClass': result.armorClass += amount; break;
        case 'maxAP': result.maxAP += amount; break;
        case 'maxHP': result.maxHP += amount; break;
        case 'ignoreDT': result.ignoreDT += amount; break;
        case 'damageResistance': {
          const keys = effect.damageType ? [effect.damageType] : ['normal', 'laser', 'fire', 'plasma', 'explosion'] as DamageType[];
          for (const key of keys) result.damageResistance[key] = (result.damageResistance[key] ?? 0) + amount;
          break;
        }
        case 'radiationResistance': result.radiationResistance += amount; break;
        case 'poisonResistance': result.poisonResistance += amount; break;
        case 'skillBonus':
          if (effect.skill) result.skillBonuses[effect.skill] = (result.skillBonuses[effect.skill] ?? 0) + amount;
          break;
        case 'specialBonus':
          if (effect.special) result.specialBonuses[effect.special] = (result.specialBonuses[effect.special] ?? 0) + amount;
          break;
        default: break;
      }
    }
  }
  return result;
}

export function customPerkAsPerk(perk: CustomPerkDefinition): BuiltInPerk {
  return {
    id: perk.id,
    name: perk.name,
    category: perk.category,
    description: perk.description,
    minLevel: perk.minLevel,
    maxRanks: perk.maxRanks,
    requiresRace: perk.requiresRace,
    excludedRaces: perk.excludedRaces,
    requiresRaceTags: perk.requiresRaceTags,
    excludedRaceTags: perk.excludedRaceTags,
    requirements: perk.requirements,
    combatEffect: null,
  };
}

const DAMAGE_TYPES = new Set<DamageType>(['normal', 'laser', 'fire', 'plasma', 'explosion']);
const WEAPON_MOD_EFFECTS = new Set([
  'toHit', 'damage', 'radiationExposure', 'range', 'attackApDiscount',
  'reloadAp', 'magazineMultiplier', 'ignoreDT',
]);
const CUSTOM_PERK_EFFECTS = new Set([
  ...WEAPON_MOD_EFFECTS, 'skillBonus', 'specialBonus', 'armorClass',
  'damageResistance', 'radiationResistance', 'poisonResistance', 'maxAP', 'maxHP',
]);
const RULE_MODES = new Set<RuleAttackMode>(['single', 'targeted', 'burst']);
const RULE_CATEGORIES = new Set(['combat', 'defense', 'utility', 'social', 'survival', 'racial']);
const RULE_SKILLS = new Set<SkillType>([
  'smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed', 'throwing',
  'firstAid', 'doctor', 'sneak', 'lockpick', 'steal', 'traps', 'science', 'repair',
  'speech', 'barter', 'gambling', 'outdoorsman', 'pilot',
]);
const RULE_SPECIALS = new Set(['strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return value === undefined || Array.isArray(value) && value.every(item => typeof item === 'string');
}

function validRuleEffect(value: unknown, kinds: Set<string>): value is CustomRuleEffect {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id
    || typeof value.kind !== 'string' || !kinds.has(value.kind)
    || typeof value.value !== 'number' || !Number.isFinite(value.value)) return false;
  if (value.damageType !== undefined && !DAMAGE_TYPES.has(value.damageType as DamageType)) return false;
  if (value.diceCount !== undefined && (!Number.isInteger(value.diceCount) || (value.diceCount as number) < 0)) return false;
  if (value.dieSides !== undefined && (!Number.isInteger(value.dieSides) || (value.dieSides as number) < 0)) return false;
  if (value.perRank !== undefined && typeof value.perRank !== 'boolean') return false;
  if (value.application !== undefined && value.application !== 'ongoing' && value.application !== 'oneTime') return false;
  return true;
}

function validCondition(value: unknown): value is CustomRuleCondition | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return isStringList(value.weaponTags)
    && isStringList(value.armorTags)
    && isStringList(value.statuses)
    && isStringList(value.attackerRaces)
    && isStringList(value.attackerRaceTags)
    && isStringList(value.attackerTraits)
    && (value.attackModes === undefined
      || Array.isArray(value.attackModes) && value.attackModes.every(mode => RULE_MODES.has(mode as RuleAttackMode)));
}

export function validateCustomWeaponMod(value: unknown): value is CustomWeaponMod {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.name === 'string' && value.name.trim().length > 0
    && typeof value.description === 'string' && typeof value.programmatic === 'boolean'
    && isStringList(value.appliesToTags)
    && Array.isArray(value.effects)
    && value.effects.every(effect => validRuleEffect(effect, WEAPON_MOD_EFFECTS)
      && effect.application !== 'oneTime');
}

export function validateCustomPerk(value: unknown): value is CustomPerkDefinition {
  if (!isRecord(value)) return false;
  const effects = Array.isArray(value.effects) ? value.effects : [];
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.name === 'string' && value.name.trim().length > 0
    && typeof value.description === 'string' && typeof value.programmatic === 'boolean'
    && RULE_CATEGORIES.has(value.category as string)
    && Number.isInteger(value.minLevel) && (value.minLevel as number) >= 1
    && Number.isInteger(value.maxRanks) && (value.maxRanks as number) >= 1
    && isStringList(value.requiresRace)
    && isStringList(value.excludedRaces)
    && isStringList(value.requiresRaceTags)
    && isStringList(value.excludedRaceTags)
    && validCondition(value.conditions)
    && Array.isArray(value.effects)
    && effects.every(effect => validRuleEffect(effect, CUSTOM_PERK_EFFECTS)
      && (effect.application !== 'oneTime'
        || (effect.kind === 'skillBonus' && RULE_SKILLS.has(effect.skill as SkillType)
          || effect.kind === 'specialBonus' && RULE_SPECIALS.has(effect.special as string))))
    && new Set(effects.map(effect => isRecord(effect) ? effect.id : null)).size === effects.length;
}
