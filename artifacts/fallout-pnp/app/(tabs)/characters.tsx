import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Image, Modal, PanResponder, Platform, ScrollView, Text,
  TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import {
  Character, CharacterType, RaceType,
  SkillType, SPECIALStats, Injury, NaturalProtection, DamageType, Weapon, Armor,
  COMBAT_SKILLS, SUPPORT_SKILLS, SKILL_LABELS,
  DAMAGE_TYPE_NAMES, EMPTY_NATURAL_PROTECTION,
} from '@/context/types';
import CharacterAvatar from '@/components/CharacterAvatar';
import HPBar from '@/components/HPBar';
import {
  calcMaxHP, calcNpcMaxHP, calcMaxAP, calcBaseAC, calcSequence, calcBaseSkills,
  xpForLevel, levelForXP,
  computePerkDerivedBonuses, brutishHulkExtraHP,
} from '@/data/derived';
import { RACES, PLAYABLE_RACES, getRaceById } from '@/data/races';
import { PERKS, getPerkById, getPerksForRace, calcAvailablePerkPoints, calcUsedPerkPoints, canTakePerk } from '@/data/perks';
import { breakTheRulesPendingAfterPurchase } from '@/data/breakTheRules';
import { TRAITS, MAX_TRAITS, getTraitById, canTakeTrait, computeTraitEffects } from '@/data/traits';
import { PREMADE_CHARACTERS, PremadeCharacter, createCharacterFromPremade } from '@/data/premades';
import { INJURY_LOCATION_INFO, computeInjuryEffects } from '@/data/injuries';
import { CHEMS, getChem } from '@/data/chems';
import { makeChemEffect, progressChemEffect, chemHasNextStage, computePerkStatBonuses } from '@/data/effects';
import { poisonEffectName } from '@/data/poisonEffects';
import { applyImmediateTraitSpecial, calculateHealingRate, calculateSkillPointsPerLevel as calculateRuleSkillPointsPerLevel, calculateTagSkillRules, calculatePerkCadence } from '@/data/effectiveRules';
import { getWeaponHands, WEAPON_CATEGORY_ORDER, WEAPON_CATEGORY_LABELS } from '@/data/weapons';
import { computeModEffects } from '@/data/mods';
import {
  applySkillPointOperation,
  canChangeSkillTag,
  rebaseSkillValue,
  reconcileUnspentSkillPoints,
} from '@/data/skillAdvancement';
import { refundPerk } from '@/data/perkRefund';
import { CONDITION_DEFINITIONS, computeConditionModifiers, isHealingBlocked, resolveHpChange } from '@/data/conditions';
import { aggregateArmorEffects, resolveArmorAwareSheet } from '@/data/armorEffects';
import { clearUnconsciousness, setUnconsciousness } from '@/data/unconsciousness';
import { adjustRadiation, hardcoreRadiationRule, formatHardcoreRadiationPenalties, HARDCORE_RADIATION_RULES, MAX_RADIATION, radiationSicknessEffect, radiationSicknessLabel, resolveRadiationAddition } from '@/data/radiation';

// ─── Perk ids that are actually traits in the manual; hide from perk browser
//     but do NOT delete saved Character.perks entries or remove lookup/effects.
const LEGACY_TRAIT_PERK_IDS = new Set(['finesse', 'fast_metabolism', 'chem_resistant', 'glowing_one']);

const DAMAGE_TYPES: DamageType[] = ['normal', 'laser', 'fire', 'plasma', 'explosion'];

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const DEFAULT_SPECIAL: SPECIALStats = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };
const SPECIAL_KEYS: (keyof SPECIALStats)[] = ['strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck'];
const SPECIAL_SHORT: Record<keyof SPECIALStats, string> = { strength: 'STR', perception: 'PER', endurance: 'END', charisma: 'CHA', intelligence: 'INT', agility: 'AGI', luck: 'LCK' };
const ALL_SKILLS: SkillType[] = [...COMBAT_SKILLS, ...SUPPORT_SKILLS];

/** Permanent advancement INT: immediate traits and Gain-X only, never chems,
 * conditions, or Night Person. */
function permanentIntelligence(char: Pick<Character, 'special' | 'traits' | 'perks'>): number {
  const special = applyImmediateTraitSpecial(char.special, char.traits);
  return special.intelligence + (computePerkStatBonuses(char).intelligence ?? 0);
}

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
    taggedSkills: [], unspentSkillPoints: calculateRuleSkillPointsPerLevel(special.intelligence),
    perks: [],
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0, accumulatedRadiation: 0,
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

