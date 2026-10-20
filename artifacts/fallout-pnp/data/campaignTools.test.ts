import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCampaignMapExport,
  exportCampaignMap,
  normalizeCampaignMap,
  normalizeCampaignTable,
  rollEncounterTable,
  rollLootTable,
  validCampaignMap,
  validCampaignTable,
} from './campaignTools.ts';
import type { CampaignTable } from '../context/types.ts';

test('normalizes campaign tables with loot defaults and preserves configurable weights', () => {
  const table = normalizeCampaignTable({
    id: 'loot-1',
    name: 'Ruins',
    description: 'Scavenge list',
    rollCountMin: 1,
    rollCountMax: 1,
    entries: [{
      id: 'water',
      name: 'Purified water',
      description: 'A bottle',
      weight: 4,
      quantityMin: 1,
      quantityMax: 1,
    }],
  });
  assert.deepEqual(table, {
    id: 'loot-1',
    name: 'Ruins',
    description: 'Scavenge list',
    rollCountMin: 1,
    rollCountMax: 1,
    entries: [{
      id: 'water',
      name: 'Purified water',
      description: 'A bottle',
      weight: 4,
      quantityMin: 1,
      quantityMax: 1,
    }],
  });
  assert.equal(validCampaignTable(table), true);
  assert.equal(validCampaignTable({ ...table!, entries: [{ ...table!.entries[0], weight: 0 }] }), false);
});

test('normalizes loot ranges so maximum rolls and quantities cannot be below their minimums', () => {
  const table = normalizeCampaignTable({
    id: 'range',
    name: 'Range',
    rollCountMin: 3,
    rollCountMax: 2,
    entries: [{ id: 'ammo', name: 'Ammo', weight: 1, quantityMin: 4, quantityMax: 2 }],
  });

  assert.equal(table?.rollCountMin, 3);
  assert.equal(table?.rollCountMax, 3);
  assert.equal(table?.entries[0].quantityMin, 4);
  assert.equal(table?.entries[0].quantityMax, 4);
});

test('encounter tables give every entry the same chance, regardless of weight', () => {
  const table: CampaignTable = {
    id: 'encounters',
    name: 'Encounters',
    description: '',
    entries: [
      { id: 'raiders', name: 'Raiders', description: '', weight: 1 },
      { id: 'geckos', name: 'Geckos', description: '', weight: 99 },
    ],
  };

  assert.equal(rollEncounterTable(table, () => 0.25)[0].name, 'Raiders');
  assert.equal(rollEncounterTable(table, () => 0.75)[0].name, 'Geckos');
  assert.deepEqual(rollEncounterTable({ ...table, entries: [] }, () => 0), []);
});

test('loot rolls draw a configurable count, choose weighted entries, and roll their quantities', () => {
  const table: CampaignTable = {
    id: 'loot',
    name: 'Loot',
    description: '',
    rollCountMin: 2,
    rollCountMax: 2,
    entries: [
      { id: 'common', name: 'Scrap', description: 'Metal pieces', weight: 1, quantityMin: 2, quantityMax: 4 },
      { id: 'rare', name: 'Stimpak', description: '', weight: 3, quantityMin: 1, quantityMax: 1 },
    ],
  };
  const values = [0.1, 0.5, 0.9];
  let index = 0;
  const results = rollLootTable(table, () => values[index++]);

  assert.deepEqual(results.map(result => [result.name, result.quantity]), [
    ['Scrap', 3],
    ['Stimpak', 1],
  ]);
  assert.equal(validCampaignTable(table), true);
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

test('map JSON export includes image data, locations, and party positions', () => {
  const map = {
    id: 'map-1',
    name: 'Junction & Ruins',
    description: 'A marked route',
    imageDataUri: 'data:image/png;base64,aGVsbG8=',
    locations: [{ id: 'gate', name: 'North Gate', description: 'Main entrance', x: 0.25, y: 0.7 }],
    party: [{ characterId: 'character-1', x: 0.4, y: 0.6 }],
  };
  const file = createCampaignMapExport(map);
  const parsed = JSON.parse(file.json);

  assert.equal(file.filename, 'Junction-Ruins.json');
  assert.equal(parsed.format, 'fallout-pnp-map');
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.map, map);
});

test('map export dispatches to browser download on web and native sharing elsewhere', async () => {
  const map = {
    id: 'map-1',
    name: 'Export map',
    description: '',
    imageDataUri: 'data:image/webp;base64,aGVsbG8=',
    locations: [],
    party: [{ characterId: 'character-1', x: 0.5, y: 0.75 }],
  };
  const downloads: string[] = [];
  const shares: string[] = [];
  const handlers = {
    download: ({ json }: { filename: string; json: string }) => {
      downloads.push(json);
    },
    share: ({ json }: { filename: string; json: string }) => {
      shares.push(json);
    },
  };

  await exportCampaignMap(map, 'web', handlers);
  assert.equal(downloads.length, 1);
  assert.equal(shares.length, 0);
  assert.deepEqual(JSON.parse(downloads[0]).map, map);

  await exportCampaignMap(map, 'native', handlers);
  assert.equal(downloads.length, 1);
  assert.equal(shares.length, 1);
  assert.deepEqual(JSON.parse(shares[0]).map, map);
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
