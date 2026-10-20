import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import type { CustomRaceDefinition, SPECIALStats, Weapon } from '@/context/types';
import { getRaceById, validateCustomRace } from '@/data/races';
import { useColors } from '@/hooks/useColors';

const SPECIAL_KEYS: (keyof SPECIALStats)[] = [
  'strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck',
];
const SPECIAL_LABELS: Record<keyof SPECIALStats, string> = {
  strength: 'STR', perception: 'PER', endurance: 'END', charisma: 'CHA',
  intelligence: 'INT', agility: 'AGI', luck: 'LCK',
};
const DAMAGE_FIELDS = [
  ['normal', 'Normal', 'dtNormal', 'drNormal'],
  ['laser', 'Laser', 'dtLaser', 'drLaser'],
  ['fire', 'Fire', 'dtFire', 'drFire'],
  ['plasma', 'Plasma', 'dtPlasma', 'drPlasma'],
  ['explosion', 'Explosion', 'dtExplosion', 'drExplosion'],
] as const;

function makeDraft(initial?: CustomRaceDefinition | null): CustomRaceDefinition {
  if (initial) {
    return {
      ...initial,
      specialMin: { ...initial.specialMin },
      specialMax: { ...initial.specialMax },
      specialDefault: { ...initial.specialDefault },
      naturalWeaponIds: [...initial.naturalWeaponIds],
      benefits: [...initial.benefits],
      penalties: [...initial.penalties],
      naturalProtection: initial.naturalProtection ? { ...initial.naturalProtection } : undefined,
    };
  }
  const base = getRaceById('customRace')!;
  return {
    ...base,
    id: `custom-race-${Date.now().toString(36)}`,
    name: '',
    description: '',
    specialMin: { ...base.specialMin },
    specialMax: { ...base.specialMax },
    specialDefault: { ...base.specialDefault },
    naturalWeaponIds: [],
    benefits: [],
    penalties: [],
    playable: true,
  };
}

function NumberField({
  label, value, onChangeText, width,
}: {
  label: string;
  value: number;
  onChangeText: (value: string) => void;
  width?: number | `${number}%`;
}) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, minWidth: width ?? 70 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 9, letterSpacing: 0.7, marginBottom: 3 }}>{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={onChangeText}
        keyboardType="numeric"
        style={{
          minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius,
          paddingHorizontal: 8, color: colors.foreground, backgroundColor: colors.background,
          fontSize: 13,
        }}
      />
    </View>
  );
}

