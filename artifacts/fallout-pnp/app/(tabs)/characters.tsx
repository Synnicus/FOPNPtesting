import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, ScrollView, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import {
  Character, CharacterSkills, CharacterPerk, CharacterType, RaceType,
  SkillType, SPECIALStats, Injury, NaturalProtection, DamageType,
  DEFAULT_SKILLS, COMBAT_SKILLS, SUPPORT_SKILLS, SKILL_LABELS,
  DAMAGE_TYPE_NAMES, EMPTY_NATURAL_PROTECTION,
} from '@/context/types';
import CharacterAvatar from '@/components/CharacterAvatar';
import HPBar from '@/components/HPBar';
import {
  calcMaxHP, calcMaxAP, calcBaseAC, calcSequence, calcBaseSkills,
  calcCriticalChance, calcHealingRate, calcCarryWeight, calcMeleeDamageBonus,
  calcSkillPointsPerLevel, xpForLevel, levelForXP,
} from '@/data/derived';
import { RACES, PLAYABLE_RACES, getRaceById } from '@/data/races';
import { PERKS, getPerkById, getPerksForRace, calcAvailablePerkPoints, calcUsedPerkPoints } from '@/data/perks';
import { PREMADE_CHARACTERS, PremadeCharacter, createCharacterFromPremade } from '@/data/premades';

// Perk points available given a race's perksPerLevels cadence (default 3)
function perkPointsForRaceLevel(level: number, race: RaceType): number {
  const raceRef = getRaceById(race);
  const per = raceRef?.perksPerLevels ?? 3;
  return Math.floor(level / per);
}

const DAMAGE_TYPES: DamageType[] = ['normal', 'laser', 'fire', 'plasma', 'explosion'];

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const DEFAULT_SPECIAL: SPECIALStats = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };
const SPECIAL_KEYS: (keyof SPECIALStats)[] = ['strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck'];
const SPECIAL_SHORT: Record<keyof SPECIALStats, string> = { strength: 'STR', perception: 'PER', endurance: 'END', charisma: 'CHA', intelligence: 'INT', agility: 'AGI', luck: 'LCK' };

function makeDefaultCharacter(): Character {
  const special = { ...DEFAULT_SPECIAL };
  const baseSkills = calcBaseSkills(special);
  return {
    id: genId(), name: '', type: 'pc', race: 'human', level: 1, xp: 0,
    special, maxHp: calcMaxHP(special, 1), currentHp: calcMaxHP(special, 1),
    armorClass: calcBaseAC(special), tempAC: 0,
    maxAP: calcMaxAP(special), currentAP: calcMaxAP(special),
    position: 'standing', sequence: calcSequence(special),
    skills: { ...baseSkills },
    taggedSkills: [], unspentSkillPoints: calcSkillPointsPerLevel(special),
    perks: [],
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
    equippedWeaponId: undefined, equippedBodyArmorId: undefined, equippedHelmetId: undefined,
    weaponAmmoStates: [],
    injuries: [], isKnockedOut: false, knockOutRoundsLeft: 0, conditions: [],
  };
}

// ─── Point Counter Badge ──────────────────────────────────────────────────────
function PointCounter({ label, remaining, total, warn }: { label: string; remaining: number; total: number; warn?: boolean }) {
  const colors = useColors();
  const isOver = remaining < 0;
  const color = isOver ? colors.destructive : warn && remaining === 0 ? '#f59e0b' : '#4a8c3f';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: isOver ? colors.destructive + '22' : color + '22', borderRadius: 8, borderWidth: 1, borderColor: isOver ? colors.destructive : color + '66' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: color, letterSpacing: 1 }}>{label}</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{total - remaining} used / {total} total</Text>
      </View>
      <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color, lineHeight: 34 }}>{remaining}</Text>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color }}>left</Text>
    </View>
  );
}