// ─── HoldButton ──────────────────────────────────────────────────────────────
// A button that fires one operation on quick tap; after a 2-second hold it
// fires at 5 ops/sec until released. Timers are always cleaned up.
// disabled: renders at reduced opacity and ignores all interactions.
function HoldButton({
  onAction, disabled, active = true, style, children,
}: {
  onAction: () => void;
  disabled?: boolean;
  active?: boolean;
  style?: any;
  children: React.ReactNode;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const didHold = useRef(false);

  const clearTimers = () => {
    if (holdTimer.current !== null) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (repeatInterval.current !== null) { clearInterval(repeatInterval.current); repeatInterval.current = null; }
  };

  useEffect(() => {
    if (!active) {
      clearTimers();
      didHold.current = false;
    }
    return () => clearTimers();
  }, [active]);

  const handlePressIn = () => {
    if (disabled || !active) return;
    didHold.current = false;
    holdTimer.current = setTimeout(() => {
      didHold.current = true;
      // Fire immediately at hold-start, then every 200ms (5/sec)
      onAction();
      repeatInterval.current = setInterval(() => {
        onAction();
      }, 200);
    }, 2000);
  };

  const handlePressOut = () => {
    clearTimers();
  };

  const handlePress = () => {
    // onPress fires after onPressOut. Only fire a single operation when it was
    // NOT a hold (didHold = false means the 2s threshold was not crossed).
    if (!disabled && active && !didHold.current) {
      onAction();
    }
    didHold.current = false;
  };

  return (
    <TouchableOpacity
      style={[style, { opacity: disabled ? 0.3 : 1 }]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !active}
      delayPressIn={0}
    >
      {children}
    </TouchableOpacity>
  );
}

// ─── SelectionModal ───────────────────────────────────────────────────────────
// Supports optional weapon-category grouping via the `groupBy` prop.
// When groupBy is provided, items are rendered under category headers in
// WEAPON_CATEGORY_ORDER order; items that match no category appear last.
type SelectionModalRow<T> = { type: 'item'; item: T } | { type: 'header'; label: string } | { type: 'none' };

function SelectionModal<T>({ visible, onClose, onSelect, items, keyFn, renderItem, title, groupBy }: {
  visible: boolean; onClose: () => void; onSelect: (item: T | null) => void;
  items: T[]; keyFn: (i: T) => string; renderItem: (i: T) => React.ReactNode; title: string;
  /** Optional: function that returns a WeaponCategory string for each item.
   *  When provided, items are grouped under category headers. */
  groupBy?: (i: T) => string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Build flat row list, optionally with group headers
  const rows = useMemo((): SelectionModalRow<T>[] => {
    const result: SelectionModalRow<T>[] = [{ type: 'none' }];
    if (!groupBy) {
      items.forEach(item => result.push({ type: 'item', item }));
      return result;
    }
    // Group by category order
    const byCategory: Record<string, T[]> = {};
    const uncategorized: T[] = [];
    for (const item of items) {
      const cat = groupBy(item);
      if (cat) {
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
      } else {
        uncategorized.push(item);
      }
    }
    for (const cat of WEAPON_CATEGORY_ORDER) {
      const catItems = byCategory[cat];
      if (catItems && catItems.length > 0) {
        result.push({ type: 'header', label: (WEAPON_CATEGORY_LABELS as Record<string, string>)[cat] ?? cat });
        catItems.forEach(item => result.push({ type: 'item', item }));
      }
    }
    // Append any items with unrecognised category keys
    if (uncategorized.length > 0) {
      result.push({ type: 'header', label: 'Other' });
      uncategorized.forEach(item => result.push({ type: 'item', item }));
    }
    return result;
  }, [items, groupBy]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ height: '100%', paddingTop: insets.top, backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <FlatList
            data={rows}
            keyExtractor={(row, idx) => {
              if (row.type === 'none') return '__none__';
              if (row.type === 'header') return `__header__${row.label}`;
              return keyFn(row.item);
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderItem={({ item: row }) => {
              if (row.type === 'header') {
                return (
                  <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, backgroundColor: colors.background }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{row.label.toUpperCase()}</Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { onSelect(row.type === 'none' ? null : row.item); onClose(); }}>
                  {row.type === 'none'
                    ? <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>None</Text>
                    : renderItem(row.item)
                  }
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Confirm Modal (cross-platform; Alert.alert buttons don't work on web) ────
function ConfirmModal({ visible, title, message, confirmLabel, cancelLabel, onCancel, onConfirm }: {
  visible: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ padding: 20, gap: 8 }}>
            <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>{title}</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 20 }}>{message}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.border }} onPress={onCancel}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{cancelLabel ?? 'CANCEL'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }} onPress={onConfirm}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>{confirmLabel ?? 'DELETE'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function HardcoreRadiationPreviewModal({ visible, enabled, onClose }: {
  visible: boolean; enabled: boolean; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const thresholds = HARDCORE_RADIATION_RULES.filter(rule => rule.threshold > 0).reverse();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} testID="hardcore-radiation-preview-modal">
      <View
        accessibilityViewIsModal
        accessibilityLabel="Hardcore radiation rules preview"
        style={{ flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: 20 }}
      >
        <View style={{ maxHeight: '88%', backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive + '88', overflow: 'hidden' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text accessibilityRole="header" style={{ flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>HARDCORE RADIATION</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close Hardcore radiation rules preview"
                accessibilityHint="Returns to the campaign controls without changing Hardcore radiation rules"
                testID="hardcore-radiation-preview-close"
                onPress={onClose}
                style={{ padding: 4 }}
              >
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text accessibilityLabel={`Optional campaign-wide SPECIAL penalties. Currently ${enabled ? 'enabled' : 'disabled'}.`} style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              Optional campaign-wide SPECIAL penalties · {enabled ? 'Currently enabled' : 'Currently disabled'}
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(16, insets.bottom), gap: 12 }}>
            <View
              accessible
              accessibilityLabel="Core Fallout PnP 2.0 radiation sickness. Sickness labels remain narrative-only at 200, 400, 600, 800, and 1000 radiation."
              testID="hardcore-radiation-core-sickness"
              style={{ padding: 12, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, gap: 4 }}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 0.7 }}>SEPARATE FROM CORE SICKNESS</Text>
              <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                Fallout PnP 2.0 sickness labels remain narrative-only at 200, 400, 600, 800, and 1000 radiation. The optional penalties below use their own thresholds.
              </Text>
            </View>

            <View style={{ gap: 7 }}>
              {thresholds.map(rule => (
                <View
                  accessible
                  accessibilityLabel={`${rule.threshold} rads. ${formatHardcoreRadiationPenalties(rule.threshold)}${rule.fatal ? '. Fatal, instant death' : ''}`}
                  key={rule.threshold}
                  testID={`hardcore-radiation-threshold-${rule.threshold}`}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: colors.radius, backgroundColor: colors.destructive + '0d', borderWidth: 1, borderColor: colors.destructive + '44', gap: 12 }}
                >
                  <View style={{ width: 58 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{rule.threshold}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.7 }}>RADS</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                    {formatHardcoreRadiationPenalties(rule.threshold)}{rule.fatal ? ' · FATAL / INSTANT DEATH' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
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
  const insets = useSafeAreaInsets();
  const { allWeapons, allArmor, hardcoreRadiationRules } = useApp();
  const [char, setChar] = useState<Character>(character ?? makeDefaultCharacter());
  const [activeTab, setActiveTab] = useState(0);
  const [specialPoolTotal, setSpecialPoolTotal] = useState(40);
  const [perkSearch, setPerkSearch] = useState('');
  const [showNaturalProt, setShowNaturalProt] = useState(false);
  const [showBioEditor, setShowBioEditor] = useState(false);

  // Weapon/armor pickers
  const [showBodyPick, setShowBodyPick] = useState(false);
  const [showHelmetPick, setShowHelmetPick] = useState(false);
  const [handPick, setHandPick] = useState<null | 'left' | 'right'>(null);
  const [showInventoryPick, setShowInventoryPick] = useState(false);
  const [showChemPick, setShowChemPick] = useState(false);

  // Perks tab: only-show-available toggle
  const [onlyAvailablePerks, setOnlyAvailablePerks] = useState(false);
  const [perkRefundId, setPerkRefundId] = useState<string | null>(null);

  // Skill points GM adjustment input
  const [skillPointsInput, setSkillPointsInput] = useState('');
  const [radiationInput, setRadiationInput] = useState('');
  const [pendingRadiation, setPendingRadiation] = useState<number | null>(null);

  // Injury form
  const [addingInjury, setAddingInjury] = useState(false);
  const [injLocation, setInjLocation] = useState<Injury['location']>('torso');
  const [injDesc, setInjDesc] = useState('');

  useEffect(() => {
    if (!visible) {
      // Modal is closing — always restore scrollability in case a crop drag was
      // interrupted (e.g. modal dismissed by swipe while dragging).
      setCropDragging(false);
      return;
    }
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
  // Purchases are stored against saved SPECIAL.  Rebase them for display only;
  // traits/perks must never be written back into char.skills.
  const permanentSpecial = useMemo(() => {
    const withTraits = applyImmediateTraitSpecial(char.special, char.traits);
    const perkStats = computePerkStatBonuses(char);
    for (const key of SPECIAL_KEYS) withTraits[key] += perkStats[key] ?? 0;
    return withTraits;
  }, [char.special, char.traits, char.perks]);
  const tagRules = useMemo(() => calculateTagSkillRules(char.traits), [char.traits]);
  const armorSheet = useMemo(() => resolveArmorAwareSheet({
    special: char.special, skills: char.skills,
    taggedSkills: [...char.taggedSkills, ...tagRules.freeTagSkills],
    traits: char.traits, perks: char.perks, conditions: char.conditions, effects: char.effects,
    raceBounds: { min: race.specialMin, max: race.specialMax },
    racialNaturalArmorClass: race.naturalACBonus,
    naturalArmorClass: char.naturalProtection?.armorClass,
    manualDerivedStats: char.manualDerivedStats,
    usesDerivedArmorClass: char.usesDerivedArmorClass,
    nightPersonPeriod: char.nightPersonPeriod,
    tempAC: char.tempAC,
    radiationResistance: char.radiationResistance, gasResistance: char.gasResistance,
    poisonResistance: char.poisonResistance, electricityResistance: char.electricityResistance,
    accumulatedRadiation: char.accumulatedRadiation, hardcoreRadiationRules,
    equippedBodyArmorId: char.equippedBodyArmorId, equippedHelmetId: char.equippedHelmetId,
    allArmor,
  }), [char, allArmor, race, tagRules.freeTagSkills, hardcoreRadiationRules]);
  const effectiveSkills = armorSheet.effectiveSkills;
  const radiationEffect = useMemo(
    () => radiationSicknessEffect(char.accumulatedRadiation ?? 0),
    [char.accumulatedRadiation],
  );
  const lockedTagCount = useMemo(
    () => ALL_SKILLS.filter(sk => !canChangeSkillTag(char.skills[sk], baseSkills[sk])).length,
    [char.skills, baseSkills],
  );

  const recomputeDerived = useCallback((updatedChar: Character): Character => {
    const raceRef = getRaceById(updatedChar.race) ?? RACES[0];
    // Derived stats use base SPECIAL + permanent Gain-X perks (NOT chem mods —
    // chems are temporary and applied at display/combat time instead).
    const perkStat = computePerkStatBonuses(updatedChar);
    const perkSpecial = { ...updatedChar.special };
    for (const k of SPECIAL_KEYS) perkSpecial[k] += perkStat[k] ?? 0;
    const hpSpecial = applyImmediateTraitSpecial(perkSpecial, updatedChar.traits);
    const pdb = computePerkDerivedBonuses(updatedChar.perks, updatedChar.level);

    if (updatedChar.manualDerivedStats) {
      // Printed NPC HP is the level-1 baseline. Legacy NPC saves predate
      // baseMaxHp, so their current stored max HP becomes that baseline once.
      const baseMaxHp = updatedChar.manualDerivedStats.baseMaxHp ?? updatedChar.maxHp;
      const maxHp = calcNpcMaxHP(
        baseMaxHp,
        hpSpecial,
        updatedChar.level,
        raceRef.bonusHPPerLevel ?? 0,
      ) + pdb.maxHP
        + (pdb.doubleHPPerLevel
          ? brutishHulkExtraHP(hpSpecial, pdb.doubleHPLevels, raceRef.bonusHPPerLevel ?? 0)
          : 0);
      return {
        ...updatedChar,
        manualDerivedStats: { ...updatedChar.manualDerivedStats, baseMaxHp },
        maxHp,
        currentHp: Math.min(updatedChar.currentHp, maxHp),
        armorClass: updatedChar.usesDerivedArmorClass
          ? calcBaseAC(perkSpecial) + raceRef.naturalACBonus + (updatedChar.naturalProtection?.armorClass ?? 0)
          : updatedChar.manualDerivedStats.armorClass,
        maxAP: updatedChar.manualDerivedStats.maxAP,
        sequence: updatedChar.manualDerivedStats.sequence,
        currentAP: Math.min(updatedChar.currentAP, updatedChar.manualDerivedStats.maxAP),
      };
    }
    const maxHp = calcMaxHP(hpSpecial, updatedChar.level, raceRef.bonusHPPerLevel ?? 0)
      + pdb.maxHP
      + (pdb.doubleHPPerLevel ? brutishHulkExtraHP(hpSpecial, pdb.doubleHPLevels, raceRef.bonusHPPerLevel ?? 0) : 0);
    // These stored baselines intentionally exclude traits. The effective rules
    // layer adds trait and temporary changes without baking them into storage.
    const maxAP = calcMaxAP(perkSpecial);
    const armorClass = calcBaseAC(perkSpecial) + raceRef.naturalACBonus + (updatedChar.naturalProtection?.armorClass ?? 0);
    const sequence = calcSequence(perkSpecial) + pdb.sequence;
    const radRes = Math.max(updatedChar.radiationResistance, raceRef.naturalDR);
    const gasRes = Math.max(updatedChar.gasResistance, raceRef.naturalGasDR);
    const elecRes = Math.min(100, Math.max(updatedChar.electricityResistance, raceRef.naturalElecDR));
    return {
      ...updatedChar,
      maxHp, currentHp: Math.min(updatedChar.currentHp, maxHp),
      maxAP, currentAP: updatedChar.currentAP,
      armorClass, sequence, radiationResistance: radRes, gasResistance: gasRes, electricityResistance: elecRes,
    };
  }, []);

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
      for (const sk of ALL_SKILLS) {
        skills[sk] = rebaseSkillValue(prev.skills[sk], oldBase[sk], newBase[sk]);
      }
      const oldTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence(prev), prev.traits) * prev.level;
      const newTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence({ ...prev, special: newSpecial }), prev.traits) * prev.level;
      const unspentSkillPoints = reconcileUnspentSkillPoints(prev.unspentSkillPoints, oldTotal, newTotal);
      return recomputeDerived({ ...prev, special: newSpecial, skills, unspentSkillPoints });
    });
  }, [recomputeDerived]);

  const setRace = useCallback((newRace: RaceType) => {
    setChar(prev => {
      const raceRef = getRaceById(newRace) ?? RACES[0];
      const special = { ...prev.special };
      for (const k of SPECIAL_KEYS) {
        special[k] = Math.max(raceRef.specialMin[k], Math.min(raceRef.specialMax[k], special[k]));
      }
      // Race bounds can move SPECIAL-derived skill bases. Preserve every
      // purchased offset so a race change cannot erase the tag-change lock or
      // revalue previously spent skill points.
      const oldBase = calcBaseSkills(prev.special);
      const newBase = calcBaseSkills(special);
      const skills = { ...prev.skills };
      for (const sk of ALL_SKILLS) {
        skills[sk] = rebaseSkillValue(prev.skills[sk], oldBase[sk], newBase[sk]);
      }
      const oldTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence(prev), prev.traits) * prev.level;
      const newTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence({ ...prev, special }), prev.traits) * prev.level;
      const unspentSkillPoints = reconcileUnspentSkillPoints(prev.unspentSkillPoints, oldTotal, newTotal);
      // Reset elemental resistances to the new race's natural defaults
      const radiationResistance = raceRef.naturalDR;
      const gasResistance = raceRef.naturalGasDR;
      const electricityResistance = raceRef.naturalElecDR;
      // Reset natural protection to the new race's defaults (or undefined)
      const naturalProtection = raceRef.naturalProtection ? { ...raceRef.naturalProtection } : undefined;
      return recomputeDerived({
        ...prev, race: newRace, special, skills, unspentSkillPoints,
        radiationResistance, gasResistance, electricityResistance, naturalProtection,
      });
    });
  }, [recomputeDerived]);

  // Apply a level change: sync XP, adjust unspent skill points, recompute derived
  const applyLevel = useCallback((newLevel: number) => {
    setChar(prev => {
      const clamped = Math.max(1, Math.min(99, newLevel));
      if (clamped === prev.level) return prev;
      const oldTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence(prev), prev.traits) * prev.level;
      const newTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence(prev), prev.traits) * clamped;
      const unspentSkillPoints = reconcileUnspentSkillPoints(prev.unspentSkillPoints, oldTotal, newTotal);
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
      const oldTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence(prev), prev.traits) * prev.level;
      const newTotal = calculateRuleSkillPointsPerLevel(permanentIntelligence(prev), prev.traits) * newLevel;
      const unspentSkillPoints = newLevel !== prev.level
        ? reconcileUnspentSkillPoints(prev.unspentSkillPoints, oldTotal, newTotal)
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
  const perkCadence = calculatePerkCadence(race.perksPerLevels ?? 3, char.traits);
  const perkPointsAvailable = Math.floor(char.level / perkCadence);
  const perkPointsUsed = calcUsedPerkPoints(char.perks);
  const perkPointsRemaining = perkPointsAvailable - perkPointsUsed;

  // Skill points: unspentSkillPoints from char
  const skillPointsTotal = calculateRuleSkillPointsPerLevel(permanentSpecial.intelligence, char.traits) * char.level;

  // Skill update: tagged skills cost 1 point for +2; untagged cost 1 point for +1.
  // Decrement is symmetric: tagged -2 refunds 1 point, untagged -1 refunds 1 point.
  // 'delta' is always +1 or -1 (one operation = one button press).
  const adjustSkill = useCallback((sk: SkillType, delta: 1 | -1) => {
    setChar(prev => {
      const base = calcBaseSkills(prev.special)[sk];
      const isTagged = prev.taggedSkills.includes(sk) || calculateTagSkillRules(prev.traits).freeTagSkills.includes(sk);
      const result = applySkillPointOperation({
        currentValue: prev.skills[sk],
        baseValue: base,
        unspentSkillPoints: prev.unspentSkillPoints,
        tagged: isTagged,
        direction: delta,
      });
      if (!result.changed) {
        if (delta > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return prev;
      }
      return {
        ...prev,
        skills: { ...prev.skills, [sk]: result.skillValue },
        unspentSkillPoints: result.unspentSkillPoints,
      };
    });
  }, []);

  const toggleTag = useCallback((sk: SkillType) => {
    setChar(prev => {
      const baseSkills = calcBaseSkills(prev.special);
      if (!canChangeSkillTag(prev.skills[sk], baseSkills[sk])) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return prev;
      }
      const rules = calculateTagSkillRules(prev.traits);
      const freeTag = rules.freeTagSkills.includes(sk);
      const isTagged = prev.taggedSkills.includes(sk) || freeTag;
      if (freeTag) return prev;
      const selectableTags = prev.taggedSkills.filter(tag => !rules.freeTagSkills.includes(tag));
      if (!isTagged && selectableTags.length >= rules.selectableCapacity) {
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
      if (!existing || existing.rank < perk.maxRanks) {
        // Adding a new perk or increasing rank — verify eligibility + points.
        const currentRanks = existing?.rank ?? 0;
        const bodyArmor = allArmor.find(armor => armor.id === prev.equippedBodyArmorId && armor.slot === 'body');
        const helmet = allArmor.find(armor => armor.id === prev.equippedHelmetId && armor.slot === 'helmet');
        const { allowed } = canTakePerk(prev, perk, currentRanks, aggregateArmorEffects(bodyArmor, helmet));
        if (!allowed || perkPointsRemaining <= 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return prev;
        }
        const breakTheRulesPending = breakTheRulesPendingAfterPurchase(prev.breakTheRulesPending, perkId);
        if (!existing) {
          return recomputeDerived({
            ...prev,
            breakTheRulesPending,
            perks: [...prev.perks, { perkId, rank: 1, takenAtLevel: prev.level }],
          });
        }
        return recomputeDerived({
          ...prev,
          breakTheRulesPending,
          perks: prev.perks.map(p => p.perkId === perkId ? { ...p, rank: p.rank + 1 } : p),
        });
      }
      return prev;
    });
  }, [perkPointsRemaining, recomputeDerived, allArmor]);

  const confirmPerkRefund = useCallback(() => {
    if (!perkRefundId) return;
    setChar(prev => recomputeDerived({
      ...prev,
      perks: refundPerk(prev.perks, perkRefundId).perks,
      breakTheRulesPending: perkRefundId === 'break_the_rules' ? false : prev.breakTheRulesPending,
    }));
    setPerkRefundId(null);
  }, [perkRefundId, recomputeDerived]);

  const pickPortrait = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setChar(c => ({ ...c, portrait: result.assets[0].uri }));
  }, []);

  const toggleTrait = useCallback((traitId: string) => {
    setChar(prev => {
      const current = prev.traits ?? [];
      let traits: string[];
      if (current.includes(traitId)) {
        traits = current.filter(t => t !== traitId);
      } else {
        const trait = getTraitById(traitId);
        if (!trait) return prev;
        const { allowed } = canTakeTrait(prev, trait);
        if (!allowed) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return prev;
        }
        traits = [...current, traitId];
      }
      const oldTotal = calculateRuleSkillPointsPerLevel(
        permanentIntelligence(prev),
        current,
      ) * prev.level;
      const next = { ...prev, traits };
      const newTotal = calculateRuleSkillPointsPerLevel(
        permanentIntelligence(next),
        traits,
      ) * prev.level;
      const unspentSkillPoints = reconcileUnspentSkillPoints(
        prev.unspentSkillPoints,
        oldTotal,
        newTotal,
      );
      return recomputeDerived({ ...next, unspentSkillPoints });
    });
  }, [recomputeDerived]);

  // ─── Effects (chems) helpers ──────────────────────────────────────────────
  const addChemEffect = useCallback((chemId: string) => {
    const chem = getChem(chemId);
    if (!chem) return;
    setChar(prev => ({ ...prev, effects: [...(prev.effects ?? []), makeChemEffect(chem, 0)] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const removeEffect = useCallback((id: string) => {
    setChar(prev => ({ ...prev, effects: (prev.effects ?? []).filter(e => e.id !== id) }));
  }, []);

  const toggleEffectActive = useCallback((id: string) => {
    setChar(prev => ({ ...prev, effects: (prev.effects ?? []).map(e => e.id === id ? { ...e, isActive: !e.isActive } : e) }));
  }, []);

  const advanceEffect = useCallback((id: string) => {
    setChar(prev => {
      const effects = prev.effects ?? [];
      const effect = effects.find(e => e.id === id);
      if (!effect || !effect.chemId) return prev;
      const chem = getChem(effect.chemId);
      if (!chem) return prev;
      const next = progressChemEffect(effect, chem);
      if (next === null) {
        return { ...prev, effects: effects.filter(e => e.id !== id) };
      }
      return { ...prev, effects: effects.map(e => e.id === id ? next : e) };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ─── Hand slots + inventory helpers ────────────────────────────────────────
  // Which arms are crippled (from injuries list — crippled/broken arm).
  const armStatus = useMemo(() => {
    const crippling = (char.injuries ?? []).filter(i => i.isActive && (i.severity === 'crippled' || i.severity === 'broken'));
    return {
      left: crippling.some(i => i.location === 'leftArm'),
      right: crippling.some(i => i.location === 'rightArm'),
    };
  }, [char.injuries]);

  // Is a weapon legal for a given hand given crippled arms?
  const weaponLegalForHand = useCallback((w: Weapon, hand: 'left' | 'right'): boolean => {
    const bothCrippled = armStatus.left && armStatus.right;
    if (bothCrippled) return false; // both arms crippled → None only
    const thisArmCrippled = hand === 'left' ? armStatus.left : armStatus.right;
    const hands = getWeaponHands(w);
    if (!thisArmCrippled) return true;
    // This arm crippled → only a 2-handed weapon with a sling, and only when
    // exactly one arm is crippled.
    const oneCrippled = armStatus.left !== armStatus.right;
    if (oneCrippled && hands === 2 && (w.mods ?? []).includes('sling')) return true;
    return false;
  }, [armStatus]);

  // Sync equippedWeaponId to primary (right hand, else left).
  const syncPrimaryWeapon = useCallback((c: Character): Character => {
    const primary = c.rightHandWeaponId ?? c.leftHandWeaponId;
    // Ensure equipped weapons are always in inventory (max 5).
    const inv = new Set(c.inventoryWeaponIds ?? []);
    if (c.leftHandWeaponId) inv.add(c.leftHandWeaponId);
    if (c.rightHandWeaponId) inv.add(c.rightHandWeaponId);
    const inventoryWeaponIds = Array.from(inv).slice(0, 5);
    return { ...c, equippedWeaponId: primary, inventoryWeaponIds };
  }, []);

  const equipHand = useCallback((hand: 'left' | 'right', weapon: Weapon | null) => {
    setChar(prev => {
      if (!weapon) {
        const next = { ...prev, [hand === 'left' ? 'leftHandWeaponId' : 'rightHandWeaponId']: undefined };
        return recomputeDerived(syncPrimaryWeapon(next));
      }
      const hands = getWeaponHands(weapon);
      let next: Character;
      if (hands === 2) {
        // 2-handed fills both slots.
        next = { ...prev, leftHandWeaponId: weapon.id, rightHandWeaponId: weapon.id };
      } else {
        // 1-handed: if the other hand holds a 2-handed weapon (same id in both),
        // clear it first.
        const otherKey = hand === 'left' ? 'rightHandWeaponId' : 'leftHandWeaponId';
        const thisKey = hand === 'left' ? 'leftHandWeaponId' : 'rightHandWeaponId';
        const otherId = prev[otherKey];
        const otherIsTwoHanded = otherId && prev.leftHandWeaponId === prev.rightHandWeaponId;
        next = {
          ...prev,
          [thisKey]: weapon.id,
          ...(otherIsTwoHanded ? { [otherKey]: undefined } : {}),
        } as Character;
      }
      return recomputeDerived(syncPrimaryWeapon(next));
    });
  }, [recomputeDerived, syncPrimaryWeapon]);

  const addToInventory = useCallback((weapon: Weapon | null) => {
    if (!weapon) return;
    setChar(prev => {
      const inv = prev.inventoryWeaponIds ?? [];
      if (inv.includes(weapon.id) || inv.length >= 5) {
        if (inv.length >= 5) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return prev;
      }
      return { ...prev, inventoryWeaponIds: [...inv, weapon.id] };
    });
  }, []);

  const removeFromInventory = useCallback((id: string) => {
    setChar(prev => {
      // Don't allow removing an equipped weapon from inventory silently — unequip it too.
      const next: Character = {
        ...prev,
        inventoryWeaponIds: (prev.inventoryWeaponIds ?? []).filter(w => w !== id),
        leftHandWeaponId: prev.leftHandWeaponId === id ? undefined : prev.leftHandWeaponId,
        rightHandWeaponId: prev.rightHandWeaponId === id ? undefined : prev.rightHandWeaponId,
      };
      return syncPrimaryWeapon(next);
    });
  }, [syncPrimaryWeapon]);

  // ─── Portrait drag-crop (PanResponder, works with mouse on web) ─────────────
  // While dragging, we disable the outer editor ScrollView so the crop gesture
  // doesn't fight with vertical scroll. We restore it on release/termination.
  const bannerLayout = useRef({ width: 1, height: 260 });
  const dragMoved = useRef(false);
  const [cropDragging, setCropDragging] = useState(false);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => (char.portraitFit ?? 'cover') === 'cover' && !!char.portrait,
    onMoveShouldSetPanResponder: () => (char.portraitFit ?? 'cover') === 'cover' && !!char.portrait,
    onPanResponderGrant: () => {
      dragMoved.current = false;
      setCropDragging(true);
    },
    onPanResponderMove: (_e, g) => {
      if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) dragMoved.current = true;
      const { width, height } = bannerLayout.current;
      setChar(c => {
        const cur = c.portraitOffset ?? { x: 0.5, y: 0.5 };
        const nx = Math.max(0, Math.min(1, cur.x - g.dx / Math.max(1, width)));
        const ny = Math.max(0, Math.min(1, cur.y - g.dy / Math.max(1, height)));
        return { ...c, portraitOffset: { x: nx, y: ny } };
      });
    },
    onPanResponderRelease: () => {
      setCropDragging(false);
      if (!dragMoved.current) pickPortrait();
    },
    onPanResponderTerminate: () => {
      setCropDragging(false);
    },
  }), [char.portraitFit, char.portrait, pickPortrait]);

  // All perks (search-filtered). Legacy trait-as-perk ids are hidden from the
  // browser (they are traits in the manual) but their saved data / effects are
  // preserved — we just don't display or allow adding them here.
  const perkList = useMemo(() =>
    PERKS.filter(p => {
      if (LEGACY_TRAIT_PERK_IDS.has(p.id)) return false;
      if (perkSearch && !p.name.toLowerCase().includes(perkSearch.toLowerCase()) && !p.description.toLowerCase().includes(perkSearch.toLowerCase())) return false;
      return true;
    }), [perkSearch]);

  const isValid = char.name.trim().length > 0;

  const handleSave = () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(recomputeDerived(char));
  };

  const TABS = ['Basics', 'SPECIAL', 'Skills', 'Perks', 'Traits', 'Equipment', 'Effects'];
  const INJURY_LOCATIONS: Injury['location'][] = ['head', 'eyes', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Math.max(insets.top, 16), borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }}>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color={colors.mutedForeground} /></TouchableOpacity>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>
            {character ? 'EDIT CHARACTER' : 'NEW CHARACTER'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={!isValid}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: isValid ? colors.primary : colors.mutedForeground }}>SAVE</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        {/* flexGrow: 0 — a horizontal ScrollView otherwise stretches to fill the
            modal's vertical flex space, leaving a huge blank gap under the tabs. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }} contentContainerStyle={{ paddingHorizontal: 8 }}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: activeTab === i ? colors.primary : 'transparent' }} onPress={() => { setCropDragging(false); setActiveTab(i); }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: activeTab === i ? colors.primary : colors.mutedForeground }}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 100, width: '100%', maxWidth: 820, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!cropDragging}
        >

          {/* ── BASICS ── */}
          {activeTab === 0 && (
            <>
              {/* Portrait banner — large preview using the full uploaded photo.
                  When cropping (cover), drag to reposition the crop focus; a tap
                  (without drag) opens the picker. */}
              <View style={{ gap: 8 }}>
                {char.portrait ? (
                  (char.portraitFit ?? 'cover') === 'cover' ? (
                    <View
                      {...panResponder.panHandlers}
                      onLayout={e => { bannerLayout.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }; }}
                      style={{ width: '100%', height: 260, borderRadius: 14, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.secondary, overflow: 'hidden' }}
                    >
                      {Platform.OS === 'web' ? (
                        <img
                          src={char.portrait}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${Math.round((char.portraitOffset?.x ?? 0.5) * 100)}% ${Math.round((char.portraitOffset?.y ?? 0.5) * 100)}%` } as any}
                          draggable={false}
                        />
                      ) : (
                        <Image
                          source={{ uri: char.portrait }}
                          resizeMode="cover"
                          style={{
                            width: bannerLayout.current.width * 1.6,
                            height: 260 * 1.6,
                            marginLeft: -(char.portraitOffset?.x ?? 0.5) * (bannerLayout.current.width * 0.6),
                            marginTop: -(char.portraitOffset?.y ?? 0.5) * (260 * 0.6),
                          }}
                        />
                      )}
                      <View style={{ position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6 }} pointerEvents="none">
                        <Feather name="move" size={11} color="#fff" />
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Drag to reposition · tap to change</Text>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity activeOpacity={0.85} onPress={pickPortrait}>
                      <Image
                        source={{ uri: char.portrait }}
                        resizeMode="contain"
                        style={{ width: '100%', height: 260, borderRadius: 14, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.secondary }}
                      />
                    </TouchableOpacity>
                  )
                ) : (
                  <TouchableOpacity activeOpacity={0.85} onPress={pickPortrait}>
                    <View style={{ width: '100%', height: 260, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Feather name="image" size={40} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>TAP TO UPLOAD PHOTO</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Avatar preview + fit toggle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <CharacterAvatar portrait={char.portrait} name={char.name} size={52} fit={char.portraitFit ?? 'cover'} offset={char.portraitOffset} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 }}>FIT</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['cover', 'contain'] as const).map(f => {
                        const active = (char.portraitFit ?? 'cover') === f;
                        return (
                          <TouchableOpacity key={f} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: active ? colors.primary : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border }} onPress={() => setChar(c => ({ ...c, portraitFit: f }))}>
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: active ? colors.primaryForeground : colors.mutedForeground }}>{f === 'cover' ? 'CROP' : 'FULL'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
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
                  <TouchableOpacity
                    disabled={isHealingBlocked(char)}
                    style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: isHealingBlocked(char) ? 0.35 : 1 }}
                    onPress={() => setChar(c => ({ ...c, currentHp: resolveHpChange(c, 1) }))}
                  >
                    <Feather name="plus" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
                <HPBar current={char.currentHp} max={char.maxHp} height={6} showText={false} />
                {isHealingBlocked(char) && (
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive, textAlign: 'center' }}>HEALING BLOCKED BY WITHDRAWAL</Text>
                )}
              </View>

              {/* Accumulated radiation — intentionally separate from HP. */}
              <View style={{ gap: 7 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>RADIATION</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.primary }}>{char.accumulatedRadiation ?? 0} / {MAX_RADIATION}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: (char.accumulatedRadiation ?? 0) >= 200 ? colors.destructive : colors.mutedForeground }}>{radiationSicknessLabel(char.accumulatedRadiation ?? 0)}</Text>
                </View>
                <View style={{ height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ height: '100%', width: `${Math.min(100, (char.accumulatedRadiation ?? 0) / 10)}%`, backgroundColor: (char.accumulatedRadiation ?? 0) >= 600 ? colors.destructive : '#b6d43b' }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput style={{ flex: 1, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, color: colors.foreground, fontFamily: 'Inter_600SemiBold' }} keyboardType="number-pad" placeholder="Amount" placeholderTextColor={colors.mutedForeground} value={radiationInput} onChangeText={text => setRadiationInput(text.replace(/[^0-9]/g, ''))} />
                  <TouchableOpacity style={{ paddingHorizontal: 14, justifyContent: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }} onPress={() => { const amount = parseInt(radiationInput, 10) || 0; setChar(c => ({ ...c, accumulatedRadiation: adjustRadiation(c.accumulatedRadiation ?? 0, -amount) })); setRadiationInput(''); }}><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold' }}>SUBTRACT</Text></TouchableOpacity>
                  <TouchableOpacity style={{ paddingHorizontal: 14, justifyContent: 'center', borderRadius: colors.radius, backgroundColor: colors.primary }} onPress={() => { const amount = parseInt(radiationInput, 10) || 0; if (amount > 0) setPendingRadiation(amount); }}><Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold' }}>ADD</Text></TouchableOpacity>
                </View>
              </View>

              {/* Resistances */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>ELEMENTAL RESISTANCES</Text>
                {[
                  { label: 'Radiation', val: char.radiationResistance, resolved: armorSheet.radiationResistance, key: 'radiationResistance' as const, natural: race.naturalDR },
                  { label: 'Gas', val: char.gasResistance, resolved: armorSheet.gasResistance, key: 'gasResistance' as const, natural: race.naturalGasDR },
                  { label: 'Poison', val: char.poisonResistance ?? 0, resolved: armorSheet.poisonResistance, key: 'poisonResistance' as const, natural: 0 },
                  { label: 'Electricity', val: char.electricityResistance, resolved: armorSheet.electricityResistance, key: 'electricityResistance' as const, natural: race.naturalElecDR },
                ].map(({ label, val, resolved, key, natural }) => (
                  <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{label}{natural !== 0 ? ` (base ${natural}% from race)` : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setChar(c => ({ ...c, [key]: Math.max(natural, val - 5) }))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                       <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: resolved >= 50 ? '#4a8c3f' : colors.foreground, minWidth: 45, textAlign: 'center' }}>{resolved}%</Text>
                      <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setChar(c => ({ ...c, [key]: Math.min(100, val + 5) }))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Natural Protection (AC/DT/DR) — collapsible */}
              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => setShowNaturalProt(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>NATURAL PROTECTION (AC/DT/DR)</Text>
                  <Feather name={showNaturalProt ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showNaturalProt && (
                  <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Built-in defense from training, hide, or plating. Natural AC stacks with Agility, race, perks, and worn armor. DT/DR applies in addition to worn armor.</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground, flex: 1 }}>Natural AC bonus</Text>
                      <TextInput
                        style={{ width: 72, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' }}
                        keyboardType="number-pad"
                        value={String(char.naturalProtection?.armorClass ?? 0)}
                        onChangeText={t => setNaturalProtectionField('armorClass', parseInt(t.replace(/[^0-9]/g, ''), 10) || 0)}
                      />
                    </View>
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

              {/* Derived stats preview (includes Gain-X + numeric perk bonuses) */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(() => {
                  const sFx = armorSheet.effectiveSpecial;
                  const pdb = computePerkDerivedBonuses(char.perks, char.level);
                  return [
                    ['Max HP', char.maxHp], ['Max AP', armorSheet.maxAP], ['AC', armorSheet.armorClass],
                    ['Sequence', armorSheet.sequence], ['Crit%', armorSheet.criticalChance],
                    ['Heal/day', calculateHealingRate(sFx.endurance, char.traits, 0, pdb.healingRate)], ['Carry', `${armorSheet.carryWeight + pdb.carryWeight}lb`],
                    ['Melee dmg', armorSheet.meleeDamage
                      + 2 * (char.perks.find(p => p.perkId === 'bonus_hth_damage')?.rank ?? 0)
                      + (computeTraitEffects(char).meleeDamageBonus ?? 0)],
                    ['Gas resist', `${armorSheet.gasResistance}%`],
                    ['Poison resist', `${armorSheet.poisonResistance}%`],
                    ['Rad resist', `${armorSheet.radiationResistance}%`],
                    ['Elec resist', `${armorSheet.electricityResistance}%`],
                    ['SP/lvl', calculateRuleSkillPointsPerLevel(permanentSpecial.intelligence, char.traits)],
                  ] as [string, string | number][];
                })().map(([l, v]) => (
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
                        <Text style={{ fontSize: 26, fontFamily: 'Inter_700Bold', color: armorSheet.effectiveSpecial[k] >= 8 ? colors.primary : colors.foreground, width: 40, textAlign: 'center' }}>{armorSheet.effectiveSpecial[k]}</Text>
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
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>SP/LVL</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>{calculateRuleSkillPointsPerLevel(permanentSpecial.intelligence, char.traits)}</Text>
                  </View>
                  {/* GM: add/remove skill points manually */}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.5 }}>ADD SKILL{'\n'}POINTS</Text>
                    <TextInput
                      style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'center' }}
                      keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                      placeholder="±0" placeholderTextColor={colors.mutedForeground}
                      value={skillPointsInput}
                      onChangeText={t => setSkillPointsInput(t.replace(/[^0-9-]/g, ''))}
                    />
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 6 }}
                      onPress={() => {
                        const delta = parseInt(skillPointsInput, 10);
                        if (!Number.isFinite(delta) || delta === 0) return;
                        setChar(c => ({ ...c, unspentSkillPoints: Math.max(-9999, Math.min(9999, c.unspentSkillPoints + delta)) }));
                        setSkillPointsInput('');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>APPLY</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>GM customization only — manually grant or remove skill points. Accepts negatives.</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Choose up to {tagRules.selectableCapacity} tags before spending skill points. Tagged skills get a free +20% bonus shown in orange. Each press costs 1 skill point: +2% for tagged skills, +1% for untagged. Hold for 2s to auto-repeat.</Text>
                {lockedTagCount > 0 && <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{lockedTagCount} skill tag{lockedTagCount === 1 ? ' is' : 's are'} locked until that skill’s purchased points are refunded.</Text>}
              </View>

              {(['combat', 'support'] as const).map(group => (
                <View key={group} style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginTop: 6 }}>{group === 'combat' ? 'COMBAT SKILLS' : 'SUPPORT SKILLS'}</Text>
                  {(group === 'combat' ? COMBAT_SKILLS : SUPPORT_SKILLS).map(sk => {
                    const base = baseSkills[sk];
                    const total = char.skills[sk];
                    const offset = total - base;
                    const freeTag = tagRules.freeTagSkills.includes(sk);
                    const isTagged = char.taggedSkills.includes(sk) || freeTag;
                    const tagLocked = !canChangeSkillTag(total, base);
                    const displayTotal = effectiveSkills[sk];
                    return (
                      <View key={sk} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                        <TouchableOpacity
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isTagged, disabled: tagLocked || freeTag }}
                          disabled={tagLocked || freeTag}
                          onPress={() => toggleTag(sk)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            borderWidth: 2,
                            borderColor: tagLocked || freeTag ? colors.mutedForeground + '55' : isTagged ? colors.primary : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: tagLocked || freeTag ? colors.secondary : isTagged ? colors.primary + '33' : 'transparent',
                            opacity: tagLocked || freeTag ? 0.6 : 1,
                            pointerEvents: tagLocked || freeTag ? 'none' : 'auto',
                          }}
                        >
                          {isTagged && <Feather name="tag" size={12} color={colors.primary} />}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: isTagged ? colors.primary : colors.foreground }} numberOfLines={1}>{SKILL_LABELS[sk]}</Text>
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                            Base {base}{offset > 0 ? ` +${offset} pts` : ''}{freeTag ? ' +20 Ham Fisted (locked)' : isTagged ? ' +20 tagged' : ''}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <HoldButton
                            active={visible}
                            disabled={offset <= 0}
                            onAction={() => adjustSkill(sk, -1)}
                            style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Feather name="minus" size={12} color={colors.foreground} />
                          </HoldButton>
                          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: isTagged ? colors.primary : displayTotal >= 75 ? '#4a8c3f' : colors.foreground, minWidth: 48, textAlign: 'center' }}>{displayTotal}%</Text>
                          <HoldButton
                            active={visible}
                            disabled={char.unspentSkillPoints <= 0}
                            onAction={() => adjustSkill(sk, 1)}
                            style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: char.unspentSkillPoints <= 0 ? colors.mutedForeground : colors.border, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Feather name="plus" size={12} color={colors.foreground} />
                          </HoldButton>
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
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Each rank costs 1 perk point. Adding ranks and refunding a perk are separate actions; refunding removes every rank and returns every point spent on that perk.</Text>
              {char.breakTheRulesPending && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                  BREAK THE RULES READY — your next perk point may select any perk, regardless of requirements or race.
                </Text>
              )}

              {/* Only-show-available toggle */}
              <TouchableOpacity
                onPress={() => setOnlyAvailablePerks(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: onlyAvailablePerks ? colors.primary : colors.border }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: onlyAvailablePerks ? colors.primary : colors.foreground, letterSpacing: 0.5 }}>ONLY SHOW AVAILABLE</Text>
                <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: onlyAvailablePerks ? colors.primary : colors.border, padding: 2, justifyContent: 'center' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: onlyAvailablePerks ? 'flex-end' : 'flex-start' }} />
                </View>
              </TouchableOpacity>

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
                         {cp.rank < perk.maxRanks && (
                           <TouchableOpacity onPress={() => togglePerk(cp.perkId)} style={{ padding: 4 }}>
                             <Feather name="plus-circle" size={18} color={perkPointsRemaining > 0 ? colors.primary : colors.mutedForeground} />
                           </TouchableOpacity>
                         )}
                         <TouchableOpacity onPress={() => setPerkRefundId(cp.perkId)} style={{ padding: 4 }}>
                           <Feather name="rotate-ccw" size={18} color={colors.destructive} />
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
                {(() => {
                  const visiblePerks = perkList.filter(perk => {
                    if (!onlyAvailablePerks) return true;
                    const existing = char.perks.find(p => p.perkId === perk.id);
                    if (existing) return true; // always show owned perks
                    const { allowed } = canTakePerk(char, perk, 0, armorSheet.armorEffects);
                    return allowed && perkPointsRemaining > 0;
                  });
                  return (
                    <>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{onlyAvailablePerks ? `Showing ${visiblePerks.length} available perks.` : `Showing all ${visiblePerks.length} perks. Unavailable perks are greyed with the reasons they can't be taken.`}</Text>
                {visiblePerks.map(perk => {
                  const existing = char.perks.find(p => p.perkId === perk.id);
                  const currentRanks = existing?.rank ?? 0;
                  const { allowed, reasons } = canTakePerk(char, perk, currentRanks, armorSheet.armorEffects);
                  const atMax = existing && currentRanks >= perk.maxRanks;
                  const noPoints = !existing && perkPointsRemaining <= 0;
                  // A perk is interactive if you can add/upgrade it (allowed + points)
                  // or if it's owned at max rank (tap to remove).
                  const canAddOrUpgrade = allowed && !noPoints;
                   const disabled = !canAddOrUpgrade && !atMax;
                  const reasonText = reasons.filter(r => !r.startsWith('Already at max')).join(' · ');
                  return (
                    <TouchableOpacity
                      key={perk.id}
                      disabled={disabled}
                      style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: existing ? colors.primary + '88' : colors.border, backgroundColor: existing ? colors.primary + '11' : colors.secondary, opacity: disabled ? 0.45 : 1, gap: 4 }}
                       onPress={() => atMax ? setPerkRefundId(perk.id) : togglePerk(perk.id)}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: existing ? colors.primary : colors.foreground, flex: 1 }}>{perk.name}</Text>
                        <View style={{ gap: 2, alignItems: 'flex-end' }}>
                          {existing && <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.primary, borderRadius: 4 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>R{existing.rank}/{perk.maxRanks}</Text></View>}
                          <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Lv {perk.requirements?.level ?? perk.minLevel}{perk.maxRanks > 1 ? ` · ${perk.maxRanks} ranks` : ''}</Text>
                          {perk.requiresRace && <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>{perk.requiresRace.join(' / ')} only</Text>}
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{perk.description}</Text>
                      {perk.combatEffect?.combatNote && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>⚔ {perk.combatEffect.combatNote}</Text>}
                      {!allowed && reasonText.length > 0 && (
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: colors.destructive }}>🔒 {reasonText}</Text>
                      )}
                      {allowed && noPoints && !existing && (
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: '#f59e0b' }}>No perk points remaining</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                    </>
                  );
                })()}
              </View>
            </>
          )}

          {/* ── TRAITS ── */}
          {activeTab === 4 && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>TRAITS</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: (char.traits?.length ?? 0) >= MAX_TRAITS ? '#f59e0b' : colors.mutedForeground }}>{char.traits?.length ?? 0}/{MAX_TRAITS} chosen</Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Optional. Choose up to {MAX_TRAITS} traits — each has a benefit and a penalty. Normally picked at creation, but editable here (GM tool).</Text>
              {TRAITS.map(trait => {
                const selected = (char.traits ?? []).includes(trait.id);
                const { allowed, reasons } = canTakeTrait(char, trait);
                // Selected traits are always tappable (to deselect). Others need to pass.
                const disabled = !selected && !allowed;
                const reasonText = reasons.filter(r => r !== 'Already selected').join(' · ');
                return (
                  <TouchableOpacity
                    key={trait.id}
                    disabled={disabled}
                    style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: selected ? colors.primary + '88' : colors.border, backgroundColor: selected ? colors.primary + '11' : colors.secondary, opacity: disabled ? 0.45 : 1, gap: 4 }}
                    onPress={() => toggleTrait(trait.id)}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: selected ? colors.primary : colors.foreground, flex: 1 }}>{trait.name}</Text>
                      {selected
                        ? <Feather name="check-circle" size={18} color={colors.primary} />
                        : <Feather name={disabled ? 'lock' : 'circle'} size={18} color={colors.mutedForeground} />}
                    </View>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{trait.description}</Text>
                    {(trait.allowedRaces || trait.excludedRaces) && (
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                        {trait.allowedRaces ? `${trait.allowedRaces.join(' / ')} only` : `Not for: ${trait.excludedRaces!.join(' / ')}`}
                      </Text>
                    )}
                    {disabled && reasonText.length > 0 && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: colors.destructive }}>🔒 {reasonText}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* ── EQUIPMENT ── */}
          {activeTab === 5 && (
            <>
              {/* Hand slots (dual wield) */}
              {(() => {
                const bothCrippled = armStatus.left && armStatus.right;
                const leftW = allWeapons.find(w => w.id === char.leftHandWeaponId);
                const rightW = allWeapons.find(w => w.id === char.rightHandWeaponId);
                return (
                  <>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>WEAPONS — HAND SLOTS</Text>
                    {(bothCrippled || armStatus.left || armStatus.right) && (
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
                        {bothCrippled ? 'Both arms crippled — no weapons can be held.' : `${armStatus.left ? 'Left' : 'Right'} arm crippled — that hand can only hold a two-handed weapon with a sling.`}
                      </Text>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['left', 'right'] as const).map(hand => {
                        const w = hand === 'left' ? leftW : rightW;
                        const armCrippled = hand === 'left' ? armStatus.left : armStatus.right;
                        return (
                          <TouchableOpacity
                            key={hand}
                            style={{ flex: 1, padding: 12, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: armCrippled ? colors.destructive + '66' : colors.border }}
                            onPress={() => setHandPick(hand)}>
                            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{hand === 'left' ? 'LEFT HAND' : 'RIGHT HAND'}</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: w ? colors.foreground : colors.mutedForeground, marginTop: 4 }} numberOfLines={2}>{w?.name ?? 'None'}</Text>
                            {w && getWeaponHands(w) === 2 && <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary, marginTop: 2 }}>2-HANDED</Text>}
                            {w && (
                              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', marginTop: 2, color: armorSheet.effectiveSpecial.strength >= w.minStr ? '#4a8c3f' : colors.destructive }}>
                                STR REQ {armorSheet.effectiveSpecial.strength}/{w.minStr}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Carried weapons inventory */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CARRIED WEAPONS ({(char.inventoryWeaponIds ?? []).length}/5)</Text>
                      {(char.inventoryWeaponIds ?? []).length < 5 && (
                        <TouchableOpacity onPress={() => setShowInventoryPick(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '66' }}>
                          <Feather name="plus" size={12} color={colors.primary} />
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary }}>ADD</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {(char.inventoryWeaponIds ?? []).length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {(char.inventoryWeaponIds ?? []).map(wid => {
                          const iw = allWeapons.find(w => w.id === wid);
                          const equipped = char.leftHandWeaponId === wid || char.rightHandWeaponId === wid;
                          return (
                            <View key={wid} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 6, paddingVertical: 5, backgroundColor: equipped ? colors.primary + '1a' : colors.secondary, borderRadius: 14, borderWidth: 1, borderColor: equipped ? colors.primary + '66' : colors.border }}>
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: equipped ? colors.primary : colors.foreground }}>{iw?.name ?? wid}</Text>
                              <TouchableOpacity onPress={() => removeFromInventory(wid)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Feather name="x" size={13} color={colors.mutedForeground} />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                );
              })()}

              {[
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

              {/* Cumulative protection summary: AC + per-type DT/DR from armor,
                  helmet, natural/racial protection, shield mods on held weapons,
                  and defensive perks. */}
              {(() => {
                const body = armorSheet.bodyArmor ?? null;
                const helm = armorSheet.helmet ?? null;
                const natural = char.naturalProtection ?? race.naturalProtection ?? null;

                // ── Shield contributions from held weapons ─────────────────────
                // Deduplicate: if both hands hold the same weapon id (2-handed),
                // count its shield mods only once.
                const heldWeaponIds = new Set<string>();
                if (char.leftHandWeaponId) heldWeaponIds.add(char.leftHandWeaponId);
                if (char.rightHandWeaponId) heldWeaponIds.add(char.rightHandWeaponId);
                if (heldWeaponIds.size === 0 && char.equippedWeaponId) heldWeaponIds.add(char.equippedWeaponId);

                let shieldAC = 0;
                const shieldDT: Record<string, number> = { Normal: 0, Laser: 0, Fire: 0, Plasma: 0, Explosion: 0 };
                const shieldDR: Record<string, number> = { Normal: 0, Laser: 0, Fire: 0, Plasma: 0, Explosion: 0 };
                let hasShield = false;
                const shieldWeaponNames: string[] = [];
                for (const wid of Array.from(heldWeaponIds)) {
                  const w = allWeapons.find(x => x.id === wid);
                  if (!w) continue;
                  const fx = computeModEffects(w);
                  if (fx.acBonus) { shieldAC += fx.acBonus; hasShield = true; shieldWeaponNames.push(w.name); }
                  if (fx.shieldProtection) {
                    hasShield = true;
                    if (!shieldWeaponNames.includes(w.name)) shieldWeaponNames.push(w.name);
                    const sp = fx.shieldProtection;
                    shieldDT.Normal += sp.dtNormal; shieldDT.Laser += sp.dtLaser;
                    shieldDT.Fire += sp.dtFire; shieldDT.Plasma += sp.dtPlasma;
                    shieldDT.Explosion += sp.dtExplosion;
                    shieldDR.Normal += sp.drNormal; shieldDR.Laser += sp.drLaser;
                    shieldDR.Fire += sp.drFire; shieldDR.Plasma += sp.drPlasma;
                    shieldDR.Explosion += sp.drExplosion;
                  }
                }

                // ── Defensive perk bonuses (Dodger AC / Toughness DR etc.) ─────
                let perkAC = 0; let perkDR = 0;
                for (const cp of char.perks ?? []) {
                  const p = getPerkById(cp.perkId);
                  const fx = p?.combatEffect;
                  if (!fx) continue;
                  if (/HP\s*<\s*50%/i.test(fx.combatNote ?? '')) continue; // situational
                  if (fx.armorClassBonus) perkAC += fx.armorClassBonus * cp.rank;
                  if (fx.damageResistBonus) perkDR += fx.damageResistBonus * cp.rank;
                  if (p?.id === 'tough_hide') perkDR += 10 * cp.rank;
                }
                // Hide of Scars: +15%/rank to all resistances EXCEPT fire
                const hideOfScars = (char.perks ?? []).find(cp => cp.perkId === 'hide_of_scars');
                const hideOfScarsDR = hideOfScars ? 15 * hideOfScars.rank : 0;

                const types: { key: string; label: string }[] = [
                  { key: 'Normal', label: 'NORM' }, { key: 'Laser', label: 'LASER' },
                  { key: 'Fire', label: 'FIRE' }, { key: 'Plasma', label: 'PLASMA' },
                  { key: 'Explosion', label: 'EXPL' },
                ];
                const ac = armorSheet.armorClassBreakdown;
                const totalAC = armorSheet.armorClass + shieldAC;
                const acParts = [`AGI ${ac.agility}`];
                if (ac.racial) acParts.push(`${ac.racial >= 0 ? '+' : ''}${ac.racial} racial`);
                if (ac.trait) acParts.push(`${ac.trait >= 0 ? '+' : ''}${ac.trait} trait`);
                if (ac.natural) acParts.push(`${ac.natural >= 0 ? '+' : ''}${ac.natural} natural`);
                if (ac.manual) acParts.push(`${ac.manual >= 0 ? '+' : ''}${ac.manual} printed`);
                if (ac.bodyArmor) acParts.push(`+${ac.bodyArmor} body armor`);
                if (ac.helmet) acParts.push(`+${ac.helmet} helmet`);
                if (ac.perks) acParts.push(`+${ac.perks} perks`);
                if (ac.temporary) acParts.push(`${ac.temporary >= 0 ? '+' : ''}${ac.temporary} temporary`);
                if (ac.effects) acParts.push(`${ac.effects >= 0 ? '+' : ''}${ac.effects} effects`);
                if (ac.minimum) acParts.push(`+${ac.minimum} minimum`);
                if (shieldAC > 0) acParts.push(`+${shieldAC} shield`);
                return (
                  <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CUMULATIVE PROTECTION</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary }}>AC {totalAC}</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, flexShrink: 1 }}>{acParts.join(' ')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {types.map(t => {
                        const dt = ((body as any)?.[`dt${t.key}`] ?? 0) + ((helm as any)?.[`dt${t.key}`] ?? 0) + ((natural as any)?.[`dt${t.key}`] ?? 0) + shieldDT[t.key];
                        const dr = Math.min(90, ((body as any)?.[`dr${t.key}`] ?? 0) + ((helm as any)?.[`dr${t.key}`] ?? 0) + ((natural as any)?.[`dr${t.key}`] ?? 0) + shieldDR[t.key] + perkDR + (t.key !== 'Fire' ? hideOfScarsDR : 0));
                        return (
                          <View key={t.key} style={{ flexGrow: 1, minWidth: 58, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{t.label}</Text>
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>DT {dt}</Text>
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>DR {dr}%</Text>
                          </View>
                        );
                      })}
                    </View>
                    {armorSheet.armorEffects.sources.some(source => (
                      Object.values(source.effects.special ?? {}).some(Boolean)
                      || Object.values(source.effects.skills ?? {}).some(Boolean)
                      || !!source.effects.gasResistance
                      || !!source.effects.poisonResistance
                      || !!source.effects.radiationResistance
                      || !!source.effects.electricityResistance
                    )) && (
                      <View style={{ gap: 2 }}>
                        {armorSheet.armorEffects.sources.map(source => {
                          const effects = [
                            ...Object.entries(source.effects.special ?? {}).map(([key, value]) => `${SPECIAL_SHORT[key as keyof SPECIALStats]} ${Number(value) >= 0 ? '+' : ''}${value}`),
                            ...Object.entries(source.effects.skills ?? {}).map(([key, value]) => `${SKILL_LABELS[key as SkillType]} ${Number(value) >= 0 ? '+' : ''}${value}%`),
                            ...(['gasResistance', 'poisonResistance', 'radiationResistance', 'electricityResistance'] as const)
                              .filter(key => source.effects[key])
                              .map(key => `${key.replace('Resistance', '')} ${source.effects[key]! >= 0 ? '+' : ''}${source.effects[key]}%`),
                          ];
                          return effects.length > 0 ? <Text key={source.armorId} style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                            {source.slot === 'body' ? 'Body' : 'Helmet'} — {source.armorName}: {effects.join(' · ')}
                          </Text> : null;
                        })}
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                          Elemental resistance is capped at 100% (Gas {armorSheet.gasResistance}% · Poison {armorSheet.poisonResistance}% · Rad {armorSheet.radiationResistance}% · Elec {armorSheet.electricityResistance}%).
                        </Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, fontStyle: 'italic' }}>
                      Sources: equipment{hasShield ? ` + shield (${shieldWeaponNames.join(', ')})` : ''} + natural/racial protection{perkAC > 0 || perkDR > 0 ? ' + perks' : ''}. DR capped at 90%. Situational perk bonuses (e.g. HP &lt; 50%) apply in combat only.
                    </Text>
                  </View>
                );
              })()}
            </>
          )}

          {/* ── EFFECTS (injuries + chem effects) ── */}
          {activeTab === 6 && (
            <>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>INJURIES</Text>
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
                  <TextInput style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 10, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13 }} placeholder="Description (optional)" placeholderTextColor={colors.mutedForeground} value={injDesc} onChangeText={setInjDesc} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }} onPress={() => { setAddingInjury(false); setInjDesc(''); }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive }} onPress={() => {
                      const inj: Injury = {
                        id: genId(), location: injLocation, severity: 'crippled',
                        description: injDesc || `crippled ${injLocation}`,
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
                char.injuries.map(inj => {
                  const info = INJURY_LOCATION_INFO.find(l => l.location === inj.location);
                  return (
                    <View key={inj.id} style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: inj.isActive ? colors.destructive + '66' : colors.border, backgroundColor: colors.secondary, gap: 10 }}>
                      <TouchableOpacity onPress={() => setChar(c => ({ ...c, injuries: c.injuries.map(i => i.id === inj.id ? { ...i, isActive: !i.isActive } : i) }))} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: inj.isActive ? colors.destructive : colors.border, backgroundColor: inj.isActive ? colors.destructive + '33' : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                        {inj.isActive && <Feather name="check" size={12} color={colors.destructive} />}
                      </TouchableOpacity>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: inj.isActive ? colors.destructive : colors.mutedForeground }}>{info?.label ?? inj.location} — {inj.severity}</Text>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{inj.description}</Text>
                        {info && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 15 }}>{info.effectText}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => setChar(c => ({ ...c, injuries: c.injuries.filter(i => i.id !== inj.id) }))} style={{ padding: 4 }}>
                        <Feather name="x" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              {/* Computed mechanical effects (auto-applied in combat) */}
              {(() => {
                const eff = computeInjuryEffects(char);
                if (eff.notes.length === 0) return null;
                const agiChanged = eff.effectiveAgility !== char.special.agility;
                const peChanged = eff.effectivePerception !== char.special.perception;
                return (
                  <View style={{ backgroundColor: colors.destructive + '18', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive + '66', padding: 12, gap: 6, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="medkit" size={16} color={colors.destructive} />
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>ACTIVE COMBAT EFFECTS</Text>
                    </View>
                    {(agiChanged || peChanged) && (
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        {agiChanged && <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>AGI {char.special.agility} → <Text style={{ color: colors.destructive }}>{eff.effectiveAgility}</Text></Text>}
                        {peChanged && <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>PE {char.special.perception} → <Text style={{ color: colors.destructive }}>{eff.effectivePerception}</Text></Text>}
                      </View>
                    )}
                    {eff.notes.map((n, i) => (
                      <Text key={i} style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground }}>• {n}</Text>
                    ))}
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>These effects apply automatically in combat.</Text>
                  </View>
                );
              })()}

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginTop: 10, gap: 8 }}>
                {(char.traits ?? []).includes('night_person') && (
                  <View style={{ gap: 6, marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>NIGHT PERSON</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Choose the current period. Day applies −1 PER/INT; Night applies +1 PER/INT within racial bounds.</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['day', 'night'] as const).map(period => {
                        const selected = (char.nightPersonPeriod ?? 'day') === period;
                        return (
                          <TouchableOpacity
                            key={period}
                            accessibilityRole="button"
                            accessibilityLabel={`Night Person ${period}`}
                            onPress={() => setChar(c => ({ ...c, nightPersonPeriod: period }))}
                            style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 6, backgroundColor: selected ? colors.primary : colors.secondary, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                          >
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: selected ? colors.primaryForeground : colors.foreground }}>{period.toUpperCase()}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>CONDITIONS</Text>
                {CONDITION_DEFINITIONS.map(condition => {
                  const active = (char.conditions ?? []).includes(condition.id);
                  return (
                    <TouchableOpacity
                      key={condition.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${condition.name}: ${active ? 'active; tap to remove' : 'inactive; tap to activate'}`}
                      onPress={() => setChar(c => {
                        const currentlyActive = (c.conditions ?? []).includes(condition.id);
                        return {
                          ...c,
                          conditions: currentlyActive
                            ? (c.conditions ?? []).filter(id => id !== condition.id)
                            : [...(c.conditions ?? []), condition.id],
                        };
                      })}
                      style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: active ? colors.destructive + '88' : colors.border, backgroundColor: active ? colors.destructive + '14' : colors.secondary, gap: 3 }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: active ? colors.destructive : colors.foreground }}>{condition.name}</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: active ? colors.destructive : colors.mutedForeground }}>{active ? 'ACTIVE — REMOVE' : 'SET ACTIVE'}</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{condition.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── ACTIVE EFFECTS ── */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>ACTIVE EFFECTS</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <TouchableOpacity onPress={() => setChar(c => c.isKnockedOut
                    ? clearUnconsciousness(c)
                    : { ...setUnconsciousness(c), position: 'prone', currentAP: 0 }
                  )} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: char.isKnockedOut ? colors.destructive + '88' : colors.primary + '66' }}>
                    <Feather name={char.isKnockedOut ? 'x' : 'plus'} size={13} color={char.isKnockedOut ? colors.destructive : colors.primary} />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: char.isKnockedOut ? colors.destructive : colors.primary }}>{char.isKnockedOut ? 'REMOVE UNCONSCIOUS' : 'ADD UNCONSCIOUS'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowChemPick(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '66' }}>
                    <Feather name="plus" size={13} color={colors.primary} />
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary }}>ADD CHEM</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {char.isKnockedOut && (
                <View style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive + '88', backgroundColor: colors.destructive + '14', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.destructive, backgroundColor: colors.destructive + '33', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <Feather name="check" size={12} color={colors.destructive} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.destructive }}>Unconsciousness</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{char.knockOutRoundsLeft} round{char.knockOutRoundsLeft === 1 ? '' : 's'} remaining</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Cannot act in combat. The character remains prone after waking until they get up.</Text>
                    </View>
                    <TouchableOpacity accessibilityLabel="Remove unconsciousness" onPress={() => setChar(c => clearUnconsciousness(c))} style={{ padding: 4 }}>
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {radiationEffect && (
                <View style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive + '88', backgroundColor: colors.destructive + '14', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.destructive, backgroundColor: colors.destructive + '33', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <Feather name="alert-triangle" size={12} color={colors.destructive} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{radiationEffect.name}</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{radiationEffect.description}</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 0.5 }}>AUTOMATIC · CONTROLLED BY RADIATION LEVEL</Text>
                    </View>
                  </View>
                </View>
              )}

              {(char.effects ?? []).length === 0 && !char.isKnockedOut && !radiationEffect ? (
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>No active effects. Add unconsciousness or a chem for out-of-combat use.</Text>
              ) : (
                (char.effects ?? []).map(effect => {
                  const chem = effect.chemId ? getChem(effect.chemId) : undefined;
                  const hasNext = chem ? chemHasNextStage(effect, chem) : false;
                  const statParts: string[] = [];
                  if (effect.statMods) {
                    (Object.keys(effect.statMods) as (keyof SPECIALStats)[]).forEach(k => {
                      const v = effect.statMods![k];
                      if (typeof v === 'number' && v !== 0) statParts.push(`${SPECIAL_SHORT[k]} ${v > 0 ? '+' : ''}${v}`);
                    });
                  }
                  if (effect.apMod) statParts.push(`AP ${effect.apMod > 0 ? '+' : ''}${effect.apMod}`);
                  if (effect.acMod) statParts.push(`AC ${effect.acMod > 0 ? '+' : ''}${effect.acMod}`);
                  if (effect.drMod) statParts.push(`DR ${effect.drMod > 0 ? '+' : ''}${effect.drMod}%`);
                  if (effect.sequenceMod) statParts.push(`SEQ ${effect.sequenceMod > 0 ? '+' : ''}${effect.sequenceMod}`);
                  if (effect.radResistMod) statParts.push(`Rad Res ${effect.radResistMod > 0 ? '+' : ''}${effect.radResistMod}%`);
                  if (effect.hpMod) statParts.push(`HP ${effect.hpMod > 0 ? '+' : ''}${effect.hpMod}`);
                  return (
                    <View key={effect.id} style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: effect.isActive ? colors.primary + '66' : colors.border, backgroundColor: colors.secondary, gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <TouchableOpacity onPress={() => toggleEffectActive(effect.id)} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: effect.isActive ? colors.primary : colors.border, backgroundColor: effect.isActive ? colors.primary + '33' : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                          {effect.isActive && <Feather name="check" size={12} color={colors.primary} />}
                        </TouchableOpacity>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: effect.isActive ? colors.primary : colors.mutedForeground }}>{effect.poisonType ? poisonEffectName(effect.poisonType, effect.poisonCount) : effect.name}</Text>
                          {chem && chem.stages.length > 1 && effect.stage !== undefined && (
                            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.5 }}>STAGE {(effect.stage ?? 0) + 1}/{chem.stages.length} · {chem.stages[effect.stage ?? 0].label}</Text>
                          )}
                          {statParts.length > 0 && <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{statParts.join(' · ')}</Text>}
                          {(effect.notes ?? []).map((n, i) => (
                            <Text key={i} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>• {n}</Text>
                          ))}
                        </View>
                        <TouchableOpacity onPress={() => removeEffect(effect.id)} style={{ padding: 4 }}>
                          <Feather name="x" size={16} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                      {hasNext && (
                        <TouchableOpacity onPress={() => advanceEffect(effect.id)} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.background, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '55' }}>
                          <Feather name="skip-forward" size={12} color={colors.primary} />
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary }}>NEXT STAGE</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
        <ConfirmModal
          visible={pendingRadiation !== null}
          title="Apply Radiation Resistance?"
          message={`Effective radiation resistance is ${armorSheet.radiationResistance}%.`}
          cancelLabel="NO"
          confirmLabel="YES"
          onCancel={() => { if (pendingRadiation !== null) setChar(c => ({ ...c, accumulatedRadiation: adjustRadiation(c.accumulatedRadiation ?? 0, pendingRadiation) })); setPendingRadiation(null); setRadiationInput(''); }}
          onConfirm={() => { if (pendingRadiation !== null) setChar(c => ({ ...c, accumulatedRadiation: adjustRadiation(c.accumulatedRadiation ?? 0, resolveRadiationAddition(pendingRadiation, armorSheet.radiationResistance)) })); setPendingRadiation(null); setRadiationInput(''); }}
        />

        <ConfirmModal
          visible={perkRefundId !== null}
          title="REFUND PERK?"
          message={(() => {
            const owned = char.perks.find(p => p.perkId === perkRefundId);
            const perk = perkRefundId ? getPerkById(perkRefundId) : undefined;
            return `Remove all ${owned?.rank ?? 0} rank${(owned?.rank ?? 0) === 1 ? '' : 's'} of ${perk?.name ?? 'this perk'} and refund ${(owned?.rank ?? 0)} perk point${(owned?.rank ?? 0) === 1 ? '' : 's'}?`;
          })()}
          confirmLabel="REFUND ALL"
          onCancel={() => setPerkRefundId(null)}
          onConfirm={confirmPerkRefund}
        />

        {/* Equipment selection modals */}
        {/* Hand picker: only weapons already in inventory (or 2-handed with sling for crippled arms).
            Uses weapon-category grouping so the list is easy to scan. */}
        <SelectionModal
          visible={handPick !== null} onClose={() => setHandPick(null)}
          title={handPick === 'left' ? 'LEFT HAND WEAPON' : 'RIGHT HAND WEAPON'}
          items={handPick
            ? allWeapons.filter(w =>
                (char.inventoryWeaponIds ?? []).includes(w.id) && weaponLegalForHand(w, handPick)
              )
            : []
          }
          keyFn={w => w.id}
          onSelect={w => { if (handPick) equipHand(handPick, w); }}
          groupBy={w => w.category ?? ''}
          renderItem={w => (
            <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
              {w.name}{getWeaponHands(w) === 2 ? ' (2H)' : ''}
            </Text>
          )}
        />
        {/* Add Carried Weapon: full armory (minus already-carried), grouped by category */}
        <SelectionModal
          visible={showInventoryPick} onClose={() => setShowInventoryPick(false)} title="ADD CARRIED WEAPON"
          items={allWeapons.filter(w => !(char.inventoryWeaponIds ?? []).includes(w.id))} keyFn={w => w.id}
          onSelect={w => addToInventory(w)}
          groupBy={w => w.category ?? ''}
          renderItem={w => <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{w.name}</Text>}
        />
        <SelectionModal
          visible={showChemPick} onClose={() => setShowChemPick(false)} title="ADD CHEM EFFECT"
          items={CHEMS} keyFn={c => c.id}
          onSelect={c => { if (c) addChemEffect(c.id); }}
          renderItem={c => (
            <View>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{c.name}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }} numberOfLines={2}>{c.description}</Text>
            </View>
          )}
        />
        <SelectionModal
          visible={showBodyPick} onClose={() => setShowBodyPick(false)} title="SELECT BODY ARMOR"
          items={allArmor.filter(a => a.slot === 'body')} keyFn={a => a.id}
          onSelect={a => setChar(c => ({ ...c, equippedBodyArmorId: a?.id ?? undefined }))}
          renderItem={a => <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{a.name}</Text>}
        />
        <SelectionModal
          visible={showHelmetPick} onClose={() => setShowHelmetPick(false)} title="SELECT HELMET"
          items={allArmor.filter(a => a.slot === 'helmet')} keyFn={a => a.id}
          onSelect={a => setChar(c => ({ ...c, equippedHelmetId: a?.id ?? undefined }))}
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
function CharacterCard({ character, hardcoreRadiationRules, onEdit, onDelete, onClone, onBio, onToggleStorage, onResetHp, onMoveUp, onMoveDown, canMoveUp, canMoveDown, allWeapons, allArmor }: {
  character: Character; onEdit: () => void; onDelete: () => void; onClone: () => void;
  hardcoreRadiationRules: boolean;
  onBio: () => void; onToggleStorage: () => void; onResetHp: () => void;
  onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean;
  allWeapons: { id: string; name: string }[];
  allArmor: Armor[];
}) {
  const colors = useColors();
  const weapon = allWeapons.find(w => w.id === character.equippedWeaponId);
  const activeInjuries = (character.injuries ?? []).filter(i => i.isActive);
  const injuryEffects = computeInjuryEffects(character);
  const activeEffects = (character.effects ?? []).filter(e => e.isActive);
  const race = getRaceById(character.race) ?? RACES[0];
  const tagRules = calculateTagSkillRules(character.traits);
  const armorSheet = resolveArmorAwareSheet({
    special: character.special, skills: character.skills,
    taggedSkills: [...character.taggedSkills, ...tagRules.freeTagSkills],
    traits: character.traits, perks: character.perks, conditions: character.conditions, effects: character.effects,
    raceBounds: { min: race.specialMin, max: race.specialMax }, racialNaturalArmorClass: race.naturalACBonus,
    naturalArmorClass: character.naturalProtection?.armorClass,
    manualDerivedStats: character.manualDerivedStats,
    usesDerivedArmorClass: character.usesDerivedArmorClass,
    nightPersonPeriod: character.nightPersonPeriod, tempAC: character.tempAC,
    radiationResistance: character.radiationResistance, gasResistance: character.gasResistance,
    poisonResistance: character.poisonResistance, electricityResistance: character.electricityResistance,
    accumulatedRadiation: character.accumulatedRadiation, hardcoreRadiationRules,
    equippedBodyArmorId: character.equippedBodyArmorId, equippedHelmetId: character.equippedHelmetId, allArmor,
  });
  const effSpecial = armorSheet.effectiveSpecial;
  const conditionModifiers = computeConditionModifiers(character);
  const SPECIAL_ROW: [keyof typeof effSpecial, string][] = [
    ['strength', 'STR'], ['perception', 'PER'], ['endurance', 'END'], ['charisma', 'CHA'],
    ['intelligence', 'INT'], ['agility', 'AGI'], ['luck', 'LCK'],
  ];
  return (
    <TouchableOpacity style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: character.type === 'pc' ? colors.primary + '44' : colors.destructive + '44', padding: 14, gap: 10 }} onPress={onEdit} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CharacterAvatar portrait={character.portrait} name={character.name} size={48} fit={character.portraitFit ?? 'cover'} offset={character.portraitOffset} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{character.name}</Text>
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: character.type === 'pc' ? colors.primary + '33' : colors.destructive + '33', borderRadius: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: character.type === 'pc' ? colors.primary : colors.destructive }}>{character.type.toUpperCase()}</Text>
            </View>
            {activeInjuries.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.destructive + '22', borderRadius: 4, borderWidth: 1, borderColor: colors.destructive + '66' }}>
                <Ionicons name="medkit" size={11} color={colors.destructive} />
                <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{activeInjuries.length}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
            Lv {character.level} {character.race} · {weapon?.name ?? 'No weapon'}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            HP {character.currentHp}/{character.maxHp} · AC {armorSheet.armorClass} · AP {Math.min(character.currentAP, armorSheet.maxAP)}/{armorSheet.maxAP} · SEQ {armorSheet.sequence}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            Carry {armorSheet.carryWeight + computePerkDerivedBonuses(character.perks, character.level).carryWeight} lb
            {(character.traits ?? []).includes('night_person') ? ` · Night Person ${(character.nightPersonPeriod ?? 'day').toUpperCase()}` : ''}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: (character.accumulatedRadiation ?? 0) >= 200 ? colors.destructive : colors.mutedForeground }}>
            RAD {character.accumulatedRadiation ?? 0}/{MAX_RADIATION} · {radiationSicknessLabel(character.accumulatedRadiation ?? 0)}
          </Text>
          {hardcoreRadiationRules && hardcoreRadiationRule(character.accumulatedRadiation ?? 0).threshold > 0 && (
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive }}>
              {hardcoreRadiationRule(character.accumulatedRadiation ?? 0).fatal
                ? 'HARDCORE RULE: FATAL — INSTANT DEATH'
                : `HARDCORE PENALTIES: ${formatHardcoreRadiationPenalties(character.accumulatedRadiation ?? 0)}`}
            </Text>
          )}
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={onMoveUp} disabled={!canMoveUp} style={{ padding: 4, opacity: canMoveUp ? 1 : 0.25 }} accessibilityLabel="Move character up">
              <Feather name="chevron-up" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onMoveDown} disabled={!canMoveDown} style={{ padding: 4, opacity: canMoveDown ? 1 : 0.25 }} accessibilityLabel="Move character down">
              <Feather name="chevron-down" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onResetHp} style={{ padding: 4 }}><Ionicons name="heart-circle" size={16} color={character.currentHp < character.maxHp ? colors.destructive : colors.mutedForeground} /></TouchableOpacity>
          <TouchableOpacity onPress={onBio} style={{ padding: 4 }}><Feather name="book-open" size={16} color={colors.primary} /></TouchableOpacity>
          <TouchableOpacity onPress={onToggleStorage} style={{ padding: 4 }}>
            <Ionicons name={character.inStorage ? 'file-tray-full' : 'archive-outline'} size={16} color={character.inStorage ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClone} style={{ padding: 4 }}><Feather name="copy" size={16} color={colors.mutedForeground} /></TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>
        </View>
      </View>
      {/* Chosen traits */}
      {(character.traits?.length ?? 0) > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {character.traits!.map(tid => {
            const trait = getTraitById(tid);
            if (!trait) return null;
            return (
              <View key={tid} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.primary + '1a', borderRadius: 4, borderWidth: 1, borderColor: colors.primary + '55' }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>{trait.name}</Text>
              </View>
            );
          })}
        </View>
      )}
      {/* SPECIAL row — chem-boosted stats render green (may exceed racial max) */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {SPECIAL_ROW.map(([key, label]) => {
          const delta = effSpecial[key] - character.special[key];
          const color = delta > 0 ? '#4a8c3f' : delta < 0 ? colors.destructive : colors.foreground;
          return (
            <View key={key} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 4, backgroundColor: colors.secondary, borderWidth: 1, borderColor: delta !== 0 ? color + '88' : colors.border }}>
              <Text style={{ fontSize: 8, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{label}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color }}>{effSpecial[key]}</Text>
            </View>
          );
        })}
      </View>
      {conditionModifiers.active.length > 0 && (
        <View style={{ backgroundColor: colors.destructive + '14', borderRadius: 8, borderWidth: 1, borderColor: colors.destructive + '44', padding: 8, gap: 2 }}>
          {conditionModifiers.active.map(condition => (
            <Text key={condition.id} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
              {condition.name} — {condition.description}
            </Text>
          ))}
        </View>
      )}
      {/* Active chem effects — shown like injuries, in green */}
      {activeEffects.length > 0 && (
        <View style={{ backgroundColor: '#4a8c3f14', borderRadius: 8, borderWidth: 1, borderColor: '#4a8c3f44', padding: 8, gap: 2 }}>
          {activeEffects.map(e => {
            const bits: string[] = [];
            for (const [k, v] of Object.entries(e.statMods ?? {})) if (v) bits.push(`${k.slice(0, 3).toUpperCase()} ${(v as number) > 0 ? '+' : ''}${v}`);
            if (e.acMod) bits.push(`AC ${e.acMod > 0 ? '+' : ''}${e.acMod}`);
            if (e.drMod) bits.push(`DR ${e.drMod > 0 ? '+' : ''}${e.drMod}%`);
            if (e.apMod) bits.push(`AP ${e.apMod > 0 ? '+' : ''}${e.apMod}`);
            if (e.sequenceMod) bits.push(`SEQ ${e.sequenceMod > 0 ? '+' : ''}${e.sequenceMod}`);
            return (
              <Text key={e.id} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>
                ⚗ {e.poisonType ? poisonEffectName(e.poisonType, e.poisonCount) : e.name}{bits.length ? ` — ${bits.join(', ')}` : ''}
              </Text>
            );
          })}
        </View>
      )}
      {/* Injury effect notes on the sheet */}
      {injuryEffects.notes.length > 0 && (
        <View style={{ backgroundColor: colors.destructive + '14', borderRadius: 8, borderWidth: 1, borderColor: colors.destructive + '44', padding: 8, gap: 2 }}>
          {injuryEffects.notes.map((n, i) => (
            <Text key={i} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>✚ {n}</Text>
          ))}
        </View>
      )}
      <HPBar current={character.currentHp} max={character.maxHp} height={4} showText={false} />
    </TouchableOpacity>
  );
}

// ─── Characters Screen ────────────────────────────────────────────────────────
export default function CharactersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { characters, addCharacter, updateCharacter, deleteCharacter, cloneCharacter, moveCharacter, healCharacter, allWeapons, allArmor, hardcoreRadiationRules, setHardcoreRadiationRules } = useApp();
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [showPremades, setShowPremades] = useState(false);
  const [bioChar, setBioChar] = useState<Character | null>(null);
  const [showStorage, setShowStorage] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [showHardcoreWarning, setShowHardcoreWarning] = useState(false);
  const [showHardcorePreview, setShowHardcorePreview] = useState(false);

  const matchesSearch = (c: Character) => !search || c.name.toLowerCase().includes(search.toLowerCase());
  const active = characters.filter(c => !c.inStorage && matchesSearch(c));
  const stored = characters.filter(c => c.inStorage && matchesSearch(c));
  const filtered = active;

  const toggleStorage = (c: Character) => {
    updateCharacter({ ...c, inStorage: !c.inStorage });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resetHp = (c: Character) => {
    if (isHealingBlocked(c)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    healCharacter(c.id, c.maxHp);
    updateCharacter({ ...c, currentHp: c.maxHp, isKnockedOut: false, knockOutRoundsLeft: 0 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resetAllHp = () => {
    characters.forEach(c => {
      if (!isHealingBlocked(c) && (c.currentHp !== c.maxHp || c.isKnockedOut)) {
        updateCharacter({ ...c, currentHp: c.maxHp, isKnockedOut: false, knockOutRoundsLeft: 0 });
      }
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const renderCharacterCard = (item: Character, visibleCharacters: Character[]) => {
    const index = visibleCharacters.findIndex(character => character.id === item.id);
    const move = (target: Character | undefined) => {
      if (!target) return;
      moveCharacter(item.id, target.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };
    return (
      <CharacterCard
        key={item.id}
        character={item}
        allWeapons={allWeapons}
        allArmor={allArmor}
        hardcoreRadiationRules={hardcoreRadiationRules}
        onEdit={() => { setEditingChar(item); setShowForm(true); }}
        onBio={() => setBioChar(item)}
        onToggleStorage={() => toggleStorage(item)}
        onResetHp={() => resetHp(item)}
        onDelete={() => setDeleteTarget(item)}
        onClone={() => { cloneCharacter(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        onMoveUp={() => move(visibleCharacters[index - 1])}
        onMoveDown={() => move(visibleCharacters[index + 1])}
        canMoveUp={index > 0}
        canMoveDown={index >= 0 && index < visibleCharacters.length - 1}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      {/* Header */}
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>CHARACTERS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive + '66' }} onPress={resetAllHp}>
              <Ionicons name="heart-circle" size={14} color={colors.destructive} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>RESET HP</Text>
            </TouchableOpacity>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: hardcoreRadiationRules ? colors.destructive : colors.border }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Review Hardcore radiation thresholds. Currently ${hardcoreRadiationRules ? 'enabled' : 'disabled'}`}
            accessibilityHint="Opens an explanation without changing the campaign setting"
            accessibilityState={{ expanded: showHardcorePreview }}
            testID="hardcore-radiation-preview"
            onPress={() => setShowHardcorePreview(true)}
            style={{ flex: 1, padding: 12 }}
          >
            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>HARDCORE RADIATION PENALTIES</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Optional campaign-wide SPECIAL penalties</Text>
              <Feather name="info" size={12} color={colors.primary} />
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>REVIEW</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel="Enable Hardcore radiation penalties"
            accessibilityHint="Applies optional campaign-wide SPECIAL penalties"
            accessibilityState={{ checked: hardcoreRadiationRules }}
            accessibilityValue={{ text: hardcoreRadiationRules ? 'Enabled' : 'Disabled' }}
            onPress={() => hardcoreRadiationRules ? setHardcoreRadiationRules(false) : setShowHardcoreWarning(true)}
            style={{ padding: 12 }}
          >
            <View style={{ width: 42, height: 24, borderRadius: 12, padding: 3, backgroundColor: hardcoreRadiationRules ? colors.destructive : colors.border, alignItems: hardcoreRadiationRules ? 'flex-end' : 'flex-start' }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' }} />
            </View>
          </TouchableOpacity>
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
          renderItem={({ item }) => renderCharacterCard(item, active)}
          ListFooterComponent={stored.length > 0 ? (
            <View style={{ marginTop: 18, gap: 10 }}>
              <TouchableOpacity onPress={() => setShowStorage(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="file-tray-full" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>STORAGE ({stored.length})</Text>
                </View>
                <Feather name={showStorage ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showStorage && stored.map(item => renderCharacterCard(item, stored))}
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

      {/* Delete confirmation (cross-platform) */}
      <ConfirmModal
        visible={showHardcoreWarning}
        title="OPTIONAL HARDCORE RULES"
        message="Hardcore radiation penalties are optional house rules separate from Fallout PnP 2.0. Enabling them applies campaign-wide SPECIAL penalties based on current radiation; 1000 radiation is displayed as fatal/instant death."
        confirmLabel="ENABLE"
        onCancel={() => setShowHardcoreWarning(false)}
        onConfirm={() => { setHardcoreRadiationRules(true); setShowHardcoreWarning(false); }}
      />

      <HardcoreRadiationPreviewModal
        visible={showHardcorePreview}
        enabled={hardcoreRadiationRules}
        onClose={() => setShowHardcorePreview(false)}
      />

      <ConfirmModal
        visible={deleteTarget !== null}
        title="DELETE CHARACTER"
        message={`Delete ${deleteTarget?.name ?? 'this character'}? This cannot be undone.`}
        confirmLabel="DELETE"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteCharacter(deleteTarget.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          setDeleteTarget(null);
        }}
      />
    </View>
  );
}
