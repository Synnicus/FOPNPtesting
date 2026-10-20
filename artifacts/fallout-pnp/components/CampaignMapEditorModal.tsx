import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CampaignMap, CampaignMapMarker, CampaignMapMarkerIcon, Character } from '@/context/types';
import {
  MAX_CAMPAIGN_MAP_IMAGE_URI_LENGTH,
  MAX_CAMPAIGN_MAP_MARKER_ICON_URI_LENGTH,
  MAX_CAMPAIGN_MAP_MARKER_ICONS,
  normalizeCampaignMap,
} from '@/data/campaignTools';
import { translateText } from '@/data/localization';

type MapTool = 'pan' | 'location' | 'party';
type FeatherName = React.ComponentProps<typeof Feather>['name'];

const BUILT_IN_MARKERS: { id: string; name: string; icon: FeatherName }[] = [
  { id: 'city', name: 'CITY', icon: 'map-pin' },
  { id: 'town', name: 'TOWN', icon: 'home' },
  { id: 'camp', name: 'CAMP', icon: 'flag' },
  { id: 'vault', name: 'VAULT', icon: 'settings' },
  { id: 'cave', name: 'CAVE', icon: 'moon' },
  { id: 'bridge', name: 'BRIDGE', icon: 'git-merge' },
];

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const cloneMap = (map: CampaignMap): CampaignMap => JSON.parse(JSON.stringify(map)) as CampaignMap;

function imageDataUri(asset: ImagePicker.ImagePickerAsset): string | null {
  if (!asset.base64) return null;
  const mime = asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) return null;
  return `data:${mime};base64,${asset.base64}`;
}

