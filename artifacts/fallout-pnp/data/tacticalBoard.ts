import type { Character, VehicleProfile } from '../context/types.ts';
import { resolveVehiclePerformance, vehicleSystemStatus } from './vehicles.ts';
import { computeInjuryEffects } from './injuries.ts';

export interface BoardCell { q: number; r: number }
export type BoardGrid = 'hex' | 'square';
export interface BoardPath {
  round: number;
  speedKph: number;
  maneuver: 'straight' | 'left' | 'right';
  cells: BoardCell[];
  facing: number;
  check: 'pending' | 'success' | 'failure';
  roll?: number;
  target: number;
  driverAttackPenalty?: boolean;
}
export interface BoardToken extends BoardCell {
  characterId: string;
  width: number;
  length: number;
  facing: number;
  imageDataUri?: string;
  /** Vehicle-only top-down map icon; separate from its side-view standee. */
  mapIconDataUri?: string;
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  /** Board-only 3D replacement; embedded in campaign JSON for portability. */
  modelDataUri?: string;
  modelFormat?: 'glb' | 'stl';
  modelName?: string;
  modelScale?: number;
  speedKph: number;
  path?: BoardPath;
  lastMovedRound?: number;
  movementTurn?: string;
  movedMeters?: number;
  driverAttackedRound?: number;
}
export interface BoardObstacle extends BoardCell {
  id: string;
  name: string;
  imageDataUri: string;
  width: number;
  length: number;
  facing: number;
}
export interface TacticalBoard {
  version: 1;
  grid: BoardGrid;
  metersPerCell: number;
  columns: number;
  rows: number;
  backgroundDataUri?: string;
  backgroundScale: number;
  tokens: BoardToken[];
  obstacles: BoardObstacle[];
  movementTerrain: 1 | 2 | 3;
}
export const MAX_BOARD_ASSET_LENGTH = 6_000_000;
export const MAX_BOARD_TOTAL_ASSETS = 18_000_000;
/** 1.5 MB file limit before base64 encoding; keeps mobile scene memory bounded. */
export const MAX_BOARD_MODEL_BYTES = 1_500_000;
export const MAX_BOARD_MODEL_LENGTH = 2_100_000;
export const MAX_BOARD_MODEL_TRIANGLES = 25_000;
export const createTacticalBoard = (): TacticalBoard => ({
  version: 1, grid: 'hex', metersPerCell: 1, columns: 80, rows: 60,
  backgroundScale: 1, tokens: [], obstacles: [], movementTerrain: 1,
});
export function isBoardImage(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_BOARD_ASSET_LENGTH) return false;
  const match = value.match(/^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/]+={0,2})$/i);
  if (!match || match[2].length % 4 !== 0) return false;
  // Verify the file header too; a MIME label alone is not validation.
  const header = match[2].slice(0, 16);
  return match[1].toLowerCase() === 'png' ? header.startsWith('iVBORw0KGgo')
    : match[1].toLowerCase() === 'jpeg' ? header.startsWith('/9j/')
      : match[1].toLowerCase() === 'gif' ? /^R0lGOD[dl]h/.test(header)
        : header.startsWith('UklGR');
}
export function isBoardModel(value: unknown, format: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_BOARD_MODEL_LENGTH) return false;
  if (format !== 'glb' && format !== 'stl') return false;
  const mime = format === 'glb' ? 'model/gltf-binary' : 'model/stl';
  const match = value.match(new RegExp(`^data:${mime};base64,([a-z0-9+/]+={0,2})$`, 'i'));
  return !!match && match[1].length % 4 === 0;
}
const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const cellValid = (v: BoardCell) => v && Number.isInteger(v.q) && Number.isInteger(v.r) && finite(v.q, -4096, 4096) && finite(v.r, -4096, 4096);
export function isTacticalBoard(value: unknown): value is TacticalBoard {
  if (!value || typeof value !== 'object') return false;
  const b = value as TacticalBoard;
  if (b.version !== 1 || !['hex', 'square'].includes(b.grid)
    || !finite(b.metersPerCell, 0.25, 100) || !finite(b.columns, 10, 200) || !finite(b.rows, 10, 200)
    || !Number.isInteger(b.columns) || !Number.isInteger(b.rows)
    || !finite(b.backgroundScale, 0.1, 10) || ![1, 2, 3].includes(b.movementTerrain)
    || (b.backgroundDataUri !== undefined && !isBoardImage(b.backgroundDataUri))
    || !Array.isArray(b.tokens) || b.tokens.length > 200
    || !Array.isArray(b.obstacles) || b.obstacles.length > 100) return false;
  const shape = (t: BoardToken | BoardObstacle) => cellValid(t)
    && finite(t.width, 1, 20) && finite(t.length, 1, 20)
    && Number.isInteger(t.width) && Number.isInteger(t.length) && finite(t.facing, -3600, 3600)
    && (t.imageDataUri === undefined || isBoardImage(t.imageDataUri));
  if (!b.tokens.every(t => t && shape(t) && typeof t.characterId === 'string' && t.characterId.length > 0
    && (t.mapIconDataUri === undefined || isBoardImage(t.mapIconDataUri))
    && (t.modelDataUri === undefined || isBoardModel(t.modelDataUri, t.modelFormat))
    && (t.modelFormat === undefined || t.modelFormat === 'glb' || t.modelFormat === 'stl')
    && (t.modelName === undefined || (typeof t.modelName === 'string' && t.modelName.length <= 60))
    && (t.modelScale === undefined || finite(t.modelScale, 0.2, 3))
    && finite(t.speedKph, 0, 2000) && (t.lastMovedRound === undefined || (Number.isInteger(t.lastMovedRound) && t.lastMovedRound >= 0))
    && (t.movementTurn === undefined || typeof t.movementTurn === 'string')
    && (t.movedMeters === undefined || finite(t.movedMeters, 0, 100000))
    && (t.driverAttackedRound === undefined || (Number.isInteger(t.driverAttackedRound) && t.driverAttackedRound >= 0))
    && (t.imageScale === undefined || finite(t.imageScale, 0.25, 4))
    && (t.imageOffsetX === undefined || finite(t.imageOffsetX, -1, 1))
    && (t.imageOffsetY === undefined || finite(t.imageOffsetY, -1, 1))
    && (t.path === undefined || (Number.isInteger(t.path.round) && t.path.round >= 1
      && finite(t.path.speedKph, 0, 2000) && ['straight', 'left', 'right'].includes(t.path.maneuver)
      && finite(t.path.facing, -3600, 3600) && finite(t.path.target, 0, 200)
      && ['pending', 'success', 'failure'].includes(t.path.check)
      && (t.path.driverAttackPenalty === undefined || typeof t.path.driverAttackPenalty === 'boolean')
      && (t.path.roll === undefined || (Number.isInteger(t.path.roll) && finite(t.path.roll, 1, 100)))
      && Array.isArray(t.path.cells) && t.path.cells.length > 0 && t.path.cells.length <= 1024 && t.path.cells.every(cellValid))))) return false;
  if (!b.obstacles.every(o => o && shape(o) && isBoardImage(o.imageDataUri) && typeof o.id === 'string' && typeof o.name === 'string')) return false;
  if (new Set(b.tokens.map(t => t.characterId)).size !== b.tokens.length || new Set(b.obstacles.map(o => o.id)).size !== b.obstacles.length) return false;
  return (b.backgroundDataUri?.length ?? 0) + [...b.tokens, ...b.obstacles].reduce((n, t) =>
    n + (t.imageDataUri?.length ?? 0) + ('mapIconDataUri' in t ? t.mapIconDataUri?.length ?? 0 : 0)
      + ('modelDataUri' in t ? t.modelDataUri?.length ?? 0 : 0), 0) <= MAX_BOARD_TOTAL_ASSETS;
}
export function makeBoardToken(
  characterId: string,
  cell: BoardCell,
  vehicle = false,
  vehicleFootprint?: { width: number; length: number },
): BoardToken {
  return {
    characterId, q: cell.q, r: cell.r,
    width: vehicle ? Math.max(1, Math.floor(vehicleFootprint?.width ?? 2)) : 1,
    length: vehicle ? Math.max(1, Math.floor(vehicleFootprint?.length ?? 3)) : 1,
    facing: 0, speedKph: 0,
  };
}
/** Hex size is center-to-center spacing across a hex; default one meter. */
export function cellPoint(c: BoardCell, grid: BoardGrid, size = 1): { x: number; y: number } {
  return grid === 'hex' ? { x: size * (c.q + c.r / 2), y: size * Math.sqrt(3) / 2 * c.r } : { x: size * c.q, y: size * c.r };
}
export function pointCell(x: number, y: number, grid: BoardGrid, size = 1): BoardCell {
  if (grid === 'square') return { q: Math.round(x / size) || 0, r: Math.round(y / size) || 0 };
  const r = y / size * 2 / Math.sqrt(3), q = x / size - r / 2;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(-q - r);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs + q + r);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq || 0, r: rr || 0 };
}
/** Square-grid movement uses adjacent diagonals (Chebyshev); UI states this explicitly. */
export function cellDistance(a: BoardCell, b: BoardCell, grid: BoardGrid): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return grid === 'hex' ? Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) : Math.max(Math.abs(dq), Math.abs(dr));
}
export function footprint(token: BoardToken, grid: BoardGrid): BoardCell[] {
  const center = cellPoint(token, grid);
  const angle = token.facing * Math.PI / 180;
  const result: BoardCell[] = [];
  for (let x = 0; x < token.width; x++) for (let y = 0; y < token.length; y++) {
    const p = cellPoint({ q: x - Math.floor(token.width / 2), r: y - Math.floor(token.length / 2) }, grid);
    const c = pointCell(center.x + p.x * Math.cos(angle) - p.y * Math.sin(angle), center.y + p.x * Math.sin(angle) + p.y * Math.cos(angle), grid);
    if (!result.some(v => v.q === c.q && v.r === c.r)) result.push(c);
  }
  return result;
}
export function tokenDistance(a: BoardToken, b: BoardToken, board: TacticalBoard): number {
  return Math.min(...footprint(a, board.grid).flatMap(c => footprint(b, board.grid).map(d => cellDistance(c, d, board.grid)))) * board.metersPerCell;
}
/** Crew remain real characters; their tactical position is inherited, not copied. */
export function boardTokenFor(id: string, board: TacticalBoard, characters: readonly Character[]): BoardToken | undefined {
  const vehicle = characters.find(c => !c.inStorage && c.vehicle && (c.vehicleCrew?.pilotCharacterId === id || c.vehicleCrew?.gunnerCharacterId === id));
  return board.tokens.find(t => t.characterId === (vehicle?.id ?? id));
}
export function movementAP(character: Character, from: BoardCell, to: BoardCell, board: TacticalBoard): number {
  const multiplier = character.position === 'prone' ? 4 : character.position === 'crouching' ? 2 : 1;
  return Math.ceil(cellDistance(from, to, board.grid) * board.metersPerCell * multiplier * board.movementTerrain);
}
export function planWalking(character: Character, token: BoardToken, cell: BoardCell, board: TacticalBoard, turn: string) {
  if (character.vehicle || character.combatDevice || character.currentHp <= 0 || character.isKnockedOut) throw new Error('This combatant cannot walk.');
  const meters = cellDistance(token, cell, board.grid) * board.metersPerCell;
  const alreadyMoved = token.movementTurn === turn ? token.movedMeters ?? 0 : 0;
  const injury = computeInjuryEffects(character);
  if (injury.oneHexPerRound && alreadyMoved + meters > 1) throw new Error('Both legs are crippled: maximum movement is one meter per turn.');
  const free = (character.perks?.find(p => p.perkId === 'bonus_move')?.rank ?? 0) * 2;
  const freeRemaining = Math.max(0, free - alreadyMoved);
  const rate = movementAP(character, { q: 0, r: 0 }, { q: 1, r: 0 }, { ...board, metersPerCell: 1 });
  const cost = Math.ceil(Math.max(0, meters - freeRemaining) * rate * injury.movementApMultiplier);
  if (cost > character.currentAP) throw new Error(`Movement requires ${cost} AP; only ${character.currentAP} remain.`);
  return { cost, token: { ...token, ...cell, movementTurn: turn, movedMeters: alreadyMoved + meters } };
}
/** Printed pp.29–30: first hex narrow, then three hexes wide, NOT a widening triangle. */
export function burstCorridor(source: BoardCell, target: BoardCell, grid: BoardGrid, rangeCells: number): BoardCell[] {
  const a = cellPoint(source, grid), b = cellPoint(target, grid);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  if (!distance) return [];
  const ux = (b.x - a.x) / distance, uy = (b.y - a.y) / distance;
  const result: BoardCell[] = [];
  const count = Math.min(512, Math.max(1, Math.ceil(rangeCells)));
  for (let step = 1; step <= count; step++) {
    for (const lateral of step === 1 ? [0] : [-1, 0, 1]) {
      const forward = grid === 'hex' && lateral ? step - 0.5 : step;
      const side = grid === 'hex' ? lateral * Math.sqrt(3) / 2 : lateral;
      const p = pointCell(a.x + ux * forward - uy * side, a.y + uy * forward + ux * side, grid);
      if (!result.some(c => c.q === p.q && c.r === p.r) && cellDistance(source, p, grid) <= count) result.push(p);
    }
  }
  return result;
}
export const PILOT_TERRAINS = [
  { label: 'Unbroken road', modifier: 30 }, { label: 'Broken road', modifier: 15 },
  { label: 'Bad road / open field', modifier: 0 }, { label: 'Scrub / debris', modifier: -5 },
  { label: 'Obstacles / wet streets', modifier: -10 }, { label: 'Light forest / wet fields', modifier: -20 },
  { label: 'Muddy ground', modifier: -25 }, { label: 'Drenched ground / wet sand', modifier: -30 },
  { label: 'Calm seas', modifier: 20 }, { label: 'Gentle waves', modifier: 0 },
  { label: 'Rolling waves', modifier: -5 }, { label: 'Big waves', modifier: -15 },
  { label: 'Stormy waves', modifier: -25 }, { label: 'Hurricane waves', modifier: -50 },
  { label: 'Calm air', modifier: 0 }, { label: 'Gentle breeze', modifier: -5 },
  { label: 'Gusty winds', modifier: -10 }, { label: 'Strong winds', modifier: -20 }, { label: 'Stormy winds', modifier: -40 },
] as const;
export interface DrivingInput {
  speedKph: number;
  maneuver: BoardPath['maneuver'];
  pilotSkill: number;
  terrainModifier: number;
  weatherModifier: number;
  night: boolean;
  driverAttacked: boolean;
  round: number;
}
export function planDriving(token: BoardToken, vehicle: VehicleProfile, input: DrivingInput, board: TacticalBoard): BoardPath {
  if (token.lastMovedRound === input.round) throw new Error('This vehicle has already moved this round.');
  const v = resolveVehiclePerformance(vehicle);
  const disabled = (kind: string) => v.systems.some(s => s.kind === kind && vehicleSystemStatus(s) !== 'operational');
  if (disabled('tread')) throw new Error('Treads are inoperative. Adjudicate a forced stop and occupant crash before continuing.');
  const coasting = disabled('engine') || disabled('drive');
  if (coasting && input.speedKph > token.speedKph) throw new Error('Propulsion is inoperative: no acceleration. Enter the GM-adjudicated coasting speed.');
  if (disabled('controls') && (input.speedKph !== token.speedKph || input.maneuver !== 'straight')) throw new Error('Controls are inoperative: no steering or voluntary speed changes. Use a straight path or GM adjudication.');
  if ([input.speedKph, input.pilotSkill, input.terrainModifier, input.weatherModifier].some(n => !Number.isFinite(n))) throw new Error('Enter valid driving values.');
  if (v.topSpeedKph === null || v.accelerationKphPerRound === null || v.brakingKphPerRound === null) throw new Error('This vehicle requires GM-adjudicated movement. Use GM placement.');
  if (input.speedKph < 0 || input.speedKph > (disabled('engine') ? token.speedKph : v.topSpeedKph)) throw new Error('Requested speed exceeds the vehicle’s current top speed.');
  if (input.speedKph - token.speedKph > (coasting ? 0 : v.accelerationKphPerRound) || token.speedKph - input.speedKph > v.brakingKphPerRound) throw new Error('Requested speed change exceeds the acceleration or braking rate.');
  if (input.maneuver !== 'straight' && (v.turningRadiusMeters === null || v.turningRadiusMeters <= 0)) throw new Error('This vehicle has no defined turning radius. Use GM placement.');
  const turning = input.maneuver !== 'straight';
  let target = input.pilotSkill + input.terrainModifier + v.terrainPilotModifier + input.weatherModifier;
  if (vehicle.category === 'motorcycle') target -= 10;
  // Deployed vehicles have instance IDs, so preserve the manual model rule by name.
  if (vehicle.id === 'ultralight' || /^ultralight$/i.test(vehicle.name.trim())) target -= 50;
  if (input.night) target -= 10;
  if (input.speedKph > (disabled('engine') ? vehicle.topSpeedKph ?? v.topSpeedKph : v.topSpeedKph) / 2) target -= 10;
  if (input.speedKph > token.speedKph * 2) target -= 10;
  if (input.speedKph < token.speedKph / 2) target -= 15;
  if (turning) target -= Math.floor(input.speedKph / 10) * 10;
  const driverAttackPenalty = input.driverAttacked || token.driverAttackedRound === input.round;
  if (driverAttackPenalty) target -= 20;
  const meters = Math.floor(input.speedKph * 2.78);
  const radius = v.turningRadiusMeters ?? 0;
  if (turning && meters < radius * Math.PI / 2) throw new Error('Insufficient movement distance for a full 90° turn at this turning radius.');
  const start = cellPoint(token, board.grid, board.metersPerCell);
  const angle = token.facing * Math.PI / 180, direction = input.maneuver === 'left' ? -1 : 1;
  const samples = Math.min(1024, Math.max(1, Math.ceil(meters / board.metersPerCell)));
  const cells: BoardCell[] = [];
  for (let i = 1; i <= samples; i++) {
    const d = meters * i / samples, arc = Math.min(d / Math.max(radius, 0.001), Math.PI / 2);
    const arcLength = radius * Math.PI / 2;
    const forward = turning ? radius * Math.sin(arc) : d;
    const sideways = turning ? direction * (radius * (1 - Math.cos(arc)) + Math.max(0, d - arcLength)) : 0;
    cells.push(pointCell(start.x + forward * Math.cos(angle) - sideways * Math.sin(angle), start.y + forward * Math.sin(angle) + sideways * Math.cos(angle), board.grid, board.metersPerCell));
  }
  return { round: input.round, speedKph: input.speedKph, maneuver: input.maneuver, cells, facing: token.facing + (turning ? direction * 90 : 0), check: 'pending', target: Math.max(0, Math.min(200, target)), driverAttackPenalty };
}
/** Resolve only the active vehicle's queued move on its initiative turn. */
export function resolveDrivingVehicleTurn(
  board: TacticalBoard,
  characterId: string,
  round: number,
  characters?: readonly Character[],
): TacticalBoard {
  const token = board.tokens.find(t => t.characterId === characterId);
  if (!token || token.lastMovedRound === round) return board;
  const character = characters?.find(c => c.id === characterId && !c.inStorage);
  const vehicle = character?.vehicle;
  const path = token.path?.round === round ? token.path : undefined;
  if (characters && !vehicle) {
    return {
      ...board,
      tokens: board.tokens.map(t => t.characterId === characterId
        ? { ...t, path: undefined, speedKph: 0, lastMovedRound: round }
        : t),
    };
  }
  if (!path) {
    if (vehicle && token.speedKph > 0) {
      throw new Error('This moving vehicle needs a queued path and completed Pilot check before ending its turn.');
    }
    return {
      ...board,
      tokens: board.tokens.map(t => t.characterId === characterId
        ? { ...t, path: undefined, lastMovedRound: round }
        : t),
    };
  }
  if (path.check === 'pending') throw new Error('Resolve this vehicle’s Pilot check before ending its turn.');
  if (vehicle) {
    const performance = resolveVehiclePerformance(vehicle);
    const disabled = (kind: string) => performance.systems.some(s => s.kind === kind && vehicleSystemStatus(s) !== 'operational');
    const speedLimit = disabled('engine') ? token.speedKph : performance.topSpeedKph ?? Infinity;
    if (disabled('tread') || speedLimit < path.speedKph || ((disabled('engine') || disabled('drive')) && path.speedKph > token.speedKph)
      || (disabled('controls') && (path.maneuver !== 'straight' || path.speedKph !== token.speedKph))) {
      throw new Error('Vehicle condition changed. Replan its movement using its current speed limit or adjudicate a forced stop.');
    }
  }
  const end = path.cells.at(-1);
  if (!end) throw new Error('This vehicle path has no destination.');
  return {
    ...board,
    tokens: board.tokens.map(t => t.characterId !== characterId ? t : path.check === 'success'
      ? { ...t, ...end, facing: path.facing, speedKph: path.speedKph, lastMovedRound: round, path: undefined }
      : { ...t, speedKph: 0, lastMovedRound: round, path: undefined }),
  };
}