// ─── SelectionModal ───────────────────────────────────────────────────────────
function SelectionModal<T>({ visible, onClose, onSelect, items, keyFn, renderItem, title }: {
  visible: boolean; onClose: () => void; onSelect: (item: T | null) => void;
  items: T[]; keyFn: (i: T) => string; renderItem: (i: T) => React.ReactNode; title: string;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ maxHeight: '75%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <FlatList
            data={[null, ...items]}
            keyExtractor={item => item ? keyFn(item) : '__none__'}
            renderItem={({ item }) => (
              <TouchableOpacity style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { onSelect(item); onClose(); }}>
                {item ? renderItem(item) : <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>None</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Character Form Modal ─────────────────────────────────────────────────────
function CharacterFormModal({ character, onSave, onClose, visible }: {
  character: Character | null; onSave: (c: Character) => void; onClose: () => void; visible: boolean;
}) {
  const colors = useColors();
  const { allWeapons, allArmor } = useApp();
  const [char, setChar] = useState<Character>(character ?? makeDefaultCharacter());
  const [activeTab, setActiveTab] = useState(0);
  const [specialPoolTotal, setSpecialPoolTotal] = useState(40);
  const [perkSearch, setPerkSearch] = useState('');
  const [showNaturalProt, setShowNaturalProt] = useState(false);
  const [showBioEditor, setShowBioEditor] = useState(false);

  // Weapon/armor pickers
  const [showWeaponPick, setShowWeaponPick] = useState(false);
  const [showBodyPick, setShowBodyPick] = useState(false);
  const [showHelmetPick, setShowHelmetPick] = useState(false);

  // Injury form
  const [addingInjury, setAddingInjury] = useState(false);
  const [injLocation, setInjLocation] = useState<Injury['location']>('torso');
  const [injSeverity, setInjSeverity] = useState<Injury['severity']>('crippled');
  const [injDesc, setInjDesc] = useState('');

  useEffect(() => {
    if (!visible) return;
    const c = character ?? makeDefaultCharacter();
    setChar(c);
    setActiveTab(0);
    setPerkSearch('');
    // Estimate pool from current SPECIAL sum
    const sum = Object.values(c.special).reduce((a, b) => a + b, 0);
    setSpecialPoolTotal(Math.max(40, sum));
  }, [visible]);

  // ─── Derived computations ────────────────────────────────────────────────────
  const race = getRaceById(char.race) ?? RACES[0];
  const baseSkills = useMemo(() => calcBaseSkills(char.special), [char.special]);

  const recomputeDerived = useCallback((updatedChar: Character): Character => {
    const raceRef = getRaceById(updatedChar.race) ?? RACES[0];
    const bodyArmor = allArmor.find(a => a.id === updatedChar.equippedBodyArmorId);
    const helmet = allArmor.find(a => a.id === updatedChar.equippedHelmetId);
    const armorACBonus = (bodyArmor?.acBonus ?? 0) + (helmet?.acBonus ?? 0);
    const maxHp = calcMaxHP(updatedChar.special, updatedChar.level, raceRef.bonusHPPerLevel ?? 0);
    const maxAP = calcMaxAP(updatedChar.special);
    const armorClass = calcBaseAC(updatedChar.special) + armorACBonus + raceRef.naturalACBonus;
    const sequence = calcSequence(updatedChar.special);
    const radRes = Math.max(updatedChar.radiationResistance, raceRef.naturalDR);
    const gasRes = Math.max(updatedChar.gasResistance, raceRef.naturalGasDR);
    const elecRes = Math.min(100, Math.max(updatedChar.electricityResistance, raceRef.naturalElecDR));
    return {
      ...updatedChar,
      maxHp, currentHp: Math.min(updatedChar.currentHp, maxHp),
      maxAP, currentAP: Math.min(updatedChar.currentAP, maxAP),
      armorClass, sequence, radiationResistance: radRes, gasResistance: gasRes, electricityResistance: elecRes,
    };
  }, [allArmor]);

  const setSPECIAL = useCallback((key: keyof SPECIALStats, value: number) => {
    setChar(prev => {
      const raceRef = getRaceById(prev.race) ?? RACES[0];
      const min = raceRef.specialMin[key];
      const max = raceRef.specialMax[key];
      const clamped = Math.max(min, Math.min(max, value));
      const newSpecial = { ...prev.special, [key]: clamped };
      // Recompute base skills but preserve manual offsets
      const oldBase = calcBaseSkills(prev.special);
      const newBase = calcBaseSkills(newSpecial);
      const skills = { ...prev.skills };
      for (const sk of [...COMBAT_SKILLS, ...SUPPORT_SKILLS] as SkillType[]) {
        const offset = prev.skills[sk] - oldBase[sk];
        skills[sk] = newBase[sk] + offset;
      }
      return recomputeDerived({ ...prev, special: newSpecial, skills });
    });
  }, [recomputeDerived]);

  const setRace = useCallback((newRace: RaceType) => {
    setChar(prev => {
      const raceRef = getRaceById(newRace) ?? RACES[0];
      const special = { ...prev.special };
      for (const k of SPECIAL_KEYS) {
        special[k] = Math.max(raceRef.specialMin[k], Math.min(raceRef.specialMax[k], special[k]));
      }
      // Reset elemental resistances to the new race's natural defaults
      const radiationResistance = raceRef.naturalDR;
      const gasResistance = raceRef.naturalGasDR;
      const electricityResistance = raceRef.naturalElecDR;
      // Reset natural protection to the new race's defaults (or undefined)
      const naturalProtection = raceRef.naturalProtection ? { ...raceRef.naturalProtection } : undefined;
      return recomputeDerived({
        ...prev, race: newRace, special,
        radiationResistance, gasResistance, electricityResistance, naturalProtection,
      });
    });
  }, [recomputeDerived]);

  // Apply a level change: sync XP, adjust unspent skill points, recompute derived
  const applyLevel = useCallback((newLevel: number) => {
    setChar(prev => {
      const clamped = Math.max(1, Math.min(99, newLevel));
      if (clamped === prev.level) return prev;
      const levelDelta = clamped - prev.level;
      const spPerLevel = calcSkillPointsPerLevel(prev.special);
      const unspentSkillPoints = Math.max(0, prev.unspentSkillPoints + levelDelta * spPerLevel);
      return recomputeDerived({
        ...prev, level: clamped, xp: xpForLevel(clamped), unspentSkillPoints,
      });
    });
  }, [recomputeDerived]);

  // Apply an XP change: sync level (and cascade via applyLevel semantics)
  const applyXP = useCallback((newXP: number) => {
    setChar(prev => {
      const xp = Math.max(0, Math.min(999999999, Math.floor(newXP) || 0));
      const newLevel = levelForXP(xp);
      const levelDelta = newLevel - prev.level;
      const spPerLevel = calcSkillPointsPerLevel(prev.special);
      const unspentSkillPoints = levelDelta !== 0
        ? Math.max(0, prev.unspentSkillPoints + levelDelta * spPerLevel)
        : prev.unspentSkillPoints;
      return recomputeDerived({ ...prev, xp, level: newLevel, unspentSkillPoints });
    });
  }, [recomputeDerived]);

  // Natural protection editor helper
  const setNaturalProtectionField = useCallback((field: keyof NaturalProtection, value: number) => {
    setChar(prev => {
      const base = prev.naturalProtection ?? { ...EMPTY_NATURAL_PROTECTION };
      const isDR = field.startsWith('dr');
      const clamped = Math.max(0, isDR ? Math.min(100, value) : Math.min(999, value));
      const next: NaturalProtection = { ...base, [field]: clamped };
      return { ...prev, naturalProtection: next };
    });
  }, []);

  // SPECIAL point tracking
  const specialSum = Object.values(char.special).reduce((a, b) => a + b, 0);
  const specialRemaining = specialPoolTotal - specialSum;

  // Perk point tracking (race-specific cadence)
  const perkPointsAvailable = perkPointsForRaceLevel(char.level, char.race);
  const perkPointsUsed = calcUsedPerkPoints(char.perks);
  const perkPointsRemaining = perkPointsAvailable - perkPointsUsed;

  // Skill points: unspentSkillPoints from char
  const skillPointsTotal = calcSkillPointsPerLevel(char.special) * char.level;

  // Skill update: costs 1 point per +1 above base
  const adjustSkill = useCallback((sk: SkillType, delta: number) => {
    setChar(prev => {
      const base = calcBaseSkills(prev.special)[sk];
      const currentOffset = prev.skills[sk] - base;
      if (delta > 0) {
        if (prev.unspentSkillPoints <= 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return prev;
        }
        return { ...prev, skills: { ...prev.skills, [sk]: prev.skills[sk] + delta }, unspentSkillPoints: prev.unspentSkillPoints - delta };
      } else {
        if (currentOffset <= 0) return prev; // can't go below base
        return { ...prev, skills: { ...prev.skills, [sk]: prev.skills[sk] + delta }, unspentSkillPoints: prev.unspentSkillPoints - delta };
      }
    });
  }, []);

  const toggleTag = useCallback((sk: SkillType) => {
    setChar(prev => {
      const isTagged = prev.taggedSkills.includes(sk);
      if (!isTagged && prev.taggedSkills.length >= 3) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return prev;
      }
      return {
        ...prev,
        taggedSkills: isTagged ? prev.taggedSkills.filter(t => t !== sk) : [...prev.taggedSkills, sk],
      };
    });
  }, []);

  const togglePerk = useCallback((perkId: string) => {
    setChar(prev => {
      const existing = prev.perks.find(p => p.perkId === perkId);
      const perk = getPerkById(perkId);
      if (!perk) return prev;
      if (!existing) {
        // Add at rank 1 — check perk points
        if (perkPointsRemaining <= 0) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return prev; }
        return { ...prev, perks: [...prev.perks, { perkId, rank: 1 }] };
      } else if (existing.rank < perk.maxRanks) {
        // Increase rank — check perk points
        if (perkPointsRemaining <= 0) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return prev; }
        return { ...prev, perks: prev.perks.map(p => p.perkId === perkId ? { ...p, rank: p.rank + 1 } : p) };
      } else {
        // Remove entirely
        return { ...prev, perks: prev.perks.filter(p => p.perkId !== perkId) };
      }
    });
  }, [perkPointsRemaining]);

  // Available perks for this race/level
  const availablePerks = useMemo(() =>
    getPerksForRace(char.race).filter(p => {
      if (p.minLevel > char.level) return false;
      if (p.minSTR && char.special.strength < p.minSTR) return false;
      if (p.minPER && char.special.perception < p.minPER) return false;
      if (p.minEND && char.special.endurance < p.minEND) return false;
      if (p.minCHA && char.special.charisma < p.minCHA) return false;
      if (p.minINT && char.special.intelligence < p.minINT) return false;
      if (p.minAGI && char.special.agility < p.minAGI) return false;
      if (p.minLCK && char.special.luck < p.minLCK) return false;
      if (perkSearch && !p.name.toLowerCase().includes(perkSearch.toLowerCase()) && !p.description.toLowerCase().includes(perkSearch.toLowerCase())) return false;
      return true;
    }), [char.race, char.level, char.special, perkSearch]);

  const isValid = char.name.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(recomputeDerived(char));
  };

  const TABS = ['Basics', 'SPECIAL', 'Skills', 'Perks', 'Equipment', 'Injuries'];
  const INJURY_LOCATIONS: Injury['location'][] = ['head', 'eyes', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
  const INJURY_SEVERITIES: Injury['severity'][] = ['minor', 'crippled', 'broken'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 52 : 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>
            {character ? 'EDIT CHARACTER' : 'NEW CHARACTER'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={!isValid}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: isValid ? colors.primary : colors.mutedForeground }}>SAVE</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === i ? colors.primary : 'transparent' }} onPress={() => setActiveTab(i)}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: activeTab === i ? colors.primary : colors.mutedForeground }}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

          {/* ── BASICS ── */}
          {activeTab === 0 && (
            <>
              {/* Portrait */}
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity onPress={async () => {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') return;
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
                  if (!result.canceled) setChar(c => ({ ...c, portrait: result.assets[0].uri }));
                }}>
                  <CharacterAvatar portrait={char.portrait} name={char.name} size={80} />
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>Tap to change</Text>
                </TouchableOpacity>
              </View>

              {/* Name */}
              <TextInput
                style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: char.name.trim() ? colors.border : colors.destructive + '88', borderRadius: colors.radius, padding: 14, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}
                placeholder="Character name*" placeholderTextColor={colors.mutedForeground}
                value={char.name} onChangeText={name => setChar(c => ({ ...c, name }))}
              />

              {/* Type */}
              <View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 8 }}>TYPE</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['pc', 'npc'] as CharacterType[]).map(t => (
                    <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: colors.radius, backgroundColor: char.type === t ? colors.primary : colors.secondary, borderWidth: 1, borderColor: char.type === t ? colors.primary : colors.border }} onPress={() => setChar(c => ({ ...c, type: t }))}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: char.type === t ? colors.primaryForeground : colors.mutedForeground }}>{t === 'pc' ? 'PLAYER' : 'NPC'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Race */}
              <View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 8 }}>RACE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {PLAYABLE_RACES.map(r => (
                      <TouchableOpacity key={r.id} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: char.race === r.id ? colors.primary : colors.secondary, borderWidth: 1, borderColor: char.race === r.id ? colors.primary : colors.border }} onPress={() => setRace(r.id as RaceType)}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: char.race === r.id ? colors.primaryForeground : colors.foreground }}>{r.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {/* Race traits */}
                <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 4, marginTop: 8 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary }}>SPECIAL range: {SPECIAL_KEYS.map(k => `${SPECIAL_SHORT[k]} ${race.specialMin[k]}–${race.specialMax[k]}`).join(' · ')}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>✓ {race.benefits.join(' · ')}</Text>
                  {race.penalties.length > 0 && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>✗ {race.penalties.join(' · ')}</Text>}
                  {race.naturalDR > 0 && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>🛡 Natural: {race.naturalDR}% Rad · {race.naturalGasDR}% Gas · {race.naturalElecDR > 0 ? `+${race.naturalElecDR}%` : `${race.naturalElecDR}%`} Elec</Text>}
                </View>
              </View>

              {/* Level/XP — kept in sync both ways */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Level stepper */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>LEVEL</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => applyLevel(char.level - 1)}><Feather name="minus" size={14} color={colors.foreground} /></TouchableOpacity>
                    <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.primary, flex: 1, textAlign: 'center' }}>{char.level}</Text>
                    <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => applyLevel(char.level + 1)}><Feather name="plus" size={14} color={colors.foreground} /></TouchableOpacity>
                  </View>
                </View>
                {/* XP typeable field */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>XP</Text>
                  <TextInput
                    style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8, color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center' }}
                    keyboardType="number-pad"
                    value={String(char.xp)}
                    onChangeText={t => applyXP(parseInt(t.replace(/[^0-9]/g, ''), 10) || 0)}
                    placeholder="0" placeholderTextColor={colors.mutedForeground}
                  />
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2, textAlign: 'center' }}>Next Lv {char.level + 1}: {xpForLevel(char.level + 1)}</Text>
                </View>
              </View>

              {/* HP override */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>HIT POINTS</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setChar(c => ({ ...c, currentHp: Math.max(0, c.currentHp - 1) }))}><Feather name="minus" size={14} color={colors.foreground} /></TouchableOpacity>
                  <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground, flex: 1, textAlign: 'center' }}>{char.currentHp} / {char.maxHp}</Text>
                  <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setChar(c => ({ ...c, currentHp: Math.min(c.maxHp, c.currentHp + 1) }))}><Feather name="plus" size={14} color={colors.foreground} /></TouchableOpacity>
                </View>
                <HPBar current={char.currentHp} max={char.maxHp} height={6} showText={false} />
              </View>

              {/* Resistances */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>ELEMENTAL RESISTANCES</Text>
                {[
                  { label: 'Radiation', val: char.radiationResistance, key: 'radiationResistance' as const, natural: race.naturalDR },
                  { label: 'Gas', val: char.gasResistance, key: 'gasResistance' as const, natural: race.naturalGasDR },
                  { label: 'Electricity', val: char.electricityResistance, key: 'electricityResistance' as const, natural: race.naturalElecDR },
                ].map(({ label, val, key, natural }) => (
                  <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{label}{natural !== 0 ? ` (base ${natural}% from race)` : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setChar(c => ({ ...c, [key]: Math.max(natural, val - 5) }))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: val >= 50 ? '#4a8c3f' : colors.foreground, minWidth: 45, textAlign: 'center' }}>{val}%</Text>
                      <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setChar(c => ({ ...c, [key]: Math.min(100, val + 5) }))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Natural Protection (DT/DR) — collapsible */}
              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => setShowNaturalProt(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>NATURAL PROTECTION (DT/DR)</Text>
                  <Feather name={showNaturalProt ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showNaturalProt && (
                  <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Built-in armor from hide/plating. finalDmg = max(0,(base−DT)×(1−DR/100)). Applies in addition to worn armor.</Text>
                    {DAMAGE_TYPES.map(dt => {
                      const dtKey = ('dt' + dt.charAt(0).toUpperCase() + dt.slice(1)) as keyof NaturalProtection;
                      const drKey = ('dr' + dt.charAt(0).toUpperCase() + dt.slice(1)) as keyof NaturalProtection;
                      const np = char.naturalProtection ?? EMPTY_NATURAL_PROTECTION;
                      return (
                        <View key={dt} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground, width: 78 }}>{DAMAGE_TYPE_NAMES[dt]}</Text>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>DT</Text>
                            <TextInput
                              style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' }}
                              keyboardType="number-pad"
                              value={String(np[dtKey] ?? 0)}
                              onChangeText={t => setNaturalProtectionField(dtKey, parseInt(t.replace(/[^0-9]/g, ''), 10) || 0)}
                            />
                          </View>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>DR%</Text>
                            <TextInput
                              style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' }}
                              keyboardType="number-pad"
                              value={String(np[drKey] ?? 0)}
                              onChangeText={t => setNaturalProtectionField(drKey, parseInt(t.replace(/[^0-9]/g, ''), 10) || 0)}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Biography */}
              <TouchableOpacity onPress={() => setShowBioEditor(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>BIOGRAPHY</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: char.biography ? colors.foreground : colors.mutedForeground, marginTop: 2 }} numberOfLines={2}>
                    {char.biography ? char.biography.replace(/\n+/g, ' ') : 'Tap to write a backstory…'}
                  </Text>
                </View>
                <Feather name="book-open" size={18} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}

          {/* ── SPECIAL ── */}
          {activeTab === 1 && (
            <>
              {/* Pool config */}
              <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>TOTAL POINT POOL</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setSpecialPoolTotal(v => Math.max(7, v - 1))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                    <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{specialPoolTotal}</Text>
                    <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setSpecialPoolTotal(v => Math.min(98, v + 1))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                  </View>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Standard: 40 points (Human). Raise for powerful NPCs.</Text>
              </View>

              <PointCounter label="SPECIAL POINTS REMAINING" remaining={specialRemaining} total={specialPoolTotal} warn />

              {/* Derived stats preview */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  ['Max HP', char.maxHp], ['Max AP', char.maxAP], ['AC', char.armorClass],
                  ['Sequence', char.sequence], ['Crit%', calcCriticalChance(char.special)],
                  ['Heal/day', calcHealingRate(char.special)], ['Carry', `${calcCarryWeight(char.special)}lb`],
                  ['Melee+', calcMeleeDamageBonus(char.special)], ['SP/lvl', calcSkillPointsPerLevel(char.special)],
                ].map(([l, v]) => (
                  <View key={l} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{l}</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary }}>{v}</Text>
                  </View>
                ))}
              </View>

              {/* SPECIAL sliders */}
              {SPECIAL_KEYS.map(k => {
                const min = race.specialMin[k];
                const max = race.specialMax[k];
                const val = char.special[k];
                return (
                  <View key={k} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{SPECIAL_SHORT[k]} — {k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Range: {min}–{max}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setSPECIAL(k, val - 1)}><Feather name="minus" size={16} color={colors.foreground} /></TouchableOpacity>
                        <Text style={{ fontSize: 26, fontFamily: 'Inter_700Bold', color: val >= 8 ? colors.primary : colors.foreground, width: 40, textAlign: 'center' }}>{val}</Text>
                        <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 6, borderWidth: 1, borderColor: specialRemaining <= 0 ? colors.mutedForeground : colors.border, alignItems: 'center', justifyContent: 'center', opacity: specialRemaining <= 0 ? 0.4 : 1 }} onPress={() => setSPECIAL(k, val + 1)} disabled={specialRemaining <= 0}><Feather name="plus" size={16} color={colors.foreground} /></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* ── SKILLS ── */}
          {activeTab === 2 && (
            <>
              <View style={{ gap: 6 }}>
                <PointCounter label="SKILL POINTS REMAINING" remaining={char.unspentSkillPoints} total={skillPointsTotal} warn />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>SP/LVL</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>{calcSkillPointsPerLevel(char.special)}</Text>
                  </View>
                  <TouchableOpacity
                    style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setChar(c => ({ ...c, unspentSkillPoints: Math.min(999, c.unspentSkillPoints + calcSkillPointsPerLevel(c.special)) }))}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary }}>+ Level Up Points</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Tagged skills ({char.taggedSkills.length}/3) get a free +20% bonus, shown in orange. Each +1 spends 1 skill point above base.</Text>
              </View>

              {(['combat', 'support'] as const).map(group => (
                <View key={group} style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginTop: 6 }}>{group === 'combat' ? 'COMBAT SKILLS' : 'SUPPORT SKILLS'}</Text>
                  {(group === 'combat' ? COMBAT_SKILLS : SUPPORT_SKILLS).map(sk => {
                    const base = baseSkills[sk];
                    const total = char.skills[sk];
                    const offset = total - base;
                    const isTagged = char.taggedSkills.includes(sk);
                    const displayTotal = total + (isTagged ? 20 : 0);
                    return (
                      <View key={sk} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                        <TouchableOpacity onPress={() => toggleTag(sk)} style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 2, borderColor: isTagged ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: isTagged ? colors.primary + '33' : 'transparent' }}>
                          {isTagged && <Feather name="tag" size={12} color={colors.primary} />}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: isTagged ? colors.primary : colors.foreground }} numberOfLines={1}>{SKILL_LABELS[sk]}</Text>
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                            Base {base}{offset > 0 ? ` +${offset} pts` : ''}{isTagged ? ' +20 tagged' : ''}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: offset <= 0 ? 0.3 : 1 }} onPress={() => adjustSkill(sk, -1)} disabled={offset <= 0}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: isTagged ? colors.primary : displayTotal >= 75 ? '#4a8c3f' : colors.foreground, minWidth: 48, textAlign: 'center' }}>{displayTotal}%</Text>
                          <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: char.unspentSkillPoints <= 0 ? colors.mutedForeground : colors.border, alignItems: 'center', justifyContent: 'center', opacity: char.unspentSkillPoints <= 0 ? 0.3 : 1 }} onPress={() => adjustSkill(sk, 1)} disabled={char.unspentSkillPoints <= 0}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          )}

          {/* ── PERKS ── */}
          {activeTab === 3 && (
            <>
              <PointCounter label="PERK POINTS REMAINING" remaining={perkPointsRemaining} total={perkPointsAvailable} warn />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>1 perk point per 3 levels. Each rank costs 1 point. Tap a perk to add/increase rank; tap at max rank to remove.</Text>

              {/* Active perks */}
              {char.perks.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>ACTIVE PERKS</Text>
                  {char.perks.map(cp => {
                    const perk = getPerkById(cp.perkId);
                    if (!perk) return null;
                    return (
                      <View key={cp.perkId} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary + '44', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>{perk.name} <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Rank {cp.rank}/{perk.maxRanks}</Text></Text>
                          {perk.combatEffect?.combatNote && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>⚔ {perk.combatEffect.combatNote}</Text>}
                        </View>
                        <TouchableOpacity onPress={() => togglePerk(cp.perkId)} style={{ padding: 4 }}>
                          {cp.rank < perk.maxRanks
                            ? <Feather name="plus-circle" size={18} color={perkPointsRemaining > 0 ? colors.primary : colors.mutedForeground} />
                            : <Feather name="x-circle" size={18} color={colors.destructive} />
                          }
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Perk browser */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, gap: 8 }}>
                  <Feather name="search" size={16} color={colors.mutedForeground} />
                  <TextInput style={{ flex: 1, paddingVertical: 8, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }} placeholder="Search perks…" placeholderTextColor={colors.mutedForeground} value={perkSearch} onChangeText={setPerkSearch} />
                  {perkSearch ? <TouchableOpacity onPress={() => setPerkSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Showing {availablePerks.length} perks available for {race.name} at level {char.level}.</Text>
                {availablePerks.map(perk => {
                  const existing = char.perks.find(p => p.perkId === perk.id);
                  const locked = !existing && perkPointsRemaining <= 0;
                  return (
                    <TouchableOpacity key={perk.id} style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: existing ? colors.primary + '88' : colors.border, backgroundColor: existing ? colors.primary + '11' : colors.secondary, opacity: locked ? 0.5 : 1, gap: 4 }} onPress={() => !locked && togglePerk(perk.id)}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: existing ? colors.primary : colors.foreground, flex: 1 }}>{perk.name}</Text>
                        <View style={{ gap: 2, alignItems: 'flex-end' }}>
                          {existing && <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.primary, borderRadius: 4 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>R{existing.rank}/{perk.maxRanks}</Text></View>}
                          <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Lv {perk.minLevel}</Text>
                          {perk.requiresRace && <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{perk.requiresRace.join(' / ')}</Text>}
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{perk.description}</Text>
                      {perk.combatEffect?.combatNote && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>⚔ {perk.combatEffect.combatNote}</Text>}
                      {(perk.minSTR || perk.minPER || perk.minEND || perk.minAGI || perk.minINT || perk.minLCK || perk.minCHA || perk.minSkill) && (
                        <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                          Requires: {[
                            perk.minSTR && `STR ${perk.minSTR}`, perk.minPER && `PER ${perk.minPER}`,
                            perk.minEND && `END ${perk.minEND}`, perk.minCHA && `CHA ${perk.minCHA}`,
                            perk.minAGI && `AGI ${perk.minAGI}`, perk.minINT && `INT ${perk.minINT}`,
                            perk.minLCK && `LCK ${perk.minLCK}`,
                            perk.minSkill && `${perk.minSkill.skill} ${perk.minSkill.value}%`,
                          ].filter(Boolean).join(', ')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── EQUIPMENT ── */}
          {activeTab === 4 && (
            <>
              {[
                { label: 'WEAPON', value: allWeapons.find(w => w.id === char.equippedWeaponId)?.name ?? 'None', onPress: () => setShowWeaponPick(true) },
                { label: 'BODY ARMOR', value: allArmor.find(a => a.id === char.equippedBodyArmorId)?.name ?? 'None', onPress: () => setShowBodyPick(true) },
                { label: 'HELMET', value: allArmor.find(a => a.id === char.equippedHelmetId)?.name ?? 'None', onPress: () => setShowHelmetPick(true) },
              ].map(({ label, value, onPress }) => (
                <TouchableOpacity key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }} onPress={onPress}>
                  <View>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{label}</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: 2 }}>{value}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}

              {/* Equipment summary */}
              {(char.equippedBodyArmorId || char.equippedHelmetId) && (
                <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>COMPUTED AC</Text>
                  <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary }}>{char.armorClass}</Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>AGI {char.special.agility} base + armor AC bonus{race.naturalACBonus > 0 ? ` + ${race.naturalACBonus} natural` : ''}</Text>
                </View>
              )}
            </>
          )}

          {/* ── INJURIES ── */}
          {activeTab === 5 && (
            <>
              {!addingInjury ? (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.destructive + '88' }} onPress={() => setAddingInjury(true)}>
                  <Feather name="plus" size={16} color={colors.destructive} />
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.destructive }}>ADD INJURY</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 }}>
                  <View>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>LOCATION</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {INJURY_LOCATIONS.map(loc => (
                        <TouchableOpacity key={loc} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: injLocation === loc ? colors.destructive : colors.background, borderWidth: 1, borderColor: injLocation === loc ? colors.destructive : colors.border }} onPress={() => setInjLocation(loc)}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: injLocation === loc ? '#fff' : colors.foreground }}>{loc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>SEVERITY</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {INJURY_SEVERITIES.map(sev => (
                        <TouchableOpacity key={sev} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: injSeverity === sev ? colors.destructive : colors.background, borderWidth: 1, borderColor: injSeverity === sev ? colors.destructive : colors.border }} onPress={() => setInjSeverity(sev)}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: injSeverity === sev ? '#fff' : colors.foreground }}>{sev.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TextInput style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 10, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13 }} placeholder="Description (optional)" placeholderTextColor={colors.mutedForeground} value={injDesc} onChangeText={setInjDesc} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }} onPress={() => { setAddingInjury(false); setInjDesc(''); }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive }} onPress={() => {
                      const inj: Injury = {
                        id: genId(), location: injLocation, severity: injSeverity,
                        description: injDesc || `${injSeverity} ${injLocation}`,
                        toHitPenalty: injLocation === 'eyes' ? 40 : injLocation === 'rightArm' || injLocation === 'leftArm' ? 20 : 0,
                        skillPenalty: {}, movementPenalty: (injLocation === 'leftLeg' || injLocation === 'rightLeg') ? 1 : 0,
                        isActive: true, source: 'manual',
                      };
                      setChar(c => ({ ...c, injuries: [...c.injuries, inj] }));
                      setAddingInjury(false); setInjDesc('');
                    }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' }}>ADD INJURY</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {char.injuries.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 30, gap: 8 }}>
                  <Feather name="check-circle" size={32} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>No injuries</Text>
                </View>
              ) : (
                char.injuries.map(inj => (
                  <View key={inj.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: inj.isActive ? colors.destructive + '66' : colors.border, backgroundColor: colors.secondary, gap: 10 }}>
                    <TouchableOpacity onPress={() => setChar(c => ({ ...c, injuries: c.injuries.map(i => i.id === inj.id ? { ...i, isActive: !i.isActive } : i) }))} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: inj.isActive ? colors.destructive : colors.border, backgroundColor: inj.isActive ? colors.destructive + '33' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {inj.isActive && <Feather name="check" size={12} color={colors.destructive} />}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: inj.isActive ? colors.destructive : colors.mutedForeground }}>{inj.location} — {inj.severity}</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{inj.description}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setChar(c => ({ ...c, injuries: c.injuries.filter(i => i.id !== inj.id) }))} style={{ padding: 4 }}>
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* Equipment selection modals */}
        <SelectionModal
          visible={showWeaponPick} onClose={() => setShowWeaponPick(false)} title="SELECT WEAPON"
          items={allWeapons} keyFn={w => w.id}
          onSelect={w => setChar(c => recomputeDerived({ ...c, equippedWeaponId: w?.id ?? undefined }))}
          renderItem={w => <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{w.name}</Text>}
        />
        <SelectionModal
          visible={showBodyPick} onClose={() => setShowBodyPick(false)} title="SELECT BODY ARMOR"
          items={allArmor.filter(a => a.slot === 'body')} keyFn={a => a.id}
          onSelect={a => setChar(c => recomputeDerived({ ...c, equippedBodyArmorId: a?.id ?? undefined }))}
          renderItem={a => <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{a.name}</Text>}
        />
        <SelectionModal
          visible={showHelmetPick} onClose={() => setShowHelmetPick(false)} title="SELECT HELMET"
          items={allArmor.filter(a => a.slot === 'helmet')} keyFn={a => a.id}
          onSelect={a => setChar(c => recomputeDerived({ ...c, equippedHelmetId: a?.id ?? undefined }))}
          renderItem={a => <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{a.name}</Text>}
        />

        {/* Biography editor */}
        <BioEditorModal
          visible={showBioEditor}
          name={char.name}
          value={char.biography ?? ''}
          onClose={next => { setChar(c => ({ ...c, biography: next })); setShowBioEditor(false); }}
        />
      </View>
    </Modal>
  );
}

