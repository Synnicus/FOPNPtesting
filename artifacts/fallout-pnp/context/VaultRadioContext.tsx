import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { useAudioPlayer } from 'expo-audio';
import {
  getListVaultRadioTracksQueryKey,
  useListVaultRadioTracks,
} from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';

const RADIO_TRACKS = [
  { id: 'aint-misbehavin', file: '9684-Aint-misbehavin.mp3' },
  { id: 'it-had-to-be-you', file: 'Isham_Jones_-_It_Had_to_Be_You_(1924).mp3' },
  { id: 'rhapsody-in-blue', file: 'Rhapsody in Blue.mp3' },
  { id: 'alabamy-bound', file: 'The78Prof - 1925 HITS ARCHIVE_ Alabamy Bound - Blossom Seeley.mp3' },
  { id: 'angry', file: 'The78Prof - 1925 HITS ARCHIVE_ Angry - Art Gillham (The Whispering Pianist).mp3' },
  { id: 'the-prisoners-song', file: 'The78Prof - 1925 HITS ARCHIVE_ The Prisoner’s Song - Vernon Dalhart (Victor 19427--Acoustic version).mp3' },
  { id: 'the-titanic', file: 'The78Prof - 1925 HITS ARCHIVE_ The Titanic - Ernest V. Stoneman.mp3' },
] as const;

const RADIO_FOLDER = 'vault-radio';
const CACHE_FOLDER = 'vault-radio-cache';
const VaultRadioStatusContext = createContext({ hasPlaybackError: false });

function getTrackUrl(fileName: string) {
  const configuredDomain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!configuredDomain) throw new Error('The app API domain is not configured.');
  const baseUrl = configuredDomain.startsWith('http')
    ? configuredDomain
    : `https://${configuredDomain}`;
  return `${baseUrl}/api/storage/public-objects/${RADIO_FOLDER}/${encodeURIComponent(fileName)}`;
}

async function getPlayableTrackUri(fileName: string): Promise<string> {
  const trackUrl = getTrackUrl(fileName);
  if (Platform.OS === 'web') return trackUrl;

  const cacheDirectory = new Directory(Paths.document, CACHE_FOLDER);
  if (!cacheDirectory.exists) {
    cacheDirectory.create({ intermediates: true, idempotent: true });
  }

  const cachedFile = new File(cacheDirectory, fileName);
  if (cachedFile.exists && (cachedFile.size ?? 0) > 0) return cachedFile.uri;

  const downloadedFile = await File.downloadFileAsync(trackUrl, cachedFile, { idempotent: true });
  if (!downloadedFile.exists || (downloadedFile.size ?? 0) === 0) {
    throw new Error(`The Vault Radio track ${fileName} downloaded empty.`);
  }
  return downloadedFile.uri;
}

export function VaultRadioProvider({ children }: { children: React.ReactNode }) {
  const { musicEnabled, musicVolume } = useApp();
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const { data: trackList, isLoading: trackListLoading } = useListVaultRadioTracks({
    query: {
      enabled: musicEnabled,
      queryKey: getListVaultRadioTracksQueryKey(),
    },
  });
  const radioTracks = useMemo(() => {
    const uploadedFiles = trackList?.tracks ?? [];
    const uploadedSet = new Set(uploadedFiles);
    const knownTracks = RADIO_TRACKS.filter(track => uploadedSet.has(track.file));
    const knownFiles = new Set<string>(knownTracks.map(track => track.file));
    const additionalTracks = uploadedFiles
      .filter(file => !knownFiles.has(file))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }))
      .map(file => ({ id: file, file }));
    return [...knownTracks, ...additionalTracks];
  }, [trackList]);
  const generation = useRef(0);
  const currentTrackIndex = useRef<number | null>(null);
  const finishedTrack = useRef(false);
  const enabledRef = useRef(musicEnabled);
  const volumeRef = useRef(musicVolume);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);

  enabledRef.current = musicEnabled;
  volumeRef.current = musicVolume;

  const playTrack = useCallback(async (index: number, playbackGeneration: number) => {
    const track = radioTracks[index];
    if (!track) return;
    try {
      const uri = await getPlayableTrackUri(track.file);
      if (!enabledRef.current || generation.current !== playbackGeneration) return;

      currentTrackIndex.current = index;
      player.replace({ uri });
      player.loop = false;
      player.volume = volumeRef.current;
      player.play();
      setHasPlaybackError(false);
    } catch (error) {
      if (generation.current !== playbackGeneration || !enabledRef.current) return;
      console.warn(`Vault Radio could not load ${track.id}.`, error);
      player.pause();
      setHasPlaybackError(true);
    }
  }, [player, radioTracks]);

  useEffect(() => {
    player.volume = musicVolume;
  }, [musicVolume, player]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish && enabledRef.current && !finishedTrack.current) {
        if (radioTracks.length === 0) return;
        finishedTrack.current = true;
        const currentIndex = currentTrackIndex.current ?? 0;
        const nextIndex = (currentIndex + 1) % RADIO_TRACKS.length;
        currentTrackIndex.current = nextIndex;
        void playTrack(nextIndex, generation.current);
      } else if (!status.didJustFinish && status.playing) {
        finishedTrack.current = false;
      }
    });
    return () => subscription.remove();
  }, [playTrack, player, radioTracks.length]);

  useEffect(() => {
    const playbackGeneration = ++generation.current;
    if (!musicEnabled) {
      currentTrackIndex.current = null;
      player.pause();
      setHasPlaybackError(false);
      return () => {
        if (generation.current === playbackGeneration) generation.current += 1;
      };
    }

    if (trackListLoading) {
      currentTrackIndex.current = null;
      player.pause();
      setHasPlaybackError(false);
      return () => {
        if (generation.current === playbackGeneration) generation.current += 1;
      };
    }

    if (radioTracks.length === 0) {
      currentTrackIndex.current = null;
      player.pause();
      setHasPlaybackError(true);
      return () => {
        if (generation.current === playbackGeneration) generation.current += 1;
      };
    }

    setHasPlaybackError(false);
    const firstTrackIndex = Math.floor(Math.random() * radioTracks.length);
    currentTrackIndex.current = firstTrackIndex;
    void playTrack(firstTrackIndex, playbackGeneration);

    return () => {
      if (generation.current === playbackGeneration) generation.current += 1;
      player.pause();
    };
  }, [musicEnabled, player, playTrack, radioTracks.length, trackListLoading]);

  return (
    <VaultRadioStatusContext.Provider value={{ hasPlaybackError }}>
      {children}
    </VaultRadioStatusContext.Provider>
  );
}

export function useVaultRadioStatus() {
  return useContext(VaultRadioStatusContext);
}
