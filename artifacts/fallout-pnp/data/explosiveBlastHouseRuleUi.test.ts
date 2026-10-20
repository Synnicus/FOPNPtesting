import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const optionsSource = readFileSync(new URL('../components/CampaignOptionsModal.tsx', import.meta.url), 'utf8');
const combatSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('the 5m explosive-ammo rule is an options toggle wired into combat profiles', () => {
  assert.match(optionsSource, /label="5m Blast Radius for Explosive Ammo"/);
  assert.match(optionsSource, /value=\{missingExplosiveBlastZoneHouseRule\}/);
  assert.match(optionsSource, /onValueChange=\{setMissingExplosiveBlastZoneHouseRule\}/);
  assert.match(combatSource, /getBuiltInAreaDamageProfiles\(missingExplosiveBlastZoneHouseRule\)/);
});
