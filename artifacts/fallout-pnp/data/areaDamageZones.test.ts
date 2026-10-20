import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAreaDamageZones,
  createCustomAmmoAreaDamageProfiles,
  createCustomWeaponAreaDamageProfiles,
  EXPLOSIVE_AMMO_AREA_PROFILES,
  MINE_TRAP_AOE_PROFILES,
  normalizeAreaProfileRangeOverrides,
  formatAreaResolution,
  resolveAreaZoneTarget,
  THROWN_EXPLOSIVE_AREA_PROFILES,
  VEHICLE_CANNON_AREA_PROFILES,
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

test('manual thrown explosives expose their printed zone boundaries and omitted ranges stay configurable', () => {
  const fragmentation = THROWN_EXPLOSIVE_AREA_PROFILES.find(profile => profile.id === 'grenade:fragmentation')!;
  const fragmentationZones = buildAreaDamageZones(fragmentation, {}, {
    main: 34, fragmentation: 5, concussion: 4,
  });
  assert.deepEqual(fragmentationZones.map(zone => [zone.minDistance, zone.maxDistance]), [[0, 0], [1, 1], [2, 2]]);
  assert.deepEqual(fragmentationZones.map(zone => zone.effects.map(effect => effect.id)), [
    ['main', 'concussion'], ['fragmentation', 'concussion'], ['concussion'],
  ]);

  const pulse = THROWN_EXPLOSIVE_AREA_PROFILES.find(profile => profile.id === 'grenade:pulse')!;
  assert.equal(buildAreaDamageZones(pulse, {}, { main: 20 }).length, 0);
  assert.equal(buildAreaDamageZones(pulse, { [pulse.id]: { main: 8 } }, { main: 20 }).length, 1);
});

test('plasma grenade and C-14 adjacent effects reuse the center roll at their printed fraction', () => {
  const plasma = THROWN_EXPLOSIVE_AREA_PROFILES.find(profile => profile.id === 'grenade:plasma')!;
  const plasmaZones = buildAreaDamageZones(plasma, {}, { main: 100, plasma_splash: 100, concussion: 4 });
  assert.equal(plasmaZones.find(zone => zone.minDistance === 1)?.effects.find(effect => effect.id === 'plasma_splash')?.rawDamage, 33);

  const plastique = THROWN_EXPLOSIVE_AREA_PROFILES.find(profile => profile.id === 'grenade:plastique-c14')!;
  const plastiqueZones = buildAreaDamageZones(plastique, {}, { main: 27, adjacent_blast: 27, concussion: 4 });
  assert.equal(plastiqueZones.find(zone => zone.minDistance === 1)?.effects.find(effect => effect.id === 'adjacent_blast')?.rawDamage, 14);
});

test('custom ammo and trap profiles preserve independent effects, units, and per-campaign missing ranges', () => {
  const ammoProfiles = createCustomAmmoAreaDamageProfiles([{
    id: 'custom-shell', name: 'Custom Shell', value: 0, volume: 0, acMod: 0, drMod: 0,
    dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, isCustom: true, areaRangeUnit: 'm',
    areaEffects: [
      { id: 'blast', label: 'Blast', kind: 'explosion', damageType: 'explosion', damageDieCount: 2, damageDie: 8, damageBonus: 2, radius: 12 },
      { id: 'fallout', label: 'Radiation fallout', kind: 'explosion', damageType: 'radiation', damageDieCount: 0, damageDie: 0, damageBonus: 20 },
    ],
  }]);
  assert.equal(ammoProfiles[0].rangeUnit, 'm');
  assert.deepEqual(ammoProfiles[0].effects.map(effect => effect.id), ['blast', 'fallout']);
  assert.deepEqual(buildAreaDamageZones(ammoProfiles[0], {}, { blast: 10, fallout: 20 }).map(zone => zone.maxDistance), [12]);

  const trapProfiles = createCustomWeaponAreaDamageProfiles([{
    id: 'custom-trap', name: 'Custom Mine', category: 'minesTraps', damageType: 'explosion',
    damageDieCount: 1, damageDie: 6, damageBonus: 0, skill: 'traps', burstLimit: 1,
    isDoubleShot: false, magazineSize: 0, weight: 0, minStr: 1, rangeNormal: 0,
    knockdownChance: 0, mods: [], isCustom: true, areaRangeUnit: 'hex',
    customAreaEffects: [{
      id: 'main', label: 'Blast', kind: 'explosion', damageType: 'explosion',
      damageDieCount: 1, damageDie: 6, damageBonus: 0,
    }],
  }]);
  assert.equal(trapProfiles[0].id, 'custom-weapon:custom-trap');
  assert.equal(buildAreaDamageZones(trapProfiles[0], { [trapProfiles[0].id]: { main: 3 } }, { main: 6 })[0].label, '0–3 hex');
});

