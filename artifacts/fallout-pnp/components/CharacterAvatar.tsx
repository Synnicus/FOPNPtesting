import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  portrait: string | null | undefined;
  name: string;
  size?: number;
  /** How the portrait image fits its frame. Default 'cover' (crops to fill). */
  fit?: 'cover' | 'contain';
}

export default function CharacterAvatar({ portrait, name, size = 48, fit = 'cover' }: Props) {
  const colors = useColors();
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (portrait) {
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
