import assert from 'node:assert/strict';
import test from 'node:test';

import { planPortraitImportCleanup } from './portraitStorageCleanup.ts';

const importedDirectory = (name: string, contentUris: string[]) => ({
  uri: `file:///documents/${name}/`,
  name,
  contentUris,
});

test('startup cleanup removes orphan import folders and preserves referenced portraits', () => {
  const activeUri = 'file:///documents/fallout-pnp-import-active/portrait.jpg';
  const plan = planPortraitImportCleanup([
    importedDirectory('fallout-pnp-import-active', [activeUri]),
    importedDirectory('fallout-pnp-import-old', [
      'file:///documents/fallout-pnp-import-old/portrait.jpg',
    ]),
  ], new Set([activeUri]));

  assert.deepEqual(plan, {
    directoryUris: ['file:///documents/fallout-pnp-import-old/'],
    contentUris: [],
  });
});

test('portrait replacement or character deletion removes the old import folder', () => {
  const oldDirectory = importedDirectory('fallout-pnp-import-old', [
    'file:///documents/fallout-pnp-import-old/portrait.jpg',
  ]);

  assert.deepEqual(
    planPortraitImportCleanup([oldDirectory], new Set([
      'file:///documents/fallout-pnp-import-new/portrait.jpg',
    ])).directoryUris,
    [oldDirectory.uri],
  );
  assert.deepEqual(
    planPortraitImportCleanup([oldDirectory], new Set()).directoryUris,
    [oldDirectory.uri],
  );
});

test('shared active folders keep every referenced portrait and remove extra files', () => {
  const first = 'file:///documents/fallout-pnp-import-shared/first.jpg';
  const second = 'file:///documents/fallout-pnp-import-shared/second.jpg';
  const extra = 'file:///documents/fallout-pnp-import-shared/unused.jpg';
  const plan = planPortraitImportCleanup([
    importedDirectory('fallout-pnp-import-shared', [first, second, extra]),
    importedDirectory('unrelated-app-folder', ['file:///documents/unrelated-app-folder/file.jpg']),
  ], new Set([first, second]));

  assert.deepEqual(plan, {
    directoryUris: [],
    contentUris: [extra],
  });
});