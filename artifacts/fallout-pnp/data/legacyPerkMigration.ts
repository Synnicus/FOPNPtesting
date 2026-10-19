import type { Character } from '../context/types.ts';

const LEGACY_TRAIT_PERKS: Readonly<Record<string, string>> = {
  finesse: 'finesse',
  fast_metabolism: 'fast_metabolism',
  chem_resistant: 'chem_resistant',
};

function normalizePerkId(id: string): string {
  return id.trim().toLowerCase().replace(/[-\s]+/g, '_');
}

/**
 * Convert old duplicate perk selections into their current Trait selections.
 * This is idempotent and preserves unrelated perks and traits.
 */
export function migrateLegacyTraitPerks(character: Character): Character {
  const perks = character.perks ?? [];
  const traits = [...(character.traits ?? [])];
  const traitSet = new Set(traits);
  const retainedPerks: typeof perks = [];
  let migrated = false;

  for (const perk of perks) {
    const traitId = LEGACY_TRAIT_PERKS[normalizePerkId(perk.perkId)];
    if (!traitId) {
      retainedPerks.push(perk);
      continue;
    }

    if ((perk.rank ?? 1) > 0 && !traitSet.has(traitId)) {
      traits.push(traitId);
      traitSet.add(traitId);
    }
    migrated = true;
  }

  if (!migrated) return character;
  return { ...character, traits, perks: retainedPerks };
}
