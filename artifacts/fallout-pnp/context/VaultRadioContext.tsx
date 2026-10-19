import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import { useAudioPlayer } from 'expo-audio';
import {
  getListVaultRadioTracksQueryKey,
  useListVaultRadioTracks,
} from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';
import {
  applyVaultRadioTrackMetadata,
  createVaultRadioTrack,
  getAdjacentVaultRadioIndex,
  normalizeVaultRadioTrackMetadata,
  VAULT_RADIO_TRACKS,
  type VaultRadioTrack,
  type VaultRadioTrackMetadata,
} from '@/data/vaultRadio';

const RADIO_FOLDER = 'vault-radio';
const CACHE_FOLDER = 'vault-radio-cache';
const METADATA_STORAGE_KEY = 'fallout_pnp_vault_radio_metadata_v1';
type VaultRadioStatus = {
  hasPlaybackError: boolean;
  currentTrack: VaultRadioTrack | null;
  customTracks: VaultRadioTrack[];
  isTrackListLoading: boolean;
  isMetadataLoading: boolean;
  metadataLoadFailed: boolean;
  metadataSaveFailed: boolean;
  updateTrackMetadata: (file: string, field: keyof VaultRadioTrackMetadata, value: string) => void;
  canSkip: boolean;
  skipPrevious: () => void;
  skipNext: () => void;
};

const VaultRadioStatusContext = createContext<VaultRadioStatus>({
  hasPlaybackError: false,
  currentTrack: null,
  customTracks: [],
  isTrackListLoading: true,
  isMetadataLoading: true,
  metadataLoadFailed: false,
  metadataSaveFailed: false,
  updateTrackMetadata: () => {},
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
  const [trackMetadata, setTrackMetadata] = useState<Record<string, VaultRadioTrackMetadata>>({});
  const [isMetadataLoading, setIsMetadataLoading] = useState(true);
  const [metadataLoadFailed, setMetadataLoadFailed] = useState(false);
  const [metadataSaveFailed, setMetadataSaveFailed] = useState(false);
  const metadataRef = useRef(trackMetadata);
  const metadataWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const { data: trackList, isLoading: trackListLoading } = useListVaultRadioTracks({
    query: {
      enabled: musicEnabled,
      queryKey: getListVaultRadioTracksQueryKey(),
    },
  });
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(METADATA_STORAGE_KEY)
      .then(raw => {
        if (!active) return;
        const parsed = raw ? JSON.parse(raw) as unknown : {};
        const normalized = normalizeVaultRadioTrackMetadata(parsed);
        metadataRef.current = normalized;
        setTrackMetadata(normalized);
      })
      .catch(error => {
        if (!active) return;
        console.warn('Vault Radio saved labels could not be loaded.', error);
        setMetadataLoadFailed(true);
      })
      .finally(() => {
        if (active) setIsMetadataLoading(false);
      });
    return () => { active = false; };
  }, []);

  const { radioTracks, customTracks } = useMemo(() => {
    const uploadedFiles = trackList?.tracks ?? [];
    const uploadedSet = new Set(uploadedFiles);
    const knownTracks = VAULT_RADIO_TRACKS.filter(track => uploadedSet.has(track.file));
    const knownFiles = new Set<string>(knownTracks.map(track => track.file));
    const additionalFiles = uploadedFiles
      .filter(file => !knownFiles.has(file))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
    const additionalTracks = additionalFiles
      .map(file => applyVaultRadioTrackMetadata(createVaultRadioTrack(file), trackMetadata[file]));
    return {
      radioTracks: [...knownTracks, ...additionalTracks],
      customTracks: additionalFiles.map(file => {
        const track = createVaultRadioTrack(file);
        const metadata = trackMetadata[file];
        return metadata ? { ...track, ...metadata } : track;
      }),
    };
  }, [trackList, trackMetadata]);
  const generation = useRef(0);
  const radioTracksRef = useRef(radioTracks);
  radioTracksRef.current = radioTracks;
  const currentTrackIndex = useRef<number | null>(null);
  const finishedTrack = useRef(false);
  const enabledRef = useRef(musicEnabled);
  const volumeRef = useRef(musicVolume);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<VaultRadioTrack | null>(null);

  enabledRef.current = musicEnabled;
  volumeRef.current = musicVolume;

  const updateTrackMetadata = useCallback((
    file: string,
    field: keyof VaultRadioTrackMetadata,
    value: string,
  ) => {
    if (
      isMetadataLoading
      || metadataLoadFailed
      || VAULT_RADIO_TRACKS.some(track => track.file === file)
      || !trackList?.tracks.includes(file)
    ) return;

    const fallback = createVaultRadioTrack(file);
    const existing = metadataRef.current[file] ?? { title: fallback.title, artist: fallback.artist };
    const nextEntry: VaultRadioTrackMetadata = field === 'title'
      ? { ...existing, title: value }
      : { ...existing, artist: value.trim() || null };
    const nextMetadata = { ...metadataRef.current, [file]: nextEntry };
    metadataRef.current = nextMetadata;
    setTrackMetadata(nextMetadata);
    metadataWriteQueue.current = metadataWriteQueue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(nextMetadata)))
      .then(() => setMetadataSaveFailed(false))
      .catch(error => {
        console.warn('Vault Radio saved labels could not be written.', error);
        setMetadataSaveFailed(true);
      });
  }, [isMetadataLoading, metadataLoadFailed, trackList]);

  const playTrack = useCallback(async (index: number, playbackGeneration: number) => {
    const track = radioTracksRef.current[index];
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
  }, [player]);

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
      currentTrack: currentTrack
        ? radioTracks.find(track => track.file === currentTrack.file) ?? currentTrack
        : null,
      customTracks,
      isTrackListLoading: trackListLoading,
      isMetadataLoading,
      metadataLoadFailed,
      metadataSaveFailed,
      updateTrackMetadata,
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
