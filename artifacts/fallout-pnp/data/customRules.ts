import type {
  Armor,
  CampaignRuleTag,
  Character,
  CustomPerkDefinition,
  CustomRuleCondition,
  CustomRuleEffect,
  CustomWeaponMod,
  DamageType,
  RuleAttackMode,
  SkillType,
  Weapon,
} from '../context/types';
import type { Perk as BuiltInPerk } from './perks';

export const BUILT_IN_RULE_TAGS: CampaignRuleTag[] = [
  { id: 'small-guns', label: 'Small Guns', appliesTo: 'weapon' },
  { id: 'big-guns', label: 'Big Guns', appliesTo: 'weapon' },
  { id: 'energy-weapons', label: 'Energy Weapons', appliesTo: 'weapon' },
  { id: 'melee-weapons', label: 'Melee Weapons', appliesTo: 'weapon' },
  { id: 'unarmed', label: 'Unarmed', appliesTo: 'weapon' },
  { id: 'throwing', label: 'Throwing', appliesTo: 'weapon' },
  { id: 'pistol', label: 'Pistol', appliesTo: 'weapon' },
  { id: 'revolver', label: 'Revolver', appliesTo: 'weapon' },
  { id: 'shotgun', label: 'Shotgun', appliesTo: 'weapon' },
  { id: 'smg', label: 'Submachine Gun', appliesTo: 'weapon' },
  { id: 'rifle', label: 'Rifle', appliesTo: 'weapon' },
  { id: 'single-shot-rifle', label: 'Single-shot Rifle', appliesTo: 'weapon' },
  { id: 'assault-rifle', label: 'Assault Rifle', appliesTo: 'weapon' },
  { id: 'sniper-rifle', label: 'Sniper Rifle', appliesTo: 'weapon' },
  { id: 'launcher', label: 'Launcher', appliesTo: 'weapon' },
  { id: 'heavy-weapon', label: 'Heavy Weapon', appliesTo: 'weapon' },
  { id: 'energy-pistol', label: 'Energy Pistol', appliesTo: 'weapon' },
  { id: 'energy-rifle', label: 'Energy Rifle', appliesTo: 'weapon' },
  { id: 'burst-capable', label: 'Burst-capable', appliesTo: 'weapon' },
  { id: 'explosive', label: 'Explosive', appliesTo: 'weapon' },
  { id: 'power-armor', label: 'Power Armor', appliesTo: 'armor' },
  { id: 'combat-armor', label: 'Combat Armor', appliesTo: 'armor' },
  { id: 'helmet', label: 'Helmet', appliesTo: 'armor' },
  { id: 'radiation-suit', label: 'Radiation Suit', appliesTo: 'armor' },
];

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
  const tags = new Set<string>([normalizeRuleTag(weapon.skill)]);
  const name = weapon.name.toLowerCase();
  const category = weapon.category;
  if (category === 'unarmed') tags.add('unarmed');
  if (category === 'meleeWeapons') tags.add('melee-weapons');
  if (category === 'throwing') tags.add('throwing');
  if (category === 'bigGuns') tags.add('heavy-weapon');
  if (category === 'smallGuns') tags.add('small-guns');
  if (category === 'energyWeapons') tags.add('energy-weapons');
  if (weapon.burstLimit > 1) tags.add('burst-capable');
  if (/shotgun/.test(name)) tags.add('shotgun');
  if (/\bsmg\b|submachine/.test(name)) tags.add('smg');
  if (/revolver/.test(name)) tags.add('revolver');
  if (/pistol|sidearm|10mm|14mm/.test(name)) tags.add(category === 'energyWeapons' ? 'energy-pistol' : 'pistol');
  if (/rifle/.test(name)) {
    tags.add('rifle');
    if (/assault/.test(name)) tags.add('assault-rifle');
    if (/sniper|marksman/.test(name)) tags.add('sniper-rifle');
    if (/single.?shot|bolt.?action|lever.?action/.test(name) || weapon.burstLimit <= 1) tags.add('single-shot-rifle');
    if (category === 'energyWeapons') tags.add('energy-rifle');
  }
  if (/launcher|missile|rocket|grenade/.test(name)) tags.add('launcher');
  if (/explosive|grenade|mine/.test(name)) tags.add('explosive');
  return [...new Set([...(weapon.tags ?? []).map(normalizeRuleTag), ...tags])];
}

export function inferArmorTags(armor: Armor): string[] {
  const tags = new Set<string>([armor.slot === 'helmet' ? 'helmet' : 'body-armor']);
  const name = armor.name.toLowerCase();
  if (/power armor|powered armor|power armour/.test(name)) tags.add('power-armor');
  if (/combat armor|combat armour/.test(name)) tags.add('combat-armor');
  if (/radiation|hazmat/.test(name)) tags.add('radiation-suit');
  if (/leather/.test(name)) tags.add('leather-armor');
  if (/metal/.test(name)) tags.add('metal-armor');
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
  if (condition.attackerRaces?.length && !condition.attackerRaces.includes(character.race)) return false;
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
    const perk = equipped.get(owned.perkId);
    if (!perk?.programmatic
      || !customRuleConditionMatches(
        character, context.weapon, context.armor ?? [],
        context.mode === undefined ? 'single' : context.mode, perk.conditions,
      )) continue;
    for (const effect of perk.effects) {
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
  return true;
}

function validCondition(value: unknown): value is CustomRuleCondition | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return isStringList(value.weaponTags)
    && isStringList(value.armorTags)
    && isStringList(value.statuses)
    && isStringList(value.attackerRaces)
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
    && value.effects.every(effect => validRuleEffect(effect, WEAPON_MOD_EFFECTS));
}

export function validateCustomPerk(value: unknown): value is CustomPerkDefinition {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.name === 'string' && value.name.trim().length > 0
    && typeof value.description === 'string' && typeof value.programmatic === 'boolean'
    && RULE_CATEGORIES.has(value.category as string)
    && Number.isInteger(value.minLevel) && (value.minLevel as number) >= 1
    && Number.isInteger(value.maxRanks) && (value.maxRanks as number) >= 1
    && validCondition(value.conditions)
    && Array.isArray(value.effects)
    && value.effects.every(effect => validRuleEffect(effect, CUSTOM_PERK_EFFECTS));
}
