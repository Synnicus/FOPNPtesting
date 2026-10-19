import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import { makeCatalogImageDataUri } from '@/data/catalogImages';
import { translateText } from '@/data/localization';
import CharacterAvatar from '@/components/CharacterAvatar';
import type { CatalogPortraitSelection, PortraitFitMode, PortraitOffset } from '@/context/types';

const DEFAULT_ASPECT: [number, number] = [1, 1];
const CENTER: PortraitOffset = { x: 0.5, y: 0.5 };

export function CatalogImageEditor({
  uri,
  onChange,
  name,
  portraitFit,
  portraitOffset,
  onDragStateChange,
  aspect = DEFAULT_ASPECT,
  testID,
}: {
  uri?: string;
  name: string;
  portraitFit?: PortraitFitMode;
  portraitOffset?: PortraitOffset;
  onChange: (selection: CatalogPortraitSelection) => void;
  onDragStateChange?: (dragging: boolean) => void;
  aspect?: [number, number];
  testID: string;
}) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState<PortraitFitMode>(portraitFit ?? 'cover');
  const [offset, setOffset] = useState<PortraitOffset>(portraitOffset ?? CENTER);
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 210 });
  const offsetRef = useRef(offset);
  const dragStartOffset = useRef(offset);
  const dragMoved = useRef(false);
  const setCurrentOffset = (next: PortraitOffset) => {
    offsetRef.current = next;
    setOffset(next);
  };

  useEffect(() => {
    const nextFit = portraitFit ?? 'cover';
    const nextOffset = portraitOffset ?? CENTER;
    setFit(nextFit);
    setCurrentOffset(nextOffset);
  }, [portraitFit, portraitOffset]);

  const chooseImage = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Photo access required', 'Allow photo-library access to add an image.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect,
        quality: 0.68,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const extension = asset.fileName?.split('.').pop()?.toLowerCase();
      const mimeType = asset.mimeType
        ?? (extension === 'png' ? 'image/png'
          : extension === 'webp' ? 'image/webp'
            : extension === 'gif' ? 'image/gif'
              : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
                : undefined);
      const imageUri = makeCatalogImageDataUri(mimeType, asset.base64);
      if (!imageUri) {
        Alert.alert(
          'Image not supported',
          'Choose a JPEG, PNG, WebP, or GIF image smaller than 5 MB.',
        );
        return;
      }
      setCurrentOffset(CENTER);
      onChange({
        portrait: imageUri,
        portraitFit: fit,
        portraitOffset: CENTER,
      });
    } catch {
      Alert.alert('Could not open photos', 'Choose an image from your photo library and try again.');
    } finally {
      setBusy(false);
    }
  }, [aspect, busy, fit, onChange]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => fit === 'cover' && !!uri,
    onMoveShouldSetPanResponder: () => fit === 'cover' && !!uri,
    onPanResponderGrant: () => {
      dragMoved.current = false;
      dragStartOffset.current = offsetRef.current;
      onDragStateChange?.(true);
    },
    onPanResponderMove: (_event, gesture) => {
      if (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3) dragMoved.current = true;
      const next = {
        x: Math.max(0, Math.min(1, dragStartOffset.current.x - gesture.dx / Math.max(1, previewSize.width))),
        y: Math.max(0, Math.min(1, dragStartOffset.current.y - gesture.dy / Math.max(1, previewSize.height))),
      };
      setCurrentOffset(next);
    },
    onPanResponderRelease: () => {
      onDragStateChange?.(false);
      if (dragMoved.current) {
        onChange({ portrait: uri, portraitFit: fit, portraitOffset: offsetRef.current });
      } else {
        void chooseImage();
      }
    },
    onPanResponderTerminate: () => {
      onDragStateChange?.(false);
      if (dragMoved.current) {
        onChange({ portrait: uri, portraitFit: fit, portraitOffset: offsetRef.current });
      }
    },
  }), [chooseImage, fit, onChange, onDragStateChange, previewSize.height, previewSize.width, uri]);

  const updateFit = (nextFit: PortraitFitMode) => {
    setFit(nextFit);
    if (uri) onChange({ portrait: uri, portraitFit: nextFit, portraitOffset: offsetRef.current });
  };

  return (
    <View style={{ gap: 8 }}>
      {uri && fit === 'cover' ? (
        <View
          {...panResponder.panHandlers}
          accessibilityLabel={translateText('User-supplied catalog photo')}
          testID={`${testID}-crop-preview`}
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            setPreviewSize(previous =>
              previous.width === width && previous.height === height
                ? previous
                : { width, height });
          }}
          style={{
            width: '100%',
            height: 210,
            borderRadius: colors.radius,
            backgroundColor: colors.secondary,
            borderWidth: 1,
            borderColor: colors.primary,
            overflow: 'hidden',
          }}
        >
          {Platform.OS === 'web' ? (
            <img
              src={uri}
              alt={translateText('User-supplied catalog photo')}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${offset.x * 100}% ${offset.y * 100}%`,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          ) : (
            <Image
              source={{ uri }}
              resizeMode="cover"
              style={{
                position: 'absolute',
                width: previewSize.width * 1.6,
                height: previewSize.height * 1.6,
                left: -offset.x * previewSize.width * 0.6,
                top: -offset.y * previewSize.height * 0.6,
              }}
            />
          )}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.62)',
            }}
          >
            <Feather name="move" size={11} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
              Drag to reposition · tap to change
            </Text>
          </View>
        </View>
      ) : uri ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => void chooseImage()}
          testID={`${testID}-crop-preview`}
        >
          <Image
            accessibilityLabel={translateText('User-supplied catalog photo')}
            source={{ uri }}
            resizeMode="contain"
            style={{
              width: '100%',
              height: 210,
              borderRadius: colors.radius,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={translateText('ADD PHOTO')}
          activeOpacity={0.85}
          onPress={() => void chooseImage()}
          testID={`${testID}-crop-preview`}
          style={{
            minHeight: 78,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: colors.radius,
            backgroundColor: colors.card,
          }}
        >
          <Feather name="image" size={16} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>No photo added</Text>
        </TouchableOpacity>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View testID={`${testID}-circle-preview`}>
          <CharacterAvatar
            portrait={uri}
            name={name}
            size={54}
            fit={fit}
            offset={offset}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginBottom: 4 }}>
            FIT
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['cover', 'contain'] as const).map(option => {
              const active = fit === option;
              return (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  testID={`${testID}-fit-${option}`}
                  onPress={() => updateFit(option)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.secondary,
                  }}
                >
                  <Text style={{
                    color: active ? colors.primaryForeground : colors.mutedForeground,
                    fontSize: 11,
                    fontFamily: 'Inter_700Bold',
                    letterSpacing: 1,
                  }}>
                    {option === 'cover' ? 'CROP' : 'FULL'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={translateText(uri ? 'CHANGE PHOTO' : 'ADD PHOTO')}
          testID={`${testID}-choose`}
          disabled={busy}
          onPress={() => void chooseImage()}
          style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 7,
            paddingVertical: 10,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: colors.primary + '77',
            backgroundColor: colors.primary + '14',
            opacity: busy ? 0.55 : 1,
          }}
        >
          <Feather name={uri ? 'refresh-cw' : 'image'} size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' }}>
            {busy ? 'OPENING…' : uri ? 'CHANGE PHOTO' : 'ADD PHOTO'}
          </Text>
        </TouchableOpacity>
        {uri ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={translateText('Remove photo')}
            testID={`${testID}-remove`}
            onPress={() => onChange({
              portrait: undefined,
              portraitFit: fit,
              portraitOffset: offsetRef.current,
            })}
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.destructive + '77',
              backgroundColor: colors.destructive + '12',
            }}
          >
            <Feather name="trash-2" size={13} color={colors.destructive} />
            <Text style={{ color: colors.destructive, fontSize: 10, fontFamily: 'Inter_700Bold' }}>REMOVE</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 15 }}>
        Upload your own photo. The app does not include artwork.
      </Text>
    </View>
  );
}
