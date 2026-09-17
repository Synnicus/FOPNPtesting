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

/** Build a persistent, flavor-only status for the victim's Effects panel. */
export function makePoisonedEffect(poison: PoisonSpec, weaponName: string): ActiveEffect {
  return {
    id: `poison-${poison.type.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: 'other',
    poisonType: poison.type,
    name: `Poisoned (Type ${poison.type})`,
    description: poison.effectText,
    notes: [
      `Source: ${weaponName}`,
      poison.effectText,
      'Flavor only — this status does not modify combat automatically.',
    ],
    isActive: true,
  };
}