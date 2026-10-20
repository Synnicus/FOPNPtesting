import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LocalizedAlert, LocalizedText as Text, LocalizedTextInput, LocalizedTouchableOpacity as TouchableOpacity, localizedConfirm } from '@/components/LocalizedText';
import { useApp } from '@/context/AppContext';
import { useLocalization } from '@/context/LocalizationContext';
import { useVaultRadioStatus } from '@/context/VaultRadioContext';
import { useColors } from '@/hooks/useColors';
import {
  createRadioSongId,
  createRadioStationId,
  DEFAULT_RADIO_STATION_ID,
  MAX_RADIO_STATIONS,
  type RadioStation,
  type RadioStationSong,
} from '@/data/radioStations';
import { translateText } from '@/data/localization';

type RadioStationsModalProps = {
  visible: boolean;
  onClose: () => void;
};

function cloneStation(station: RadioStation): RadioStation {
  return { ...station, songs: station.songs.map(song => ({ ...song })) };
}

export default function RadioStationsModal({ visible, onClose }: RadioStationsModalProps) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const { locale } = useLocalization();
  const {
    radioStations,
    activeRadioStationId,
    musicEnabled,
    saveRadioStations,
    selectRadioStation,
    setMusicEnabled,
  } = useApp();
  const { availableTracks, isTrackListLoading, hasPlaybackError } = useVaultRadioStatus();
  const [mode, setMode] = useState<'stations' | 'editor' | 'audioPicker'>('stations');
  const [draft, setDraft] = useState<RadioStation | null>(null);
  const [pickerSongId, setPickerSongId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!visible) {
      setMode('stations');
      setDraft(null);
      setPickerSongId(null);
      setMessage('');
    }
  }, [visible]);

  const safeTop = Math.max(insets.top, Platform.OS === 'web' ? 67 : 12);
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 12);
  const inputStyle = {
    minHeight: 44,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: palette.radius,
    backgroundColor: palette.background,
    color: palette.foreground,
    fontSize: 14,
    fontFamily: 'Inter_400Regular' as const,
  };
  const panelStyle = {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: palette.radius,
    backgroundColor: palette.secondary,
  };
  const actionStyle = {
    minHeight: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: palette.radius,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.primary + '12',
  };

  const updateDraft = (update: (station: RadioStation) => RadioStation) => {
    setDraft(current => current ? update(current) : current);
    setMessage('');
  };

  const startEditing = (station: RadioStation) => {
    setDraft(cloneStation(station));
    setPickerSongId(null);
    setMode('editor');
    setMessage('');
  };

  const addStation = () => {
    if (radioStations.length >= MAX_RADIO_STATIONS) {
      setMessage('You can have up to 50 radio stations in one campaign.');
      return;
    }
    setDraft({
      id: createRadioStationId(),
      name: translateText('New station', locale),
      description: '',
      songs: [],
    });
    setMode('editor');
    setMessage('');
  };

  const saveDraft = () => {
    if (!draft?.name.trim()) {
      setMessage('Enter a station name.');
      return;
    }
    const updated = radioStations.some(station => station.id === draft.id)
      ? radioStations.map(station => station.id === draft.id ? draft : station)
      : [...radioStations, draft];
    saveRadioStations(updated);
    setDraft(null);
    setMode('stations');
    setMessage('');
  };

  const removeDraft = () => {
    if (!draft || draft.id === DEFAULT_RADIO_STATION_ID) return;
    const remove = () => {
      saveRadioStations(radioStations.filter(station => station.id !== draft.id));
      setDraft(null);
      setMode('stations');
      setMessage('');
    };
    if (Platform.OS === 'web') {
      if (localizedConfirm('Remove this custom station?', 'This removes the station and its playlist data from this campaign. Audio files are not deleted.')) remove();
      return;
    }
    LocalizedAlert.alert(
      'Remove this custom station?',
      'This removes the station and its playlist data from this campaign. Audio files are not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove station', style: 'destructive', onPress: remove },
      ],
    );
  };

  const selectStation = (station: RadioStation) => {
    if (isTrackListLoading) {
      setMessage('Loading uploaded tracks…');
      return;
    }
    const playableCount = station.songs.filter(song =>
      !!song.file && availableTracks.some(track => track.file === song.file),
    ).length;
    if (playableCount === 0) {
      setMessage('This station has no available songs. Edit it to add or relink tracks.');
      return;
    }
    selectRadioStation(station.id);
    setMode('stations');
    onClose();
  };

  const addSong = () => {
    if (!draft || draft.songs.length >= 100) return;
    const song: RadioStationSong = {
      id: createRadioSongId(),
      file: null,
      title: '',
      artist: null,
    };
    updateDraft(station => ({ ...station, songs: [...station.songs, song] }));
  };

  const updateSong = (songId: string, update: (song: RadioStationSong) => RadioStationSong) => {
    updateDraft(station => ({
      ...station,
      songs: station.songs.map(song => song.id === songId ? update(song) : song),
    }));
  };

  const selectAudioFile = (songId: string, file: string) => {
    const track = availableTracks.find(item => item.file === file);
    updateSong(songId, song => ({
      ...song,
      file,
      title: song.title.trim() ? song.title : track?.title ?? '',
      artist: song.artist ?? track?.artist ?? null,
    }));
    setPickerSongId(null);
    setMode('editor');
  };

  const moveSong = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.songs.length) return;
    const songs = [...draft.songs];
    [songs[index], songs[nextIndex]] = [songs[nextIndex], songs[index]];
    updateDraft(station => ({ ...station, songs }));
  };

  const title = mode === 'audioPicker'
    ? 'Select audio file'
    : mode === 'editor'
      ? 'Edit station'
      : 'Available radio stations';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (mode === 'audioPicker') {
          setMode('editor');
          return;
        }
        if (mode === 'editor') {
          setDraft(null);
          setMode('stations');
          return;
        }
        onClose();
      }}
    >
      <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: safeTop, paddingBottom: safeBottom }}>
        <View style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}>
          <Text accessibilityRole="header" style={{
            flex: 1,
            color: palette.primary,
            fontFamily: 'Inter_700Bold',
            fontSize: 14,
            letterSpacing: 1.2,
          }}>
            {title}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close radio stations"
            testID="radio-stations-close"
            onPress={() => {
              if (mode === 'audioPicker') setMode('editor');
              else if (mode === 'editor') {
                setDraft(null);
                setMode('stations');
              } else onClose();
            }}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name={mode === 'stations' ? 'x' : 'arrow-left'} size={20} color={palette.foreground} />
          </TouchableOpacity>
        </View>

        {mode === 'stations' ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
              Choose a station to play or edit its name, description, and track list.
            </Text>
            {radioStations.map(station => {
              const isPlaying = musicEnabled && activeRadioStationId === station.id;
              const availableCount = station.songs.filter(song =>
                !!song.file && availableTracks.some(track => track.file === song.file),
              ).length;
              return (
                <View key={station.id} style={{ ...panelStyle, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Select station"
                    accessibilityHint="Starts this station and closes the station list."
                    testID={`radio-station-play-${station.id}`}
                    disabled={isTrackListLoading}
                    onPress={() => selectStation(station)}
                    style={{ flex: 1, minWidth: 0, padding: 13, gap: 5, opacity: isTrackListLoading ? 0.55 : 1 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
                        {station.name}
                      </Text>
                      {isPlaying && <Feather name="volume-2" size={15} color={palette.primary} />}
                    </View>
                    {!!station.description && (
                      <Text numberOfLines={2} style={{ fontSize: 11, lineHeight: 15, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                        {station.description}
                      </Text>
                    )}
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: isPlaying ? palette.primary : palette.mutedForeground }}>
                      {isPlaying ? 'Currently playing' : 'Songs available'}
                    </Text>
                    {!isPlaying && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                        {availableCount}/{station.songs.length}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Edit station"
                    testID={`radio-station-edit-${station.id}`}
                    onPress={() => startEditing(station)}
                    style={{ width: 48, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: palette.border }}
                  >
                    <Feather name="edit-3" size={17} color={palette.primary} />
                  </TouchableOpacity>
                </View>
              );
            })}
            {isTrackListLoading && (
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                Loading uploaded tracks…
              </Text>
            )}
            {!isTrackListLoading && availableTracks.length === 0 && (
              <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                No audio files are available. Upload music to the public vault-radio folder in App Storage first.
              </Text>
            )}
            {!!message && (
              <Text accessibilityRole="alert" style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: palette.warning }}>
                {message}
              </Text>
            )}
            {hasPlaybackError && musicEnabled && (
              <Text accessibilityRole="alert" style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: palette.destructive }}>
                Unable to load this station. Check the connection and audio files.
              </Text>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Add station"
              testID="radio-station-add"
              disabled={radioStations.length >= MAX_RADIO_STATIONS}
              onPress={addStation}
              style={{ ...actionStyle, opacity: radioStations.length >= MAX_RADIO_STATIONS ? 0.45 : 1 }}
            >
              <Feather name="plus" size={16} color={palette.primary} />
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.primary, letterSpacing: 0.7 }}>
                Add station
              </Text>
            </TouchableOpacity>
            {musicEnabled && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Turn radio off"
                testID="radio-turn-off"
                onPress={() => {
                  setMusicEnabled(false);
                  onClose();
                }}
                style={{ ...panelStyle, minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: 10 }}
              >
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: palette.mutedForeground }}>
                  Turn radio off
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        ) : mode === 'audioPicker' ? (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
              Choose an uploaded audio file.
            </Text>
            {isTrackListLoading ? (
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                Loading uploaded tracks…
              </Text>
            ) : availableTracks.length === 0 ? (
              <Text style={{ fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                No audio files are available. Upload music to the public vault-radio folder in App Storage first.
              </Text>
            ) : availableTracks.map(track => (
              <TouchableOpacity
                key={track.file}
                accessibilityRole="button"
                accessibilityLabel="Select audio file"
                testID={`radio-audio-file-${track.file}`}
                onPress={() => pickerSongId && selectAudioFile(pickerSongId, track.file)}
                style={{ ...panelStyle, minHeight: 58, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9, gap: 4 }}
              >
                <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
                  {track.title}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                  {track.artist ? `${track.artist} · ` : ''}{track.file}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 13 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
          >
            {draft && (
              <>
                <View style={{ gap: 5 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: palette.mutedForeground, letterSpacing: 0.8 }}>
                    Station name
                  </Text>
                  <LocalizedTextInput
                    accessibilityLabel="Station name"
                    testID="radio-station-name"
                    value={draft.name}
                    onChangeText={name => updateDraft(station => ({ ...station, name }))}
                    placeholder="Station name"
                    maxLength={100}
                    style={inputStyle}
                  />
                </View>
                <View style={{ gap: 5 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: palette.mutedForeground, letterSpacing: 0.8 }}>
                    Description
                  </Text>
                  <LocalizedTextInput
                    accessibilityLabel="Station description"
                    testID="radio-station-description"
                    value={draft.description}
                    onChangeText={description => updateDraft(station => ({ ...station, description }))}
                    placeholder="Description"
                    maxLength={500}
                    multiline
                    style={{ ...inputStyle, minHeight: 74, paddingVertical: 10, textAlignVertical: 'top' }}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: palette.primary, letterSpacing: 0.9 }}>
                    Songs ({draft.songs.length})
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Add song"
                    testID="radio-song-add"
                    disabled={draft.songs.length >= 100}
                    onPress={addSong}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, padding: 7, opacity: draft.songs.length >= 100 ? 0.4 : 1 }}
                  >
                    <Feather name="plus" size={14} color={palette.primary} />
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: palette.primary }}>
                      Add song
                    </Text>
                  </TouchableOpacity>
                </View>
                {draft.songs.length === 0 && (
                  <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                    No songs added yet.
                  </Text>
                )}
                {draft.songs.map((song, index) => {
                  const isAvailable = !!song.file && availableTracks.some(track => track.file === song.file);
                  return (
                    <View key={song.id} style={{ ...panelStyle, padding: 11, gap: 9 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Inter_700Bold', color: palette.mutedForeground }}>
                          Song {index + 1}
                        </Text>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Move song up"
                          testID={`radio-song-up-${index}`}
                          disabled={index === 0}
                          onPress={() => moveSong(index, -1)}
                          style={{ padding: 5, opacity: index === 0 ? 0.3 : 1 }}
                        >
                          <Feather name="arrow-up" size={14} color={palette.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Move song down"
                          testID={`radio-song-down-${index}`}
                          disabled={index === draft.songs.length - 1}
                          onPress={() => moveSong(index, 1)}
                          style={{ padding: 5, opacity: index === draft.songs.length - 1 ? 0.3 : 1 }}
                        >
                          <Feather name="arrow-down" size={14} color={palette.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Remove song"
                          testID={`radio-song-remove-${index}`}
                          onPress={() => updateDraft(station => ({
                            ...station,
                            songs: station.songs.filter(item => item.id !== song.id),
                          }))}
                          style={{ padding: 5 }}
                        >
                          <Feather name="trash-2" size={14} color={palette.destructive} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={song.file ? 'Replace audio' : 'Select audio file'}
                        testID={`radio-song-file-${index}`}
                        onPress={() => {
                          setPickerSongId(song.id);
                          setMode('audioPicker');
                        }}
                        style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderWidth: 1, borderColor: isAvailable ? palette.border : palette.warning, borderRadius: palette.radius }}
                      >
                        <Feather name={isAvailable ? 'music' : 'alert-circle'} size={14} color={isAvailable ? palette.primary : palette.warning} />
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 10, fontFamily: 'Inter_500Medium', color: isAvailable ? palette.foreground : palette.warning }}>
                          {song.file ?? 'No audio file selected'}
                        </Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: palette.primary }}>
                          {song.file ? 'Replace audio' : 'Select audio file'}
                        </Text>
                      </TouchableOpacity>
                      {!!song.file && !isAvailable && (
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: palette.warning }}>
                          Audio file missing. Choose an uploaded file to replace this slot.
                        </Text>
                      )}
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: palette.foreground }}>Track title</Text>
                        <LocalizedTextInput
                          accessibilityLabel="Track title"
                          testID={`radio-song-title-${index}`}
                          value={song.title}
                          onChangeText={title => updateSong(song.id, item => ({ ...item, title }))}
                          placeholder="Track title"
                          maxLength={200}
                          style={inputStyle}
                        />
                      </View>
                      <View style={{ gap: 4 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: palette.foreground }}>Artist</Text>
                        <LocalizedTextInput
                          accessibilityLabel="Artist"
                          testID={`radio-song-artist-${index}`}
                          value={song.artist ?? ''}
                          onChangeText={artist => updateSong(song.id, item => ({ ...item, artist: artist || null }))}
                          placeholder="Artist (optional)"
                          maxLength={200}
                          style={inputStyle}
                        />
                      </View>
                    </View>
                  );
                })}
                {!!message && (
                  <Text accessibilityRole="alert" style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: palette.destructive }}>
                    {message}
                  </Text>
                )}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save station"
                  testID="radio-station-save"
                  onPress={saveDraft}
                  style={{ ...actionStyle, backgroundColor: palette.primary }}
                >
                  <Feather name="check" size={15} color={palette.primaryForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.primaryForeground, letterSpacing: 0.8 }}>
                    Save station
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing station"
                  testID="radio-station-cancel"
                  onPress={() => {
                    setDraft(null);
                    setMode('stations');
                    setMessage('');
                  }}
                  style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center', padding: 8 }}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: palette.mutedForeground }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                {draft.id !== DEFAULT_RADIO_STATION_ID && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Remove station"
                    testID="radio-station-remove"
                    onPress={removeDraft}
                    style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: palette.destructive, borderRadius: palette.radius, backgroundColor: palette.destructive + '12' }}
                  >
                    <Feather name="trash-2" size={14} color={palette.destructive} />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: palette.destructive }}>
                      Remove station
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </KeyboardAwareScrollViewCompat>
        )}
      </View>
    </Modal>
  );
}
