import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as Touch,
} from '@/components/LocalizedText';
import { useColors } from '@/hooks/useColors';
import type { Character } from '@/context/types';
import CombatantPortrait from './CombatantPortrait';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];

export function Btn({ label, onPress, icon, active, danger, disabled, compact, testID, a11y, portrait, portraitImageUri, portraitVehicle }: {
  label?: string; onPress: () => void; icon?: FeatherName; active?: boolean; danger?: boolean;
  disabled?: boolean; compact?: boolean; testID?: string; a11y?: string;
  portrait?: Character | null;
  portraitImageUri?: string;
  portraitVehicle?: boolean;
}) {
  const c = useColors();
  const tint = danger ? c.destructive : active ? c.primaryForeground : c.primary;
  return (
    <Touch
      testID={testID}
      accessibilityLabel={a11y || label}
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
        paddingHorizontal: compact ? 8 : 11, paddingVertical: compact ? 6 : 9, minHeight: compact ? 32 : 38,
        borderRadius: 8, borderWidth: 1, opacity: disabled ? 0.4 : 1,
        borderColor: danger ? c.destructive : active ? c.primary : c.border,
        backgroundColor: active ? c.primary : c.card,
      }}
    >
      {portrait || portraitImageUri || portraitVehicle ? <CombatantPortrait character={portrait} imageUri={portraitImageUri} vehicle={portraitVehicle} size={compact ? 22 : 26} active={active} /> : null}
      {icon ? <Feather name={icon} size={14} color={tint} /> : null}
      {label ? <Text numberOfLines={1} style={{ color: tint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, flexShrink: 1, minWidth: 0 }}>{label}</Text> : null}
    </Touch>
  );
}

export function Label({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.mutedForeground, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }}>{children}</Text>;
}

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'error' }) {
  const c = useColors();
  const col = tone === 'error' ? c.destructive : tone === 'warn' ? c.primary : c.mutedForeground;
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: col, paddingLeft: 8, paddingVertical: 2 }}>
      <Text style={{ color: tone === 'info' ? c.mutedForeground : c.text, fontSize: 11, lineHeight: 16 }}>{children}</Text>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: 7, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
      <Text style={{ color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>{title}</Text>
      {children}
    </View>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{children}</View>;
}

export function NumInput({ label, value, onChange, width = 70 }: {
  label: string; value: number; onChange: (n: number) => void; width?: number;
}) {
  const c = useColors();
  const [text, setText] = useState(String(value));
  useEffect(() => { if (Number(text) !== value) setText(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ gap: 3 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={text}
        keyboardType="numeric"
        onChangeText={t => { setText(t); const n = Number(t); if (t.trim() !== '' && Number.isFinite(n)) onChange(n); }}
        style={{ width, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: c.background }}
      />
    </View>
  );
}

export function Stepper({ label, value, onChange, min, max, step = 1, fmt }: {
  label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; fmt?: (n: number) => string;
}) {
  const c = useColors();
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 1000) / 1000)));
  return (
    <View style={{ gap: 3 }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Btn compact icon="minus" onPress={() => set(value - step)} disabled={value <= min} label="" />
        <Text style={{ color: c.text, minWidth: 40, textAlign: 'center', fontWeight: '700' }}>{fmt ? fmt(value) : String(value)}</Text>
        <Btn compact icon="plus" onPress={() => set(value + step)} disabled={value >= max} label="" />
      </View>
    </View>
  );
}
