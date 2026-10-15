import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  FlatList, Modal, Platform, ScrollView, View,
} from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity, localizedConfirm } from '@/components/LocalizedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { BestiaryTemplate, BestiaryCategory, CharacterSkills, SPECIALStats, DEFAULT_SKILLS, NaturalProtection, EMPTY_NATURAL_PROTECTION, Armor, DamageType, DAMAGE_TYPE_NAMES } from '@/context/types';
import { BUILT_IN_BESTIARY, BESTIARY_CATEGORIES, spawnBestiaryTemplate } from '@/data/bestiary';
import { calcMaxHP, calcMaxAP, calcBaseAC, calcSequence, calcBaseSkills } from '@/data/derived';
import { RACES, getRaceById } from '@/data/races';
import { computeCombinedProtection } from '@/data/armor';

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SKILL_SHORTHAND: (keyof CharacterSkills)[] = ['smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed'];
const SKILL_SHORT_LABELS: Partial<Record<keyof CharacterSkills, string>> = {
  smallGuns: 'SG', bigGuns: 'BG', energyWeapons: 'EW', meleeWeapons: 'MW', unarmed: 'UN',
};

const DEFAULT_SPECIAL: SPECIALStats = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };

// 5 damage types keyed to NaturalProtection / Armor fields
const NP_TYPES: { type: DamageType; dtKey: keyof NaturalProtection; drKey: keyof NaturalProtection }[] = [
  { type: 'normal', dtKey: 'dtNormal', drKey: 'drNormal' },
  { type: 'laser', dtKey: 'dtLaser', drKey: 'drLaser' },
  { type: 'fire', dtKey: 'dtFire', drKey: 'drFire' },
  { type: 'plasma', dtKey: 'dtPlasma', drKey: 'drPlasma' },
  { type: 'explosion', dtKey: 'dtExplosion', drKey: 'drExplosion' },
];

// Combined DT/DR for a damage type from natural protection + body + helmet
function combinedProtectionFor(
  np: NaturalProtection | undefined,
  body: Armor | undefined,
  helmet: Armor | undefined,
  t: { type: DamageType; dtKey: keyof NaturalProtection; drKey: keyof NaturalProtection },
): { dt: number; dr: number } {
  const armor = computeCombinedProtection(body, helmet, t.type);
  const npDt = np ? (np[t.dtKey] as number) : 0;
  const npDr = np ? (np[t.drKey] as number) : 0;
  return { dt: armor.dt + npDt, dr: armor.dr + npDr };
}

