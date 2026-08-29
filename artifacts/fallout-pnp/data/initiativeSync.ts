import type { InitiativeEntry } from '../context/types.ts';

export interface InitiativeSheetSnapshot {
  sequence: number;
  maxAP: number;
  armorClass: number;
}

/** Preserve the original d10 component while refreshing sheet-derived values. */
export function syncInitiativeEntrySheet(
  entry: InitiativeEntry,
  sheet: InitiativeSheetSnapshot,
): InitiativeEntry {
  const initiativeRoll = entry.initiative - entry.sequence;
  return {
    ...entry,
    initiative: initiativeRoll + sheet.sequence,
    sequence: sheet.sequence,
    maxAP: sheet.maxAP,
    currentAP: Math.min(entry.currentAP, sheet.maxAP),
    armorClass: sheet.armorClass,
  };
}

export function sortInitiativeEntries(entries: readonly InitiativeEntry[]): InitiativeEntry[] {
  return [...entries].sort((a, b) =>
    b.initiative !== a.initiative ? b.initiative - a.initiative : b.sequence - a.sequence
  );
}