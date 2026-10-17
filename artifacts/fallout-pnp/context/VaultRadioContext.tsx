import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { useAudioPlayer } from 'expo-audio';
import {
  getListVaultRadioTracksQueryKey,
  useListVaultRadioTracks,
} from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';
import {
  createVaultRadioTrack,
  getAdjacentVaultRadioIndex,
  VAULT_RADIO_TRACKS,
  type VaultRadioTrack,
} from '@/data/vaultRadio';

const RADIO_FOLDER = 'vault-radio';
const CACHE_FOLDER = 'vault-radio-cache';
type VaultRadioStatus = {
  hasPlaybackError: boolean;
  currentTrack: VaultRadioTrack | null;
  canSkip: boolean;
  skipPrevious: () => void;
  skipNext: () => void;
};

const VaultRadioStatusContext = createContext<VaultRadioStatus>({
  hasPlaybackError: false,
  currentTrack: null,
  canSkip: false,
  skipPrevious: () => {},
  skipNext: () => {},
});

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
    const knownTracks = VAULT_RADIO_TRACKS.filter(track => uploadedSet.has(track.file));
    const knownFiles = new Set<string>(knownTracks.map(track => track.file));
    const additionalTracks = uploadedFiles
      .filter(file => !knownFiles.has(file))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }))
      .map(createVaultRadioTrack);
    return [...knownTracks, ...additionalTracks];
  }, [trackList]);
  const generation = useRef(0);
  const currentTrackIndex = useRef<number | null>(null);
  const finishedTrack = useRef(false);
  const enabledRef = useRef(musicEnabled);
  const volumeRef = useRef(musicVolume);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<VaultRadioTrack | null>(null);

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
      setCurrentTrack(track);
      setHasPlaybackError(false);
    } catch (error) {
      if (generation.current !== playbackGeneration || !enabledRef.current) return;
      console.warn(`Vault Radio could not load ${track.id}.`, error);
      player.pause();
      setCurrentTrack(null);
      setHasPlaybackError(true);
    }
  }, [player, radioTracks]);

  const skipTrack = useCallback((direction: -1 | 1) => {
    if (!enabledRef.current || radioTracks.length < 2) return;
    const nextIndex = getAdjacentVaultRadioIndex(currentTrackIndex.current, direction, radioTracks.length);
    if (nextIndex === null) return;
    const playbackGeneration = ++generation.current;
    currentTrackIndex.current = nextIndex;
    finishedTrack.current = true;
    setCurrentTrack(null);
    setHasPlaybackError(false);
    player.pause();
    void playTrack(nextIndex, playbackGeneration);
  }, [player, playTrack, radioTracks.length]);

  const skipPrevious = useCallback(() => skipTrack(-1), [skipTrack]);
  const skipNext = useCallback(() => skipTrack(1), [skipTrack]);

  useEffect(() => {
    player.volume = musicVolume;
  }, [musicVolume, player]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish && enabledRef.current && !finishedTrack.current) {
        if (radioTracks.length === 0) return;
        finishedTrack.current = true;
        const nextIndex = getAdjacentVaultRadioIndex(currentTrackIndex.current, 1, radioTracks.length);
        if (nextIndex === null) return;
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
      setCurrentTrack(null);
      player.pause();
      setHasPlaybackError(false);
      return () => {
        if (generation.current === playbackGeneration) generation.current += 1;
      };
    }

    if (trackListLoading) {
      currentTrackIndex.current = null;
      setCurrentTrack(null);
      player.pause();
      setHasPlaybackError(false);
      return () => {
        if (generation.current === playbackGeneration) generation.current += 1;
      };
    }

    if (radioTracks.length === 0) {
      currentTrackIndex.current = null;
      setCurrentTrack(null);
      player.pause();
      setHasPlaybackError(true);
      return () => {
        if (generation.current === playbackGeneration) generation.current += 1;
      };
    }

    setHasPlaybackError(false);
    const firstTrackIndex = Math.floor(Math.random() * radioTracks.length);
    currentTrackIndex.current = firstTrackIndex;
    setCurrentTrack(null);
    void playTrack(firstTrackIndex, playbackGeneration);

    return () => {
      if (generation.current === playbackGeneration) generation.current += 1;
      player.pause();
    };
  }, [musicEnabled, player, playTrack, radioTracks.length, trackListLoading]);

  return (
    <VaultRadioStatusContext.Provider value={{
      hasPlaybackError,
      currentTrack,
      canSkip: musicEnabled && radioTracks.length > 1 && (currentTrack !== null || hasPlaybackError),
      skipPrevious,
      skipNext,
    }}>
      {children}
    </VaultRadioStatusContext.Provider>
  );
}

export function useVaultRadioStatus() {
  return useContext(VaultRadioStatusContext);
}