// ─── Spawn Modal ─────────────────────────────────────────────────────────────
function SpawnModal({ template, visible, onClose, onSpawn, allWeapons, allArmor }: {
  template: BestiaryTemplate | null; visible: boolean;
  onClose: () => void; onSpawn: (name: string) => void;
  allWeapons: import('@/context/types').Weapon[];
  allArmor: Armor[];
}) {
  const colors = useColors();
  const [customName, setCustomName] = useState('');
  if (!template) return null;
  const spawnName = customName.trim() || template.name;
  const attacks = (template.naturalAttacks ?? []).map(attack => ({
    ...attack,
    weapon: allWeapons.find(w => w.id === attack.weaponId),
  })).filter(attack => !!attack.weapon);
  const spawnBody = allArmor.find(a => a.id === template.equippedBodyArmorId);
  const spawnHelmet = allArmor.find(a => a.id === template.equippedHelmetId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>SPAWN {template.name.toUpperCase()}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['HP', template.maxHp], ['AC', template.armorClass], ['AP', template.maxAP],
              ['SEQ', template.sequence], ['XP', template.xpValue ?? '—'],
              ['CC', template.criticalChance === undefined ? '—' : `${template.criticalChance}%`],
            ].map(([l, v]) => (
              <View key={l} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>{l}</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary }}>{v}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>PR {template.poisonResistance ?? 0}%</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>RR {template.radiationResistance}%</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>GR {template.gasResistance}/{template.gasResistanceSecondary ?? 0}</Text>
          </View>

          {/* Top combat skills */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SKILL_SHORTHAND.map(sk => (
              template.skills[sk] > 0 && (
                <View key={sk} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.secondary, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{SKILL_SHORT_LABELS[sk]}</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{template.skills[sk]}%</Text>
                </View>
              )
            ))}
          </View>

          {attacks.map(({ weapon, hitChance, notes }) => weapon && (
            <Text key={weapon.id} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
              {weapon.name}: {hitChance}% · {weapon.apSingle} AP · {weapon.damageDieCount}d{weapon.damageDie}{notes ? ` · ${notes}` : ''}
            </Text>
          ))}
          {!attacks.length && template.equippedWeaponId && (
            <Text style={{ fontSize: 12, color: colors.foreground }}>
              Equipped: {allWeapons.find(w => w.id === template.equippedWeaponId)?.name ?? template.equippedWeaponId}
            </Text>
          )}

          {/* Derived DT/DR (armor + natural protection) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {NP_TYPES.map(t => {
              const c = combinedProtectionFor(template.naturalProtection, spawnBody, spawnHelmet, t);
              return (
                <View key={t.type} style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.secondary, borderRadius: 4, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>{DAMAGE_TYPE_NAMES[t.type].charAt(0)}</Text>
                  {c.dt > 0 && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.foreground }}>DT {c.dt}</Text>}
                  {c.dr > 0 && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>DR {c.dr}%</Text>}
                </View>
              );
            })}
          </View>

          {template.description && (
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, fontStyle: 'italic' }}>{template.description}</Text>
          )}

          <TextInput
            style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }}
            placeholder={`Custom name (default: ${template.name})`}
            placeholderTextColor={colors.mutedForeground}
            value={customName}
            onChangeText={setCustomName}
          />

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: colors.radius, backgroundColor: colors.primary }}
            onPress={() => { onSpawn(spawnName); setCustomName(''); onClose(); }}
          >
            <Feather name="plus-circle" size={16} color={colors.primaryForeground} />
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primaryForeground }}>SPAWN TO COMBAT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Custom NPC Form Modal ─────────────────────────────────────────────────────
function CustomNPCModal({ visible, onClose, onSave, editTemplate, allWeapons, allArmor }: {
  visible: boolean; onClose: () => void;
  onSave: (t: BestiaryTemplate) => void;
  editTemplate?: BestiaryTemplate | null;
  allWeapons: import('@/context/types').Weapon[];
  allArmor: Armor[];
}) {
  const colors = useColors();
  const [name, setName] = useState(editTemplate?.name ?? '');
  const [category, setCategory] = useState<BestiaryCategory>(editTemplate?.category ?? 'custom');
  const [description, setDescription] = useState(editTemplate?.description ?? '');
  const [special, setSpecial] = useState<SPECIALStats>(editTemplate?.special ?? { ...DEFAULT_SPECIAL });
  const [skills, setSkills] = useState<CharacterSkills>(editTemplate?.skills ?? { ...DEFAULT_SKILLS });
  const [maxHp, setMaxHp] = useState(editTemplate?.maxHp ?? 30);
  const [maxAP, setMaxAP] = useState(editTemplate?.maxAP ?? 8);
  const [sequence, setSequence] = useState(editTemplate?.sequence ?? calcSequence(editTemplate?.special ?? DEFAULT_SPECIAL));
  const [radRes, setRadRes] = useState(editTemplate?.radiationResistance ?? 0);
  const [weaponId, setWeaponId] = useState(editTemplate?.equippedWeaponId ?? '');
  const [bodyArmorId, setBodyArmorId] = useState(editTemplate?.equippedBodyArmorId ?? '');
  const [helmetId, setHelmetId] = useState(editTemplate?.equippedHelmetId ?? '');
  const [naturalProtection, setNaturalProtection] = useState<NaturalProtection>(editTemplate?.naturalProtection ?? { ...EMPTY_NATURAL_PROTECTION });
  const [useComputed, setUseComputed] = useState(false);
  const [tab, setTab] = useState<'basics' | 'special' | 'skills' | 'protect'>('basics');
  const [showPreset, setShowPreset] = useState(false);
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showBodyPicker, setShowBodyPicker] = useState(false);
  const [showHelmetPicker, setShowHelmetPicker] = useState(false);

  const applyTemplateFields = (t: BestiaryTemplate, nameOverride?: string) => {
    setName(nameOverride ?? t.name);
    setCategory(t.category);
    setDescription(t.description ?? '');
    setSpecial({ ...t.special });
    setSkills({ ...t.skills });
    setMaxHp(t.maxHp);
    setMaxAP(t.maxAP);
    setSequence(t.sequence);
    setRadRes(t.radiationResistance);
    setWeaponId(t.equippedWeaponId ?? '');
    setBodyArmorId(t.equippedBodyArmorId ?? '');
    setHelmetId(t.equippedHelmetId ?? '');
    setNaturalProtection(t.naturalProtection ? { ...t.naturalProtection } : { ...EMPTY_NATURAL_PROTECTION });
  };

  React.useEffect(() => {
    if (!visible) return;
    setUseComputed(false);
    setTab('basics');
    setShowPreset(false);
    setShowWeaponPicker(false);
    setShowBodyPicker(false);
    setShowHelmetPicker(false);
    if (editTemplate) {
      applyTemplateFields(editTemplate);
    } else {
      setName('');
      setCategory('custom');
      setDescription('');
      setSpecial({ ...DEFAULT_SPECIAL });
      setSkills({ ...DEFAULT_SKILLS });
      setMaxHp(30);
      setMaxAP(8);
      setSequence(calcSequence(DEFAULT_SPECIAL));
      setRadRes(0);
      setWeaponId('');
      setBodyArmorId('');
      setHelmetId('');
      setNaturalProtection({ ...EMPTY_NATURAL_PROTECTION });
    }
  }, [visible]);

  // Auto-compute derived stats when useComputed is on
  React.useEffect(() => {
    if (useComputed) {
      setMaxHp(calcMaxHP(special, 1));
      setMaxAP(calcMaxAP(special));
      setSequence(calcSequence(special));
      setSkills(calcBaseSkills(special));
    }
  }, [special, useComputed]);

  const bodyArmor = allArmor.find(a => a.id === bodyArmorId);
  const helmet = allArmor.find(a => a.id === helmetId);
  const bodyArmorList = allArmor.filter(a => a.slot === 'body');
  const helmetList = allArmor.filter(a => a.slot === 'helmet');

  // Natural AC is a separate contribution, included once in the preview total.
  const naturalAC = naturalProtection.armorClass ?? 0;
  const derivedAC = special.agility + naturalAC + (bodyArmor?.acBonus ?? 0) + (helmet?.acBonus ?? 0);

  const setNP = (dtKey: keyof NaturalProtection, drKey: keyof NaturalProtection, field: 'dt' | 'dr', delta: number) => {
    setNaturalProtection(np => {
      const key = field === 'dt' ? dtKey : drKey;
      const max = field === 'dt' ? 50 : 90;
      return { ...np, [key]: Math.max(0, Math.min(max, (np[key] as number) + delta)) };
    });
  };

  const SPECIAL_KEYS = Object.keys(special) as (keyof SPECIALStats)[];
  const COMBAT_SKILLS: (keyof CharacterSkills)[] = ['smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed', 'throwing'];
  const SUPPORT_SKILLS: (keyof CharacterSkills)[] = ['firstAid', 'doctor', 'sneak', 'lockpick', 'steal', 'traps', 'science', 'repair', 'speech', 'barter', 'gambling', 'outdoorsman', 'pilot'];
  const SKILL_LABELS: Record<keyof CharacterSkills, string> = {
    smallGuns: 'Small Guns', bigGuns: 'Big Guns', energyWeapons: 'Energy Weapons',
    meleeWeapons: 'Melee Weapons', unarmed: 'Unarmed', throwing: 'Throwing',
    firstAid: 'First Aid', doctor: 'Doctor', sneak: 'Sneak', lockpick: 'Lockpick',
    steal: 'Steal', traps: 'Traps', science: 'Science', repair: 'Repair',
    speech: 'Speech', barter: 'Barter', gambling: 'Gambling', outdoorsman: 'Outdoorsman',
    pilot: 'Pilot',
  };

  const hasNaturalProtection = naturalAC > 0 || NP_TYPES.some(t => (naturalProtection[t.dtKey] as number) > 0 || (naturalProtection[t.drKey] as number) > 0);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const t: BestiaryTemplate = {
      id: editTemplate?.id ?? genId(),
      name: name.trim(), category, description,
      special, maxHp, armorClass: derivedAC, usesDerivedArmorClass: true, maxAP, sequence, skills,
      equippedWeaponId: weaponId || undefined,
      equippedBodyArmorId: bodyArmorId || undefined,
      equippedHelmetId: helmetId || undefined,
      naturalProtection: hasNaturalProtection ? naturalProtection : undefined,
      radiationResistance: radRes, gasResistance: 0, electricityResistance: 0,
      isCustom: true,
    };
    onSave(t);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '95%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{editTemplate ? 'EDIT' : 'CREATE'} CUSTOM NPC</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>

          {/* Copy from template */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}
              onPress={() => setShowPreset(v => !v)}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>COPY FROM TEMPLATE</Text>
              <Feather name={showPreset ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showPreset && (
              <View style={{ maxHeight: 180, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                <ScrollView>
                  {BUILT_IN_BESTIARY.map(t => (
                    <TouchableOpacity key={t.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { applyTemplateFields(t); setShowPreset(false); }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{t.name}</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{BESTIARY_CATEGORIES.find(c => c.id === t.category)?.label} · HP {t.maxHp} · AP {t.maxAP}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Tab bar */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {(['basics', 'special', 'skills', 'protect'] as const).map(t => (
              <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }} onPress={() => setTab(t)}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: tab === t ? colors.primary : colors.mutedForeground, letterSpacing: 1 }}>{t === 'protect' ? 'DT/DR' : t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
            {tab === 'basics' && (
              <>
                <TextInput
                  style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}
                  placeholder="NPC Name*" placeholderTextColor={colors.mutedForeground}
                  value={name} onChangeText={setName}
                />
                <TextInput
                  style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, minHeight: 60, textAlignVertical: 'top' }}
                  placeholder="Description (optional)" placeholderTextColor={colors.mutedForeground}
                  value={description} onChangeText={setDescription} multiline
                />
                {/* Category */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CATEGORY</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {BESTIARY_CATEGORIES.map(c => (
                    <TouchableOpacity key={c.id} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: category === c.id ? colors.primary : colors.secondary, borderWidth: 1, borderColor: category === c.id ? colors.primary : colors.border }} onPress={() => setCategory(c.id)}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: category === c.id ? colors.primaryForeground : colors.foreground }}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Derived stats */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>AUTO-COMPUTE FROM SPECIAL</Text>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: useComputed ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => setUseComputed(v => !v)}
                  >
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: useComputed ? colors.primaryForeground : colors.mutedForeground }}>{useComputed ? 'ON' : 'OFF'}</Text>
                  </TouchableOpacity>
                </View>

                {[
                  { label: 'Max HP', val: maxHp, set: setMaxHp, min: 1, max: 999 },
                  { label: 'Max AP', val: maxAP, set: setMaxAP, min: 1, max: 20 },
                  { label: 'Sequence', val: sequence, set: setSequence, min: 0, max: 30 },
                  { label: 'Radiation Resistance %', val: radRes, set: setRadRes, min: 0, max: 100 },
                ].map(({ label, val, set, min, max }) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => set(v => Math.max(min, v - 1))}><Feather name="minus" size={14} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 40, textAlign: 'center' }}>{val}</Text>
                      <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => set(v => Math.min(max, v + 1))}><Feather name="plus" size={14} color={colors.foreground} /></TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Derived AC (agility + natural + armor acBonus) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                  <View>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.foreground }}>Armor Class (derived)</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>AGI {special.agility} + natural {naturalAC} + armor {(bodyArmor?.acBonus ?? 0) + (helmet?.acBonus ?? 0)}</Text>
                  </View>
                  <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.primary }}>{derivedAC}</Text>
                </View>

                {/* Weapon dropdown */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 4 }}>EQUIPPED WEAPON</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setShowWeaponPicker(v => !v)}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: weaponId ? colors.foreground : colors.mutedForeground }}>{allWeapons.find(w => w.id === weaponId)?.name ?? 'None'}</Text>
                  <Feather name={showWeaponPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showWeaponPicker && (
                  <View style={{ maxHeight: 200, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                    <ScrollView>
                      <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { setWeaponId(''); setShowWeaponPicker(false); }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>None</Text>
                      </TouchableOpacity>
                      {allWeapons.map(w => (
                        <TouchableOpacity key={w.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: weaponId === w.id ? colors.primary + '22' : 'transparent' }} onPress={() => { setWeaponId(w.id); setShowWeaponPicker(false); }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: weaponId === w.id ? colors.primary : colors.foreground }}>{w.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Body armor dropdown */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 4 }}>BODY ARMOR</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setShowBodyPicker(v => !v)}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: bodyArmorId ? colors.foreground : colors.mutedForeground }}>{bodyArmor?.name ?? 'None'}</Text>
                  <Feather name={showBodyPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showBodyPicker && (
                  <View style={{ maxHeight: 200, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                    <ScrollView>
                      <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { setBodyArmorId(''); setShowBodyPicker(false); }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>None</Text>
                      </TouchableOpacity>
                      {bodyArmorList.map(a => (
                        <TouchableOpacity key={a.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: bodyArmorId === a.id ? colors.primary + '22' : 'transparent' }} onPress={() => { setBodyArmorId(a.id); setShowBodyPicker(false); }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: bodyArmorId === a.id ? colors.primary : colors.foreground }}>{a.name}</Text>
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>AC+{a.acBonus}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Helmet dropdown */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 4 }}>HELMET</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setShowHelmetPicker(v => !v)}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: helmetId ? colors.foreground : colors.mutedForeground }}>{helmet?.name ?? 'None'}</Text>
                  <Feather name={showHelmetPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showHelmetPicker && (
                  <View style={{ maxHeight: 200, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                    <ScrollView>
                      <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { setHelmetId(''); setShowHelmetPicker(false); }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>None</Text>
                      </TouchableOpacity>
                      {helmetList.map(a => (
                        <TouchableOpacity key={a.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: helmetId === a.id ? colors.primary + '22' : 'transparent' }} onPress={() => { setHelmetId(a.id); setShowHelmetPicker(false); }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: helmetId === a.id ? colors.primary : colors.foreground }}>{a.name}</Text>
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>AC+{a.acBonus}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {tab === 'special' && (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>SPECIAL STATS</Text>
                {SPECIAL_KEYS.map(k => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground, width: 120, textTransform: 'capitalize' }}>{k}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setSpecial(s => ({ ...s, [k]: Math.max(1, s[k] - 1) }))}><Feather name="minus" size={14} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.primary, width: 36, textAlign: 'center' }}>{special[k]}</Text>
                      <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setSpecial(s => ({ ...s, [k]: Math.min(14, s[k] + 1) }))}><Feather name="plus" size={14} color={colors.foreground} /></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {tab === 'skills' && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>COMBAT SKILLS</Text>
                  {useComputed && <Text style={{ fontSize: 11, color: colors.primary }}>Auto from SPECIAL</Text>}
                </View>
                {([...COMBAT_SKILLS, ...SUPPORT_SKILLS] as (keyof CharacterSkills)[]).map(sk => (
                  <View key={sk} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground, flex: 1 }}>{SKILL_LABELS[sk]}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setSkills(s => ({ ...s, [sk]: Math.max(0, s[sk] - 1) }))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: skills[sk] > 50 ? colors.primary : colors.foreground, minWidth: 38, textAlign: 'center' }}>{skills[sk]}%</Text>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setSkills(s => ({ ...s, [sk]: Math.min(200, s[sk] + 1) }))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {tab === 'protect' && (
              <>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>NATURAL PROTECTION (AC/DT/DR)</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  Built-in armor for creatures like Deathclaws/Radscorpions. AC = Armor Class bonus, DT = flat reduction, DR = % resist. Stacks with equipped armor.
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground, flex: 1 }}>Natural AC bonus</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Decrease natural AC bonus"
                      accessibilityState={{ disabled: naturalAC === 0 }}
                      disabled={naturalAC === 0}
                      style={{ width: 44, height: 44, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setNaturalProtection(np => ({ ...np, armorClass: Math.max(0, (np.armorClass ?? 0) - 1) }))}
                    ><Feather name="minus" size={14} color={colors.foreground} /></TouchableOpacity>
                    <Text accessibilityLabel={`Natural AC bonus: ${naturalAC}`} style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 32, textAlign: 'center' }}>{naturalAC}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Increase natural AC bonus"
                      style={{ width: 44, height: 44, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setNaturalProtection(np => ({ ...np, armorClass: (np.armorClass ?? 0) + 1 }))}
                    ><Feather name="plus" size={14} color={colors.foreground} /></TouchableOpacity>
                  </View>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  Total AC: {derivedAC} (AGI {special.agility} + natural {naturalAC} + armor {(bodyArmor?.acBonus ?? 0) + (helmet?.acBonus ?? 0)})
                </Text>
                {NP_TYPES.map(t => {
                  const dtVal = naturalProtection[t.dtKey] as number;
                  const drVal = naturalProtection[t.drKey] as number;
                  const combined = combinedProtectionFor(naturalProtection, bodyArmor, helmet, t);
                  return (
                    <View key={t.type} style={{ padding: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary }}>{DAMAGE_TYPE_NAMES[t.type]}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground }}>DT (flat)</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setNP(t.dtKey, t.drKey, 'dt', -1)}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground, minWidth: 32, textAlign: 'center' }}>{dtVal}</Text>
                          <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setNP(t.dtKey, t.drKey, 'dt', 1)}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground }}>DR (%)</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setNP(t.dtKey, t.drKey, 'dr', -5)}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground, minWidth: 40, textAlign: 'center' }}>{drVal}%</Text>
                          <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setNP(t.dtKey, t.drKey, 'dr', 5)}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                        </View>
                      </View>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                        Total (with armor): DT {combined.dt} · DR {combined.dr}%
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity
              style={{ paddingVertical: 14, borderRadius: colors.radius, backgroundColor: name.trim() ? colors.primary : colors.secondary, alignItems: 'center' }}
              onPress={handleSave} disabled={!name.trim()}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: name.trim() ? colors.primaryForeground : colors.mutedForeground }}>SAVE NPC</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Bestiary Card ───────────────────────────────────────────────────────────
