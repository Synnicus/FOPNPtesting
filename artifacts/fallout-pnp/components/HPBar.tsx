import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  current: number;
  max: number;
  height?: number;
  showText?: boolean;
}

function getBarColor(pct: number, colors: ReturnType<typeof useColors>) {
  if (pct > 0.6) return '#4a8c3f';
  if (pct > 0.3) return '#c8841a';
  return colors.destructive;
}

export default function HPBar({ current, max, height = 8, showText = false }: Props) {
  const colors = useColors();
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const barColor = getBarColor(pct, colors);

  return (
    <View style={styles.wrapper}>
      {showText && (
        <Text style={[styles.text, { color: colors.mutedForeground }]}>
          {current}/{max} HP
        </Text>
      )}
      <View style={[styles.track, { height, backgroundColor: colors.border, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct * 100}%` as `${number}%`,
              height,
              backgroundColor: barColor,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', gap: 4 },
  text: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  track: { width: '100%', overflow: 'hidden' },
  fill: {},
});
