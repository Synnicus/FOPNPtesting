import type { Character } from '@/context/types';
import { makeBoardToken, type TacticalBoard } from '@/data/tacticalBoard';

type Role = 'pilotCharacterId' | 'gunnerCharacterId';
const crewIds = (v: Character) => [v.vehicleCrew?.pilotCharacterId, v.vehicleCrew?.gunnerCharacterId].filter(Boolean) as string[];

/** Characters seated in a deployed vehicle; they are drawn and hit-tested through the vehicle token only. */
export function boardedIds(characters: readonly Character[]): Set<string> {
  return new Set(characters.filter(c => !c.inStorage && c.vehicle).flatMap(crewIds));
}

/** Board tokens that should render: existing, not stored, and not boarded in a vehicle. */
export function visibleTokens(board: TacticalBoard, characters: readonly Character[]) {
  const boarded = boardedIds(characters);
  return board.tokens.filter(t => {
    const ch = characters.find(x => x.id === t.characterId);
    return !!ch && !ch.inStorage && !boarded.has(t.characterId);
  });
}

/**
 * Sets or clears one crew seat. A character can sit in only one seat of one vehicle:
 * earlier seats are detached first. Boarding removes the independent token; leaving restores it at the vehicle.
 */
export function assignCrewExclusive(args: {
  characters: readonly Character[]; vehicleId: string; role: Role; crewId: string | undefined;
  updateCharacter: (c: Character) => void; updateBoard: (fn: (b: TacticalBoard) => TacticalBoard) => void;
}) {
  const { characters, vehicleId, role, crewId } = args;
  const before = boardedIds(characters);
  const changed = new Map<string, Character>();
  for (const v of characters) {
    if (!v.vehicle || v.inStorage) continue;
    let crew = { ...(v.vehicleCrew ?? {}) };
    let dirty = false;
    if (crewId) for (const r of ['pilotCharacterId', 'gunnerCharacterId'] as const) {
      if (crew[r] === crewId && !(v.id === vehicleId && r === role)) { crew = { ...crew, [r]: undefined }; dirty = true; }
    }
    if (v.id === vehicleId) { crew = { ...crew, [role]: crewId }; dirty = true; }
    if (dirty) changed.set(v.id, { ...v, vehicleCrew: crew });
  }
  changed.forEach(c => args.updateCharacter(c));
  const after = new Set<string>();
  for (const v of characters) {
    if (v.inStorage || !v.vehicle) continue;
    (crewIds(changed.get(v.id) ?? v)).forEach(id => after.add(id));
  }
  const released = [...before].filter(id => !after.has(id));
  args.updateBoard(b => {
    let tokens = b.tokens.filter(t => !after.has(t.characterId));
    for (const id of released) {
      if (tokens.some(t => t.characterId === id)) continue;
      const host = characters.find(v => v.vehicle && crewIds(v).includes(id));
      const at = tokens.find(t => t.characterId === host?.id) ?? b.tokens.find(t => t.characterId === vehicleId);
      if (at && characters.some(c => c.id === id && !c.inStorage)) tokens = [...tokens, makeBoardToken(id, { q: at.q, r: at.r })];
    }
    return { ...b, tokens };
  });
}
