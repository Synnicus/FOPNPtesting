import type { Armor, Character, InitiativeEntry } from '../context/types.ts';
import { addArmorWear } from './armorCondition.ts';

interface DamageState {
  characters: Character[];
  initiativeEntries: InitiativeEntry[];
  damageReceiptIds?: string[];
}
/** Damage has already been resolved using starting protection. Apply HP and wear
 * together, without rerolling or recalculating damage at the new condition. */
export function applyEquipmentDamage<T extends DamageState>(
  state: T, armor: readonly Armor[], requestId: string, characterId: string,
  damage: number, damagingHits: number, location?: string,
): T {
  if ((state.damageReceiptIds ?? []).includes(requestId)) return state;
  const hpDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const hits = Number.isFinite(damagingHits) ? Math.max(0, Math.floor(damagingHits)) : 0;
  const characters = state.characters.map(c => c.id === characterId
    ? addArmorWear({ ...c, currentHp: Math.max(0, c.currentHp - hpDamage) }, armor, hpDamage > 0 ? hits : 0, location)
    : c);
  return { ...state, characters,
    damageReceiptIds: [...(state.damageReceiptIds ?? []), requestId].slice(-200),
    initiativeEntries: state.initiativeEntries.map(e => e.characterId === characterId
      ? { ...e, currentHp: characters.find(c => c.id === characterId)?.currentHp ?? e.currentHp } : e),
  };
}
