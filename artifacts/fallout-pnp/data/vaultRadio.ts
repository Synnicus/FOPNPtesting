export type VaultRadioTrack = {
  id: string;
  file: string;
  title: string;
  artist: string | null;
};

export const VAULT_RADIO_TRACKS: readonly VaultRadioTrack[] = [
  {
    id: 'aint-misbehavin',
    file: '9684-Aint-misbehavin.mp3',
    title: "Ain't Misbehavin'",
    artist: 'Fats Waller',
  },
  {
    id: 'it-had-to-be-you',
    file: 'Isham_Jones_-_It_Had_to_Be_You_(1924).mp3',
    title: 'It Had to Be You',
    artist: 'Isham Jones & His Orchestra',
  },
  {
    id: 'rhapsody-in-blue',
    file: 'Rhapsody in Blue.mp3',
    title: 'Rhapsody in Blue',
    artist: 'George Gershwin',
  },
  {
    id: 'alabamy-bound',
    file: 'The78Prof - 1925 HITS ARCHIVE_ Alabamy Bound - Blossom Seeley.mp3',
    title: 'Alabamy Bound',
    artist: 'Blossom Seeley',
  },
  {
    id: 'angry',
    file: 'The78Prof - 1925 HITS ARCHIVE_ Angry - Art Gillham (The Whispering Pianist).mp3',
    title: 'Angry',
    artist: 'Art Gillham',
  },
  {
    id: 'the-prisoners-song',
    file: 'The78Prof - 1925 HITS ARCHIVE_ The Prisoner’s Song - Vernon Dalhart (Victor 19427--Acoustic version).mp3',
    title: 'The Prisoner’s Song',
    artist: 'Vernon Dalhart',
  },
  {
    id: 'the-titanic',
    file: 'The78Prof - 1925 HITS ARCHIVE_ The Titanic - Ernest V. Stoneman.mp3',
    title: 'The Titanic',
    artist: 'Ernest V. Stoneman',
  },
];

const knownTrackByFile = new Map(VAULT_RADIO_TRACKS.map(track => [track.file, track]));

export function createVaultRadioTrack(file: string): VaultRadioTrack {
  const knownTrack = knownTrackByFile.get(file);
  if (knownTrack) return knownTrack;

  const title = file
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    id: file,
    file,
    title: title || file,
    artist: null,
  };
}

export function getAdjacentVaultRadioIndex(
  currentIndex: number | null,
  direction: -1 | 1,
  trackCount: number,
): number | null {
  if (!Number.isInteger(trackCount) || trackCount <= 0) return null;
  const baseIndex = currentIndex ?? (direction > 0 ? -1 : 0);
  return ((baseIndex + direction) % trackCount + trackCount) % trackCount;
}
