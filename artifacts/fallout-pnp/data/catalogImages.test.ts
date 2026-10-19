import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCatalogImageDataUri,
  makeCatalogImageDataUri,
  MAX_CATALOG_IMAGE_BYTES,
  normalizeCatalogPortraitMap,
} from './catalogImages.ts';

test('catalog image data URIs accept supported image types and normalize base64 whitespace', () => {
  const uri = makeCatalogImageDataUri('IMAGE/PNG', 'AQID\n');
  assert.equal(uri, 'data:image/png;base64,AQID');
  assert.equal(isCatalogImageDataUri(uri), true);
});

test('catalog image data URIs reject unsupported types and malformed payloads', () => {
  assert.equal(makeCatalogImageDataUri('image/svg+xml', 'PHN2Zz4='), null);
  assert.equal(makeCatalogImageDataUri('image/jpeg', 'not-base64!'), null);
  assert.equal(isCatalogImageDataUri('https://images.example.invalid/photo.png'), false);
});

test('catalog image data URIs enforce the per-image byte limit', () => {
  const tooLarge = 'A'.repeat(Math.ceil((MAX_CATALOG_IMAGE_BYTES + 1) / 3) * 4);
  assert.equal(makeCatalogImageDataUri('image/jpeg', tooLarge), null);
});

test('portrait maps keep valid user images and discard external or malformed URIs', () => {
  const valid = 'data:image/jpeg;base64,AQID';
  assert.deepEqual(
    normalizeCatalogPortraitMap({
      'giant-rat': valid,
      'deathclaw': 'https://images.example.invalid/art.png',
      '': valid,
      'too-long': 7,
    }),
    { 'giant-rat': valid },
  );
});
