import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyVaultRadioTrackMetadata,
  createVaultRadioTrack,
  getAdjacentVaultRadioIndex,
  normalizeVaultRadioTrackMetadata,
  VAULT_RADIO_TRACKS,
} from './vaultRadio.ts';

test('Vault Radio knows the title and performer for each supplied track', () => {
  assert.equal(VAULT_RADIO_TRACKS.length, 7);
  assert.deepEqual(
    VAULT_RADIO_TRACKS.map(({ title, artist }) => [title, artist]),
    [
      ["Ain't Misbehavin'", 'Fats Waller'],
      ['It Had to Be You', 'Isham Jones & His Orchestra'],
      ['Rhapsody in Blue', 'George Gershwin'],
      ['Alabamy Bound', 'Blossom Seeley'],
      ['Angry', 'Art Gillham'],
      ['The Prisoner’s Song', 'Vernon Dalhart'],
      ['The Titanic', 'Ernest V. Stoneman'],
    ],
  );
});

test('uploaded tracks without curated metadata get a readable filename and unknown artist', () => {
  assert.deepEqual(createVaultRadioTrack('New_song-demo.mp3'), {
    id: 'New_song-demo.mp3',
    file: 'New_song-demo.mp3',
    title: 'New song demo',
    artist: null,
  });
});

test('uploaded track metadata is normalized and applied without changing curated tracks', () => {
  const metadata: ReturnType<typeof normalizeVaultRadioTrackMetadata> = normalizeVaultRadioTrackMetadata({
    'New_song-demo.mp3': { title: '  Demo Song  ', artist: '  A Player  ' },
    'missing-title.mp3': { artist: 'No title' },
    [VAULT_RADIO_TRACKS[0].file]: { title: 'Changed', artist: 'Changed' },
    'invalid-artist.mp3': { title: 'Valid title', artist: 42 },
  });
  const uploadedTrack = createVaultRadioTrack('New_song-demo.mp3');
  const uploadedMetadata = metadata[uploadedTrack.file];

  assert.deepEqual(metadata, {
    'New_song-demo.mp3': { title: 'Demo Song', artist: 'A Player' },
  });
  assert.deepEqual(applyVaultRadioTrackMetadata(uploadedTrack, uploadedMetadata), {
    ...uploadedTrack,
    title: 'Demo Song',
    artist: 'A Player',
  });
  assert.deepEqual(
    applyVaultRadioTrackMetadata(VAULT_RADIO_TRACKS[0], { title: 'Changed', artist: 'Changed' }),
    VAULT_RADIO_TRACKS[0],
  );
});

test('previous and next controls wrap around the ordered playlist', () => {
  assert.equal(getAdjacentVaultRadioIndex(0, -1, 7), 6);
  assert.equal(getAdjacentVaultRadioIndex(6, 1, 7), 0);
  assert.equal(getAdjacentVaultRadioIndex(3, 1, 7), 4);
  assert.equal(getAdjacentVaultRadioIndex(3, -1, 7), 2);
  assert.equal(getAdjacentVaultRadioIndex(null, 1, 7), 0);
  assert.equal(getAdjacentVaultRadioIndex(null, -1, 7), 6);
  assert.equal(getAdjacentVaultRadioIndex(0, 1, 0), null);
});
