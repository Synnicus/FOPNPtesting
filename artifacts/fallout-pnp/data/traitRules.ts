/**
 * The manual gives Jinxed a 50% relative increase to the normal 3% critical
 * failure chance. A percentile die has no half-percent face, so 96 is the
 * boundary roll: it counts half the time while Jinxed is present.
 */
export function isCriticalFailureRoll(
  roll: number,
  jinxedPresent: boolean,
  boundaryCheck = 1,
): boolean {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) return false;
  if (roll >= 98) return true;
  if (!jinxedPresent) return false;
  if (roll === 97) return true;
  return roll === 96 && boundaryCheck < 0.5;
}

/** Robot armor plates double their existing base damage resistance. */
export function applyTightNutsDamageResistance(
  damageResistance: number,
  baseNaturalResistance: number,
  raceId: string,
  traits: readonly string[] | undefined,
): number {
  const hasTrait = (traits ?? []).some(trait => trait.toLowerCase().replace(/[-\s]+/g, '_') === 'tight_nuts');
  return raceId === 'robot' && hasTrait
    ? damageResistance + Math.max(0, baseNaturalResistance)
    : damageResistance;
}
