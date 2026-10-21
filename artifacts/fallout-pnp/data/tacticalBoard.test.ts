import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boardTokenFor, burstCorridor, cellDistance, cellPoint, createTacticalBoard, footprint,
  isBoardImage, isTacticalBoard, makeBoardToken, planDriving, planWalking, pointCell,
  resolveDrivingRound, tokenDistance,
} from './tacticalBoard.ts';
import { BUILT_IN_VEHICLES, spawnVehicleCharacter } from './vehicles.ts';
import { createCampaignBundle, parseCampaignFile, restoreCampaignPortraits } from './portableExports.ts';
import type { Character, Injury } from '../context/types.ts';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1iAAAAAASUVORK5CYII=';
const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const vehicle = BUILT_IN_VEHICLES.find(v => v.topSpeedKph !== null && (v.accelerationKphPerRound ?? 0) >= 10
  && (v.brakingKphPerRound ?? 0) >= 10 && (v.turningRadiusMeters ?? 0) > 0)!;
const driver: Character = { ...spawnVehicleCharacter(vehicle, 'driver'), vehicle: undefined, race: 'human',
  currentAP: 20, type: 'pc', position: 'standing', injuries: [], perks: [] };
const token = makeBoardToken(driver.id, { q: 0, r: 0 });
const board = createTacticalBoard();
const input = { speedKph: 10, maneuver: 'straight' as const, pilotSkill: 75, terrainModifier: 0,
  weatherModifier: 0, night: false, driverAttacked: false, round: 1 };

