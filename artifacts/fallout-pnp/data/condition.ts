import type { Character } from '../context/types.ts';

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

/** Every confirmed critical failure degrades the attacking weapon by 10%. */
export function conditionAfterCriticalFailure(filledBoxes: number): number {
  return clampConditionBoxes(filledBoxes + 1);
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

type ConditionSemanticsState = {
  conditionSemanticsV2?: boolean;
  characters?: Character[];
};

/** Mark newly-created state as using filled-box condition semantics. */
export function markConditionSemanticsV2<T extends object>(state: T): T & { conditionSemanticsV2: true } {
  return { ...state, conditionSemanticsV2: true };
}

/** One-time migration from legacy 0–5 remaining boxes to current 0–10 filled boxes. */
export function migrateConditionSemantics<T extends ConditionSemanticsState>(
  parsed: T,
): T & { conditionSemanticsV2: true } {
  if (parsed.conditionSemanticsV2) return parsed as T & { conditionSemanticsV2: true };
  const migrate = (character: Character): Character => ({
    ...character,
    weaponAmmoStates: (character.weaponAmmoStates ?? []).map(state => ({
      ...state,
      conditionBoxes: Math.max(0, Math.min(10, (5 - Math.max(0, Math.min(5, state.conditionBoxes ?? 5))) * 2)),
    })),
  });
  return {
    ...parsed,
    characters: (parsed.characters ?? []).map(migrate),
    conditionSemanticsV2: true,
  } as T & { conditionSemanticsV2: true };
}