export function CustomRaceEditorModal({
  visible,
  initial,
  naturalWeapons,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial?: CustomRaceDefinition | null;
  naturalWeapons: readonly Weapon[];
  onClose: () => void;
  onSave: (race: CustomRaceDefinition) => void;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState<CustomRaceDefinition>(() => makeDraft(initial));
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setDraft(makeDraft(initial));
      setError('');
    }
  }, [visible, initial]);

  const protection = useMemo(() => ({
    dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
    drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0,
    ...(draft.naturalProtection ?? {}),
  }), [draft.naturalProtection]);

  const updateNumber = (field: keyof CustomRaceDefinition, value: string) => {
    const parsed = value.trim() === '' ? 0 : Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft(current => ({ ...current, [field]: Math.floor(parsed) }));
  };
  const updateSpecial = (key: keyof SPECIALStats, field: 'specialMin' | 'specialMax' | 'specialDefault', value: string) => {
    const parsed = value.trim() === '' ? 0 : Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft(current => ({ ...current, [field]: { ...current[field], [key]: Math.floor(parsed) } }));
  };
  const updateProtection = (field: keyof typeof protection, value: string) => {
    const parsed = value.trim() === '' ? 0 : Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft(current => ({
      ...current,
      naturalProtection: { ...protection, [field]: Math.floor(parsed) },
    }));
  };
  const updateLines = (field: 'benefits' | 'penalties', value: string) => {
    setDraft(current => ({
      ...current,
      [field]: value.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 20),
    }));
  };
  const save = () => {
    const cleaned: CustomRaceDefinition = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      naturalWeaponIds: [...new Set(draft.naturalWeaponIds)],
      benefits: draft.benefits.map(value => value.trim()).filter(Boolean),
      penalties: draft.penalties.map(value => value.trim()).filter(Boolean),
      playable: true,
      ...(Object.values(protection).some(value => value !== 0) ? { naturalProtection: protection } : { naturalProtection: undefined }),
    };
    if (!validateCustomRace(cleaned)) {
      setError('Enter a name, and keep each SPECIAL default between its minimum and maximum (1–20). Resistances may range from −100% to +100%.');
      return;
    }
    onSave(cleaned);
  };

  const sectionTitle = {
    color: colors.primary, fontFamily: 'Inter_700Bold' as const, fontSize: 10, letterSpacing: 1.2,
    marginTop: 12, marginBottom: 6,
  };
  const row = { flexDirection: 'row' as const, gap: 7, marginBottom: 7 };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', padding: 14, paddingTop: Platform.OS === 'web' ? 30 : 54, backgroundColor: '#000a' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ maxHeight: '94%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 13, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1.5 }}>
                {initial ? 'EDIT CUSTOM RACE' : 'CREATE CUSTOM RACE'}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 3 }}>Campaign profile for playable Custom Race characters.</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close race editor" onPress={onClose} style={{ padding: 5 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 21 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ paddingHorizontal: 13 }} keyboardShouldPersistTaps="handled">
            <Text style={sectionTitle}>IDENTITY</Text>
            <TextInput
              value={draft.name}
              onChangeText={name => setDraft(current => ({ ...current, name }))}
              placeholder="Race name"
              placeholderTextColor={colors.mutedForeground}
              maxLength={80}
              style={{ minHeight: 42, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background, marginBottom: 7 }}
            />
            <TextInput
              value={draft.description}
              onChangeText={description => setDraft(current => ({ ...current, description }))}
              placeholder="Description"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={1000}
              style={{ minHeight: 64, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background, textAlignVertical: 'top' }}
            />

            <Text style={sectionTitle}>SPECIAL LIMITS AND DEFAULTS</Text>
            <View style={row}>
              {['MIN', 'DEFAULT', 'MAX'].map(label => <Text key={label} style={{ flex: 1, color: colors.mutedForeground, fontSize: 9, letterSpacing: 0.6 }}>{label}</Text>)}
            </View>
            {SPECIAL_KEYS.map(key => (
              <View key={key} style={[row, { alignItems: 'center' }]}>
                <Text style={{ width: 34, color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 10 }}>{SPECIAL_LABELS[key]}</Text>
                <NumberField label="" value={draft.specialMin[key]} onChangeText={value => updateSpecial(key, 'specialMin', value)} />
                <NumberField label="" value={draft.specialDefault[key]} onChangeText={value => updateSpecial(key, 'specialDefault', value)} />
                <NumberField label="" value={draft.specialMax[key]} onChangeText={value => updateSpecial(key, 'specialMax', value)} />
              </View>
            ))}

            <Text style={sectionTitle}>NATURAL DEFENSES AND PROGRESSION</Text>
            <View style={row}>
              <NumberField label="RADIATION RESISTANCE %" value={draft.naturalDR} onChangeText={value => updateNumber('naturalDR', value)} />
              <NumberField label="GAS RESISTANCE %" value={draft.naturalGasDR} onChangeText={value => updateNumber('naturalGasDR', value)} />
            </View>
            <View style={row}>
              <NumberField label="ELECTRICITY RESISTANCE %" value={draft.naturalElecDR} onChangeText={value => updateNumber('naturalElecDR', value)} />
              <NumberField label="NATURAL AC BONUS" value={draft.naturalACBonus} onChangeText={value => updateNumber('naturalACBonus', value)} />
            </View>
            <View style={row}>
              <NumberField label="PERK EVERY N LEVELS" value={draft.perksPerLevels ?? 3} onChangeText={value => updateNumber('perksPerLevels', value)} />
              <NumberField label="BONUS HP / LEVEL" value={draft.bonusHPPerLevel ?? 0} onChangeText={value => updateNumber('bonusHPPerLevel', value)} />
              <NumberField label="MELEE BONUS" value={draft.bonusMeleeDamage ?? 0} onChangeText={value => updateNumber('bonusMeleeDamage', value)} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 9, marginBottom: 4 }}>Use 0 for no bonus. Perk cadence is one perk every N levels.</Text>

            <Text style={sectionTitle}>NATURAL DT / DR BY DAMAGE TYPE</Text>
            {DAMAGE_FIELDS.map(([, label, dtKey, drKey]) => (
              <View key={dtKey} style={row}>
                <Text style={{ width: 68, alignSelf: 'center', color: colors.foreground, fontSize: 10 }}>{label}</Text>
                <NumberField label="DT" value={protection[dtKey]} onChangeText={value => updateProtection(dtKey, value)} />
                <NumberField label="DR %" value={protection[drKey]} onChangeText={value => updateProtection(drKey, value)} />
              </View>
            ))}

            <Text style={sectionTitle}>NATURAL WEAPONS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {naturalWeapons.map(weapon => {
                const selected = draft.naturalWeaponIds.includes(weapon.id);
                return (
                  <TouchableOpacity
                    key={weapon.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setDraft(current => ({
                      ...current,
                      naturalWeaponIds: selected
                        ? current.naturalWeaponIds.filter(id => id !== weapon.id)
                        : [...current.naturalWeaponIds, weapon.id],
                    }))}
                    style={{ marginRight: 6, marginBottom: 6, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}22` : 'transparent', borderRadius: 5 }}
                  >
                    <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 10 }}>{weapon.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={sectionTitle}>BENEFITS AND LIMITATIONS</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 9, marginBottom: 4 }}>One item per line. Descriptive items are shown in the character editor.</Text>
            <TextInput
              value={draft.benefits.join('\n')}
              onChangeText={value => updateLines('benefits', value)}
              placeholder="Benefits, one per line"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={{ minHeight: 68, padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background, textAlignVertical: 'top', marginBottom: 7 }}
            />
            <TextInput
              value={draft.penalties.join('\n')}
              onChangeText={value => updateLines('penalties', value)}
              placeholder="Limitations, one per line"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={{ minHeight: 68, padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, backgroundColor: colors.background, textAlignVertical: 'top', marginBottom: 14 }}
            />
            {!!error && <Text style={{ color: colors.destructive, fontSize: 10, marginBottom: 8 }}>{error}</Text>}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderColor: colors.border }}>
            <TouchableOpacity accessibilityRole="button" onPress={onClose} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 10 }}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={save} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, backgroundColor: colors.primary, borderRadius: colors.radius }}>
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 10 }}>{initial ? 'SAVE RACE' : 'CREATE RACE'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
