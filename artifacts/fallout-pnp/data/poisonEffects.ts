import type { ActiveEffect, Weapon } from '../context/types.ts';
import type { AmmoType } from './ammo.ts';
import { computeModEffects, type PoisonSpec } from './mods.ts';

/** Poison carried by a weapon coating/natural attack or its loaded ammunition. */
export function poisonExposuresForAttack(
  weapon: Weapon | null | undefined,
  ammo: AmmoType | null | undefined,
): PoisonSpec[] {
  if (!weapon) return [];
  const exposures = [...computeModEffects(weapon).poisons];
  if (ammo?.poison) exposures.push(ammo.poison);
  return exposures.filter((poison, index, all) =>
    all.findIndex(candidate => candidate.type === poison.type) === index,
  );
}

export function poisonEffectName(poisonType: NonNullable<ActiveEffect['poisonType']>, count = 1): string {
  return `Poisoned with Type ${poisonType} X${Math.max(1, count)}`;
}

/** Build a persistent, flavor-only status for the victim's Effects panel. */
export function makePoisonedEffect(poison: PoisonSpec, weaponName: string): ActiveEffect {
  return {
    id: `poison-${poison.type.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: 'other',
    poisonType: poison.type,
    poisonCount: 1,
    name: poisonEffectName(poison.type),
    description: poison.effectText,
    notes: [
      `Source: ${weaponName}`,
      poison.effectText,
      'Flavor only — this status does not modify combat automatically.',
    ],
    isActive: true,
  };
}

/** Consolidate another exposure into an existing flavor-only poison status. */
export function mergePoisonedEffect(existing: ActiveEffect, incoming: ActiveEffect): ActiveEffect {
  if (!existing.poisonType || existing.poisonType !== incoming.poisonType) return existing;
  const count = Math.max(1, existing.poisonCount ?? 1) + Math.max(1, incoming.poisonCount ?? 1);
  const newSources = (incoming.notes ?? []).filter(note => note.startsWith('Source:'));
  return {
    ...existing,
    poisonCount: count,
    name: poisonEffectName(existing.poisonType, count),
    notes: [...(existing.notes ?? []), ...newSources],
  };
}