// ─── Biography Editor Modal (full-screen notepad) ─────────────────────────────
function BioEditorModal({ visible, name, value, onClose }: {
  visible: boolean; name: string; value: string; onClose: (next: string) => void;
}) {
  const colors = useColors();
  const [text, setText] = useState(value);
  useEffect(() => { if (visible) setText(value); }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => onClose(text)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 52 : 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
          <TouchableOpacity onPress={() => onClose(text)}><Feather name="chevron-left" size={24} color={colors.mutedForeground} /></TouchableOpacity>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }} numberOfLines={1}>{name ? name.toUpperCase() : 'BIOGRAPHY'}</Text>
          <TouchableOpacity onPress={() => onClose(text)}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>DONE</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={{ minHeight: 400, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, textAlignVertical: 'top' }}
            multiline
            placeholder="Write this character's backstory, notes, and history…"
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Premade Picker Modal ─────────────────────────────────────────────────────
function PremadePickerModal({ visible, onClose, onPick }: {
  visible: boolean; onClose: () => void; onPick: (p: PremadeCharacter) => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ maxHeight: '80%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>PRE-MADE CHARACTERS</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <FlatList
            data={PREMADE_CHARACTERS}
            keyExtractor={p => p.premadeId}
            renderItem={({ item }) => {
              const raceRef = getRaceById(item.race);
              return (
                <TouchableOpacity style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 }} onPress={() => onPick(item)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{item.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>· Lv 1 {raceRef?.name ?? item.race}</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.primary }}>{item.title}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Character Card ────────────────────────────────────────────────────────────
function CharacterCard({ character, onEdit, onDelete, onClone, onBio, onToggleStorage, allWeapons }: {
  character: Character; onEdit: () => void; onDelete: () => void; onClone: () => void;
  onBio: () => void; onToggleStorage: () => void;
  allWeapons: { id: string; name: string }[];
}) {
  const colors = useColors();
  const weapon = allWeapons.find(w => w.id === character.equippedWeaponId);
  return (
    <TouchableOpacity style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: character.type === 'pc' ? colors.primary + '44' : colors.destructive + '44', padding: 14, gap: 10 }} onPress={onEdit} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CharacterAvatar portrait={character.portrait} name={character.name} size={48} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{character.name}</Text>
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: character.type === 'pc' ? colors.primary + '33' : colors.destructive + '33', borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: character.type === 'pc' ? colors.primary : colors.destructive }}>{character.type.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
            Lv {character.level} {character.race} · {weapon?.name ?? 'No weapon'}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            HP {character.currentHp}/{character.maxHp} · AC {character.armorClass + character.tempAC} · AP {character.currentAP}/{character.maxAP} · SEQ {character.sequence ?? character.special.perception * 2}
          </Text>
        </View>
        <View style={{ gap: 6 }}>
          <TouchableOpacity onPress={onBio} style={{ padding: 4 }}><Feather name="book-open" size={16} color={colors.primary} /></TouchableOpacity>
          <TouchableOpacity onPress={onToggleStorage} style={{ padding: 4 }}>
            <Ionicons name={character.inStorage ? 'file-tray-full' : 'archive-outline'} size={16} color={character.inStorage ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClone} style={{ padding: 4 }}><Feather name="copy" size={16} color={colors.mutedForeground} /></TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>
        </View>
      </View>
      <HPBar current={character.currentHp} max={character.maxHp} height={4} showText={false} />
    </TouchableOpacity>
  );
}