test('radiation-only zone effects return exposure without HP damage', () => {
  const profile = createCustomAmmoAreaDamageProfiles([{
    id: 'rad-shell', name: 'Radiation Shell', value: 0, volume: 0, acMod: 0, drMod: 0,
    dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, isCustom: true,
    areaEffects: [{
      id: 'rads', label: 'Radiation', kind: 'explosion', damageType: 'radiation',
      damageDieCount: 0, damageDie: 0, damageBonus: 20, radius: 5,
    }],
  }])[0];
  const zone = buildAreaDamageZones(profile, {}, { rads: 20 })[0];
  const result = resolveAreaZoneTarget(zone, {
    id: 'rad-target', name: 'Rad target', endurance: 5,
    gasInhaledResistance: 0, gasContactResistance: 0, electricityResistance: 0,
    dt: 10, dr: 90, radiationResistance: 0,
  });
  assert.equal(result.damage, 0);
  assert.equal(result.radiationExposure, 20);
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

test('vehicle cannon profiles use the manual blast dice and 1d6 concussion through 100m', () => {
  assert.deepEqual(
    VEHICLE_CANNON_AREA_PROFILES.map(profile => [
      profile.id,
      profile.effects.map(effect => [
        effect.id, effect.kind, effect.damageDieCount, effect.damageDie,
        effect.damageBonus, effect.radius, effect.rangeUnit,
      ]),
    ]),
    [
      ['vehicle-cannon:vehicle_20mm_cannon', [
        ['blast', 'explosion', 8, 10, 40, 10, undefined],
        ['concussion', 'concussion', 1, 6, 0, 100, undefined],
      ]],
      ['vehicle-cannon:vehicle_25mm_cannon', [
        ['blast', 'explosion', 8, 10, 40, 10, undefined],
        ['concussion', 'concussion', 1, 6, 0, 100, undefined],
      ]],
      ['vehicle-cannon:vehicle_m68_105mm_cannon', [
        ['blast', 'explosion', 15, 20, 30, 15, undefined],
        ['concussion', 'concussion', 1, 6, 0, 100, undefined],
      ]],
      ['vehicle-cannon:rheinmetall_120mm_gun', [
        ['blast', 'explosion', 20, 20, 50, 20, undefined],
        ['concussion', 'concussion', 1, 6, 0, 100, undefined],
      ]],
      ['vehicle-cannon:vehicle_152mm_shillelagh', [
        ['blast', 'explosion', 20, 20, 50, 25, undefined],
        ['concussion', 'concussion', 1, 6, 0, 100, undefined],
      ]],
    ],
  );
  assert.ok(VEHICLE_CANNON_AREA_PROFILES.every(profile => profile.rangeUnit === 'm'));
});

test('cannon impact target takes blast and concussion once with DT ignored only for concussion', () => {
  const profile = VEHICLE_CANNON_AREA_PROFILES.find(candidate => candidate.id === 'vehicle-cannon:vehicle_20mm_cannon');
  assert.ok(profile);
  const zones = buildAreaDamageZones(profile, {}, { blast: 100, concussion: 6 });
  assert.deepEqual(zones.map(zone => [zone.minDistance, zone.maxDistance]), [[0, 10], [11, 100]]);
  const impact = resolveAreaZoneTarget(zones[0], {
    id: 'target-1',
    name: 'Impact target',
    endurance: 5,
    gasInhaledResistance: 0,
    gasContactResistance: 0,
    electricityResistance: 0,
    dt: 10,
    dr: 50,
  });
  assert.equal(impact.damage, 48); // blast: (100 − 10) × 50%; concussion: 6 × 50%
  assert.deepEqual(impact.componentBreakdown, [
    'Blast: 100 raw → 45 HP (explosion protection applies)',
    'Concussion: 6 raw → 3 HP (DT ignored; explosive DR applies)',
  ]);
  const explanation = formatAreaResolution({ ...impact, directHit: true });
  assert.match(explanation, /direct hit \/ impact point/);
  assert.match(explanation, /Blast: 100 raw → 45 HP/);
  assert.match(explanation, /Concussion: 6 raw → 3 HP/);

  const concussionOnly = resolveAreaZoneTarget(zones[1], {
    id: 'target-2',
    name: 'Nearby target',
    endurance: 5,
    gasInhaledResistance: 0,
    gasContactResistance: 0,
    electricityResistance: 0,
    dt: 10,
    dr: 50,
  });
  assert.equal(concussionOnly.damage, 3);
  assert.ok(concussionOnly.componentBreakdown);
  assert.deepEqual(concussionOnly.componentBreakdown.map(line => line.split(':')[0]), ['Concussion']);
});
