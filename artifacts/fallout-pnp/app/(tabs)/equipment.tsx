import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Armor, ArmorSlot, DamageType, SkillType, Weapon, WeaponCategory } from '@/context/types';
import { BUILT_IN_WEAPONS, formatWeaponDamage } from '@/data/weapons';
import { BUILT_IN_ARMOR } from '@/data/armor';

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const CATEGORIES: { label: string; value: WeaponCategory }[] = [
  { label: 'Firearm', value: 'firearm' },
  { label: 'Energy', value: 'energy' },
  { label: 'Melee', value: 'melee' },
  { label: 'Unarmed', value: 'unarmed' },
];

const DAMAGE_TYPES: { label: string; value: DamageType }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Bio', value: 'bio' },
  { label: 'Energy', value: 'energy' },
];

// ─── Custom Weapon Form ───────────────────────────────────────────────────────

function WeaponFormModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (w: Weapon) => void }) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WeaponCategory>('firearm');
  const [damageType, setDamageType] = useState<DamageType>('normal');
  const [dieCount, setDieCount] = useState('1');
  const [die, setDie] = useState('8');
  const [bonus, setBonus] = useState('0');
  const [burst, setBurst] = useState('0');
  const [skill, setSkill] = useState<SkillType>('firearms');

  const reset = () => { setName(''); setCategory('firearm'); setDamageType('normal'); setDieCount('1'); setDie('8'); setBonus('0'); setBurst('0'); setSkill('firearms'); };

  React.useEffect(() => {
    if (visible) reset();
  }, [visible]);

  const isValid = name.trim().length > 0 && parseInt(dieCount) > 0 && parseInt(die) > 0;

  const save = () => {
    const w: Weapon = {
      id: genId(),
      name: name.trim(),
      category,
      damageType,
      damageDieCount: Math.max(1, parseInt(dieCount) || 1),
      damageDie: Math.max(2, parseInt(die) || 6),
      damageBonus: parseInt(bonus) || 0,
      burstLimit: Math.max(0, parseInt(burst) || 0),
      skill,
      isCustom: true,
    };
    onSave(w);
    onClose();
  };

  const RadioGroup = <T extends string>({ label, options, value, onChange }: { label: string; options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => (
          <TouchableOpacity
            key={o.value}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: colors.radius,
              backgroundColor: value === o.value ? colors.primary : colors.secondary,
              borderWidth: 1,
              borderColor: value === o.value ? colors.primary : colors.border,
            }}
            onPress={() => onChange(o.value)}
          >
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: value === o.value ? colors.primaryForeground : colors.mutedForeground }}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const Inp = ({ label, value, onChange, numeric }: { label: string; value: string; onChange: (t: string) => void; numeric?: boolean }) => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 10, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ maxHeight: '90%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>NEW CUSTOM WEAPON</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Inp label="WEAPON NAME" value={name} onChange={setName} />
            <View style={{ height: 12 }} />
            <RadioGroup label="CATEGORY" options={CATEGORIES} value={category} onChange={v => { setCategory(v); setSkill(v === 'melee' ? 'melee' : v === 'unarmed' ? 'unarmed' : 'firearms'); }} />
            <RadioGroup label="DAMAGE TYPE" options={DAMAGE_TYPES} value={damageType} onChange={setDamageType} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>DAMAGE DICE</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Inp label="COUNT" value={dieCount} onChange={setDieCount} numeric />
              <Inp label="SIDES" value={die} onChange={setDie} numeric />
              <Inp label="BONUS" value={bonus} onChange={setBonus} numeric />
            </View>
            <View style={{ marginBottom: 12 }}>
              <Inp label="BURST LIMIT (0 = single shot)" value={burst} onChange={setBurst} numeric />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: isValid ? colors.primary : colors.secondary, borderRadius: colors.radius, paddingVertical: 14, alignItems: 'center', marginBottom: 30 }}
              disabled={!isValid}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); save(); }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: isValid ? colors.primaryForeground : colors.mutedForeground, letterSpacing: 1 }}>ADD WEAPON</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Custom Armor Form ────────────────────────────────────────────────────────

function ArmorFormModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (a: Armor) => void }) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [slot, setSlot] = useState<ArmorSlot>('body');
  const [dtNorm, setDtNorm] = useState('0');
  const [dtBio, setDtBio] = useState('0');
  const [dtEnergy, setDtEnergy] = useState('0');

  const reset = () => { setName(''); setSlot('body'); setDtNorm('0'); setDtBio('0'); setDtEnergy('0'); };
  React.useEffect(() => { if (visible) reset(); }, [visible]);

  const isValid = name.trim().length > 0;
  const save = () => {
    const a: Armor = {
      id: genId(),
      name: name.trim(),
      slot,
      dtNormal: parseInt(dtNorm) || 0,
      dtBio: parseInt(dtBio) || 0,
      dtEnergy: parseInt(dtEnergy) || 0,
      isCustom: true,
    };
    onSave(a);
    onClose();
  };

  const Inp = ({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) => (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 10, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }}
        value={value} onChangeText={onChange} keyboardType="number-pad" placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>NEW CUSTOM ARMOR</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 }}>NAME</Text>
              <TextInput style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 10, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }} value={name} onChangeText={setName} placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>SLOT</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[{ label: 'Body Armor', value: 'body' as ArmorSlot }, { label: 'Helmet', value: 'helmet' as ArmorSlot }].map(o => (
                  <TouchableOpacity key={o.value} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: slot === o.value ? colors.primary : colors.secondary, borderWidth: 1, borderColor: slot === o.value ? colors.primary : colors.border }}
                    onPress={() => setSlot(o.value)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: slot === o.value ? colors.primaryForeground : colors.mutedForeground }}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 6 }}>DAMAGE THRESHOLD</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Inp label="NORMAL" value={dtNorm} onChange={setDtNorm} />
              <Inp label="BIO" value={dtBio} onChange={setDtBio} />
              <Inp label="ENERGY" value={dtEnergy} onChange={setDtEnergy} />
            </View>
            <TouchableOpacity style={{ backgroundColor: isValid ? colors.primary : colors.secondary, borderRadius: colors.radius, paddingVertical: 14, alignItems: 'center', marginBottom: 30 }}
              disabled={!isValid} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); save(); }}>
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: isValid ? colors.primaryForeground : colors.mutedForeground, letterSpacing: 1 }}>ADD ARMOR</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Item Row ─────────────────────────────────────────────────────────────────

