import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCampaignMap, normalizeCampaignTable, validCampaignMap, validCampaignTable } from './campaignTools.ts';

test('normalizes campaign tables and preserves configurable weighted entries', () => {
  const table = normalizeCampaignTable({
    id: 'loot-1',
    name: 'Ruins',
    description: 'Scavenge list',
    entries: [{ id: 'water', name: 'Purified water', description: 'A bottle', weight: 4 }],
  });
  assert.deepEqual(table, {
    id: 'loot-1',
    name: 'Ruins',
    description: 'Scavenge list',
    entries: [{ id: 'water', name: 'Purified water', description: 'A bottle', weight: 4 }],
  });
  assert.equal(validCampaignTable(table), true);
  assert.equal(validCampaignTable({ ...table!, entries: [{ ...table!.entries[0], weight: 0 }] }), false);
});

test('campaign map normalizes portable image and normalized marker coordinates', () => {
  const map = normalizeCampaignMap({
    id: 'map-1',
    name: 'Junction',
    description: '',
    imageDataUri: 'data:image/png;base64,aGVsbG8=',
    locations: [{ id: 'gate', name: 'North Gate', description: '', x: 0.25, y: 0.7 }],
    party: [{ characterId: 'character-1', x: 0.4, y: 0.6 }],
  });
  assert.equal(map?.locations[0].x, 0.25);
  assert.equal(map?.party[0].characterId, 'character-1');
  assert.equal(validCampaignMap(map), true);
});

test('invalid marker coordinates and unsupported image formats are rejected', () => {
  const base = {
    id: 'map-1',
    name: 'Bad map',
    locations: [{ id: 'bad', name: 'Outside', description: '', x: 2, y: 0 }],
    party: [],
  };
  assert.equal(validCampaignMap(base), false);
  assert.equal(validCampaignMap({ ...base, locations: [], imageDataUri: 'data:image/svg+xml;base64,PHN2Zz4=' }), false);
});

test('malformed table entries do not pass portable validation', () => {
  assert.equal(validCampaignTable({
    id: 'table-1',
    name: 'Invalid',
    entries: [{ id: 'duplicate', name: 'A', weight: 1 }, { id: 'duplicate', name: 'B', weight: 1 }],
  }), false);
});
