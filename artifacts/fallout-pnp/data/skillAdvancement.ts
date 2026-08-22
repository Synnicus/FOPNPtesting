export interface SkillPointOperationInput {
  currentValue: number;
  baseValue: number;
  unspentSkillPoints: number;
  tagged: boolean;
  direction: 1 | -1;
}

export interface SkillPointOperationResult {
  skillValue: number;
  unspentSkillPoints: number;
  changed: boolean;
}

/**
 * Tags are chosen before spending skill points. Changing a tag after an
 * allocation would revalue an already-purchased skill offset (+1 per point
 * versus +2 per point) and can create or destroy skill points on refund.
 */
export function canChangeSkillTags(currentValues: readonly number[], baseValues: readonly number[]): boolean {
  return currentValues.every((value, index) => value <= (baseValues[index] ?? value));
}

/** Preserve the purchased offset when a SPECIAL or race change moves a skill's base. */
export function rebaseSkillValue(currentValue: number, oldBaseValue: number, newBaseValue: number): number {
  return newBaseValue + (currentValue - oldBaseValue);
}

/** Keep spent points constant when Intelligence, race, or level changes the total pool. */
export function reconcileUnspentSkillPoints(
  currentUnspent: number,
  oldTotal: number,
  newTotal: number,
): number {
  // Preserve a signed debt when the new pool is smaller than points already
  // spent. Clamping to zero would discard that debt and let later refunds mint
  // points beyond the new total.
  return currentUnspent + (newTotal - oldTotal);
}

/**
 * Apply one skill-point operation.
 *
 * One operation always spends/refunds exactly one point. A normal skill changes
 * by 1%; a tagged skill changes by 2%. Legacy odd offsets are refunded without
 * ever crossing below the current SPECIAL-derived base value.
 */
export function applySkillPointOperation({
  currentValue,
  baseValue,
  unspentSkillPoints,
  tagged,
  direction,
}: SkillPointOperationInput): SkillPointOperationResult {
  const step = tagged ? 2 : 1;

  if (direction > 0) {
    if (unspentSkillPoints <= 0) {
      return { skillValue: currentValue, unspentSkillPoints, changed: false };
    }
    return {
      skillValue: currentValue + step,
      unspentSkillPoints: unspentSkillPoints - 1,
      changed: true,
    };
  }

  const purchasedOffset = Math.max(0, currentValue - baseValue);
  if (purchasedOffset === 0) {
    return { skillValue: currentValue, unspentSkillPoints, changed: false };
  }

  return {
    skillValue: currentValue - Math.min(step, purchasedOffset),
    unspentSkillPoints: unspentSkillPoints + 1,
    changed: true,
  };
}