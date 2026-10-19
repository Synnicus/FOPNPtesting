import React, { useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import type { PortraitFitMode, PortraitOffset } from '@/context/types';

interface Props {
  uri?: string | null;
  fit?: PortraitFitMode;
  offset?: PortraitOffset;
  scrimColor: string;
  imageOpacity?: number;
  scrimOpacity?: number;
}

export function PortraitCardBackground({
  uri,
  fit = 'cover',
  offset,
  scrimColor,
  imageOpacity = 0.72,
  scrimOpacity = 0.68,
}: Props) {
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  if (!uri) return null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame(previous => previous.width === width && previous.height === height ? previous : { width, height });
  };
  const alpha = Math.round(Math.max(0, Math.min(1, scrimOpacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  const cropX = Math.max(0, Math.min(1, offset?.x ?? 0.5));
  const cropY = Math.max(0, Math.min(1, offset?.y ?? 0.5));
  const nativeCropEnabled = Platform.OS !== 'web' && fit === 'cover' && !!offset && frame.width > 0 && frame.height > 0;
  const nativeImageStyle = nativeCropEnabled
    ? {
        position: 'absolute' as const,
        width: frame.width * 2,
        height: frame.height * 2,
        left: -frame.width * cropX,
        top: -frame.height * cropY,
        opacity: imageOpacity,
      }
    : { ...StyleSheet.absoluteFillObject, opacity: imageOpacity };

  return (
    <View
      pointerEvents="none"
      accessible={false}
      onLayout={Platform.OS === 'web' ? undefined : onLayout}
      style={StyleSheet.absoluteFill}
    >
      {Platform.OS === 'web' ? (
        <img
          src={uri}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: fit,
            objectPosition: `${Math.round(cropX * 100)}% ${Math.round(cropY * 100)}%`,
            opacity: imageOpacity,
          } as any}
        />
      ) : (
        <Image source={{ uri }} resizeMode={fit} style={nativeImageStyle} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `${scrimColor}${alpha}` }]} />
    </View>
  );
}