function BestiaryCard({ template, onSpawn, onEdit, onDelete, allWeapons }: {
  template: BestiaryTemplate;
  onSpawn: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  allWeapons: import('@/context/types').Weapon[];
}) {
  const colors = useColors();
  const cat = BESTIARY_CATEGORIES.find(c => c.id === template.category);
  const attacks = (template.naturalAttacks ?? []).map(attack => ({
    ...attack,
    weapon: allWeapons.find(w => w.id === attack.weaponId),
  })).filter(attack => !!attack.weapon);
  const topSkills = SKILL_SHORTHAND.filter(sk => template.skills[sk] > 0);

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: template.isCustom ? colors.primary + '66' : colors.border, padding: 12, gap: 8 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {template.isCustom && <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.primary + '33', borderRadius: 4 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>CUSTOM</Text></View>}
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground, flexShrink: 1 }}>{template.name}</Text>
          </View>
          {template.description && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }} numberOfLines={2}>{template.description}</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {onEdit && <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}><Feather name="edit-2" size={14} color={colors.mutedForeground} /></TouchableOpacity>}
          {onDelete && <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}><Feather name="trash-2" size={14} color={colors.destructive} /></TouchableOpacity>}
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[['HP', template.maxHp], ['AC', template.armorClass], ['AP', template.maxAP], ['SEQ', template.sequence], ['XP', template.xpValue ?? '—'], ['CC', template.criticalChance === undefined ? '—' : `${template.criticalChance}%`]].map(([l, v]) => (
          <View key={l} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.secondary, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>{l}</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>PR {template.poisonResistance ?? 0}%</Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>RR {template.radiationResistance}%</Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>GR {template.gasResistance}/{template.gasResistanceSecondary ?? 0}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
        {NP_TYPES.map(t => {
          const protection = combinedProtectionFor(template.naturalProtection, undefined, undefined, t);
          return (
            <Text key={t.type} style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>
              {DAMAGE_TYPE_NAMES[t.type].charAt(0)} {protection.dt}/{protection.dr}
            </Text>
          );
        })}
      </View>

      {/* Top skills */}
      {topSkills.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {topSkills.slice(0, 4).map(sk => (
            <View key={sk} style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.secondary, borderRadius: 4 }}>
              <Text style={{ fontSize: 9, color: colors.mutedForeground }}>{SKILL_SHORT_LABELS[sk]}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: template.skills[sk] >= 60 ? colors.primary : colors.foreground }}>{template.skills[sk]}%</Text>
            </View>
          ))}
        </View>
      )}

      {attacks.map(({ weapon, hitChance, notes }) => weapon && (
        <Text key={weapon.id} style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }} numberOfLines={2}>
          {weapon.name}: {hitChance}% · {weapon.apSingle} AP · {weapon.damageDieCount}d{weapon.damageDie}{notes ? ` · ${notes}` : ''}
        </Text>
      ))}
      {!attacks.length && template.equippedWeaponId && (
        <Text style={{ fontSize: 11, color: colors.foreground }}>
          Equipped: {allWeapons.find(w => w.id === template.equippedWeaponId)?.name ?? template.equippedWeaponId}
        </Text>
      )}

      <TouchableOpacity
        style={{ paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
        onPress={onSpawn}
      >
        <Feather name="plus" size={14} color={colors.primaryForeground} />
        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primaryForeground }}>SPAWN</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Bestiary Screen ─────────────────────────────────────────────────────
