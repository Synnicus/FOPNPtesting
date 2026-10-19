import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAreaDamageZones,
  EXPLOSIVE_AMMO_AREA_PROFILES,
  MINE_TRAP_AOE_PROFILES,
  normalizeAreaProfileRangeOverrides,
  resolveAreaZoneTarget,
} from './areaEffects.ts';

test('mine zones include every component whose range reaches that zone', () => {
  const profile = MINE_TRAP_AOE_PROFILES.find(candidate => candidate.id === 'trap:t13_antipersonnel_mine');
  assert.ok(profile);
  const zones = buildAreaDamageZones(profile, {}, { main: 22, fragmentation: 4, concussion: 5 });

  assert.deepEqual(zones.map(zone => [zone.minDistance, zone.maxDistance]), [[0, 0], [1, 1], [2, 3]]);
  assert.deepEqual(zones[0].effects.map(effect => effect.id), ['main', 'fragmentation', 'concussion']);
  assert.deepEqual(zones[1].effects.map(effect => effect.id), ['fragmentation', 'concussion']);
  assert.deepEqual(zones[2].effects.map(effect => effect.id), ['concussion']);
});

test('mortar zones stack the 20m blast with concussion through 50m', () => {
  const profile = EXPLOSIVE_AMMO_AREA_PROFILES.find(candidate => candidate.id === 'ammo:51mm_explosive_mortar');
  assert.ok(profile);
  const zones = buildAreaDamageZones(profile, {}, { main: 30, concussion: 3 });

  assert.deepEqual(zones.map(zone => [zone.minDistance, zone.maxDistance]), [[0, 20], [21, 50]]);
  assert.deepEqual(zones[0].effects.map(effect => effect.id), ['main', 'concussion']);
  assert.deepEqual(zones[1].effects.map(effect => effect.id), ['concussion']);
  assert.equal(zones[1].effects[0].rawDamage, 3);
});

test('profiles without manual ranges need campaign overrides before zones can be assigned', () => {
  const profile = EXPLOSIVE_AMMO_AREA_PROFILES.find(candidate => candidate.id === 'ammo:rocket_explosive');
  assert.ok(profile);
  assert.equal(buildAreaDamageZones(profile, {}, { main: 12 }).length, 0);

  const ranges = normalizeAreaProfileRangeOverrides({ [profile.id]: { main: 35, invalid: -1 } });
  const zones = buildAreaDamageZones(profile, ranges, { main: 12 });
  assert.equal(zones.length, 1);
  assert.equal(zones[0].label, '0–35 m');
  assert.deepEqual(ranges[profile.id], { main: 35 });
});

test('one assigned zone resolves all stacked damage effects in one result', () => {
  const profile = EXPLOSIVE_AMMO_AREA_PROFILES.find(candidate => candidate.id === 'ammo:51mm_explosive_mortar');
  assert.ok(profile);
  const zone = buildAreaDamageZones(profile, {}, { main: 10, concussion: 2 })[0];
  const result = resolveAreaZoneTarget(zone, {
    id: 'target-1',
    name: 'Target',
    endurance: 5,
    gasInhaledResistance: 0,
    gasContactResistance: 0,
    electricityResistance: 0,
    dt: 0,
    dr: 0,
    protectionByType: {
      normal: { dt: 0, dr: 0 },
      laser: { dt: 0, dr: 0 },
      fire: { dt: 0, dr: 0 },
      plasma: { dt: 0, dr: 0 },
      explosion: { dt: 0, dr: 0 },
    },
  }, () => 100, sides => sides);

  assert.equal(result.damage, 12);
  assert.equal(result.zoneId, zone.id);
  assert.equal(result.zoneLabel, zone.label);
});