export default function CampaignMapEditorModal({
  visible,
  map,
  characters,
  onClose,
  onSave,
  onExport,
}: {
  visible: boolean;
  map: CampaignMap;
  characters: Character[];
  onClose: () => void;
  onSave: (map: CampaignMap) => void;
  onExport: (map: CampaignMap) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<CampaignMap>(() => cloneMap(map));
  const [tool, setTool] = useState<MapTool>('pan');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedIconId, setSelectedIconId] = useState('city');
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [notice, setNotice] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [detectedImageSize, setDetectedImageSize] = useState<{ width: number; height: number } | null>(null);
  const panRef = useRef(pan);
  const panStartRef = useRef(pan);
  const draggedRef = useRef(false);
  panRef.current = pan;

  useEffect(() => {
    if (!visible) return;
    setDraft(cloneMap(map));
    setTool('pan');
    setSelectedLocationId(null);
    setSelectedCharacterId(null);
    setSelectedIconId('city');
    setLocationName('');
    setLocationDescription('');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDetectedImageSize(null);
    setNotice('');
  }, [visible, map.id]);

  useEffect(() => {
    if (!draft.imageDataUri || (draft.imageWidth && draft.imageHeight)) {
      setDetectedImageSize(null);
      return;
    }
    Image.getSize(
      draft.imageDataUri,
      (width, height) => setDetectedImageSize({ width, height }),
      () => setDetectedImageSize(null),
    );
  }, [draft.imageDataUri, draft.imageWidth, draft.imageHeight]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(map);
  const customIcons = draft.markerIcons ?? [];
  const activeCharacters = characters.filter(character => !character.inStorage);
  const selectedLocation = draft.locations.find(location => location.id === selectedLocationId) ?? null;
  const hasMapImage = !!draft.imageDataUri;
  const imageAspect = draft.imageWidth && draft.imageHeight
    ? draft.imageWidth / draft.imageHeight
    : detectedImageSize
      ? detectedImageSize.width / detectedImageSize.height
      : (viewport.width && viewport.height ? viewport.width / viewport.height : 1.5);
  const artboard = useMemo(() => {
    if (!viewport.width || !viewport.height) return { width: 1, height: 1 };
    const fittedScale = Math.min(viewport.width / imageAspect, viewport.height);
    return { width: fittedScale * imageAspect, height: fittedScale };
  }, [imageAspect, viewport.height, viewport.width]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => {
      panStartRef.current = panRef.current;
      draggedRef.current = true;
    },
    onPanResponderMove: (_event, gesture) => {
      setPan({ x: panStartRef.current.x + gesture.dx, y: panStartRef.current.y + gesture.dy });
    },
    onPanResponderRelease: () => {
      setTimeout(() => { draggedRef.current = false; }, 120);
    },
    onPanResponderTerminate: () => {
      draggedRef.current = false;
    },
  })).current;

  const updateDraft = (patch: Partial<CampaignMap>) => {
    setDraft(current => ({ ...current, ...patch }));
    setNotice('');
  };

  const saveMap = (): CampaignMap | null => {
    const normalized = normalizeCampaignMap(draft);
    if (!normalized) {
      setNotice('Map could not be saved.');
      return null;
    }
    onSave(normalized);
    setDraft(cloneMap(normalized));
    setNotice('Map saved to campaign.');
    return normalized;
  };

  const requestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    const saveAndClose = () => {
      if (saveMap()) onClose();
    };
    const discardAndClose = () => onClose();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${translateText('Unsaved map changes')}\n\n${translateText('Save changes before leaving this map?')}`)) {
        saveAndClose();
      } else {
        discardAndClose();
      }
      return;
    }
    Alert.alert('Unsaved map changes', 'Save changes before leaving this map?', [
      { text: 'Continue editing', style: 'cancel' },
      { text: 'Discard changes', style: 'destructive', onPress: discardAndClose },
      { text: 'Save and exit', onPress: saveAndClose },
    ]);
  };

  const pickImage = async (forMarker: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: forMarker,
      ...(forMarker ? { aspect: [1, 1] as [number, number] } : {}),
      base64: true,
      quality: 0.75,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const uri = imageDataUri(asset);
    if (!uri) {
      setNotice('Use a PNG, JPEG, or WEBP image.');
      return;
    }
    if (forMarker) {
      if (customIcons.length >= MAX_CAMPAIGN_MAP_MARKER_ICONS) {
        setNotice(translateText('The marker icon library is limited to {0} images.')
          .replace('{0}', String(MAX_CAMPAIGN_MAP_MARKER_ICONS)));
        return;
      }
      if (uri.length > MAX_CAMPAIGN_MAP_MARKER_ICON_URI_LENGTH) {
        setNotice('Image is too large to add.');
        return;
      }
      const fileName = asset.fileName?.replace(/\.[^.]+$/, '').trim();
      const icon: CampaignMapMarkerIcon = {
        id: makeId('marker'),
        name: (fileName || `Marker ${customIcons.length + 1}`).slice(0, 80),
        imageDataUri: uri,
      };
      updateDraft({ markerIcons: [...customIcons, icon] });
      setSelectedIconId(icon.id);
      setTool('location');
      return;
    }
    if (uri.length > MAX_CAMPAIGN_MAP_IMAGE_URI_LENGTH) {
      setNotice('Image is too large to add.');
      return;
    }
    updateDraft({
      imageDataUri: uri,
      ...(asset.width > 0 ? { imageWidth: asset.width } : {}),
      ...(asset.height > 0 ? { imageHeight: asset.height } : {}),
    });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const selectIcon = (iconId: string) => {
    setSelectedIconId(iconId);
    if (selectedLocation) {
      updateDraft({
        locations: draft.locations.map(location => location.id === selectedLocation.id
          ? { ...location, iconId }
          : location),
      });
    }
  };

  const placeAt = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (!hasMapImage || tool === 'pan') return;
    const { locationX, locationY } = event.nativeEvent;
    const left = (viewport.width - artboard.width * zoom) / 2 + pan.x;
    const top = (viewport.height - artboard.height * zoom) / 2 + pan.y;
    const x = (locationX - left) / (artboard.width * zoom);
    const y = (locationY - top) / (artboard.height * zoom);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (tool === 'location') {
      const name = locationName.trim();
      if (!name) {
        setNotice('Enter a location name before placing it.');
        return;
      }
      if (draft.locations.length >= 200) {
        setNotice('This map has reached its location limit.');
        return;
      }
      const location: CampaignMapMarker = {
        id: makeId('location'),
        name,
        description: locationDescription.trim(),
        iconId: selectedIconId,
        x,
        y,
      };
      updateDraft({ locations: [...draft.locations, location] });
      setSelectedLocationId(location.id);
      setLocationName('');
      setLocationDescription('');
    } else if (tool === 'party') {
      if (!selectedCharacterId) {
        setNotice('Select a character before placing the party marker.');
        return;
      }
      updateDraft({
        party: [
          ...draft.party.filter(marker => marker.characterId !== selectedCharacterId),
          { characterId: selectedCharacterId, x, y },
        ],
      });
    }
  };

  const updateLocation = (patch: Partial<CampaignMapMarker>) => {
    if (!selectedLocation) return;
    updateDraft({
      locations: draft.locations.map(location => location.id === selectedLocation.id
        ? { ...location, ...patch }
        : location),
    });
  };

  const removeLocation = () => {
    if (!selectedLocation) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${translateText('Remove location?')}\n\n${translateText('This location marker will be removed from the map.')}`)) {
        updateDraft({ locations: draft.locations.filter(location => location.id !== selectedLocation.id) });
        setSelectedLocationId(null);
      }
      return;
    }
    Alert.alert('Remove location?', 'This location marker will be removed from the map.', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE',
        style: 'destructive',
        onPress: () => {
          updateDraft({ locations: draft.locations.filter(location => location.id !== selectedLocation.id) });
          setSelectedLocationId(null);
        },
      },
    ]);
  };

  const removePartyMarker = (characterId: string) => {
    updateDraft({ party: draft.party.filter(marker => marker.characterId !== characterId) });
    if (selectedCharacterId === characterId) setSelectedCharacterId(null);
  };

  const renderIcon = (iconId: string, size: number, color: string) => {
    const custom = customIcons.find(icon => icon.id === iconId);
    if (custom) {
      return <Image source={{ uri: custom.imageDataUri }} style={{ width: size, height: size, borderRadius: 4 }} />;
    }
    const icon = BUILT_IN_MARKERS.find(item => item.id === iconId) ?? BUILT_IN_MARKERS[0];
    return <Feather name={icon.icon} size={size} color={color} />;
  };

  const iconPicker = (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>
        CUSTOM MARKER ICONS
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 6 }}>
        {BUILT_IN_MARKERS.map(marker => {
          const active = selectedIconId === marker.id;
          return (
            <TouchableOpacity
              key={marker.id}
              accessibilityLabel={marker.name}
              onPress={() => selectIcon(marker.id)}
              style={{
                alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 52, padding: 7,
                borderRadius: 8, borderWidth: 1, borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.secondary : colors.card,
              }}
            >
              <Feather name={marker.icon} size={18} color={active ? colors.primary : colors.text} />
              <Text style={{ color: active ? colors.primary : colors.text, fontSize: 9 }}>{marker.name}</Text>
            </TouchableOpacity>
          );
        })}
        {customIcons.map(icon => {
          const active = selectedIconId === icon.id;
          return (
            <TouchableOpacity
              key={icon.id}
              accessibilityLabel={icon.name}
              onPress={() => selectIcon(icon.id)}
              style={{
                alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 54, maxWidth: 72, padding: 6,
                borderRadius: 8, borderWidth: 1, borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.secondary : colors.card,
              }}
            >
              <Image source={{ uri: icon.imageDataUri }} style={{ width: 20, height: 20, borderRadius: 4 }} />
              <Text numberOfLines={1} style={{ color: active ? colors.primary : colors.text, fontSize: 9 }}>{icon.name}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          accessibilityLabel="UPLOAD MARKER ICON"
          onPress={() => void pickImage(true)}
          style={{
            alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 56, padding: 7,
            borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
          }}
        >
          <Feather name="plus" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 9 }}>UPLOAD MARKER ICON</Text>
        </TouchableOpacity>
      </ScrollView>
      {customIcons.length === 0 && (
        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>No custom marker icons yet.</Text>
      )}
    </View>
  );

  const toolButton = (nextTool: MapTool, label: string, icon: FeatherName) => {
    const active = tool === nextTool;
    return (
      <TouchableOpacity
        key={nextTool}
        accessibilityLabel={label}
        onPress={() => {
          setTool(nextTool);
          setSelectedLocationId(null);
        }}
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          paddingVertical: 10, borderRadius: 8, borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.secondary : colors.card,
        }}
      >
        <Feather name={icon} size={15} color={active ? colors.primary : colors.mutedForeground} />
        <Text style={{ color: active ? colors.primary : colors.text, fontSize: 10, fontWeight: '700' }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const selectedMapImageButton = (
    <TouchableOpacity
      onPress={() => void pickImage(false)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8,
        borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.card,
      }}
    >
      <Feather name="image" size={14} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>
        {hasMapImage ? 'CHANGE MAP IMAGE' : 'UPLOAD MAP IMAGE'}
      </Text>
    </TouchableOpacity>
  );

  const mapBoxLeft = (viewport.width - artboard.width) / 2 + pan.x;
  const mapBoxTop = (viewport.height - artboard.height) / 2 + pan.y;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={requestClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 12 : 8) }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}>
          <TouchableOpacity accessibilityLabel="CLOSE EDITOR" onPress={requestClose} style={{ padding: 8 }}>
            <Feather name="arrow-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            value={draft.name}
            onChangeText={name => updateDraft({ name })}
            placeholder="Map name"
            accessibilityLabel="Map name"
            style={{
              flex: 1, minWidth: 0, color: colors.text, fontWeight: '700', fontSize: 15,
              paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border,
              borderRadius: 7, backgroundColor: colors.card,
            }}
          />
          <TouchableOpacity
            accessibilityLabel="JSON"
            onPress={() => onExport(draft)}
            style={{ padding: 9, borderRadius: 7, borderWidth: 1, borderColor: colors.border }}
          >
            <Feather name="download" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="SAVE MAP"
            onPress={() => saveMap()}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 9,
              borderRadius: 7, backgroundColor: colors.primary, opacity: dirty ? 1 : 0.78,
            }}
          >
            <Feather name="save" size={14} color={colors.primaryForeground} />
            <Text style={{ color: colors.primaryForeground, fontSize: 10, fontWeight: '800' }}>SAVE MAP</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
          <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
            MAP DETAILS
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
          <TextInput
            value={draft.description}
            onChangeText={description => updateDraft({ description })}
            placeholder="Map description"
            accessibilityLabel="Map description"
            style={{
              flex: 1, minWidth: 0, color: colors.mutedForeground, fontSize: 11,
              paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border,
              borderRadius: 7, backgroundColor: colors.card,
            }}
          />
          {selectedMapImageButton}
          {hasMapImage ? (
            <TouchableOpacity
              accessibilityLabel="Remove map image"
              onPress={() => {
                updateDraft({ imageDataUri: undefined, imageWidth: undefined, imageHeight: undefined });
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              style={{ padding: 9, borderRadius: 7, borderWidth: 1, borderColor: colors.border }}
            >
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          {...panResponder.panHandlers}
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            if (width !== viewport.width || height !== viewport.height) setViewport({ width, height });
          }}
          style={{
            flex: 1, overflow: 'hidden', backgroundColor: colors.card, position: 'relative',
            ...(Platform.OS === 'web' ? { touchAction: 'none' } as object : {}),
          }}
        >
          <Pressable
            onPress={placeAt}
            accessibilityLabel="Place a map marker"
            style={{ position: 'absolute', inset: 0 }}
          />
          {hasMapImage && viewport.width > 0 && viewport.height > 0 && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute', left: mapBoxLeft, top: mapBoxTop,
                width: artboard.width, height: artboard.height,
                transform: [{ scale: zoom }],
              }}
            >
              <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
                <Image
                  source={{ uri: draft.imageDataUri }}
                  resizeMode="stretch"
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
              {draft.locations.map(location => {
                const active = selectedLocationId === location.id;
                return (
                  <TouchableOpacity
                    key={location.id}
                    onPress={event => {
                      event.stopPropagation();
                      setSelectedLocationId(location.id);
                      setSelectedIconId(location.iconId ?? 'city');
                      setLocationName(location.name);
                      setLocationDescription(location.description);
                      setTool('location');
                    }}
                    style={{
                      position: 'absolute', left: location.x * artboard.width, top: location.y * artboard.height,
                      width: 30, height: 38, alignItems: 'center', justifyContent: 'center',
                      marginLeft: -15, marginTop: -34,
                    }}
                  >
                    <View style={{
                      width: 28, height: 28, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: colors.background, borderWidth: active ? 3 : 1.5,
                      borderColor: active ? colors.warning : colors.primary,
                    }}>
                      {renderIcon(location.iconId ?? 'city', 15, colors.primary)}
                    </View>
                    <View style={{
                      position: 'absolute', bottom: -2, width: 0, height: 0,
                      borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
                      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.primary,
                    }} />
                  </TouchableOpacity>
                );
              })}
              {draft.party.map(marker => {
                const character = activeCharacters.find(item => item.id === marker.characterId);
                return (
                  <TouchableOpacity
                    key={marker.characterId}
                    accessibilityLabel={character?.name ?? 'Unknown character'}
                    onPress={event => {
                      event.stopPropagation();
                      setTool('party');
                      setSelectedCharacterId(marker.characterId);
                    }}
                    style={{
                      position: 'absolute', left: marker.x * artboard.width, top: marker.y * artboard.height,
                      width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
                      marginLeft: -16, marginTop: -16, borderRadius: 18, borderWidth: 2,
                      borderColor: colors.primaryForeground, backgroundColor: colors.primary,
                    }}
                  >
                    <Feather name="user" size={15} color={colors.primaryForeground} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 5 }}>
            {[
              { icon: 'minus' as const, label: 'Zoom out', action: () => setZoom(value => Math.max(0.5, Number((value - 0.25).toFixed(2)))) },
              { icon: 'plus' as const, label: 'Zoom in', action: () => setZoom(value => Math.min(3, Number((value + 0.25).toFixed(2)))) },
              { icon: 'crosshair' as const, label: 'Reset map view', action: () => { setZoom(1); setPan({ x: 0, y: 0 }); } },
            ].map(control => (
              <TouchableOpacity
                key={control.label}
                accessibilityLabel={control.label}
                onPress={control.action}
                style={{
                  width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9,
                  borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
                }}
              >
                <Feather name={control.icon} size={15} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>

          {hasMapImage ? (
            <View
              style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
              pointerEvents="none"
            >
              <Feather name="move" size={12} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 9 }}>DRAG TO PAN</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{Math.round(zoom * 100)}%</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => void pickImage(false)}
              style={{ position: 'absolute', left: '10%', right: '10%', top: '35%', alignItems: 'center', gap: 9, padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 12 }}
            >
              <Feather name="image" size={30} color={colors.primary} />
              <Text style={{ color: colors.text, textAlign: 'center' }}>Upload a custom map image to place markers.</Text>
              {selectedMapImageButton}
            </TouchableOpacity>
          )}

          {hasMapImage && (
            <View
              style={{
                position: 'absolute', bottom: 12, left: 10, right: 10, gap: 8,
                padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                backgroundColor: colors.background,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {toolButton('pan', 'DRAG TO PAN', 'move')}
                {toolButton('location', 'PLACE LOCATION', 'map-pin')}
                {toolButton('party', 'PLACE PARTY', 'users')}
              </View>

              {tool === 'location' && selectedLocation ? (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      value={selectedLocation.name}
                      onChangeText={name => updateLocation({ name })}
                      placeholder="New location name"
                      accessibilityLabel="New location name"
                      style={{ flex: 1, color: colors.text, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.card }}
                    />
                    <TouchableOpacity onPress={removeLocation} style={{ padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 7 }}>
                      <Feather name="trash-2" size={15} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={selectedLocation.description}
                    onChangeText={description => updateLocation({ description })}
                    placeholder={translateText('Description for {0}').replace('{0}', selectedLocation.name)}
                    accessibilityLabel={translateText('Description for {0}').replace('{0}', selectedLocation.name)}
                    multiline
                    style={{ minHeight: 42, maxHeight: 80, color: colors.text, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.card }}
                  />
                  {iconPicker}
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                    {selectedLocation.name}
                    {selectedLocation.description ? ` · ${selectedLocation.description}` : ''}
                  </Text>
                </View>
              ) : tool === 'location' ? (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      value={locationName}
                      onChangeText={setLocationName}
                      placeholder="New location name"
                      accessibilityLabel="New location name"
                      style={{ flex: 1, minWidth: 0, color: colors.text, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.card }}
                    />
                    <TextInput
                      value={locationDescription}
                      onChangeText={setLocationDescription}
                      placeholder="Map notes"
                      accessibilityLabel="Map notes"
                      style={{ flex: 1, minWidth: 0, color: colors.text, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.card }}
                    />
                  </View>
                  {iconPicker}
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Location name, then tap map</Text>
                </View>
              ) : tool === 'party' ? (
                <View style={{ gap: 7 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                    {selectedCharacterId
                      ? 'Tap the map to place the selected character.'
                      : 'Add an active character to place the party.'}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {activeCharacters.map(character => {
                      const active = selectedCharacterId === character.id;
                      const hasMarker = draft.party.some(marker => marker.characterId === character.id);
                      return (
                        <View key={character.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedCharacterId(character.id);
                              setNotice('');
                            }}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7,
                              borderWidth: 1, borderColor: active ? colors.primary : colors.border,
                              borderRadius: hasMarker ? 0 : 7, borderTopLeftRadius: 7, borderBottomLeftRadius: 7,
                              backgroundColor: active ? colors.secondary : colors.card,
                            }}
                          >
                            <Feather name={hasMarker ? 'map-pin' : 'user'} size={12} color={active ? colors.primary : colors.mutedForeground} />
                            <Text style={{ color: active ? colors.primary : colors.text, fontSize: 10 }}>{character.name}</Text>
                          </TouchableOpacity>
                          {hasMarker ? (
                            <TouchableOpacity
                              accessibilityLabel={translateText('Remove {0} marker').replace('{0}', character.name)}
                              onPress={() => removePartyMarker(character.id)}
                              style={{
                                padding: 7, borderWidth: 1, borderLeftWidth: 0, borderColor: colors.border,
                                borderTopRightRadius: 7, borderBottomRightRadius: 7, backgroundColor: colors.card,
                              }}
                            >
                              <Feather name="x" size={13} color={colors.destructive} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                  DRAG TO PAN
                </Text>
              )}
              {!!notice && <Text style={{ color: colors.warning, fontSize: 11 }}>{notice}</Text>}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 12, paddingVertical: 6, paddingBottom: Math.max(insets.bottom, 6), borderTopWidth: 1, borderTopColor: colors.border, minHeight: 27 }}>
          <Text style={{ color: notice ? colors.warning : dirty ? colors.mutedForeground : colors.success, fontSize: 10 }}>
            {notice || (dirty ? 'Map changes are saved to the campaign when you tap Save Map.' : 'Map saved to campaign.')}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