// ─── Characters Screen ────────────────────────────────────────────────────────
export default function CharactersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { characters, addCharacter, updateCharacter, deleteCharacter, cloneCharacter, allWeapons } = useApp();
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [showPremades, setShowPremades] = useState(false);
  const [bioChar, setBioChar] = useState<Character | null>(null);
  const [showStorage, setShowStorage] = useState(false);

  const matchesSearch = (c: Character) => !search || c.name.toLowerCase().includes(search.toLowerCase());
  const active = characters.filter(c => !c.inStorage && matchesSearch(c));
  const stored = characters.filter(c => c.inStorage && matchesSearch(c));
  const filtered = active;

  const toggleStorage = (c: Character) => {
    updateCharacter({ ...c, inStorage: !c.inStorage });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePickPremade = (p: PremadeCharacter) => {
    addCharacter(createCharacterFromPremade(p, genId()));
    setShowPremades(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = (c: Character) => {
    if (characters.find(existing => existing.id === c.id)) updateCharacter(c);
    else addCharacter(c);
    setShowForm(false);
    setEditingChar(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      {/* Header */}
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>CHARACTERS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary + '66' }} onPress={() => setShowPremades(true)}>
              <Feather name="users" size={14} color={colors.primary} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>PREMADE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: colors.radius }} onPress={() => { setEditingChar(null); setShowForm(true); }}>
              <Feather name="plus" size={14} color={colors.primaryForeground} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>NEW</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, gap: 8 }}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput style={{ flex: 1, paddingVertical: 8, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }} placeholder="Search…" placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>
      </View>

      {active.length === 0 && stored.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
          <Feather name="users" size={52} color={colors.mutedForeground} />
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textAlign: 'center' }}>{search ? 'No results' : 'No characters yet'}</Text>
          {!search && (
            <TouchableOpacity style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: colors.radius }} onPress={() => { setEditingChar(null); setShowForm(true); }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>Create First Character</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <CharacterCard
              character={item}
              allWeapons={allWeapons}
              onEdit={() => { setEditingChar(item); setShowForm(true); }}
              onBio={() => setBioChar(item)}
              onToggleStorage={() => toggleStorage(item)}
              onDelete={() => Alert.alert('Delete Character', `Delete ${item.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteCharacter(item.id) },
              ])}
              onClone={() => { cloneCharacter(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            />
          )}
          ListFooterComponent={stored.length > 0 ? (
            <View style={{ marginTop: 18, gap: 10 }}>
              <TouchableOpacity onPress={() => setShowStorage(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="file-tray-full" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>STORAGE ({stored.length})</Text>
                </View>
                <Feather name={showStorage ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showStorage && stored.map(item => (
                <CharacterCard
                  key={item.id}
                  character={item}
                  allWeapons={allWeapons}
                  onEdit={() => { setEditingChar(item); setShowForm(true); }}
                  onBio={() => setBioChar(item)}
                  onToggleStorage={() => toggleStorage(item)}
                  onDelete={() => Alert.alert('Delete Character', `Delete ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteCharacter(item.id) },
                  ])}
                  onClone={() => { cloneCharacter(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                />
              ))}
            </View>
          ) : null}
        />
      )}

      <CharacterFormModal
        visible={showForm}
        character={editingChar}
        onSave={handleSave}
        onClose={() => { setShowForm(false); setEditingChar(null); }}
      />

      <PremadePickerModal
        visible={showPremades}
        onClose={() => setShowPremades(false)}
        onPick={handlePickPremade}
      />

      {/* Card-level biography editor */}
      <BioEditorModal
        visible={bioChar !== null}
        name={bioChar?.name ?? ''}
        value={bioChar?.biography ?? ''}
        onClose={next => {
          if (bioChar) updateCharacter({ ...bioChar, biography: next });
          setBioChar(null);
        }}
      />
    </View>
  );
}
