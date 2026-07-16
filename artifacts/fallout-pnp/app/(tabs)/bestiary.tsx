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
import { BestiaryTemplate, BestiaryCategory, Character, CharacterSkills, SPECIALStats, DEFAULT_SKILLS } from '@/context/types';
import { BUILT_IN_BESTIARY, BESTIARY_CATEGORIES } from '@/data/bestiary';
import { calcMaxHP, calcMaxAP, calcBaseAC, calcSequence, calcBaseSkills } from '@/data/derived';
import { RACES, getRaceById } from '@/data/races';
import { BUILT_IN_WEAPONS } from '@/data/weapons';

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SKILL_SHORTHAND: (keyof CharacterSkills)[] = ['smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed'];
const SKILL_SHORT_LABELS: Partial<Record<keyof CharacterSkills, string>> = {
  smallGuns: 'SG', bigGuns: 'BG', energyWeapons: 'EW', meleeWeapons: 'MW', unarmed: 'UN',
};

const DEFAULT_SPECIAL: SPECIALStats = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };

// ─── Spawn Modal ─────────────────────────────────────────────────────────────
function SpawnModal({ template, visible, onClose, onSpawn }: {
  template: BestiaryTemplate | null; visible: boolean;
  onClose: () => void; onSpawn: (name: string) => void;
}) {
  const colors = useColors();
  const [customName, setCustomName] = useState('');
  if (!template) return null;
  const spawnName = customName.trim() || template.name;
  const weapon = BUILT_IN_WEAPONS.find(w => w.id === template.equippedWeaponId);

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
              ['SEQ', template.special.perception * 2], ['RAD', `${template.radiationResistance}%`],
            ].map(([l, v]) => (
              <View key={l} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>{l}</Text>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary }}>{v}</Text>
              </View>
            ))}
            {weapon && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>WEAPON</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{weapon.name}</Text>
              </View>
            )}
          </View>

          {/* SPECIAL */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(template.special).map(([k, v]) => (
              <View key={k} style={{ alignItems: 'center', width: 40, paddingVertical: 4, backgroundColor: colors.secondary, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>{k.slice(0,3).toUpperCase()}</Text>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary }}>{v}</Text>
              </View>
            ))}
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
function CustomNPCModal({ visible, onClose, onSave, editTemplate }: {
  visible: boolean; onClose: () => void;
  onSave: (t: BestiaryTemplate) => void;
  editTemplate?: BestiaryTemplate | null;
}) {
  const colors = useColors();
  const [name, setName] = useState(editTemplate?.name ?? '');
  const [category, setCategory] = useState<BestiaryCategory>(editTemplate?.category ?? 'custom');
  const [description, setDescription] = useState(editTemplate?.description ?? '');
  const [special, setSpecial] = useState<SPECIALStats>(editTemplate?.special ?? { ...DEFAULT_SPECIAL });
  const [skills, setSkills] = useState<CharacterSkills>(editTemplate?.skills ?? { ...DEFAULT_SKILLS });
  const [maxHp, setMaxHp] = useState(editTemplate?.maxHp ?? 30);
  const [armorClass, setArmorClass] = useState(editTemplate?.armorClass ?? 10);
  const [maxAP, setMaxAP] = useState(editTemplate?.maxAP ?? 8);
  const [radRes, setRadRes] = useState(editTemplate?.radiationResistance ?? 0);
  const [weaponId, setWeaponId] = useState(editTemplate?.equippedWeaponId ?? '');
  const [useComputed, setUseComputed] = useState(false);
  const [tab, setTab] = useState<'basics' | 'special' | 'skills'>('basics');

  React.useEffect(() => {
    if (!visible) return;
    setName(editTemplate?.name ?? '');
    setCategory(editTemplate?.category ?? 'custom');
    setDescription(editTemplate?.description ?? '');
    setSpecial(editTemplate?.special ?? { ...DEFAULT_SPECIAL });
    setSkills(editTemplate?.skills ?? { ...DEFAULT_SKILLS });
    setMaxHp(editTemplate?.maxHp ?? 30);
    setArmorClass(editTemplate?.armorClass ?? 10);
    setMaxAP(editTemplate?.maxAP ?? 8);
    setRadRes(editTemplate?.radiationResistance ?? 0);
    setWeaponId(editTemplate?.equippedWeaponId ?? '');
    setUseComputed(false);
    setTab('basics');
  }, [visible]);

  // Auto-compute derived stats when useComputed is on
  React.useEffect(() => {
    if (useComputed) {
      setMaxHp(calcMaxHP(special, 1));
      setMaxAP(calcMaxAP(special));
      setArmorClass(calcBaseAC(special));
      setSkills(calcBaseSkills(special));
    }
  }, [special, useComputed]);

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

  const naturalWeapons = BUILT_IN_WEAPONS.filter(w => w.category === 'natural' || w.category === 'unarmed' || w.category === 'meleeWeapons');

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    const t: BestiaryTemplate = {
      id: editTemplate?.id ?? genId(),
      name: name.trim(), category, description,
      special, maxHp, armorClass, maxAP, skills,
      equippedWeaponId: weaponId || undefined,
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

          {/* Tab bar */}
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {(['basics', 'special', 'skills'] as const).map(t => (
              <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }} onPress={() => setTab(t)}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: tab === t ? colors.primary : colors.mutedForeground, letterSpacing: 1 }}>{t.toUpperCase()}</Text>
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
                  { label: 'Armor Class', val: armorClass, set: setArmorClass, min: 0, max: 100 },
                  { label: 'Max AP', val: maxAP, set: setMaxAP, min: 1, max: 20 },
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

                {/* Weapon selector */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 4 }}>EQUIPPED WEAPON (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: !weaponId ? colors.primary : colors.secondary, borderWidth: 1, borderColor: !weaponId ? colors.primary : colors.border }} onPress={() => setWeaponId('')}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: !weaponId ? colors.primaryForeground : colors.mutedForeground }}>None</Text>
                    </TouchableOpacity>
                    {naturalWeapons.map(w => (
                      <TouchableOpacity key={w.id} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: weaponId === w.id ? colors.primary : colors.secondary, borderWidth: 1, borderColor: weaponId === w.id ? colors.primary : colors.border }} onPress={() => setWeaponId(w.id)}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: weaponId === w.id ? colors.primaryForeground : colors.foreground }}>{w.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
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
function BestiaryCard({ template, onSpawn, onEdit, onDelete }: {
  template: BestiaryTemplate;
  onSpawn: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const colors = useColors();
  const cat = BESTIARY_CATEGORIES.find(c => c.id === template.category);
  const weapon = BUILT_IN_WEAPONS.find(w => w.id === template.equippedWeaponId);
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
        {[['HP', template.maxHp], ['AC', template.armorClass], ['AP', template.maxAP], ['SEQ', template.special.perception * 2]].map(([l, v]) => (
          <View key={l} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.secondary, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>{l}</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>{v}</Text>
          </View>
        ))}
        {template.radiationResistance > 0 && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#4a8c3f33', borderRadius: 4 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>RAD</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>{template.radiationResistance}%</Text>
          </View>
        )}
      </View>

      {/* SPECIAL row */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Object.entries(template.special).map(([k, v]) => (
          <View key={k} style={{ flex: 1, alignItems: 'center', paddingVertical: 2, backgroundColor: colors.secondary, borderRadius: 3 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>{k.slice(0,1).toUpperCase()}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: v >= 8 ? colors.primary : colors.foreground }}>{v}</Text>
          </View>
        ))}
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

      {weapon && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>⚔ {weapon.name}</Text>}

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
  const { addCharacter, customBestiaryTemplates, addCustomBestiaryTemplate, removeCustomBestiaryTemplate, allWeapons } = useApp();

  const [activeCategory, setActiveCategory] = useState<BestiaryCategory>('human');
  const [spawnTarget, setSpawnTarget] = useState<BestiaryTemplate | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BestiaryTemplate | null>(null);
  const [search, setSearch] = useState('');

  // Combine built-in + custom templates
  const allTemplates = [...BUILT_IN_BESTIARY, ...customBestiaryTemplates];
  const filteredTemplates = allTemplates.filter(t => {
    if (t.category !== activeCategory) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleSpawn = (template: BestiaryTemplate, spawnName: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = genId();
    const weapon = allWeapons.find(w => w.id === template.equippedWeaponId);
    const char: Character = {
      id,
      name: spawnName,
      type: 'npc',
      race: 'human',
      level: 1,
      xp: 0,
      special: { ...template.special },
      maxHp: template.maxHp,
      currentHp: template.maxHp,
      armorClass: template.armorClass,
      tempAC: 0,
      maxAP: template.maxAP,
      currentAP: template.maxAP,
      position: 'standing',
      sequence: template.special.perception * 2,
      skills: { ...template.skills },
      taggedSkills: [],
      unspentSkillPoints: 0,
      perks: [],
      radiationResistance: template.radiationResistance,
      gasResistance: template.gasResistance,
      electricityResistance: template.electricityResistance,
      equippedWeaponId: template.equippedWeaponId,
      equippedBodyArmorId: template.equippedBodyArmorId,
      equippedHelmetId: template.equippedHelmetId,
      weaponAmmoStates: weapon && weapon.magazineSize > 0
        ? [{ weaponId: weapon.id, currentAmmo: weapon.magazineSize, conditionBoxes: 5 }]
        : [],
      injuries: [],
      isKnockedOut: false,
      knockOutRoundsLeft: 0,
      conditions: [],
    };
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
            {BESTIARY_CATEGORIES.map(cat => {
              const count = allTemplates.filter(t => t.category === cat.id).length;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: activeCategory === cat.id ? colors.primary : colors.secondary, borderWidth: 1, borderColor: activeCategory === cat.id ? colors.primary : colors.border }}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Feather name={cat.icon as any} size={12} color={activeCategory === cat.id ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: activeCategory === cat.id ? colors.primaryForeground : colors.mutedForeground }}>{cat.label}</Text>
                  <View style={{ paddingHorizontal: 5, paddingVertical: 1, backgroundColor: activeCategory === cat.id ? 'rgba(0,0,0,0.3)' : colors.border + '88', borderRadius: 8 }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: activeCategory === cat.id ? colors.primaryForeground : colors.mutedForeground }}>{count}</Text>
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
          <Feather name={activeCategory === 'custom' ? 'plus-circle' : 'book-open'} size={48} color={colors.mutedForeground} />
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textAlign: 'center' }}>
            {activeCategory === 'custom' ? 'No custom NPCs yet.' : `No ${BESTIARY_CATEGORIES.find(c => c.id === activeCategory)?.label ?? ''} templates.`}
          </Text>
          {activeCategory === 'custom' && (
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
      />

      <CustomNPCModal
        visible={showCustomForm}
        onClose={() => { setShowCustomForm(false); setEditingTemplate(null); }}
        onSave={handleSaveCustom}
        editTemplate={editingTemplate}
      />
    </View>
  );
}
