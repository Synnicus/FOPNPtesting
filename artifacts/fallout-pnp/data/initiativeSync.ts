import type { Character, InitiativeEntry } from '../context/types.ts';

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
  if (entry.turnKind === 'vehicle') return entry;
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

export function createVehicleInitiativeEntry(
  vehicle: Character,
  driverEntry?: InitiativeEntry,
  id = `init-${vehicle.id}`,
): InitiativeEntry {
  const driverInitiative = driverEntry && driverEntry.turnKind !== 'vehicle'
    ? driverEntry.initiative
    : -1;
  return {
    id,
    characterId: vehicle.id,
    turnKind: 'vehicle',
    driverInitiative,
    name: vehicle.name,
    initiative: driverInitiative,
    sequence: driverEntry?.sequence ?? 0,
    currentAP: 0,
    maxAP: 0,
    currentHp: vehicle.currentHp,
    maxHp: vehicle.maxHp,
    armorClass: vehicle.vehicle?.armorClass ?? vehicle.armorClass,
    tempAC: 0,
    position: vehicle.position,
    hasActed: false,
    isActive: false,
  };
}

/** Refresh vehicle rows from their deployed records and assigned drivers. */
export function syncVehicleInitiativeEntries(
  entries: readonly InitiativeEntry[],
  characters: readonly Character[],
): InitiativeEntry[] {
  const characterEntries = new Map(
    entries.flatMap(entry => entry.turnKind !== 'vehicle' && entry.characterId
      ? [[entry.characterId, entry] as const]
      : []),
  );
  const characterById = new Map(characters.map(character => [character.id, character]));
  return sortInitiativeEntries(entries.map(entry => {
    if (entry.turnKind !== 'vehicle' || !entry.characterId) return entry;
    const vehicle = characterById.get(entry.characterId);
    if (!vehicle) return { ...entry, currentAP: 0, maxAP: 0, tempAC: 0 };
    const driverId = vehicle.vehicleCrew?.pilotCharacterId;
    const driverEntry = driverId ? characterEntries.get(driverId) : undefined;
    const driverInitiative = driverEntry?.initiative ?? -1;
    return {
      ...entry,
      name: vehicle.name,
      initiative: driverInitiative,
      driverInitiative,
      sequence: driverEntry?.sequence ?? 0,
      currentAP: 0,
      maxAP: 0,
      currentHp: vehicle.currentHp,
      maxHp: vehicle.maxHp,
      armorClass: vehicle.vehicle?.armorClass ?? vehicle.armorClass,
      tempAC: 0,
      position: vehicle.position,
    };
  }));
}

export function sortInitiativeEntries(entries: readonly InitiativeEntry[]): InitiativeEntry[] {
  return [...entries].sort((a, b) => {
    const aVehicle = a.turnKind === 'vehicle';
    const bVehicle = b.turnKind === 'vehicle';
    if (aVehicle !== bVehicle) return aVehicle ? 1 : -1;
    if (aVehicle && bVehicle) {
      const aDriverInitiative = a.driverInitiative ?? a.initiative;
      const bDriverInitiative = b.driverInitiative ?? b.initiative;
      if (aDriverInitiative !== bDriverInitiative) return bDriverInitiative - aDriverInitiative;
      if (a.sequence !== b.sequence) return b.sequence - a.sequence;
      return a.name.localeCompare(b.name);
    }
    return b.initiative !== a.initiative
      ? b.initiative - a.initiative
      : b.sequence - a.sequence;
  });
}