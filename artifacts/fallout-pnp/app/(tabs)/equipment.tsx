import React, { useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, ScrollView, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { BUILT_IN_WEAPONS, WEAPON_CATEGORIES, DAMAGE_TYPES, WEAPON_MODS, computeModBonuses, formatWeaponDamage } from '@/data/weapons';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { Weapon, Armor, DamageType, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_NAMES } from '@/context/types';

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const SKILL_LABELS: Record<string, string> = {
  smallGuns: 'Small Guns', bigGuns: 'Big Guns', energyWeapons: 'Energy Weapons',
  meleeWeapons: 'Melee Weapons', unarmed: 'Unarmed', throwing: 'Throwing', natural: 'Natural',
};

// ─── Weapon Form Modal ────────────────────────────────────────────────────────
function WeaponFormModal({ visible, onClose, onSave, editWeapon }: {
  visible: boolean; onClose: () => void; onSave: (w: Weapon) => void;
  editWeapon?: Weapon | null;
}) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('smallGuns');
  const [damageType, setDamageType] = useState<DamageType>('normal');
  const [dieCount, setDieCount] = useState(1);
  const [dieSides, setDieSides] = useState(6);
  const [damageBonus, setDamageBonus] = useState(0);
  const [burstLimit, setBurstLimit] = useState(1);
  const [isDoubleShot, setIsDoubleShot] = useState(false);
  const [magazineSize, setMagazineSize] = useState(0);
  const [minStr, setMinStr] = useState(3);
  const [rangeNormal, setRangeNormal] = useState(15);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [tab, setTab] = useState<'basic' | 'advanced' | 'mods'>('basic');
  const [showPresets, setShowPresets] = useState(false);

  const isEditing = !!editWeapon;

  const applyWeaponFields = (w: Weapon, nameOverride?: string) => {
    setName(nameOverride ?? w.name);
    setCategory(w.category);
    setDamageType(w.damageType);
    setDieCount(w.damageDieCount);
    setDieSides(w.damageDie);
    setDamageBonus(w.damageBonus);
    setBurstLimit(w.burstLimit);
    setIsDoubleShot(w.isDoubleShot);
    setMagazineSize(w.magazineSize);
    setMinStr(w.minStr);
    setRangeNormal(w.rangeNormal);
    setSelectedMods([...w.mods]);
  };

  React.useEffect(() => {
    if (!visible) return;
    setTab('basic');
    setShowPresets(false);
    if (editWeapon) {
      applyWeaponFields(editWeapon);
    } else {
      setName(''); setCategory('smallGuns'); setDamageType('normal');
      setDieCount(1); setDieSides(6); setDamageBonus(0); setBurstLimit(1);
      setIsDoubleShot(false); setMagazineSize(0); setMinStr(3); setRangeNormal(15);
      setSelectedMods([]);
    }
  }, [visible, editWeapon]);

  const isValid = name.trim().length > 0 && dieCount > 0 && dieSides > 0;

  const modBonuses = computeModBonuses(selectedMods);

  const toggleMod = (id: string) => {
    setSelectedMods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const copyFromPreset = (w: Weapon) => {
    applyWeaponFields(w, `${w.name} (Copy)`);
    setShowPresets(false);
  };

  const handleSave = () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave({
      id: isEditing ? editWeapon!.id : genId(), name: name.trim(),
      category: category as Weapon['category'],
      damageType, damageDieCount: dieCount, damageDie: dieSides,
      damageBonus, skill: (category === 'meleeWeapons' ? 'meleeWeapons' : category === 'unarmed' || category === 'natural' ? 'unarmed' : category === 'throwing' ? 'throwing' : category) as Weapon['skill'],
      burstLimit, isDoubleShot, magazineSize,
      weight: 0, minStr, rangeNormal, knockdownChance: 0,
      mods: selectedMods, isCustom: true,
    });
    onClose();
  };

  const NumStepper = ({ label, val, min, max, set }: { label: string; val: number; min: number; max: number; set: (v: number) => void }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => set(Math.max(min, val - 1))}><Feather name="minus" size={14} color={colors.foreground} /></TouchableOpacity>
        <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{val}</Text>
        <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => set(Math.min(max, val + 1))}><Feather name="plus" size={14} color={colors.foreground} /></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ maxHeight: '90%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{isEditing ? 'EDIT CUSTOM WEAPON' : 'CREATE CUSTOM WEAPON'}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>

          {/* Copy from preset */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}
              onPress={() => setShowPresets(v => !v)}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>COPY FROM PRESET</Text>
              <Feather name={showPresets ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showPresets && (
              <View style={{ maxHeight: 180, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                <ScrollView>
                  {BUILT_IN_WEAPONS.map(w => (
                    <TouchableOpacity key={w.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => copyFromPreset(w)}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{w.name}</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{formatWeaponDamage(w)} · {SKILL_LABELS[w.category] ?? w.category}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {(['basic', 'advanced', 'mods'] as const).map(t => (
              <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }} onPress={() => setTab(t)}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: tab === t ? colors.primary : colors.mutedForeground, letterSpacing: 0.5 }}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}>
            {tab === 'basic' && (
              <>
                <TextInput
                  style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: isValid ? colors.border : colors.destructive + '88', borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}
                  placeholder="Weapon name*" placeholderTextColor={colors.mutedForeground}
                  value={name} onChangeText={setName}
                />
                {/* Category */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CATEGORY</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(WEAPON_CATEGORIES).map(([label, val]) => (
                    <TouchableOpacity key={val} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: colors.radius, backgroundColor: category === val ? colors.primary : colors.secondary, borderWidth: 1, borderColor: category === val ? colors.primary : colors.border }} onPress={() => setCategory(val)}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: category === val ? colors.primaryForeground : colors.foreground }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Damage type */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>DAMAGE TYPE</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(Object.keys(DAMAGE_TYPES) as string[]).map(label => {
                    const val = DAMAGE_TYPES[label];
                    return (
                      <TouchableOpacity key={val} style={{ flex: 1, paddingVertical: 8, borderRadius: colors.radius, alignItems: 'center', backgroundColor: damageType === val ? colors.primary : colors.secondary, borderWidth: 1, borderColor: damageType === val ? colors.primary : colors.border }} onPress={() => setDamageType(val)}>
                        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: damageType === val ? colors.primaryForeground : colors.primary }}>{DAMAGE_TYPE_LABELS[val]}</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: damageType === val ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>{DAMAGE_TYPE_NAMES[val]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Damage dice */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>
                  DAMAGE: {dieCount}d{dieSides}{damageBonus !== 0 ? (damageBonus > 0 ? `+${damageBonus}` : `${damageBonus}`) : ''} ({DAMAGE_TYPE_LABELS[damageType]})
                </Text>
                <NumStepper label="Number of dice" val={dieCount} min={1} max={10} set={setDieCount} />
                <NumStepper label="Die sides" val={dieSides} min={2} max={12} set={setDieSides} />
                <NumStepper label="Flat bonus" val={damageBonus} min={-20} max={50} set={setDamageBonus} />
              </>
            )}

            {tab === 'advanced' && (
              <>
                <NumStepper label="Magazine size (0 = melee/unlimited)" val={magazineSize} min={0} max={999} set={setMagazineSize} />
                <NumStepper label="Burst limit (1 = single shot)" val={burstLimit} min={1} max={20} set={setBurstLimit} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>Double-shot weapon</Text>
                  <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, backgroundColor: isDoubleShot ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setIsDoubleShot(v => !v)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: isDoubleShot ? colors.primaryForeground : colors.mutedForeground }}>{isDoubleShot ? 'YES' : 'NO'}</Text>
                  </TouchableOpacity>
                </View>
                <NumStepper label="Min STR required" val={minStr} min={1} max={10} set={setMinStr} />
                <NumStepper label="Range (squares)" val={rangeNormal} min={1} max={100} set={setRangeNormal} />
              </>
            )}

            {tab === 'mods' && (
              <>
                {modBonuses.toHit !== 0 || modBonuses.damage !== 0 || modBonuses.range !== 0 ? (
                  <View style={{ backgroundColor: '#4a8c3f22', borderRadius: colors.radius, padding: 10, gap: 4, borderWidth: 1, borderColor: '#4a8c3f66' }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#4a8c3f', letterSpacing: 1 }}>ACTIVE MOD BONUSES</Text>
                    {modBonuses.toHit !== 0 && <Text style={{ fontSize: 12, color: '#4a8c3f' }}>+{modBonuses.toHit}% to-hit</Text>}
                    {modBonuses.damage !== 0 && <Text style={{ fontSize: 12, color: '#4a8c3f' }}>+{modBonuses.damage} damage</Text>}
                    {modBonuses.range !== 0 && <Text style={{ fontSize: 12, color: '#4a8c3f' }}>+{modBonuses.range} range</Text>}
                  </View>
                ) : null}
                {WEAPON_MODS.map(mod => {
                  const active = selectedMods.includes(mod.id);
                  return (
                    <TouchableOpacity key={mod.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '22' : colors.secondary, gap: 10 }} onPress={() => toggleMod(mod.id)}>
                      <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: active ? colors.primary : colors.mutedForeground, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : 'transparent' }}>
                        {active && <Feather name="check" size={12} color={colors.primaryForeground} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: active ? colors.primary : colors.foreground }}>{mod.name}</Text>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{mod.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ paddingVertical: 14, borderRadius: colors.radius, alignItems: 'center', backgroundColor: isValid ? colors.primary : colors.secondary, opacity: isValid ? 1 : 0.5 }} onPress={handleSave} disabled={!isValid}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: isValid ? colors.primaryForeground : colors.mutedForeground }}>{isEditing ? 'SAVE CHANGES' : 'CREATE WEAPON'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Armor Form Modal ─────────────────────────────────────────────────────────
function ArmorFormModal({ visible, onClose, onSave, editArmor }: {
  visible: boolean; onClose: () => void; onSave: (a: Armor) => void;
  editArmor?: Armor | null;
}) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [slot, setSlot] = useState<'body' | 'helmet'>('body');
  const [tab, setTab] = useState<'dt' | 'dr'>('dt');
  // DT fields
  const [dtNormal, setDtNormal] = useState(0);
  const [dtLaser, setDtLaser] = useState(0);
  const [dtFire, setDtFire] = useState(0);
  const [dtPlasma, setDtPlasma] = useState(0);
  const [dtExplosion, setDtExplosion] = useState(0);
  // DR fields
  const [drNormal, setDrNormal] = useState(0);
  const [drLaser, setDrLaser] = useState(0);
  const [drFire, setDrFire] = useState(0);
  const [drPlasma, setDrPlasma] = useState(0);
  const [drExplosion, setDrExplosion] = useState(0);
  const [acBonus, setAcBonus] = useState(0);
  const [showPresets, setShowPresets] = useState(false);

  const isEditing = !!editArmor;

  const applyArmorFields = (a: Armor, nameOverride?: string) => {
    setName(nameOverride ?? a.name);
    setSlot(a.slot);
    setDtNormal(a.dtNormal); setDtLaser(a.dtLaser); setDtFire(a.dtFire); setDtPlasma(a.dtPlasma); setDtExplosion(a.dtExplosion);
    setDrNormal(a.drNormal); setDrLaser(a.drLaser); setDrFire(a.drFire); setDrPlasma(a.drPlasma); setDrExplosion(a.drExplosion);
    setAcBonus(a.acBonus);
  };

  React.useEffect(() => {
    if (!visible) return;
    setTab('dt');
    setShowPresets(false);
    if (editArmor) {
      applyArmorFields(editArmor);
    } else {
      setName(''); setSlot('body');
      setDtNormal(0); setDtLaser(0); setDtFire(0); setDtPlasma(0); setDtExplosion(0);
      setDrNormal(0); setDrLaser(0); setDrFire(0); setDrPlasma(0); setDrExplosion(0);
      setAcBonus(0);
    }
  }, [visible, editArmor]);

  const isValid = name.trim().length > 0;

  const copyFromPreset = (a: Armor) => {
    applyArmorFields(a, `${a.name} (Copy)`);
    setShowPresets(false);
  };

  const handleSave = () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave({
      id: isEditing ? editArmor!.id : genId(), name: name.trim(), slot,
      dtNormal, dtLaser, dtFire, dtPlasma, dtExplosion,
      drNormal, drLaser, drFire, drPlasma, drExplosion,
      acBonus, weight: 0, isCustom: true,
    });
    onClose();
  };

  const NumStepper = ({ label, val, min, max, set }: { label: string; val: number; min: number; max: number; set: (v: number) => void }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => set(Math.max(min, val - 1))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{val}{tab === 'dr' ? '%' : ''}</Text>
        <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => set(Math.min(max, val + 1))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
      </View>
    </View>
  );

  const dtData = [
    { label: 'DT Normal (N)', val: dtNormal, set: setDtNormal },
    { label: 'DT Laser (L)', val: dtLaser, set: setDtLaser },
    { label: 'DT Fire (F)', val: dtFire, set: setDtFire },
    { label: 'DT Plasma (P)', val: dtPlasma, set: setDtPlasma },
    { label: 'DT Explosion (E)', val: dtExplosion, set: setDtExplosion },
  ];
  const drData = [
    { label: 'DR Normal (N) %', val: drNormal, set: setDrNormal },
    { label: 'DR Laser (L) %', val: drLaser, set: setDrLaser },
    { label: 'DR Fire (F) %', val: drFire, set: setDrFire },
    { label: 'DR Plasma (P) %', val: drPlasma, set: setDrPlasma },
    { label: 'DR Explosion (E) %', val: drExplosion, set: setDrExplosion },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ maxHeight: '85%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{isEditing ? 'EDIT CUSTOM ARMOR' : 'CREATE CUSTOM ARMOR'}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>

          {/* Copy from preset */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}
              onPress={() => setShowPresets(v => !v)}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>COPY FROM PRESET</Text>
              <Feather name={showPresets ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showPresets && (
              <View style={{ maxHeight: 180, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                <ScrollView>
                  {BUILT_IN_ARMOR.map(a => (
                    <TouchableOpacity key={a.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => copyFromPreset(a)}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{a.name}</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{a.slot === 'body' ? 'Body' : 'Helmet'} · AC+{a.acBonus}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {(['dt', 'dr'] as const).map(t => (
              <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }} onPress={() => setTab(t)}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: tab === t ? colors.primary : colors.mutedForeground, letterSpacing: 1 }}>{t === 'dt' ? 'DT (FLAT)' : 'DR (% RESIST)'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
            {tab === 'dt' && (
              <>
                <TextInput
                  style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}
                  placeholder="Armor name*" placeholderTextColor={colors.mutedForeground}
                  value={name} onChangeText={setName}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['body', 'helmet'] as const).map(s => (
                    <TouchableOpacity key={s} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: slot === s ? colors.primary : colors.secondary, borderWidth: 1, borderColor: slot === s ? colors.primary : colors.border }} onPress={() => setSlot(s)}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: slot === s ? colors.primaryForeground : colors.mutedForeground, letterSpacing: 1 }}>{s.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, flex: 1 }}>AC Bonus</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setAcBonus(v => Math.max(0, v - 1))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{acBonus}</Text>
                    <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setAcBonus(v => Math.min(50, v + 1))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                  </View>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>DT = flat damage reduction applied before DR percentage.</Text>
                {dtData.map(({ label, val, set }) => (
                  <NumStepper key={label} label={label} val={val} min={0} max={50} set={set} />
                ))}
              </>
            )}
            {tab === 'dr' && (
              <>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  DR = percentage reduction applied after DT. Final damage = max(0, (base−DT) × (1−DR%))
                </Text>
                {drData.map(({ label, val, set }) => (
                  <NumStepper key={label} label={label} val={val} min={0} max={90} set={set} />
                ))}
              </>
            )}
          </ScrollView>

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ paddingVertical: 14, borderRadius: colors.radius, alignItems: 'center', backgroundColor: isValid ? colors.primary : colors.secondary, opacity: isValid ? 1 : 0.5 }} onPress={handleSave} disabled={!isValid}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: isValid ? colors.primaryForeground : colors.mutedForeground }}>{isEditing ? 'SAVE CHANGES' : 'CREATE ARMOR'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Weapon Row ───────────────────────────────────────────────────────────────
function WeaponRow({ weapon, onDelete, onEdit, onCopy }: { weapon: Weapon; onDelete?: () => void; onEdit?: () => void; onCopy?: () => void }) {
  const colors = useColors();
  const modBonuses = computeModBonuses(weapon.mods);
  const hasModBonuses = modBonuses.toHit !== 0 || modBonuses.damage !== 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{weapon.name}</Text>
          {weapon.isCustom && <View style={{ paddingHorizontal: 5, paddingVertical: 2, backgroundColor: colors.primary + '33', borderRadius: 3 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>CUSTOM</Text></View>}
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.secondary, borderRadius: 3, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>{DAMAGE_TYPE_LABELS[weapon.damageType]}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
          {formatWeaponDamage(weapon)} · {SKILL_LABELS[weapon.category] ?? weapon.category}
          {weapon.magazineSize > 0 ? ` · Mag ${weapon.magazineSize}` : ' · Melee'}
          {weapon.burstLimit > 1 ? ` · Burst ${weapon.burstLimit}` : ''}
          {weapon.isDoubleShot ? ' · Double' : ''}
          {` · Range ${weapon.rangeNormal}sq`}
        </Text>
        {hasModBonuses && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f', marginTop: 2 }}>
            Mods: {modBonuses.toHit > 0 ? `+${modBonuses.toHit}% hit` : ''}{modBonuses.damage > 0 ? ` +${modBonuses.damage} dmg` : ''}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onCopy && (
          <TouchableOpacity onPress={onCopy} style={{ padding: 6 }}>
            <Feather name="copy" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}>
            <Feather name="edit-2" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
            <Feather name="trash-2" size={16} color={colors.destructive} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Armor Row ────────────────────────────────────────────────────────────────
function ArmorRow({ armor, onDelete, onEdit, onCopy }: { armor: Armor; onDelete?: () => void; onEdit?: () => void; onCopy?: () => void }) {
  const colors = useColors();
  const dtTypes: (keyof Armor)[] = ['dtNormal', 'dtLaser', 'dtFire', 'dtPlasma', 'dtExplosion'];
  const drTypes: (keyof Armor)[] = ['drNormal', 'drLaser', 'drFire', 'drPlasma', 'drExplosion'];
  const typeLabels = ['N', 'L', 'F', 'P', 'E'];
  return (
    <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{armor.name}</Text>
          {armor.isCustom && <View style={{ paddingHorizontal: 5, paddingVertical: 2, backgroundColor: colors.primary + '33', borderRadius: 3 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>CUSTOM</Text></View>}
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{armor.slot === 'body' ? 'Body' : 'Helmet'} · AC+{armor.acBonus}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onCopy && <TouchableOpacity onPress={onCopy} style={{ padding: 6 }}><Feather name="copy" size={16} color={colors.mutedForeground} /></TouchableOpacity>}
          {onEdit && <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}><Feather name="edit-2" size={16} color={colors.primary} /></TouchableOpacity>}
          {onDelete && <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {typeLabels.map((l, i) => {
          const dt = (armor[dtTypes[i]] as number);
          const dr = (armor[drTypes[i]] as number);
          return (dt > 0 || dr > 0) ? (
            <View key={l} style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.secondary, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>{l}</Text>
              {dt > 0 && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.foreground }}>DT {dt}</Text>}
              {dr > 0 && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>DR {dr}%</Text>}
            </View>
          ) : null;
        })}
        {typeLabels.every((_, i) => (armor[dtTypes[i]] as number) === 0 && (armor[drTypes[i]] as number) === 0) && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>No protection values</Text>
        )}
      </View>
    </View>
  );
}

// ─── Equipment Screen ─────────────────────────────────────────────────────────
export default function EquipmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { customWeapons, customArmor, addCustomWeapon, updateCustomWeapon, deleteCustomWeapon, addCustomArmor, updateCustomArmor, deleteCustomArmor } = useApp();
  const [tab, setTab] = useState<'weapons' | 'armor'>('weapons');
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [showArmorForm, setShowArmorForm] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [editingArmor, setEditingArmor] = useState<Armor | null>(null);
  const [search, setSearch] = useState('');

  const openNewWeapon = () => { setEditingWeapon(null); setShowWeaponForm(true); };
  const openNewArmor = () => { setEditingArmor(null); setShowArmorForm(true); };
  const openEditWeapon = (w: Weapon) => { setEditingWeapon(w); setShowWeaponForm(true); };
  const openEditArmor = (a: Armor) => { setEditingArmor(a); setShowArmorForm(true); };
  // Duplicate: open the creator pre-filled from an existing weapon/armor as a NEW custom.
  const openCopyWeapon = (w: Weapon) => { setEditingWeapon({ ...w, id: genId(), name: `${w.name} (Copy)`, isCustom: true }); setShowWeaponForm(true); };
  const openCopyArmor = (a: Armor) => { setEditingArmor({ ...a, id: genId(), name: `${a.name} (Copy)`, isCustom: true }); setShowArmorForm(true); };

  const allWeapons = [...BUILT_IN_WEAPONS, ...customWeapons];
  const allArmor = [...BUILT_IN_ARMOR, ...customArmor];

  const filteredWeapons = allWeapons.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase()));
  const filteredArmor = allArmor.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      {/* Header */}
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>EQUIPMENT</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: colors.radius }}
            onPress={() => tab === 'weapons' ? openNewWeapon() : openNewArmor()}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>
              {tab === 'weapons' ? 'WEAPON' : 'ARMOR'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, gap: 8 }}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={{ flex: 1, paddingVertical: 8, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}
            placeholder="Search…" placeholderTextColor={colors.mutedForeground}
            value={search} onChangeText={setSearch}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['weapons', 'armor'] as const).map(t => (
            <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: tab === t ? colors.primary : colors.secondary, borderWidth: 1, borderColor: tab === t ? colors.primary : colors.border }} onPress={() => setTab(t)}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: tab === t ? colors.primaryForeground : colors.mutedForeground }}>
                {t === 'weapons' ? `WEAPONS (${filteredWeapons.length})` : `ARMOR (${filteredArmor.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {tab === 'weapons' ? (
        <FlatList
          data={filteredWeapons}
          keyExtractor={w => w.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <WeaponRow
              weapon={item}
              onCopy={() => openCopyWeapon(item)}
              onEdit={item.isCustom ? () => openEditWeapon(item) : undefined}
              onDelete={item.isCustom ? () => Alert.alert('Delete', `Delete ${item.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteCustomWeapon(item.id) },
              ]) : undefined}
            />
          )}
        />
      ) : (
        <FlatList
          data={filteredArmor}
          keyExtractor={a => a.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <ArmorRow
              armor={item}
              onCopy={() => openCopyArmor(item)}
              onEdit={item.isCustom ? () => openEditArmor(item) : undefined}
              onDelete={item.isCustom ? () => Alert.alert('Delete', `Delete ${item.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteCustomArmor(item.id) },
              ]) : undefined}
            />
          )}
        />
      )}

      <WeaponFormModal
        visible={showWeaponForm}
        editWeapon={editingWeapon}
        onClose={() => { setShowWeaponForm(false); setEditingWeapon(null); }}
        onSave={w => {
          if (customWeapons.some(x => x.id === w.id)) updateCustomWeapon(w);
          else addCustomWeapon(w);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
      <ArmorFormModal
        visible={showArmorForm}
        editArmor={editingArmor}
        onClose={() => { setShowArmorForm(false); setEditingArmor(null); }}
        onSave={a => {
          if (customArmor.some(x => x.id === a.id)) updateCustomArmor(a);
          else addCustomArmor(a);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}
