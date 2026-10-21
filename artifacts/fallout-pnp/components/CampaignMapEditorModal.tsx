import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Platform,
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
import type { CampaignMap, CampaignMapMarker, CampaignMapMarkerIcon } from '@/context/types';
import DraggableMapMarker from '@/components/DraggableMapMarker';
import CaveIcon from '@/components/CaveIcon';
import { mapViewportCenter } from '@/data/mapPlacement';
import {
  MAX_CAMPAIGN_MAP_IMAGE_URI_LENGTH,
  MAX_CAMPAIGN_MAP_MARKER_ICON_URI_LENGTH,
  MAX_CAMPAIGN_MAP_MARKER_ICONS,
  normalizeCampaignMap,
} from '@/data/campaignTools';
import { translateText } from '@/data/localization';

type MapTool = 'pan' | 'location' | 'edit';
type FeatherName = React.ComponentProps<typeof Feather>['name'];

const BUILT_IN_MARKERS: { id: string; name: string; icon: FeatherName | 'cave' }[] = [
  { id: 'city', name: 'CITY', icon: 'map-pin' },
  { id: 'town', name: 'TOWN', icon: 'home' },
  { id: 'camp', name: 'CAMP', icon: 'flag' },
  { id: 'vault', name: 'VAULT', icon: 'settings' },
  { id: 'cave', name: 'CAVE', icon: 'cave' },
  { id: 'bridge', name: 'BRIDGE', icon: 'git-merge' },
  { id: 'party', name: 'Party', icon: 'user' },
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
  onClose,
  onSave,
  onExport,
}: {
  visible: boolean;
  map: CampaignMap;
  onClose: () => void;
  onSave: (map: CampaignMap) => void;
  onExport: (map: CampaignMap) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<CampaignMap>(() => cloneMap(map));
  const [tool, setTool] = useState<MapTool>('pan');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<CampaignMapMarker | null>(null);
  const [selectedIconId, setSelectedIconId] = useState('city');
  const [notice, setNotice] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [detectedImageSize, setDetectedImageSize] = useState<{ width: number; height: number } | null>(null);
  const panRef = useRef(pan);
  const panStartRef = useRef(pan);
  const centerNewMarkerRef = useRef(false);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  panRef.current = pan;

  useEffect(() => {
    if (!visible) return;
    setDraft(cloneMap(map));
    setTool('pan');
    setSelectedLocationId(null);
    setPendingLocation(null);
    centerNewMarkerRef.current = false;
    setSelectedIconId('city');
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
    onMoveShouldSetPanResponder: (_event, gesture) =>
      toolRef.current === 'pan' && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
    onPanResponderGrant: () => {
      panStartRef.current = panRef.current;
    },
    onPanResponderMove: (_event, gesture) => {
      if (toolRef.current === 'pan') {
        setPan({ x: panStartRef.current.x + gesture.dx, y: panStartRef.current.y + gesture.dy });
      }
    },
  })).current;

  const updateDraft = (patch: Partial<CampaignMap>) => {
    setDraft(current => ({ ...current, ...patch }));
    setNotice('');
  };

  const saveMap = (): CampaignMap | null => {
    if (pendingLocation) {
      setNotice('Confirm or cancel placement before saving.');
      return null;
    }
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
    if (pendingLocation) {
      setNotice('Confirm or cancel placement before saving.');
      return;
    }
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
      setPendingLocation(current => current ? { ...current, iconId: icon.id } : current);
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
    setPendingLocation(current => current ? { ...current, iconId } : current);
  };

  const confirmPlacement = () => {
    if (!pendingLocation) return;
    if (!pendingLocation.name.trim()) {
      setNotice('Enter a location name before placing it.');
      return;
    }
    const location = { ...pendingLocation, name: pendingLocation.name.trim(), description: pendingLocation.description.trim() };
    updateDraft({
      locations: selectedLocationId
        ? draft.locations.map(item => item.id === selectedLocationId ? location : item)
        : [...draft.locations, location],
    });
    setPendingLocation(null);
    setSelectedLocationId(null);
    setTool('edit');
  };

  const updateLocation = (patch: Partial<CampaignMapMarker>) => {
    setPendingLocation(current => current ? { ...current, ...patch } : current);
    setNotice('');
  };

  const removeLocation = () => {
    if (!selectedLocation) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${translateText('Remove location?')}\n\n${translateText('This location marker will be removed from the map.')}`)) {
        updateDraft({ locations: draft.locations.filter(location => location.id !== selectedLocation.id) });
        setSelectedLocationId(null);
        setPendingLocation(null);
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
          setPendingLocation(null);
        },
      },
    ]);
  };

  const renderIcon = (iconId: string, size: number, color: string) => {
    const custom = customIcons.find(icon => icon.id === iconId);
    if (custom) {
      return <Image source={{ uri: custom.imageDataUri }} style={{ width: size, height: size, borderRadius: 4 }} />;
    }
    const icon = BUILT_IN_MARKERS.find(item => item.id === iconId) ?? BUILT_IN_MARKERS[0];
    if (icon.icon === 'cave') return <CaveIcon size={size} color={color} />;
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
              {renderIcon(marker.id, 18, active ? colors.primary : colors.text)}
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
          if (pendingLocation) {
            setNotice('Confirm or cancel placement before changing tools.');
            return;
          }
          if (nextTool === 'location') {
            if (draft.locations.length >= 200) {
              setNotice('This map has reached its location limit.');
              return;
            }
            setPendingLocation({
              id: makeId('location'), name: '', description: '', iconId: selectedIconId,
              ...mapViewportCenter(artboard, zoom, pan),
            });
            centerNewMarkerRef.current = true;
          }
          setTool(nextTool);
          setSelectedLocationId(null);
          setNotice('');
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
            onPress={() => {
              if (pendingLocation) setNotice('Confirm or cancel placement before saving.');
              else onExport(draft);
            }}
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
                setPendingLocation(null);
                setSelectedLocationId(null);
                setTool('pan');
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
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            if (width !== viewport.width || height !== viewport.height) setViewport({ width, height });
          }}
          style={{
            flex: 1, overflow: 'hidden', backgroundColor: colors.card, position: 'relative',
            ...(Platform.OS === 'web' ? { touchAction: 'none' } as object : {}),
          }}
        >
          <View
            {...panResponder.panHandlers}
            accessibilityLabel="Map background"
            testID="map-pan-surface"
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
              {[...draft.locations.filter(location => location.id !== pendingLocation?.id), ...(pendingLocation ? [pendingLocation] : [])].map(location => {
                const active = pendingLocation?.id === location.id;
                return (
                  <DraggableMapMarker
                    key={location.id}
                    marker={location}
                    artboard={artboard}
                    zoom={zoom}
                    editable={active}
                    onMove={point => updateLocation(point)}
                    onPress={() => {
                      if (active) return;
                      if (pendingLocation) {
                        setNotice('Confirm or cancel placement before changing tools.');
                        return;
                      }
                      setSelectedLocationId(location.id);
                      if (tool === 'edit') {
                        setPendingLocation({ ...location });
                        setSelectedIconId(location.iconId ?? 'city');
                      }
                    }}
                  >
                    {renderIcon(location.iconId ?? 'city', 15, colors.primary)}
                  </DraggableMapMarker>
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
              <Text style={{ color: colors.text, fontSize: 9 }}>{tool === 'pan' ? 'DRAG TO PAN' : 'Map panning locked'}</Text>
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
              onLayout={event => {
                if (!centerNewMarkerRef.current) return;
                centerNewMarkerRef.current = false;
                const height = event.nativeEvent.layout.height;
                // Center new markers in the usable map area, above the floating tools.
                const position = mapViewportCenter(artboard, zoom, pan, { x: 0, y: -(height + 12) / 2 });
                setPendingLocation(current => current ? { ...current, ...position } : current);
              }}
              style={{
                position: 'absolute', bottom: 12, left: 10, right: 10, gap: 8,
                padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                backgroundColor: colors.background,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {toolButton('pan', 'DRAG TO PAN', 'move')}
                {toolButton('location', 'PLACE LOCATION', 'map-pin')}
                {toolButton('edit', 'EDIT LOCATION', 'edit-2')}
              </View>

              {pendingLocation ? (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      value={pendingLocation.name}
                      onChangeText={name => updateLocation({ name })}
                      placeholder="New location name"
                      accessibilityLabel="New location name"
                      style={{ flex: 1, color: colors.text, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.card }}
                    />
                    {selectedLocation && <TouchableOpacity accessibilityLabel="Remove location" onPress={removeLocation} style={{ padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 7 }}>
                      <Feather name="trash-2" size={15} color={colors.destructive} />
                    </TouchableOpacity>}
                  </View>
                  <TextInput
                    value={pendingLocation.description}
                    onChangeText={description => updateLocation({ description })}
                    placeholder="Location description"
                    accessibilityLabel="Location description"
                    multiline
                    style={{ minHeight: 42, maxHeight: 80, color: colors.text, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 7, backgroundColor: colors.card }}
                  />
                  {iconPicker}
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Drag the marker, then confirm placement.</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      accessibilityLabel="CONFIRM PLACEMENT"
                      onPress={confirmPlacement}
                      style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: colors.primary }}
                    >
                      <Text style={{ color: colors.primaryForeground, fontSize: 11, fontWeight: '700' }}>CONFIRM PLACEMENT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setPendingLocation(null); setSelectedLocationId(null); setTool('edit'); setNotice(''); }}
                      style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ color: colors.text, fontSize: 11 }}>CANCEL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : tool === 'edit' ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Select a location marker to edit or delete it.</Text>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                  DRAG TO PAN
                </Text>
              )}
              {!pendingLocation && selectedLocation && (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{selectedLocation.name}</Text>
                  <Text style={{ color: colors.text, fontSize: 11 }}>{selectedLocation.description}</Text>
                </View>
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
