import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { TouchableOpacity } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { VehicleCategory, VehicleProfile, VehicleSystem, VehicleSystemKind } from '@/context/types';
import { VEHICLE_CATEGORIES, VEHICLE_ENHANCEMENTS } from '@/data/vehicles';

const DAMAGE_TYPES = [
  { id: 'normal', label: 'Normal' },
  { id: 'laser', label: 'Laser' },
  { id: 'fire', label: 'Fire' },
  { id: 'plasma', label: 'Plasma' },
  { id: 'explosion', label: 'Explosion' },
] as const;

const SYSTEM_KINDS: VehicleSystemKind[] = ['structure', 'engine', 'controls', 'drive', 'tire', 'tread', 'other'];

const textInputStyle = (colors: ReturnType<typeof useColors>) => ({
  color: colors.foreground,
  backgroundColor: colors.secondary,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 7,
  paddingHorizontal: 10,
  paddingVertical: 9,
  fontSize: 13,
  fontFamily: 'Inter_400Regular' as const,
});

function numberText(value: number | null): string {
  return value === null ? '' : String(value);
}

export function VehicleFormModal({ visible, initial, onClose, onSave, title = 'VEHICLE DETAILS' }: {
  visible: boolean;
  initial: VehicleProfile | null;
  onClose: () => void;
  onSave: (vehicle: VehicleProfile) => void;
  title?: string;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState<VehicleProfile | null>(null);
  const [numeric, setNumeric] = useState<Record<string, string>>({});
  const [passengers, setPassengers] = useState('');
  const [cargo, setCargo] = useState('');
  const [weaponsText, setWeaponsText] = useState('');
  const [enhancementsText, setEnhancementsText] = useState('');
  const [notesText, setNotesText] = useState('');

  useEffect(() => {
    if (!visible || !initial) {
      setDraft(null);
      return;
    }
    const copy: VehicleProfile = {
      ...initial,
      damageResistance: { ...initial.damageResistance },
      systems: initial.systems.map(system => ({ ...system })),
      mountedWeapons: [...initial.mountedWeapons],
      enhancements: [...initial.enhancements],
      notes: [...initial.notes],
    };
    setDraft(copy);
    setNumeric({
      topSpeedKph: numberText(copy.topSpeedKph),
      accelerationKphPerRound: numberText(copy.accelerationKphPerRound),
      brakingKphPerRound: numberText(copy.brakingKphPerRound),
      turningRadiusMeters: numberText(copy.turningRadiusMeters),
      rangeKm: numberText(copy.rangeKm),
      fuelCharges: numberText(copy.fuelCharges),
      armorClass: String(copy.armorClass),
      terrainPilotModifier: String(copy.terrainPilotModifier),
      ...Object.fromEntries(DAMAGE_TYPES.map(type => [`dr_${type.id}`, String(copy.damageResistance[type.id])])),
    });
    setPassengers(copy.passengers);
    setCargo(copy.carryingWeightLb);
    setWeaponsText(copy.mountedWeapons.join('\n'));
    setEnhancementsText(copy.enhancements.join('\n'));
    setNotesText(copy.notes.join('\n'));
  }, [visible, initial]);

  const updateNumber = (key: string, value: string) => setNumeric(current => ({ ...current, [key]: value }));
  const numericValue = (key: string, nullable = false): number | null => {
    const raw = numeric[key]?.trim() ?? '';
    if (nullable && raw.length === 0) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setDraft(current => current ? { ...current, portrait: result.assets[0].uri } : current);
    }
  };
  const patchSystem = (id: string, patch: Partial<VehicleSystem>) => setDraft(current => current ? ({
    ...current,
    systems: current.systems.map(system => system.id === id ? {
      ...system,
      ...patch,
      ...(patch.maxHp !== undefined ? {
        maxHp: Math.max(1, Math.floor(patch.maxHp)),
        currentHp: Math.min(system.currentHp, Math.max(1, Math.floor(patch.maxHp))),
      } : {}),
      ...(patch.currentHp !== undefined ? {
        currentHp: Math.max(0, Math.min(system.maxHp, Math.floor(patch.currentHp))),
      } : {}),
    } : system),
  }) : current);
  const addSystem = () => setDraft(current => current ? {
    ...current,
    systems: [...current.systems, {
      id: `system-${Date.now()}`,
      name: 'New system',
      kind: 'other',
      currentHp: 10,
      maxHp: 10,
    }],
  } : current);
  const removeSystem = (id: string) => setDraft(current => current
    ? { ...current, systems: current.systems.length > 1 ? current.systems.filter(system => system.id !== id) : current.systems }
    : current);

  const save = () => {
    if (!draft || !draft.name.trim() || draft.systems.length === 0) return;
    const dr = Object.fromEntries(DAMAGE_TYPES.map(type => [
      type.id,
      Math.max(0, Math.min(100, numericValue(`dr_${type.id}`) ?? 0)),
    ])) as VehicleProfile['damageResistance'];
    const optionalNumber = (key: string) => numericValue(key, true);
    const output: VehicleProfile = {
      ...draft,
      name: draft.name.trim(),
      topSpeedKph: optionalNumber('topSpeedKph'),
      accelerationKphPerRound: optionalNumber('accelerationKphPerRound'),
      brakingKphPerRound: optionalNumber('brakingKphPerRound'),
      turningRadiusMeters: optionalNumber('turningRadiusMeters'),
      rangeKm: optionalNumber('rangeKm'),
      fuelCharges: optionalNumber('fuelCharges'),
      armorClass: Math.max(0, numericValue('armorClass') ?? 0),
      terrainPilotModifier: numericValue('terrainPilotModifier') ?? 0,
      passengers: passengers.trim(),
      carryingWeightLb: cargo.trim(),
      damageResistance: dr,
      systems: draft.systems.map(system => ({
        ...system,
        name: system.name.trim() || 'System',
        maxHp: Math.max(1, Math.floor(system.maxHp)),
        currentHp: Math.max(0, Math.min(system.maxHp, Math.floor(system.currentHp))),
      })),
      mountedWeapons: weaponsText.split('\n').map(value => value.trim()).filter(Boolean),
      enhancements: enhancementsText.split('\n').map(value => value.trim()).filter(Boolean),
      notes: notesText.split('\n').map(value => value.trim()).filter(Boolean),
    };
    onSave(output);
  };
  const sectionTitle = (label: string) => (
    <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, marginTop: 5 }}>
      {label}
    </Text>
  );
  const label = (text: string) => (
    <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{text}</Text>
  );
  const numberField = (key: string, titleText: string, nullable = false) => (
    <View key={key} style={{ flex: 1, minWidth: '28%', gap: 4 }}>
      {label(titleText)}
      <TextInput
        value={numeric[key] ?? ''}
        onChangeText={value => updateNumber(key, value.replace(/[^0-9.-]/g, ''))}
        keyboardType="numeric"
        placeholder={nullable ? 'N/A' : '0'}
        placeholderTextColor={colors.mutedForeground}
        style={textInputStyle(colors)}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.82)' }}>
        <View style={{ maxHeight: '94%', backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close vehicle form">
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {draft && (
            <>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  {draft.portrait ? (
                    <Image source={{ uri: draft.portrait }} style={{ width: 92, height: 68, borderRadius: 8, backgroundColor: colors.secondary }} />
                  ) : (
                    <View style={{ width: 92, height: 68, borderRadius: 8, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="truck" size={28} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 7 }}>
                    <TouchableOpacity onPress={choosePhoto} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 6, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                      <Feather name="image" size={14} color={colors.primary} />
                      <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'Inter_700Bold' }}>ADD / CHANGE PICTURE</Text>
                    </TouchableOpacity>
                    {!!draft.portrait && <TouchableOpacity onPress={() => setDraft(current => current ? { ...current, portrait: undefined } : current)}><Text style={{ fontSize: 10, color: colors.destructive }}>Remove picture</Text></TouchableOpacity>}
                  </View>
                </View>

                {sectionTitle('IDENTITY')}
                <TextInput value={draft.name} onChangeText={value => setDraft(current => current ? { ...current, name: value } : current)} placeholder="Vehicle name" placeholderTextColor={colors.mutedForeground} style={textInputStyle(colors)} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(Object.keys(VEHICLE_CATEGORIES) as VehicleCategory[]).map(category => (
                    <TouchableOpacity key={category} onPress={() => setDraft(current => current ? { ...current, category } : current)} style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, backgroundColor: draft.category === category ? colors.primary : colors.secondary, borderWidth: 1, borderColor: draft.category === category ? colors.primary : colors.border }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: draft.category === category ? colors.primaryForeground : colors.mutedForeground }}>{VEHICLE_CATEGORIES[category]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={draft.description}
                  onChangeText={value => setDraft(current => current ? { ...current, description: value } : current)}
                  multiline
                  placeholder="Description"
                  placeholderTextColor={colors.mutedForeground}
                  style={[textInputStyle(colors), { minHeight: 62, textAlignVertical: 'top' }]}
                />

                {sectionTitle('MOVEMENT & CAPACITY')}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {numberField('topSpeedKph', 'Top speed · KPH', true)}
                  {numberField('accelerationKphPerRound', 'Acceleration · KPH/round', true)}
                  {numberField('brakingKphPerRound', 'Braking · KPH/round', true)}
                  {numberField('turningRadiusMeters', 'Turn radius · m', true)}
                  {numberField('rangeKm', 'Range · km', true)}
                  {numberField('fuelCharges', 'Fuel charges', true)}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, gap: 4 }}>{label('PASSENGERS')}<TextInput value={passengers} onChangeText={setPassengers} style={textInputStyle(colors)} /></View>
                  <View style={{ flex: 1, gap: 4 }}>{label('CARRYING WEIGHT · LB')}<TextInput value={cargo} onChangeText={setCargo} style={textInputStyle(colors)} /></View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {numberField('armorClass', 'Armor class')}
                  {numberField('terrainPilotModifier', 'Terrain Pilot modifier · %')}
                </View>

                {sectionTitle('DAMAGE RESISTANCE · NO DT')}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DAMAGE_TYPES.map(type => numberField(`dr_${type.id}`, `${type.label} DR · %`))}
                </View>

                {sectionTitle('SYSTEM CONDITION')}
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular' }}>
                  Each tire or tread is a separate system. A system is disabled after it loses more than 66% of its HP.
                </Text>
                {draft.systems.map(system => (
                  <View key={system.id} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', padding: 7, borderRadius: 7, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                    <TextInput value={system.name} onChangeText={value => patchSystem(system.id, { name: value })} style={[textInputStyle(colors), { flex: 1 }]} />
                    <View style={{ width: 72, gap: 2 }}>{label('KIND')}
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`System type ${system.kind}; tap to change`}
                        onPress={() => {
                          const index = SYSTEM_KINDS.indexOf(system.kind);
                          patchSystem(system.id, { kind: SYSTEM_KINDS[(index + 1) % SYSTEM_KINDS.length] });
                        }}
                        style={[textInputStyle(colors), { justifyContent: 'center', minHeight: 38 }]}
                      >
                        <Text style={{ color: colors.foreground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{system.kind}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ width: 60, gap: 2 }}>{label('CURRENT')}
                      <TextInput value={String(system.currentHp)} onChangeText={value => patchSystem(system.id, { currentHp: Number(value) || 0 })} keyboardType="numeric" style={textInputStyle(colors)} />
                    </View>
                    <View style={{ width: 60, gap: 2 }}>{label('MAX')}
                      <TextInput value={String(system.maxHp)} onChangeText={value => patchSystem(system.id, { maxHp: Number(value) || 1 })} keyboardType="numeric" style={textInputStyle(colors)} />
                    </View>
                    <TouchableOpacity onPress={() => removeSystem(system.id)} accessibilityLabel={`Remove ${system.name}`}>
                      <Feather name="x" size={17} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity onPress={addSystem} style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontFamily: 'Inter_700Bold' }}>+ ADD SYSTEM</Text>
                </TouchableOpacity>

                {sectionTitle('WEAPONS, UPGRADES & NOTES')}
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_400Regular' }}>
                  Tap a manual enhancement to add or remove it from this vehicle.
                </Text>
                {VEHICLE_ENHANCEMENTS.map(enhancement => {
                  const selected = enhancementsText.split('\n').includes(enhancement.name);
                  return (
                    <TouchableOpacity
                      key={enhancement.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        const lines = enhancementsText.split('\n').map(line => line.trim()).filter(Boolean);
                        setEnhancementsText(selected
                          ? lines.filter(line => line !== enhancement.name).join('\n')
                          : [...lines, enhancement.name].join('\n'));
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, borderRadius: 6, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '18' : colors.secondary }}
                    >
                      <Feather name={selected ? 'check-square' : 'square'} size={15} color={selected ? colors.primary : colors.mutedForeground} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 10 }}>{enhancement.name} · {enhancement.cost.toLocaleString()} caps</Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 9 }}>{enhancement.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TextInput value={weaponsText} onChangeText={setWeaponsText} multiline placeholder="Mounted weapons — one per line" placeholderTextColor={colors.mutedForeground} style={[textInputStyle(colors), { minHeight: 54, textAlignVertical: 'top' }]} />
                <TextInput value={enhancementsText} onChangeText={setEnhancementsText} multiline placeholder="Installed enhancements — one per line" placeholderTextColor={colors.mutedForeground} style={[textInputStyle(colors), { minHeight: 54, textAlignVertical: 'top' }]} />
                <TextInput value={notesText} onChangeText={setNotesText} multiline placeholder="Manual notes — one per line" placeholderTextColor={colors.mutedForeground} style={[textInputStyle(colors), { minHeight: 64, textAlignVertical: 'top' }]} />
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
                <TouchableOpacity onPress={onClose} style={{ flex: 1, alignItems: 'center', padding: 12, borderRadius: 7, backgroundColor: colors.secondary }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 12 }}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={save} disabled={!draft.name.trim() || !draft.systems.length} style={{ flex: 1, alignItems: 'center', padding: 12, borderRadius: 7, backgroundColor: colors.primary, opacity: draft.name.trim() && draft.systems.length ? 1 : 0.5 }}>
                  <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 12 }}>SAVE VEHICLE</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