export default function BestiaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCharacter, customBestiaryTemplates, addCustomBestiaryTemplate, removeCustomBestiaryTemplate, allWeapons, allArmor } = useApp();

  const [activeCategory, setActiveCategory] = useState<BestiaryCategory>('beast');
  const [spawnTarget, setSpawnTarget] = useState<BestiaryTemplate | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BestiaryTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const { manualSearch, manualAll } = useLocalSearchParams<{
    manualSearch?: string;
    manualAll?: string;
  }>();

  useEffect(() => {
    if (!manualSearch && manualAll !== 'true') return;

    const nextSearch = typeof manualSearch === 'string' ? manualSearch : '';
    setSearch(nextSearch);
    setShowAllCategories(!nextSearch && manualAll === 'true');
    router.setParams({ manualSearch: '', manualAll: '' });
  }, [manualAll, manualSearch]);

  // Combine built-in + custom templates
  const allTemplates = [...BUILT_IN_BESTIARY, ...customBestiaryTemplates];
  const searchQuery = search.trim().toLowerCase();
  const searchingAllCategories = searchQuery.length > 0;
  const filteredTemplates = allTemplates.filter(t => {
    if (!searchingAllCategories && !showAllCategories && t.category !== activeCategory) return false;
    if (searchingAllCategories && !t.name.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  const handleSpawn = (template: BestiaryTemplate, spawnName: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const char = spawnBestiaryTemplate(template, allWeapons, spawnName, genId());
    addCharacter(char);
    Alert.alert('Spawned!', `${spawnName} added to Characters.`);
  };

  const handleSaveCustom = (t: BestiaryTemplate) => {
    if (editingTemplate) {
      removeCustomBestiaryTemplate(editingTemplate.id);
    }
    addCustomBestiaryTemplate(t);
    setShowCustomForm(false);
    setEditingTemplate(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (t: BestiaryTemplate) => {
    // Alert.alert with buttons is a silent no-op on react-native-web — use
    // window.confirm there so the delete button actually works in the browser.
    if (Platform.OS === 'web') {
      if (localizedConfirm(`Remove ${t.name} from the bestiary?`)) removeCustomBestiaryTemplate(t.id);
      return;
    }
    Alert.alert('Delete NPC', `Remove ${t.name} from the bestiary?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeCustomBestiaryTemplate(t.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      {/* Header */}
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>BESTIARY</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: colors.radius }}
            onPress={() => { setEditingTemplate(null); setShowCustomForm(true); }}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>CUSTOM NPC</Text>
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

        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: showAllCategories && !searchingAllCategories }}
              testID="bestiary-category-all"
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: showAllCategories && !searchingAllCategories ? colors.primary : colors.secondary, borderWidth: 1, borderColor: showAllCategories && !searchingAllCategories ? colors.primary : colors.border }}
              onPress={() => { setSearch(''); setShowAllCategories(true); }}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: showAllCategories && !searchingAllCategories ? colors.primaryForeground : colors.mutedForeground }}>ALL</Text>
            </TouchableOpacity>
            {BESTIARY_CATEGORIES.map(cat => {
              const count = allTemplates.filter(t => t.category === cat.id).length;
              const isSelected = !searchingAllCategories && !showAllCategories && activeCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: isSelected ? colors.primary : colors.secondary, borderWidth: 1, borderColor: isSelected ? colors.primary : colors.border }}
                  onPress={() => { setActiveCategory(cat.id); setShowAllCategories(false); }}
                >
                  <Feather name={cat.icon as any} size={12} color={isSelected ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: isSelected ? colors.primaryForeground : colors.mutedForeground }}>{cat.label}</Text>
                  <View style={{ paddingHorizontal: 5, paddingVertical: 1, backgroundColor: isSelected ? 'rgba(0,0,0,0.3)' : colors.border + '88', borderRadius: 8 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: isSelected ? colors.primaryForeground : colors.mutedForeground }}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Template list */}
      {filteredTemplates.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
          <Feather name={searchingAllCategories ? 'search' : activeCategory === 'custom' ? 'plus-circle' : 'book-open'} size={48} color={colors.mutedForeground} />
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textAlign: 'center' }}>
            {searchingAllCategories
              ? 'No Bestiary entries match your search.'
              : activeCategory === 'custom' ? 'No custom NPCs yet.' : `No ${BESTIARY_CATEGORIES.find(c => c.id === activeCategory)?.label ?? ''} templates.`}
          </Text>
          {!searchingAllCategories && activeCategory === 'custom' && (
            <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: colors.radius }} onPress={() => { setEditingTemplate(null); setShowCustomForm(true); }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>Create Custom NPC</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={t => t.id}
          numColumns={2}
          contentContainerStyle={{ padding: 8, paddingBottom: insets.bottom + 80 }}
          columnWrapperStyle={{ gap: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <BestiaryCard
                template={item}
                allWeapons={allWeapons}
                onSpawn={() => setSpawnTarget(item)}
                onEdit={item.isCustom ? () => { setEditingTemplate(item); setShowCustomForm(true); } : undefined}
                onDelete={item.isCustom ? () => handleDelete(item) : undefined}
              />
            </View>
          )}
        />
      )}

      <SpawnModal
        template={spawnTarget}
        visible={!!spawnTarget}
        onClose={() => setSpawnTarget(null)}
        onSpawn={name => spawnTarget && handleSpawn(spawnTarget, name)}
        allWeapons={allWeapons}
        allArmor={allArmor}
      />

      <CustomNPCModal
        visible={showCustomForm}
        onClose={() => { setShowCustomForm(false); setEditingTemplate(null); }}
        onSave={handleSaveCustom}
        editTemplate={editingTemplate}
        allWeapons={allWeapons}
        allArmor={allArmor}
      />
    </View>
  );
}
