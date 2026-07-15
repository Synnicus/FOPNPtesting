import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  portrait: string | null;
  name: string;
  size?: number;
}

export default function CharacterAvatar({ portrait, name, size = 48 }: Props) {
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
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: colors.primary }]}
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