test('default board is valid, hex-based, and uses manual one-meter hexes', () => {
  assert.equal(board.grid, 'hex'); assert.equal(board.metersPerCell, 1);
  assert.ok(isTacticalBoard(board));
});
test('pixel/grid transforms round-trip in every quadrant for both grids', () => {
  for (const grid of ['hex', 'square'] as const) for (let q = -7; q <= 7; q++) for (let r = -7; r <= 7; r++) {
    const p = cellPoint({ q, r }, grid, 37);
    assert.deepEqual(pointCell(p.x, p.y, grid, 37), { q, r });
  }
});
test('hex uses axial distance; square supports adjacent diagonal movement', () => {
  assert.equal(cellDistance({ q: 0, r: 0 }, { q: 2, r: 2 }, 'hex'), 4);
  assert.equal(cellDistance({ q: 0, r: 0 }, { q: 2, r: 2 }, 'square'), 2);
});
test('range measures nearest footprint cells and respects physical scale', () => {
  const big = { ...makeBoardToken('v', { q: 4, r: 0 }, true), width: 3, length: 1 };
  assert.equal(footprint(big, 'hex').length, 3);
  assert.equal(tokenDistance(token, big, { ...board, metersPerCell: 5 }), 15);
});
test('passenger location is inherited from the assigned vehicle', () => {
  const v = { ...spawnVehicleCharacter(vehicle, 'vehicle'), vehicleCrew: { pilotCharacterId: 'driver' } };
  const vt = makeBoardToken(v.id, { q: 9, r: 8 }, true);
  const b = { ...board, tokens: [token, vt] };
  assert.equal(boardTokenFor('driver', b, [driver, v]), vt);
  assert.equal(boardTokenFor('driver', b, [driver, { ...v, vehicleCrew: {} }]), token);
});
test('walking charges AP for posture, terrain and meters, not displayed cells', () => {
  assert.equal(planWalking(driver, token, { q: 3, r: 0 }, board, '1:driver').cost, 3);
  assert.equal(planWalking({ ...driver, position: 'crouching' }, token, { q: 3, r: 0 }, board, '1:driver').cost, 6);
  assert.equal(planWalking({ ...driver, position: 'prone' }, token, { q: 2, r: 0 }, board, '1:driver').cost, 8);
  assert.equal(planWalking(driver, token, { q: 1, r: 0 }, { ...board, metersPerCell: 5, movementTerrain: 2 }, '1:driver').cost, 10);
  assert.throws(() => planWalking({ ...driver, currentAP: 1 }, token, { q: 2, r: 0 }, board, '1:driver'), /AP/);
});
test('Bonus Move free distance is consumed across moves, then restored on next turn', () => {
  const c = { ...driver, perks: [{ perkId: 'bonus_move', rank: 1 }] };
  const first = planWalking(c, token, { q: 2, r: 0 }, board, '1:driver');
  assert.equal(first.cost, 0);
  assert.equal(planWalking(c, first.token, { q: 3, r: 0 }, board, '1:driver').cost, 1);
  assert.equal(planWalking(c, first.token, { q: 3, r: 0 }, board, '2:driver').cost, 0);
});
test('injured legs affect cost and both crippled legs cap total movement per turn', () => {
  const leg: Injury = { id: 'leg1', location: 'leftLeg', severity: 'crippled', description: '', toHitPenalty: 0, skillPenalty: {}, movementPenalty: 0, isActive: true };
  assert.equal(planWalking({ ...driver, injuries: [leg] }, token, { q: 2, r: 0 }, board, '1:driver').cost, 4);
  const c = { ...driver, injuries: [leg, { ...leg, id: 'leg2', location: 'rightLeg' as const }] };
  const first = planWalking(c, token, { q: 1, r: 0 }, board, '1:driver');
  assert.throws(() => planWalking(c, first.token, { q: 2, r: 0 }, board, '1:driver'), /one meter/);
});
test('burst is one cell followed by a three-wide corridor, never a widening cone', () => {
  const corridor = burstCorridor(token, { q: 12, r: 0 }, 'hex', 12);
  assert.equal(corridor.length, 34);
  assert.ok(corridor.some(c => c.q === 1 && c.r === 0));
  assert.ok(!corridor.some(c => Math.abs(c.r) > 1));
  assert.deepEqual(burstCorridor(token, token, 'hex', 10), []);
});
test('driving previews use manual KPH-to-meters conversion and acceleration limits', () => {
  const vt = makeBoardToken('v', token, true);
  const path = planDriving(vt, vehicle, input, board);
  assert.equal(path.cells.length, 27);
  assert.deepEqual(path.cells.at(-1), { q: 27, r: 0 });
  assert.equal(path.target, 65 + vehicle.terrainPilotModifier - (vehicle.category === 'motorcycle' ? 10 : 0) - (vehicle.id === 'ultralight' ? 50 : 0));
  assert.throws(() => planDriving(vt, vehicle, { ...input, speedKph: 2001 }, board), /top speed/);
  assert.throws(() => planDriving({ ...vt, lastMovedRound: 1 }, vehicle, input, board), /already moved/);
});
test('driving modifiers stack and already-recorded driver attacks do not apply twice', () => {
  const vt = makeBoardToken('v', token, true);
  const plain = planDriving(vt, vehicle, input, board);
  const penalized = planDriving({ ...vt, driverAttackedRound: 1 }, vehicle, { ...input, night: true, weatherModifier: -20, driverAttacked: true }, board);
  assert.equal(penalized.target, Math.max(0, plain.target - 50));
  assert.equal(penalized.driverAttackPenalty, true);
});
test('deployed Ultralights keep the manual Pilot penalty after receiving an instance ID', () => {
  const source = BUILT_IN_VEHICLES.find(v => v.id === 'ultralight')!;
  const deployed = spawnVehicleCharacter(source, 'ultralight-instance').vehicle!;
  const vt = makeBoardToken('flight', token, true);
  assert.equal(planDriving(vt, source, input, board).target, planDriving(vt, deployed, input, board).target);
});
test('disabled propulsion permits GM coasting but never acceleration; broken controls cannot steer', () => {
  const vt = { ...makeBoardToken('v', token, true), speedKph: 10 };
  const engineOut = { ...vehicle, systems: vehicle.systems.map(s => s.kind === 'engine' ? { ...s, currentHp: 0 } : s) };
  assert.ok(planDriving(vt, engineOut, { ...input, speedKph: 5 }, board).cells.length > 0);
  assert.throws(() => planDriving(vt, engineOut, { ...input, speedKph: 11 }, board), /no acceleration/);
  const controlsOut = { ...vehicle, systems: vehicle.systems.map(s => s.kind === 'controls' ? { ...s, currentHp: 0 } : s) };
  assert.throws(() => planDriving(vt, controlsOut, { ...input, maneuver: 'left' }, board), /no steering/);
});
test('round end waits for all checks, moves successful vehicles together, and is idempotent', () => {
  const vt = makeBoardToken('v', token, true);
  const path = planDriving(vt, vehicle, input, board);
  const waiting = { ...board, tokens: [{ ...vt, path }] };
  assert.throws(() => resolveDrivingRound(waiting, 1), /every queued/);
  const checked = { ...board, tokens: [
    { ...vt, path: { ...path, check: 'success' as const } },
    { ...makeBoardToken('v2', { q: 5, r: 2 }, true), path: { ...path, check: 'failure' as const } },
  ] };
  const done = resolveDrivingRound(checked, 1);
  assert.equal(done.tokens[0].q, 27); assert.equal(done.tokens[0].speedKph, 10);
  assert.equal(done.tokens[1].q, 5); assert.equal(done.tokens[1].speedKph, 0);
  assert.deepEqual(resolveDrivingRound(done, 1), done);
});
test('moving vehicles cannot skip a new round’s path, and damage invalidates unsafe plans', () => {
  const vc = spawnVehicleCharacter(vehicle, 'v');
  const vt = { ...makeBoardToken(vc.id, token, true), speedKph: 10 };
  assert.throws(() => resolveDrivingRound({ ...board, tokens: [vt] }, 2, [vc]), /Every moving vehicle/);
  const path = planDriving({ ...vt, speedKph: 0 }, vehicle, input, board);
  const damaged = { ...vc, vehicle: { ...vehicle, topSpeedKph: 0 } };
  assert.throws(() => resolveDrivingRound({ ...board, tokens: [{ ...vt, path: { ...path, check: 'success' } }] }, 1, [damaged]), /condition changed/);
});
test('board assets accept transparent PNG and animated GIF but reject unsafe or oversized content', () => {
  assert.ok(isBoardImage(png)); assert.ok(isBoardImage(gif));
  assert.equal(isBoardImage('https://example.com/tracking.png'), false);
  assert.equal(isBoardImage('data:image/png;base64,SGVsbG8='), false);
  assert.equal(isBoardImage('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isTacticalBoard({ ...board, metersPerCell: NaN }), false);
  assert.equal(isTacticalBoard({ ...board, tokens: [token, token] }), false);
  assert.equal(isTacticalBoard({ ...board, backgroundDataUri: 'file:///device/map.png' }), false);
});
test('campaign JSON round-trips board skins, terrain, obstacles, queued paths and crew links', async () => {
  const vc = { ...spawnVehicleCharacter(vehicle, 'v'), vehicleCrew: { pilotCharacterId: driver.id } };
  const vt = { ...makeBoardToken(vc.id, { q: 4, r: 2 }, true), imageDataUri: gif };
  const tacticalBoard = { ...board, backgroundDataUri: png, tokens: [{ ...vt, path: planDriving(vt, vehicle, input, board) }],
    obstacles: [{ id: 'obstacle', name: 'Rock', q: 2, r: 3, width: 2, length: 2, facing: 45, imageDataUri: png }] };
  const state = { campaignName: 'Tactical regression', tacticalBoard, characters: [driver, vc], customWeapons: [], customArmor: [], customAmmo: [],
    customBestiaryTemplates: [], initiativeEntries: [], currentRound: 1, combatActive: false, activeEntryId: null };
  const bundle = createCampaignBundle(state, []);
  const parsed = parseCampaignFile(JSON.stringify(bundle));
  assert.ok(parsed.ok);
  if (!parsed.ok || parsed.source !== 'portable') return assert.fail('Expected portable campaign bundle');
  const restored = await restoreCampaignPortraits(parsed.bundle, async () => { throw new Error('No external assets expected'); });
  assert.deepEqual(restored.state.tacticalBoard, tacticalBoard);
  assert.equal(restored.state.characters[1].vehicleCrew?.pilotCharacterId, driver.id);
  const invalid = structuredClone(bundle);
  invalid.state.tacticalBoard!.tokens[0].imageDataUri = 'file:///another-device.png';
  assert.equal(parseCampaignFile(JSON.stringify(invalid)).ok, false);
  assert.equal(parseCampaignFile(JSON.stringify({ ...state, tacticalBoard: undefined })).ok, true);
});
