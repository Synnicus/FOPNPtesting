import type { Armor, ArmorConditionState, Character } from '../context/types.ts';

export const ARMOR_HITS_PER_BOX = 5;
export const ARMOR_MAX_HITS = 50;
export function clampArmorHits(hits: number): number {
  return Number.isFinite(hits) ? Math.max(0, Math.min(50, Math.floor(hits))) : 0;
}
export function armorHits(states: readonly ArmorConditionState[] | undefined, armorId: string): number {
  return clampArmorHits(states?.find(state => state.armorId === armorId)?.hitSegments ?? 0);
}
export function armorConditionModifier(hits: number): number {
  const boxes = Math.floor(clampArmorHits(hits) / 5);
  return boxes < 4 ? 0 : boxes === 4 ? 0.05 : (boxes - 4) / 10;
}
export function setArmorHits(states: readonly ArmorConditionState[] | undefined, armorId: string, hits: number): ArmorConditionState[] {
  return [...(states ?? []).filter(state => state.armorId !== armorId), { armorId, hitSegments: clampArmorHits(hits) }];
}
export function adjustedArmor(armor: Armor | undefined, states?: readonly ArmorConditionState[]): Armor | undefined {
  if (!armor) return undefined;
  const multiplier = 1 - armorConditionModifier(armorHits(states, armor.id));
  const result = { ...armor };
  for (const type of ['Normal', 'Laser', 'Fire', 'Plasma', 'Explosion'] as const) {
    result[`dt${type}`] = armor[`dt${type}`] * multiplier;
    result[`dr${type}`] = armor[`dr${type}`] * multiplier;
  }
  return result;
}

export function normalizeArmorCondition(states: readonly ArmorConditionState[] | undefined): ArmorConditionState[] {
  const byId = new Map<string, ArmorConditionState>();
  for (const state of states ?? []) {
    if (typeof state?.armorId === 'string' && state.armorId) {
      byId.set(state.armorId, { armorId: state.armorId, hitSegments: clampArmorHits(state.hitSegments) });
    }
  }
  return [...byId.values()];
}
/** Same validity rules as the sheet resolver; catalogue entries are never mutated. */
export function wornArmor(character: Pick<Character, 'equippedBodyArmorId' | 'equippedHelmetId' | 'armorConditionStates'>, catalog: readonly Armor[]) {
  const body = catalog.find(a => a.id === character.equippedBodyArmorId && a.slot === 'body');
  const selected = catalog.find(a => a.id === character.equippedHelmetId && a.slot === 'helmet');
  const helmet = body?.integratedHelmet || body?.prohibitsHelmet ||
    (selected?.compatibleBodyArmorIds && (!body || !selected.compatibleBodyArmorIds.includes(body.id))) ? undefined : selected;
  return { bodyArmor: adjustedArmor(body, character.armorConditionStates), helmet: adjustedArmor(helmet, character.armorConditionStates) };
}
/** GM policy: aimed head/eyes hits wear a separate valid helmet; other hits wear body armor.
 * Integrated helmets belong to the suit. Aggregate area exposures count once. */
export function addArmorWear(character: Character, catalog: readonly Armor[], damagingHits: number, location?: string): Character {
  const worn = wornArmor(character, catalog);
  const armor = /head|eyes/i.test(location ?? '') ? worn.helmet ?? worn.bodyArmor : worn.bodyArmor;
  if (!armor || damagingHits <= 0) return character;
  return { ...character, armorConditionStates: setArmorHits(character.armorConditionStates, armor.id,
    armorHits(character.armorConditionStates, armor.id) + damagingHits) };
}