function WeaponRow({ weapon, onDelete }: { weapon: Weapon; onDelete?: () => void }) {
  const colors = useColors();
  const catColors: Record<string, string> = { firearm: colors.primary, energy: '#4a9acc', melee: '#cc7a3a', unarmed: '#8a5acc' };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{weapon.name}</Text>
          {weapon.isCustom && <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.primary + '33', borderRadius: 3 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>CUSTOM</Text></View>}
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
          <Text style={{ color: catColors[weapon.category] ?? colors.primary }}>{weapon.category.toUpperCase()}</Text>
          {'  '}
          {formatWeaponDamage(weapon)}
          {'  '}
          {weapon.damageType.toUpperCase()}
          {weapon.burstLimit > 0 ? `  Burst ×${weapon.burstLimit}` : '  Single'}
          {'  Skill: '}{weapon.skill}
        </Text>
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={{ padding: 8 }}>
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function ArmorRow({ armor, onDelete }: { armor: Armor; onDelete?: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{armor.name}</Text>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.secondary, borderRadius: 3 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{armor.slot.toUpperCase()}</Text>
          </View>
          {armor.isCustom && <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.primary + '33', borderRadius: 3 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>CUSTOM</Text></View>}
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
          DT Normal: {armor.dtNormal}  ·  Bio: {armor.dtBio}  ·  Energy: {armor.dtEnergy}
        </Text>
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={{ padding: 8 }}>
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Equipment Screen ─────────────────────────────────────────────────────────

export default function EquipmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customWeapons, customArmor, addCustomWeapon, deleteCustomWeapon, addCustomArmor, deleteCustomArmor } = useApp();
  const [tab, setTab] = useState<'weapons' | 'armor'>('weapons');
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [showArmorForm, setShowArmorForm] = useState(false);

  const confirmDeleteWeapon = (w: Weapon) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete ${w.name}?`)) deleteCustomWeapon(w.id);
    } else {
      Alert.alert('Delete Weapon', `Remove ${w.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCustomWeapon(w.id) },
      ]);
    }
  };

  const confirmDeleteArmor = (a: Armor) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete ${a.name}?`)) deleteCustomArmor(a.id);
    } else {
      Alert.alert('Delete Armor', `Remove ${a.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCustomArmor(a.id) },
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2, marginBottom: 4 }}>EQUIPMENT</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 14 }}>
          {BUILT_IN_WEAPONS.length + customWeapons.length} weapons · {BUILT_IN_ARMOR.length + customArmor.length} armor pieces
        </Text>

        {/* Tab toggle */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[{ label: 'WEAPONS', value: 'weapons' as const }, { label: 'ARMOR', value: 'armor' as const }].map(t => (
            <TouchableOpacity
              key={t.value}
              style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: colors.radius, backgroundColor: tab === t.value ? colors.primary : colors.secondary, borderWidth: 1, borderColor: tab === t.value ? colors.primary : colors.border }}
              onPress={() => setTab(t.value)}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: tab === t.value ? colors.primaryForeground : colors.mutedForeground }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'weapons' ? (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
            {/* Custom weapons first */}
            {customWeapons.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2, paddingTop: 12 }}>CUSTOM</Text>
                {customWeapons.map(w => <WeaponRow key={w.id} weapon={w} onDelete={() => confirmDeleteWeapon(w)} />)}
              </>
            )}
            {/* Built-in by category */}
            {(['firearm', 'energy', 'melee', 'unarmed'] as WeaponCategory[]).map(cat => {
              const weapons = BUILT_IN_WEAPONS.filter(w => w.category === cat);
              return (
                <View key={cat}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, paddingTop: 12 }}>{cat.toUpperCase()}S</Text>
                  {weapons.map(w => <WeaponRow key={w.id} weapon={w} />)}
                </View>
              );
            })}
            {/* Add button */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 }}
              onPress={() => setShowWeaponForm(true)}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>Add Custom Weapon</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
            {customArmor.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2, paddingTop: 12 }}>CUSTOM</Text>
                {customArmor.map(a => <ArmorRow key={a.id} armor={a} onDelete={() => confirmDeleteArmor(a)} />)}
              </>
            )}
            {['body', 'helmet'].map(slot => {
              const armors = BUILT_IN_ARMOR.filter(a => a.slot === slot);
              return (
                <View key={slot}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, paddingTop: 12 }}>{slot.toUpperCase()} ARMOR</Text>
                  {armors.map(a => <ArmorRow key={a.id} armor={a} />)}
                </View>
              );
            })}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 }}
              onPress={() => setShowArmorForm(true)}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>Add Custom Armor</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <WeaponFormModal visible={showWeaponForm} onClose={() => setShowWeaponForm(false)} onSave={w => { addCustomWeapon(w); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} />
      <ArmorFormModal visible={showArmorForm} onClose={() => setShowArmorForm(false)} onSave={a => { addCustomArmor(a); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} />
    </View>
  );
}

const styles = StyleSheet.create({});
