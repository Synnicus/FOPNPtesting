import { VAULT_RADIO_TRACKS } from './vaultRadio.ts';

export interface RadioStationSong {
  id: string;
  /** App Storage filename only; audio data is deliberately never exported. */
  file: string | null;
  title: string;
  artist: string | null;
}

export interface RadioStation {
  id: string;
  name: string;
  description: string;
  songs: RadioStationSong[];
}

export const DEFAULT_RADIO_STATION_ID = 'vault-radio';
export const MAX_RADIO_STATIONS = 50;
export const MAX_RADIO_STATION_SONGS = 100;

export const DEFAULT_RADIO_STATION: RadioStation = {
  id: DEFAULT_RADIO_STATION_ID,
  name: 'Vault Radio',
  description: "Public Domain 1920's",
  songs: VAULT_RADIO_TRACKS.map(track => ({
    id: track.id,
    file: track.file,
    title: track.title,
    artist: track.artist,
  })),
};

export const DEFAULT_RADIO_STATIONS: RadioStation[] = [DEFAULT_RADIO_STATION];

export function isRadioStationSong(value: unknown): value is RadioStationSong {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const song = value as Record<string, unknown>;
  const validFile = song.file === null
    || (typeof song.file === 'string'
      && song.file.length > 0
      && song.file.length <= 255
      && song.file.trim() === song.file
      && !/[\\/:?#]/.test(song.file));
  return typeof song.id === 'string'
    && song.id.length > 0
    && song.id.length <= 128
    && validFile
    && typeof song.title === 'string'
    && song.title.length <= 200
    && (song.artist === null || (typeof song.artist === 'string' && song.artist.length <= 200));
}

export function isRadioStationRecord(value: unknown): value is RadioStation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const station = value as Record<string, unknown>;
  return typeof station.id === 'string'
    && station.id.length > 0
    && station.id.length <= 128
    && typeof station.name === 'string'
    && station.name.trim().length > 0
    && station.name.length <= 100
    && typeof station.description === 'string'
    && station.description.length <= 500
    && Array.isArray(station.songs)
    && station.songs.length <= MAX_RADIO_STATION_SONGS
    && station.songs.every(isRadioStationSong)
    && new Set(station.songs.map(song => song.id)).size === station.songs.length;
}

export function normalizeRadioStations(value: unknown): RadioStation[] {
  const candidates = Array.isArray(value)
    ? value.filter(isRadioStationRecord).slice(0, MAX_RADIO_STATIONS)
    : [];
  const seen = new Set<string>();
  const stations = candidates.filter(station => {
    if (seen.has(station.id)) return false;
    seen.add(station.id);
    return true;
  }).map(station => ({
    ...station,
    name: station.name.trim().slice(0, 100),
    description: station.description.trim().slice(0, 500),
    songs: station.songs.map(song => ({
      ...song,
      title: song.title.trim().slice(0, 200),
      artist: song.artist?.trim().slice(0, 200) || null,
    })),
  }));

  if (!seen.has(DEFAULT_RADIO_STATION_ID)) {
    stations.unshift({
      ...DEFAULT_RADIO_STATION,
      songs: DEFAULT_RADIO_STATION.songs.map(song => ({ ...song })),
    });
  }
  return stations;
}

export function createRadioStationId(): string {
  return `station-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRadioSongId(): string {
  return `song-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
