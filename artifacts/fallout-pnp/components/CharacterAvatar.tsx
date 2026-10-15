import React from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';

interface Props {
  portrait: string | null | undefined;
  name: string;
  size?: number;
  /** How the portrait image fits its frame. Default 'cover' (crops to fill). */
  fit?: 'cover' | 'contain';
  /** Crop focus when fit is 'cover': 0–1 in each axis (0.5 = centered). */
  offset?: { x: number; y: number };
}

export default function CharacterAvatar({ portrait, name, size = 48, fit = 'cover', offset }: Props) {
  const colors = useColors();
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (portrait) {
    // When cropping (cover) and a focus offset is provided, position the crop.
    if (fit === 'cover' && offset) {
      const px = Math.round((offset.x ?? 0.5) * 100);
      const py = Math.round((offset.y ?? 0.5) * 100);
      if (Platform.OS === 'web') {
        return (
          <View
            style={[
              styles.avatar,
              { width: size, height: size, borderRadius: size / 2, borderColor: colors.primary },
            ]}
          >
            <Image
              source={{ uri: portrait }}
              style={{ width: '100%', height: '100%' }}
              // @ts-ignore web-only style prop for crop focus
              resizeMode="cover"
            />
            {/* Overlay web objectPosition via absolute image on web */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <img
                src={portrait}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${px}% ${py}%` } as any}
              />
            </View>
          </View>
        );
      }
      // Native: oversized image positioned by percentage inside the clipped frame.
      const scale = 2;
      const big = size * scale;
      const maxShift = big - size;
      return (
        <View
          style={[
            styles.avatar,
            { width: size, height: size, borderRadius: size / 2, borderColor: colors.primary },
          ]}
        >
          <Image
            source={{ uri: portrait }}
            resizeMode="cover"
            style={{
              width: big,
              height: big,
              marginLeft: -(offset.x ?? 0.5) * maxShift,
              marginTop: -(offset.y ?? 0.5) * maxShift,
            }}
          />
        </View>
      );
    }
    return (
      <Image
        source={{ uri: portrait }}
        resizeMode={fit}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: colors.primary,
            backgroundColor: fit === 'contain' ? colors.secondary : undefined,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.secondary,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: size * 0.35,
          fontFamily: 'Inter_700Bold',
        }}
      >
        {initials || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
