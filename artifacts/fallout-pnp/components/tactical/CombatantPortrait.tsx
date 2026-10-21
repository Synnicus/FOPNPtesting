import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import type { Character } from '@/context/types';
import { useColors } from '@/hooks/useColors';
import { raceIconPath } from './raceIcons';

export default function CombatantPortrait({ character, size = 28, active = false, imageUri, vehicle, race }: {
  character?: Character | null;
  size?: number;
  active?: boolean;
  imageUri?: string;
  vehicle?: boolean;
  race?: string;
}) {
  const c = useColors();
  const portrait = character?.portrait ?? imageUri;
  const radius = size / 2;
  const isVehicle = Boolean(character?.vehicle ?? vehicle);
  const icon = isVehicle ? 'truck' : undefined;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size, height: size, borderRadius: radius, overflow: 'hidden',
        borderWidth: active ? 2 : 1, borderColor: active ? c.primary : c.border,
        alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, flexShrink: 0,
      }}
    >
      {portrait ? (
        <Image source={{ uri: portrait }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      ) : icon ? (
        <Feather name={icon} size={size * 0.58} color={c.text} />
      ) : (
        <Svg width={size * 0.76} height={size * 0.76} viewBox="0 0 24 24">
          <Path d={raceIconPath(character?.race ?? race)} fill="none" stroke={c.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
