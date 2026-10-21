import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { deflateSync } from 'fflate';
import { mapViewportCenter, moveMapMarker } from './mapPlacement.ts';
import { normalizeCampaignMap, validCampaignMap } from './campaignTools.ts';
import { supportsThemeTint } from './markerTint.ts';

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

function testPng(colorType: number, pixels: number[], transparency?: number[], height = 1, interlace = 0) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  const width = pixels.length / (channels * height);
  const chunk = (type: string, data: number[]) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type), Buffer.from(data), Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = colorType;
  header[12] = interlace;
  const passes = interlace === 0
    ? [{ x: 0, y: 0, stepX: 1, stepY: 1 }]
    : [
      { x: 0, y: 0, stepX: 8, stepY: 8 }, { x: 4, y: 0, stepX: 8, stepY: 8 },
      { x: 0, y: 4, stepX: 4, stepY: 8 }, { x: 2, y: 0, stepX: 4, stepY: 4 },
      { x: 0, y: 2, stepX: 2, stepY: 4 }, { x: 1, y: 0, stepX: 2, stepY: 2 },
      { x: 0, y: 1, stepX: 1, stepY: 2 },
    ];
  const scanlines: number[] = [];
  for (const pass of passes) {
    const passWidth = pass.x < width ? Math.ceil((width - pass.x) / pass.stepX) : 0;
    const passHeight = pass.y < height ? Math.ceil((height - pass.y) / pass.stepY) : 0;
    if (!passWidth || !passHeight) continue;
    for (let passY = 0; passY < passHeight; passY += 1) {
      scanlines.push(0);
      const y = pass.y + (passY * pass.stepY);
      for (let passX = 0; passX < passWidth; passX += 1) {
        const x = pass.x + (passX * pass.stepX);
        const start = ((y * width) + x) * channels;
        scanlines.push(...pixels.slice(start, start + channels));
      }
    }
  }
  return `data:image/png;base64,${Buffer.concat([
    signature,
    chunk('IHDR', [...header]),
    ...(colorType === 3 ? [chunk('PLTE', [0, 0, 0, 255, 255, 255])] : []),
    ...(transparency ? [chunk('tRNS', transparency)] : []),
    chunk('IDAT', [...deflateSync(new Uint8Array(scanlines))]),
    chunk('IEND', []),
  ]).toString('base64')}`;
}

test('theme tint is limited to PNGs containing actual transparent pixels', () => {
  assert.equal(supportsThemeTint(testPng(6, [255, 255, 255, 100])), true, 'RGBA transparency is honored');
  assert.equal(supportsThemeTint(testPng(6, [255, 255, 255, 255])), false, 'opaque RGBA PNGs are unchanged');
  assert.equal(supportsThemeTint(testPng(4, [150, 254])), true, 'grayscale-alpha transparency is honored');
  assert.equal(supportsThemeTint(testPng(4, [150, 255])), false, 'opaque grayscale-alpha PNGs are unchanged');
  assert.equal(supportsThemeTint(testPng(2, [0, 0, 0])), false, 'opaque truecolor PNGs are unchanged');
  assert.equal(supportsThemeTint(testPng(3, [0], [255, 0])), false, 'unused palette transparency is unchanged');
  assert.equal(supportsThemeTint(testPng(3, [1], [255, 0])), true, 'visible palette transparency is honored');
  assert.equal(supportsThemeTint(testPng(3, [0], [255, 255])), false, 'opaque palettes are unchanged');
  assert.equal(supportsThemeTint(testPng(2, [0, 0, 0], [0, 0, 0, 0, 0, 0])), true, 'transparent color keys are honored');
  assert.equal(supportsThemeTint(testPng(2, [1, 0, 0], [0, 0, 0, 0, 0, 0])), false, 'unused color keys are unchanged');
  assert.equal(supportsThemeTint(testPng(6, [
    255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 100,
  ], undefined, 2, 1)), true, 'Adam7 interlaced transparency is honored');
  assert.equal(supportsThemeTint('data:image/jpeg;base64,/9j/2Q=='), false);
  assert.equal(supportsThemeTint('data:image/png;base64,not-a-png'), false);
});

test('marker tint setting and original PNG assets stay portable in map data', () => {
  const originalPng = testPng(6, [255, 255, 255, 100]);
  const map = normalizeCampaignMap({
    id: 'map',
    name: 'Test',
    description: '',
    tintMarkersToTheme: true,
    imageDataUri: 'data:image/png;base64,aGVsbG8=',
    locations: [{ id: 'place', name: 'Place', description: '', iconId: 'marker-1', x: 0.2, y: 0.7 }],
    markerIcons: [{ id: 'marker-1', name: 'Marker', imageDataUri: originalPng }],
    party: [],
  });
  assert.equal(map?.tintMarkersToTheme, true);
  assert.equal(map?.markerIcons?.[0].imageDataUri, originalPng);
  assert.equal(normalizeCampaignMap({
    id: 'legacy', name: 'Legacy', description: '', locations: [], party: [],
  })?.tintMarkersToTheme, false);
  assert.equal(validCampaignMap({
    id: 'invalid', name: 'Invalid', description: '', tintMarkersToTheme: 'yes', locations: [], party: [],
  }), false);
  const tools = readFileSync(new URL('../components/DraggableMapMarker.tsx', import.meta.url), 'utf8');
  assert.match(tools, /backgroundColor: 'transparent'/);
  const editor = readFileSync(new URL('../components/CampaignMapEditorModal.tsx', import.meta.url), 'utf8');
  const mapList = readFileSync(new URL('../components/CampaignToolsPanel.tsx', import.meta.url), 'utf8');
  assert.match(editor, /tintColor=\{tintColor\}/);
  assert.match(editor, /tintMarkersToTheme && tintableCustomIconIds\.has\(icon\.id\)/);
  assert.match(editor, /Match marker colors to UI theme/);
  assert.match(mapList, /tintMarkersToTheme: true/);
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
