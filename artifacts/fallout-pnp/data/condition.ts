// ─── Weapon Condition — Fallout PnP 2.0 manual ───────────────────────────────
// Every weapon has 10 condition boxes. `conditionBoxes` in WeaponAmmoState
// counts FILLED boxes (0 = pristine, 10 = jammed/broken).
//  • 8 or 9 boxes filled → −10% to hit.
//  • 10 boxes filled → the weapon is jammed/busted and cannot fire.
//  • A miss fills 1 box; a repair clears 2 boxes (house rules from the table).

export const CONDITION_BOXES_MAX = 10;

export function clampConditionBoxes(filled: number): number {
  return Math.max(0, Math.min(CONDITION_BOXES_MAX, Math.round(filled)));
}

/** To-hit penalty from condition (negative number or 0). */
export function conditionToHitPenalty(filledBoxes: number): number {
  const f = clampConditionBoxes(filledBoxes);
  if (f >= CONDITION_BOXES_MAX) return 0; // can't fire at all — penalty moot
  return f >= 8 ? -10 : 0;
}

export function isWeaponJammed(filledBoxes: number): boolean {
  return clampConditionBoxes(filledBoxes) >= CONDITION_BOXES_MAX;
}

export function conditionLabel(filledBoxes: number): string {
  const f = clampConditionBoxes(filledBoxes);
  if (f >= CONDITION_BOXES_MAX) return 'JAMMED / BROKEN';
  if (f >= 8) return 'Poor (−10% to hit)';
  if (f >= 4) return 'Worn';
  return 'Good';
}
