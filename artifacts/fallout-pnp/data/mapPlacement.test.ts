import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { mapViewportCenter, moveMapMarker } from './mapPlacement.ts';
import { normalizeCampaignMap } from './campaignTools.ts';

test('Party is a normal location icon and cave icons use a cave silhouette in picker and map', () => {
  const editor = readFileSync(new URL('../components/CampaignMapEditorModal.tsx', import.meta.url), 'utf8');
  assert.match(editor, /id: 'party', name: 'Party', icon: 'user'/);
  assert.match(editor, /id: 'cave', name: 'CAVE', icon: 'cave'/);
  assert.match(editor, /icon\.icon === 'cave'.*<CaveIcon/);
  assert.match(editor, /renderIcon\(marker\.id, 18/);
  for (const iconId of ['party', 'cave']) {
    const saved = normalizeCampaignMap({
      id: 'map', name: 'Test', description: '', party: [],
      locations: [{ id: 'location', name: 'Location', description: '', iconId, x: 0.4, y: 0.5 }],
    });
    assert.equal(saved?.locations[0].iconId, iconId);
    assert.deepEqual(saved?.party, []);
  }
});

test('new map markers center in the visible map region at any zoom or pan', () => {
  const artboard = { width: 400, height: 600 };
  assert.deepEqual(mapViewportCenter(artboard, 1, { x: 0, y: 0 }), { x: 0.5, y: 0.5 });
  assert.deepEqual(mapViewportCenter(artboard, 2, { x: 80, y: -120 }), { x: 0.4, y: 0.6 });
  assert.deepEqual(mapViewportCenter(artboard, 1, { x: 0, y: 0 }, { x: 0, y: -150 }), { x: 0.5, y: 0.25 });
  assert.deepEqual(mapViewportCenter(artboard, 1, { x: 900, y: -900 }), { x: 0, y: 1 });
});

test('marker dragging uses normalized image coordinates with zoom and image boundaries', () => {
  const artboard = { width: 400, height: 600 };
  const start = { x: 0.5, y: 0.5 };
  assert.deepEqual(moveMapMarker(start, { x: 40, y: -60 }, artboard, 1), { x: 0.6, y: 0.4 });
  assert.deepEqual(moveMapMarker(start, { x: 40, y: -60 }, artboard, 2), { x: 0.55, y: 0.45 });
  assert.deepEqual(moveMapMarker(start, { x: -1000, y: 1000 }, artboard, 1), { x: 0, y: 1 });
  assert.deepEqual(start, { x: 0.5, y: 0.5 });
});

test('map editor gates panning and persistence, stages locations, and retires party controls', () => {
  const editor = readFileSync(new URL('../components/CampaignMapEditorModal.tsx', import.meta.url), 'utf8');
  const list = readFileSync(new URL('../components/CampaignToolsPanel.tsx', import.meta.url), 'utf8');
  assert.match(editor, /toolRef\.current === 'pan' &&/);
  assert.match(editor, /if \(toolRef\.current === 'pan'\)/);
  assert.match(editor, /if \(pendingLocation\) \{\s*setNotice\('Confirm or cancel placement before saving\.'/);
  assert.match(editor, /onPress=\{confirmPlacement\}/);
  assert.match(editor, /if \(tool === 'edit'\) \{\s*setPendingLocation/);
  assert.match(editor, /locations: draft\.locations\.filter/);
  assert.doesNotMatch(editor, /PLACE PARTY|draft\.party|setSelectedCharacterId/);
  assert.match(list, /source=\{\{ uri: map\.imageDataUri \}\}/);
});

test('new map editor controls have complete translations in every supported locale', () => {
  const data = JSON.parse(readFileSync(new URL('./locales/map-editor.json', import.meta.url), 'utf8'));
  const source = ['CampaignToolsPanel', 'CampaignMapEditorModal', 'DraggableMapMarker']
    .map(name => readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8')).join('\n');
  const locales = ['fr', 'it', 'de', 'es-ES', 'es-MX', 'ja', 'pl', 'pt-BR', 'ru', 'zh-Hans', 'zh-Hant'];
  for (const locale of locales) {
    assert.equal(data[locale].length, data.keys.length, locale);
    data.keys.forEach((key: string, index: number) => {
      assert.ok(source.includes(key), key);
      assert.ok(data[locale][index]?.trim(), `${locale}: ${key}`);
      assert.deepEqual(
        key.match(/\{\d+\}/g) ?? [], data[locale][index].match(/\{\d+\}/g) ?? [], `${locale}: ${key}`,
      );
    });
  }
});
