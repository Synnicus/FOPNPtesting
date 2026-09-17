import type { ActiveEffect, Weapon } from '../context/types.ts';
import type { AmmoType } from './ammo.ts';
import { computeModEffects, POISON_HOURLY_DAMAGE, type PoisonSpec, type PoisonType } from './mods.ts';

export interface PoisonResistanceResult {
  poison: PoisonSpec;
  roll: number;
  resistance: number;
  applied: boolean;
  bonusDamage: number;
}

/** Roll at or below resistance means the target resists this poison exposure. */
export function resolvePoisonResistance(
  poison: PoisonSpec,
  resistance: number,
  roll: number,
): PoisonResistanceResult {
  const clampedResistance = Math.max(0, Math.min(100, Math.trunc(resistance)));
  const clampedRoll = Math.max(1, Math.min(100, Math.trunc(roll)));
  const applied = clampedRoll > clampedResistance;
  return {
    poison,
    roll: clampedRoll,
    resistance: clampedResistance,
    applied,
    bonusDamage: applied ? POISON_HOURLY_DAMAGE[poison.type] : 0,
  };
}

export function poisonHourlyDamage(type: PoisonType): number {
  return POISON_HOURLY_DAMAGE[type];
}

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
      'The persisted status does not modify later combat automatically.',
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

/** Collapse legacy duplicate poison entries into one counted status per type. */
export function consolidatePoisonedEffects(effects: ActiveEffect[]): ActiveEffect[] {
  return effects.reduce<ActiveEffect[]>((result, effect) => {
    if (!effect.poisonType) {
      result.push(effect);
      return result;
    }
    const existingIndex = result.findIndex(existing => existing.poisonType === effect.poisonType);
    if (existingIndex < 0) {
      const count = Math.max(1, effect.poisonCount ?? 1);
      result.push({ ...effect, poisonCount: count, name: poisonEffectName(effect.poisonType, count) });
      return result;
    }
    result[existingIndex] = mergePoisonedEffect(result[existingIndex], effect);
    return result;
  }, []);
}