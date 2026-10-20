import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_RADIO_STATION,
  DEFAULT_RADIO_STATION_ID,
  isRadioStationRecord,
  normalizeRadioStations,
  type RadioStation,
} from './radioStations.ts';

test('the default station keeps the existing Vault Radio collection and requested descriptor', () => {
  assert.equal(DEFAULT_RADIO_STATION.id, DEFAULT_RADIO_STATION_ID);
  assert.equal(DEFAULT_RADIO_STATION.name, 'Vault Radio');
  assert.equal(DEFAULT_RADIO_STATION.description, "Public Domain 1920's");
  assert.equal(DEFAULT_RADIO_STATION.songs.length, 7);
  assert.ok(DEFAULT_RADIO_STATION.songs.every(song => song.file && song.title));
});

test('radio station normalization preserves metadata and missing-file slots without audio blobs', () => {
  const custom: RadioStation = {
    id: 'station-one',
    name: 'Roadside Radio',
    description: 'Songs from the highway.',
    songs: [
      { id: 'slot-1', file: 'song-a.mp3', title: 'Song A', artist: 'Artist A' },
      { id: 'slot-2', file: 'song-not-yet-uploaded.mp3', title: 'Song B', artist: null },
      { id: 'slot-3', file: null, title: 'Unassigned track', artist: null },
    ],
  };
  const normalized = normalizeRadioStations([custom]);
  assert.equal(normalized[0].id, DEFAULT_RADIO_STATION_ID);
  assert.deepEqual(normalized.find(station => station.id === custom.id), custom);
  assert.equal(JSON.stringify(normalized).includes('data:audio/'), false);
});

test('radio station records reject paths, duplicate song IDs, excessive fields, and invalid song metadata', () => {
  const base: RadioStation = {
    id: 'station-one',
    name: 'Roadside Radio',
    description: '',
    songs: [{ id: 'slot-1', file: 'song.mp3', title: 'Song', artist: null }],
  };
  assert.equal(isRadioStationRecord(base), true);
  assert.equal(isRadioStationRecord({
    ...base,
    songs: [{ ...base.songs[0], file: '../private/song.mp3' }],
  }), false);
  assert.equal(isRadioStationRecord({
    ...base,
    songs: [base.songs[0], { ...base.songs[0], file: 'other.mp3' }],
  }), false);
  assert.equal(isRadioStationRecord({
    ...base,
    songs: [{ ...base.songs[0], artist: 12 }],
  }), false);
});

test('normalization keeps only unique valid stations and restores the built-in station', () => {
  const valid: RadioStation = {
    id: 'station-one',
    name: 'Roadside Radio',
    description: '',
    songs: [],
  };
  const normalized = normalizeRadioStations([valid, valid, { ...valid, name: '' }]);
  assert.deepEqual(normalized.map(station => station.id), [DEFAULT_RADIO_STATION_ID, valid.id]);
});
