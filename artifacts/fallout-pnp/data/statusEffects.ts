import type { Character } from '@/context/types';
import { clearUnconsciousness } from './unconsciousness.ts';

/**
 * Remove temporary character statuses without changing HP, radiation,
 * equipment, perks, or combat turn restrictions. Injuries are retained as
 * history and are only deactivated when the caller explicitly requests it.
 */
export function clearTemporaryCharacterEffects(
  character: Character,
  healInjuries = false,
): Character {
  const conscious = clearUnconsciousness(character);
  return {
    ...conscious,
    effects: [],
    conditions: [],
    combatDefenseSuppressed: false,
    areaEffects: [],
    ...(healInjuries
      ? { injuries: (character.injuries ?? []).map(injury => ({ ...injury, isActive: false })) }
      : {}),
  };
}
