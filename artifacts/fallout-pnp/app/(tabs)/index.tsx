import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Character, Injury, Weapon, InitiativeEntry, DAMAGE_TYPE_LABELS, NaturalProtection, DamageType, PositionType } from '@/context/types';
import CharacterAvatar from '@/components/CharacterAvatar';
import HPBar from '@/components/HPBar';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { CRITICAL_HIT_RANGED, CRITICAL_HIT_MELEE, CRITICAL_FAILURE_TABLE, AIMED_SHOT_CRIT_BONUS } from '@/data/criticals';
import { PERKS, getPerkById } from '@/data/perks';
import { AP_COSTS } from '@/data/apCosts';
import { isMeleeWeapon, CONDITION_MAX, computeModBonuses } from '@/data/weapons';
import { calcCriticalChance, calcMeleeDamageBonus, calcSequence } from '@/data/derived';
import { applyProtection } from '@/data/armor';
import { getRaceById } from '@/data/races';

// ─── Dice helpers ─────────────────────────────────────────────────────────────
function rollD10() { return Math.floor(Math.random() * 10) + 1; }
function rollDie(sides: number) { return Math.floor(Math.random() * sides) + 1; }
function digitVal(face: number) { return face === 10 ? 0 : face; }
function percentileRoll(tens: number, units: number) { return digitVal(tens) * 10 + digitVal(units); }
function genId() { return Date.now().toString() + Math.random().toString(36).substr(2, 9); }

// ─── Modifier tables ──────────────────────────────────────────────────────────
const LIGHT_OPTIONS = [
  { label: 'Clear day / Well-lit building', value: 0 },
  { label: 'Light clouds', value: 5 },
  { label: 'Medium clouds', value: 10 },
  { label: 'Heavy clouds', value: 15 },
  { label: 'Medium-lit building', value: 20 },
  { label: 'Light rain or dust', value: 30 },
  { label: 'Medium rain or dust', value: 40 },
  { label: 'Bad light indoors', value: 50 },
  { label: 'Heavy rain or dust', value: 60 },
  { label: 'Downpour / Cave with torch', value: 80 },
  { label: 'Blizzard / Hurricane', value: 150 },
  { label: 'Total darkness', value: 200 },
];

interface TargetedOption { label: string; ranged: number; melee: number; key: string; }
const TARGETED_OPTIONS: TargetedOption[] = [
  { label: 'None',       ranged: 0,  melee: 0,  key: 'none' },
  { label: 'Torso',      ranged: 0,  melee: 0,  key: 'torso' },
  { label: 'Legs',       ranged: 20, melee: 10, key: 'legs' },
  { label: 'Arms/Groin', ranged: 30, melee: 15, key: 'arms' },
  { label: 'Head',       ranged: 40, melee: 20, key: 'head' },
  { label: 'Eyes',       ranged: 60, melee: 30, key: 'eyes' },
];

const POSITION_OPTIONS = [
  { label: 'Standing', bonus: 0 },
  { label: 'Crouching', bonus: 10 },
  { label: 'Prone', bonus: 25 },
];

const RANGED_SKILLS = new Set(['smallGuns', 'bigGuns', 'energyWeapons']);

const DAMAGE_TYPE_ORDER: DamageType[] = ['normal', 'laser', 'fire', 'plasma', 'explosion'];

// Combined DT/DR from armor pieces + natural protection for a given damage type
function combinedProtectionFor(
  dmgType: DamageType,
  bodyArmor: { [k: string]: any } | null,
  helmet: { [k: string]: any } | null,
  natural: NaturalProtection | null | undefined,
): { dt: number; dr: number } {
  const cap = dmgType.charAt(0).toUpperCase() + dmgType.slice(1);
  const dtField = `dt${cap}`;
  const drField = `dr${cap}`;
  const dt = ((bodyArmor?.[dtField] as number) ?? 0)
    + ((helmet?.[dtField] as number) ?? 0)
    + ((natural?.[dtField as keyof NaturalProtection] as number) ?? 0);
  const dr = Math.min(90, ((bodyArmor?.[drField] as number) ?? 0)
    + ((helmet?.[drField] as number) ?? 0)
    + ((natural?.[drField as keyof NaturalProtection] as number) ?? 0));
  return { dt, dr };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShotResult {
  index: number; chanceToHit: number; penalty: number;
  roll: number | null; hit: boolean; margin: number; cpsEarned: number;
  isCrit: boolean; isCritFail: boolean;
}
interface ShotDamage {
  shotIndex: number; baseRolls: number[]; baseDmg: number; cpRolls: number[];
  cpBonusDmg: number; combinedDT: number; combinedDR: number; finalDmg: number; critMultiplier: number;
  meleeDmgBonus: number; afterDT: number;
}

// ─── Perk Bonuses Computed ────────────────────────────────────────────────────
interface PerkBonus {
  toHit: number;
  damage: number;
  critChance: number;
  critDamageMult: number;
  allHitsAreCrits: boolean;
  ignoreDT: number;
  apDiscount: number;
  lightReduction: number; // Night Vision: reduce light penalty %
  notes: string[];
}

function computePerkBonuses(char: Character | null, weapon: Weapon | null, isRanged: boolean): PerkBonus {
  const result: PerkBonus = {
    toHit: 0, damage: 0, critChance: 0, critDamageMult: 1.0,
    allHitsAreCrits: false, ignoreDT: 0, apDiscount: 0, lightReduction: 0, notes: [],
  };
  if (!char || !char.perks) return result;

  for (const cp of char.perks) {
    const perk = getPerkById(cp.perkId);
    if (!perk || !perk.combatEffect) continue;
    const fx = perk.combatEffect;
    const rank = cp.rank;

    if (fx.toHitBonus) { result.toHit += fx.toHitBonus * rank; result.notes.push(`${perk.name}: +${fx.toHitBonus * rank}% to-hit`); }
    if (isRanged) {
      if (fx.rangedToHitBonus) { result.toHit += fx.rangedToHitBonus * rank; result.notes.push(`${perk.name}: +${fx.rangedToHitBonus * rank}% ranged to-hit`); }
      if (weapon?.skill === 'smallGuns' && fx.smallGunsToHitBonus) { result.toHit += fx.smallGunsToHitBonus * rank; result.notes.push(`${perk.name}: +${fx.smallGunsToHitBonus * rank}% Small Guns`); }
      if (fx.rangedDamageBonus) { result.damage += fx.rangedDamageBonus * rank; result.notes.push(`${perk.name}: +${fx.rangedDamageBonus * rank} ranged dmg`); }
    } else {
      if (fx.meleeToHitBonus) { result.toHit += fx.meleeToHitBonus * rank; result.notes.push(`${perk.name}: +${fx.meleeToHitBonus * rank}% melee to-hit`); }
      if (fx.meleeDamageBonus) { result.damage += fx.meleeDamageBonus * rank; result.notes.push(`${perk.name}: +${fx.meleeDamageBonus * rank} melee dmg`); }
      if (fx.allHitsAreCrits) { result.allHitsAreCrits = true; result.notes.push(`${perk.name}: all hits are crits`); }
      if (fx.ignoreDT) { result.ignoreDT += fx.ignoreDT * rank; result.notes.push(`${perk.name}: ignore ${fx.ignoreDT * rank} DT`); }
    }
    if (fx.damageBonus) { result.damage += fx.damageBonus * rank; result.notes.push(`${perk.name}: +${fx.damageBonus * rank} all dmg`); }
    if (fx.critChanceBonus) { result.critChance += fx.critChanceBonus * rank; }
    if (fx.critDamageMultiplier) { result.critDamageMult = Math.max(result.critDamageMult, fx.critDamageMultiplier); }
    if (fx.attackAPDiscount) { result.apDiscount += fx.attackAPDiscount * rank; }
    if (perk.id === 'night_vision' && fx.combatNote) { result.lightReduction += 20 * rank; result.notes.push(`${perk.name}: −${20 * rank}% light penalty`); }

    // Adrenaline Rush
    if (fx.adrenalineRushActive && char.currentHp < char.maxHp / 2) {
      result.notes.push(`${perk.name}: active (+${fx.adrenalineStrBonus ?? 1} STR)`);
    }
  }
  return result;
}

// ─── Animated Die Face ────────────────────────────────────────────────────────
function DieFace({ face, rolling, label, highlight, hit }: {
  face: number | null; rolling: boolean; label: string; highlight?: boolean; hit?: boolean;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (rolling) {
      scale.value = withSequence(
        withTiming(1.18, { duration: 80 }), withTiming(0.88, { duration: 80 }),
        withTiming(1.1, { duration: 60 }), withTiming(1, { duration: 60 }),
      );
    }
  }, [face, rolling]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const displayVal = face !== null ? digitVal(face) : null;
  const faceColor = hit === true ? '#4a8c3f' : hit === false ? colors.destructive : (highlight && face !== null ? colors.primary : colors.border);

  return (
    <Animated.View style={animStyle}>
      <View style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: highlight && face !== null ? `${colors.primary}22` : colors.secondary, borderColor: rolling ? colors.primary : faceColor }}>
        <Text style={{ fontSize: 26, fontFamily: 'Inter_700Bold', color: face !== null ? (hit === true ? '#4a8c3f' : hit === false ? colors.destructive : colors.primary) : colors.mutedForeground, lineHeight: 30 }}>
          {displayVal !== null ? String(displayVal) : '?'}
        </Text>
        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: -2 }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
function Stepper({ value, step = 1, min = -999, max = 999, onChange, formatValue }: {
  value: number; step?: number; min?: number; max?: number;
  onChange: (v: number) => void; formatValue?: (v: number) => string;
}) {
  const colors = useColors();
  const fmt = formatValue ?? (v => v >= 0 ? `+${v}` : `${v}`);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => onChange(Math.max(min, value - step))}>
        <Feather name="minus" size={14} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: value === 0 ? colors.mutedForeground : value > 0 ? '#4a8c3f' : colors.destructive, minWidth: 44, textAlign: 'center' }}>{fmt(value)}</Text>
      <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => onChange(Math.min(max, value + step))}>
        <Feather name="plus" size={14} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Chance-to-Hit Badge ──────────────────────────────────────────────────────
function ChanceToHitBadge({ value, label }: { value: number; label?: string }) {
  const colors = useColors();
  const color = value >= 60 ? '#4a8c3f' : value >= 35 ? colors.primary : colors.destructive;
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      {label && <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 }}>{label}</Text>}
      <View style={{ borderWidth: 2, borderColor: color, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center', minWidth: 80 }}>
        <Text style={{ fontSize: 36, fontFamily: 'Inter_700Bold', color, lineHeight: 42 }}>{value}</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color, letterSpacing: 1 }}>%</Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 4, fontStyle: 'italic' }}>roll ≤ this</Text>
    </View>
  );
}

// ─── Formula Line ─────────────────────────────────────────────────────────────
function FormulaLine({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: color ?? colors.foreground }}>{value}</Text>
    </View>
  );
}

// ─── Character Picker Modal ───────────────────────────────────────────────────
function CharacterPickerModal({ visible, onClose, onSelect, title, characters, allWeapons }: {
  visible: boolean; onClose: () => void; onSelect: (id: string) => void;
  title: string; characters: Character[]; allWeapons: Weapon[];
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ maxHeight: '80%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          {characters.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>No characters yet. Add them in the Characters tab.</Text>
            </View>
          ) : (
            <FlatList data={characters} keyExtractor={c => c.id} renderItem={({ item: c }) => {
              const weapon = allWeapons.find(w => w.id === c.equippedWeaponId);
              const ammoState = c.weaponAmmoStates?.find(a => a.weaponId === c.equippedWeaponId);
              return (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { onSelect(c.id); onClose(); }}>
                  <CharacterAvatar portrait={c.portrait} name={c.name} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{c.name}</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                      AC {c.armorClass + (c.tempAC ?? 0)} · HP {c.currentHp}/{c.maxHp} · AP {c.currentAP ?? c.maxAP}/{c.maxAP}
                      {weapon ? ` · ${weapon.name}` : ''}
                      {weapon && weapon.magazineSize > 0 ? ` [${ammoState?.currentAmmo ?? weapon.magazineSize}/${weapon.magazineSize}]` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: c.type === 'pc' ? colors.primary : colors.destructive }}>{c.type.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Light Picker Modal ───────────────────────────────────────────────────────
function LightPickerModal({ visible, value, onChange, onClose }: {
  visible: boolean; value: number; onChange: (v: number) => void; onClose: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ maxHeight: '75%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>LIGHT CONDITIONS</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <FlatList data={LIGHT_OPTIONS} keyExtractor={o => String(o.value)}
            renderItem={({ item }) => (
              <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: value === item.value ? colors.primary + '22' : 'transparent' }} onPress={() => { onChange(item.value); onClose(); }}>
                <Text style={{ fontSize: 14, fontFamily: value === item.value ? 'Inter_600SemiBold' : 'Inter_400Regular', color: value === item.value ? colors.primary : colors.foreground, flex: 1 }}>{item.label}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: item.value === 0 ? '#4a8c3f' : colors.destructive, marginLeft: 8 }}>{item.value === 0 ? '0%' : `−${item.value}%`}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Critical Hit Result Card ─────────────────────────────────────────────────
function CritResultCard({ result, damage, onApplyInjury, onKnockDown }: {
  result: typeof CRITICAL_HIT_RANGED[0]; damage: number;
  onApplyInjury?: () => void; onKnockDown?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ backgroundColor: colors.primary + '22', borderRadius: colors.radius, padding: 12, borderWidth: 2, borderColor: colors.primary, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="zap" size={18} color={colors.primary} />
        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>CRITICAL HIT — {result.name.toUpperCase()}</Text>
      </View>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{result.description}</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.primary + '33', borderRadius: 4 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary }}>×{result.damageMultiplier} damage</Text>
        </View>
        {result.knockDown && <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.destructive + '33', borderRadius: 4 }}><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>KNOCKDOWN</Text></View>}
        {result.knockOut && <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#f59e0b33', borderRadius: 4 }}><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#f59e0b' }}>STUN {result.knockOutRounds}rnd</Text></View>}
        {result.blindTarget && <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.destructive + '33', borderRadius: 4 }}><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>BLINDED</Text></View>}
        {result.instantKill && <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.destructive, borderRadius: 4 }}><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' }}>INSTANT KILL</Text></View>}
      </View>
      {result.injuryLocation && onApplyInjury && (
        <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={onApplyInjury}>
          <Feather name="alert-triangle" size={14} color="#fff" />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 1 }}>APPLY {result.injuryLocation.toUpperCase()} INJURY</Text>
        </TouchableOpacity>
      )}
      {result.knockDown && onKnockDown && (
        <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.primary + '44', borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={onKnockDown}>
          <Feather name="chevrons-down" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>SET DEFENDER PRONE</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Critical Failure Card ────────────────────────────────────────────────────
function CritFailCard({ result, onApplyEffect }: {
  result: typeof CRITICAL_FAILURE_TABLE[0]; onApplyEffect?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ backgroundColor: colors.destructive + '22', borderRadius: colors.radius, padding: 12, borderWidth: 2, borderColor: colors.destructive, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="alert-octagon" size={18} color={colors.destructive} />
        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>CRITICAL FAILURE — {result.name.toUpperCase()}</Text>
      </View>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{result.description}</Text>
      {result.selfDamage && (
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.destructive + '33', borderRadius: 4, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{result.selfDamage} self-damage</Text>
        </View>
      )}
      {onApplyEffect && (
        <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={onApplyEffect}>
          <Feather name="zap" size={14} color="#fff" />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 1 }}>APPLY EFFECT</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Knockdown Result Card ────────────────────────────────────────────────────
function KnockdownCard({ damage, defenderStr, defenderEnd, onProne }: {
  damage: number; defenderStr: number; defenderEnd: number; onProne: () => void;
}) {
  const colors = useColors();
  const threshold = defenderStr * 2;
  const triggered = damage >= threshold;
  const resistChance = Math.min(95, defenderEnd * 5);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const resisted = rollResult !== null ? rollResult <= resistChance : null;

  return (
    <View style={{ backgroundColor: triggered ? '#f59e0b22' : colors.secondary, borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: triggered ? '#f59e0b66' : colors.border, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Feather name="chevrons-down" size={16} color={triggered ? '#f59e0b' : colors.mutedForeground} />
        <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: triggered ? '#f59e0b' : colors.mutedForeground, letterSpacing: 1 }}>
          KNOCKDOWN CHECK {triggered ? '— TRIGGERED' : `— NOT triggered (need ${threshold} dmg, got ${damage})`}
        </Text>
      </View>
      {triggered && (
        <>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
            Damage {damage} ≥ STR×2 ({threshold}). Defender must roll END check.
            Resist chance: {resistChance}% (END {defenderEnd} × 5)
          </Text>
          <TouchableOpacity
            style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: '#f59e0b', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setRollResult(Math.floor(Math.random() * 100) + 1); }}
          >
            <Feather name="refresh-cw" size={14} color="#f59e0b" />
            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#f59e0b' }}>ROLL END CHECK (d100)</Text>
          </TouchableOpacity>
          {rollResult !== null && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
                Roll: <Text style={{ fontFamily: 'Inter_700Bold', color: resisted ? '#4a8c3f' : colors.destructive }}>{rollResult}</Text>
                {' vs '}{resistChance}% → {resisted ? 'RESISTED (stays standing)' : 'KNOCKED DOWN — set to PRONE'}
              </Text>
              {!resisted && (
                <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: '#f59e0b', flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={onProne}>
                  <Feather name="chevrons-down" size={14} color="#000" />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 1 }}>SET PRONE</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Main Combat Screen ───────────────────────────────────────────────────────
export default function CombatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { characters, allWeapons, allArmor, applyDamage, spendAmmo, reloadWeapon, jamWeapon, setPosition, addInjury, updateCharacter, spendAP,
    initiativeEntries, currentRound, combatActive, activeEntryId,
    startCombat, endCombat, addInitiativeEntry, removeInitiativeEntry, moveInitiativeEntry, nextTurn, nextRound,
  } = useApp();

  // Round tracker
  const [showRoundTracker, setShowRoundTracker] = useState(false);
  const [showInitSetup, setShowInitSetup] = useState(false);
  const [initRolls, setInitRolls] = useState<Record<string, number>>({});

  // Combatants
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [defenderId, setDefenderId] = useState<string | null>(null);

  // Dice (standard percentile)
  const [tensFace, setTensFace] = useState<number | null>(null);
  const [unitsFace, setUnitsFace] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  // Burst
  const [isBurst, setIsBurst] = useState(false);
  const [burstMode, setBurstMode] = useState<'complex' | 'streamlined'>('streamlined');
  const [burstShots, setBurstShots] = useState(1);
  // Streamlined burst dice
  const [streamlinedDice, setStreamlinedDice] = useState<number[]>([]);
  const [streamlinedRolled, setStreamlinedRolled] = useState(false);

  // Double shot
  const [doubleShotActive, setDoubleShotActive] = useState(false);

  // Modifiers
  const [rangeMod, setRangeMod] = useState(0);
  const [lightPenalty, setLightPenalty] = useState(0);
  const [coverPenalty, setCoverPenalty] = useState(0);
  const [weaponBonus, setWeaponBonus] = useState(0);
  const [positionIdx, setPositionIdx] = useState(0);
  const [targetedIdx, setTargetedIdx] = useState(0);
  const [showLightPicker, setShowLightPicker] = useState(false);
  const [showModifiers, setShowModifiers] = useState(true);

  // Damage
  const [cpSpent, setCpSpent] = useState<number[]>([]);
  const [shotDamages, setShotDamages] = useState<(ShotDamage | null)[] | null>(null);
  const [damageApplied, setDamageApplied] = useState(false);

  // Crit / crit fail
  const [critResult, setCritResult] = useState<typeof CRITICAL_HIT_RANGED[0] | null>(null);
  const [critFailResult, setCritFailResult] = useState<typeof CRITICAL_FAILURE_TABLE[0] | null>(null);

  // AP spent flag
  const [apSpent, setApSpent] = useState(false);

  // Pickers
  const [showAttackerPicker, setShowAttackerPicker] = useState(false);
  const [showDefenderPicker, setShowDefenderPicker] = useState(false);
  const [showAddCombatantPicker, setShowAddCombatantPicker] = useState(false);
  const [showApActions, setShowApActions] = useState(false);

  // Non-storage characters — used for pickers and initiative setup
  const activeCharacters = characters.filter(c => !c.inStorage);

  // Derived values
  const attacker = characters.find(c => c.id === attackerId) ?? null;
  const defender = characters.find(c => c.id === defenderId) ?? null;
  const weapon = attacker?.equippedWeaponId ? allWeapons.find(w => w.id === attacker.equippedWeaponId) ?? null : null;
  const bodyArmor = defender?.equippedBodyArmorId ? allArmor.find(a => a.id === defender.equippedBodyArmorId) ?? null : null;
  const helmet = defender?.equippedHelmetId ? allArmor.find(a => a.id === defender.equippedHelmetId) ?? null : null;
  const isRanged = weapon ? RANGED_SKILLS.has(weapon.skill) : true;
  const isMelee = weapon ? isMeleeWeapon(weapon) : false;
  const positionBonus = isRanged ? POSITION_OPTIONS[positionIdx].bonus : 0;
  const targetedPenalty = isRanged ? TARGETED_OPTIONS[targetedIdx].ranged : TARGETED_OPTIONS[targetedIdx].melee;
  // Include tagged skill +20 bonus in base skill
  const rawBaseSkill = (attacker && weapon) ? (attacker.skills as any)[weapon.skill] ?? 0 : 0;
  const isTaggedSkill = weapon ? (attacker?.taggedSkills ?? []).includes(weapon.skill as any) : false;
  const baseSkill = rawBaseSkill + (isTaggedSkill ? 20 : 0);

  // Perk bonuses
  const perkBonuses = computePerkBonuses(attacker, weapon, isRanged);

  // Auto-computed weapon-mod bonuses (to-hit, damage, range) from equipped weapon's mods
  const modBonuses = weapon ? computeModBonuses(weapon.mods ?? []) : { toHit: 0, damage: 0, range: 0 };

  // Effective weapon range: base rangeNormal + mod range bonuses
  const effectiveRange = weapon ? weapon.rangeNormal + modBonuses.range : 0;

  // Defender natural protection (creatures like Deathclaws)
  const defenderNatural: NaturalProtection | null = defender
    ? (defender.naturalProtection ?? getRaceById(defender.race)?.naturalProtection ?? null)
    : null;

  // Effective defender AC (with tempAC)
  const defenderAC = defender ? (defender.armorClass + (defender.tempAC ?? 0)) : 0;

  // Injury to-hit penalty on attacker
  const attackerInjuryPenalty = attacker?.injuries?.filter(i => i.isActive).reduce((s, inj) => s + inj.toHitPenalty, 0) ?? 0;

  // Light penalty after Night Vision perk
  const effectiveLightPenalty = Math.max(0, lightPenalty - perkBonuses.lightReduction);

  // STR requirement penalty
  const strReqPenalty = (attacker && weapon) ? (attacker.special && attacker.special.strength < weapon.minStr ? (weapon.minStr - attacker.special.strength) * 20 : 0) : 0;

  // Ammo state
  const ammoState = (attacker && weapon) ? attacker.weaponAmmoStates?.find(a => a.weaponId === weapon.id) : null;
  const currentAmmo = ammoState?.currentAmmo ?? (weapon?.magazineSize ?? 0);
  const conditionBoxes = ammoState?.conditionBoxes ?? CONDITION_MAX;
  const hasAmmo = !weapon || weapon.magazineSize === 0 || currentAmmo > 0;

  // ─── Weapon condition modifier ───────────────────────────────────────────────
  // conditionBoxes counts REMAINING good boxes (CONDITION_MAX = pristine).
  // jamWeapon decrements it. Manual intervals (mapped onto CONDITION_MAX scale):
  //   full → −1 damaged box  : 0% penalty
  //   2 damaged boxes        : −10% to hit
  //   fully damaged (0 boxes): weapon jammed / broken (cannot fire)
  const damagedBoxes = Math.max(0, CONDITION_MAX - conditionBoxes);
  const weaponBroken = !!weapon && conditionBoxes <= 0;
  const conditionPenalty = weaponBroken ? 0 : (damagedBoxes >= CONDITION_MAX - 1 ? 10 : 0);

  // CtH formula (weapon-mod to-hit auto-included; condition penalty auto-included)
  const computeCtH = (extraBurstPenalty: number) =>
    Math.max(1, Math.min(99,
      baseSkill
      + rangeMod
      - effectiveLightPenalty
      - defenderAC
      - coverPenalty
      + weaponBonus
      + modBonuses.toHit
      - conditionPenalty
      + positionBonus
      - targetedPenalty
      + extraBurstPenalty
      + perkBonuses.toHit
      - attackerInjuryPenalty
      - strReqPenalty
    ));

  // Double shot: single shot, range −3
  const effectiveBurstShots = doubleShotActive ? 1 : (isBurst && weapon && weapon.burstLimit > 1 ? burstShots : 1);
  const burstPenalties = Array.from({ length: effectiveBurstShots }, (_, i) => i === 0 ? 0 : -i * 10);
  const shotChances = burstPenalties.map(p => computeCtH(p));

  const rollTotal = (tensFace !== null && unitsFace !== null) ? percentileRoll(tensFace, unitsFace) : null;

  // Crit chance
  const baseCritChance = attacker?.special ? calcCriticalChance(attacker.special) : 0;
  const aimCritBonus = AIMED_SHOT_CRIT_BONUS[TARGETED_OPTIONS[targetedIdx].key] ?? 0;
  const totalCritChance = baseCritChance + aimCritBonus + perkBonuses.critChance;

  // Shot results
  const shotResults: ShotResult[] = shotChances.map((cth, i) => {
    const roll = rollTotal;
    const hit = roll !== null && roll <= cth;
    const isCrit = hit && (roll !== null && roll <= totalCritChance || perkBonuses.allHitsAreCrits);
    const isCritFail = !hit && roll !== null && roll >= 97;
    const margin = (roll !== null && hit) ? cth - roll : 0;
    const cpsEarned = hit ? Math.floor(margin / 10) : 0;
    return { index: i, chanceToHit: cth, penalty: burstPenalties[i], roll, hit, margin, cpsEarned, isCrit, isCritFail };
  });

  const canRoll = !!(attacker && defender && weapon);

  // AP cost for this attack
  const baseAPCost = doubleShotActive ? AP_COSTS.ATTACK_DOUBLE_SHOT : isBurst ? AP_COSTS.ATTACK_BURST : targetedIdx > 0 ? AP_COSTS.ATTACK_AIMED : AP_COSTS.ATTACK_SINGLE;
  const effectiveAPCost = Math.max(1, baseAPCost - perkBonuses.apDiscount);
  const attackerHasAP = (attacker?.currentAP ?? 0) >= effectiveAPCost;

  // Streamlined burst params
  const roundedCtH = (() => {
    const cth = shotChances[0];
    if (!weapon) return cth;
    const isMinigun = weapon.burstLimit >= 10;
    if (burstShots <= 5 || isMinigun) return Math.ceil(cth / 10) * 10;
    return Math.floor(cth / 10) * 10;
  })();
  const streamlinedHitThreshold = Math.floor(roundedCtH / 10);

  // Reset on combatant/weapon change
  useEffect(() => {
    setCpSpent(shotResults.map(() => 0));
    setShotDamages(null);
    setDamageApplied(false);
    setCritResult(null);
    setCritFailResult(null);
    setApSpent(false);
    setStreamlinedDice([]);
    setStreamlinedRolled(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tensFace, unitsFace, attackerId, defenderId, isBurst, burstShots, burstMode, doubleShotActive,
      rangeMod, lightPenalty, coverPenalty, weaponBonus, positionIdx, targetedIdx]);

  useEffect(() => {
    setIsBurst(false); setBurstShots(1); setPositionIdx(0); setTargetedIdx(0);
    setDoubleShotActive(false); setStreamlinedDice([]); setStreamlinedRolled(false);
  }, [attackerId]);

  // Clear attacker/defender if the selected character was moved to storage
  useEffect(() => {
    if (attackerId && !characters.some(c => c.id === attackerId && !c.inStorage)) setAttackerId(null);
    if (defenderId && !characters.some(c => c.id === defenderId && !c.inStorage)) setDefenderId(null);
  }, [characters, attackerId, defenderId]);

  // Auto-switch the attacker to the active initiative entry's character while combat is active.
  // The user can still manually change the attacker afterwards.
  useEffect(() => {
    if (!combatActive || !activeEntryId) return;
    const activeEntry = initiativeEntries.find(e => e.id === activeEntryId);
    const cid = activeEntry?.characterId;
    if (cid && cid !== attackerId && characters.some(c => c.id === cid && !c.inStorage)) {
      setAttackerId(cid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntryId, combatActive]);

  // Prevent the same character being both attacker and defender.
  useEffect(() => {
    if (attackerId && defenderId && attackerId === defenderId) setDefenderId(null);
  }, [attackerId, defenderId]);

  const rollDice = useCallback(() => {
    if (weaponBroken) {
      if (Platform.OS === 'web') { alert('Weapon jammed/broken! Repair before firing.'); }
      else Alert.alert('Weapon Broken', 'This weapon is jammed/broken and cannot fire until repaired.');
      return;
    }
    if (!hasAmmo) {
      if (Platform.OS === 'web') { alert('Empty Magazine! Reload before firing.'); }
      else Alert.alert('Empty Magazine', 'No ammo remaining. Reload first!', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reload (2 AP)', onPress: () => { if (attacker && weapon) { reloadWeapon(attacker.id, weapon.id); spendAP(attacker.id, AP_COSTS.RELOAD); } } },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRolling(true);
    const t = rollD10(); const u = rollD10();
    setTensFace(t); setUnitsFace(u);
    setShotDamages(null); setDamageApplied(false);
    setCritResult(null); setCritFailResult(null);
    setApSpent(false);
    const roll = percentileRoll(t, u);

    // Spend ammo
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, 1);
    }

    // Crit check
    const hitSuccess = roll <= shotChances[0];
    if (hitSuccess) {
      const isCrit = roll <= totalCritChance || perkBonuses.allHitsAreCrits;
      if (isCrit) {
        const critTable = isMelee ? CRITICAL_HIT_MELEE : CRITICAL_HIT_RANGED;
        const critRoll = rollD10();
        const result = critTable.find(r => r.roll === critRoll) ?? critTable[0];
        setCritResult(result);
      }
    } else if (roll >= 97) {
      // Critical failure
      const failRoll = rollD10();
      const failResult = CRITICAL_FAILURE_TABLE.find(r => r.roll === failRoll) ?? CRITICAL_FAILURE_TABLE[0];
      setCritFailResult(failResult);
      // Handle jam
      if ((failResult.effect === 'jam' || failResult.effect === 'catastrophic') && attacker && weapon) {
        jamWeapon(attacker.id, weapon.id);
      }
    }

    setTimeout(() => setRolling(false), 350);
  }, [weaponBroken, hasAmmo, attacker, weapon, shotChances, totalCritChance, isMelee, perkBonuses, spendAmmo, jamWeapon, spendAP, reloadWeapon]);

  const rollStreamlined = useCallback(() => {
    if (weaponBroken) {
      Alert.alert('Weapon Broken', 'This weapon is jammed/broken and cannot fire until repaired.');
      return;
    }
    if (!hasAmmo) {
      Alert.alert('Empty Magazine', 'No ammo remaining. Reload first!');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const dice = Array.from({ length: burstShots }, () => Math.floor(Math.random() * 10));
    setStreamlinedDice(dice);
    setStreamlinedRolled(true);
    setShotDamages(null); setDamageApplied(false); setApSpent(false);
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, burstShots);
    }
  }, [weaponBroken, hasAmmo, attacker, weapon, burstShots, spendAmmo]);

  const toggleCPSpent = useCallback((shotIdx: number, delta: number) => {
    setCpSpent(prev => {
      const next = [...prev];
      const maxCp = shotResults[shotIdx]?.cpsEarned ?? 0;
      next[shotIdx] = Math.max(0, Math.min(maxCp, (next[shotIdx] ?? 0) + delta));
      return next;
    });
    setShotDamages(null); setDamageApplied(false);
  }, [shotResults]);

  const calculateDamage = useCallback(() => {
    if (!weapon || shotResults.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const halfDie = Math.ceil(weapon.damageDie / 2);
    // Combined DT/DR from armor + defender natural protection (DT adds, DR sums capped at 90%)
    const prot = combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural);
    const combinedDT = Math.max(0, prot.dt - perkBonuses.ignoreDT);
    const combinedDR = prot.dr;

    // Melee/unarmed damage bonus from STR + race bonus (e.g. Deathclaw +5)
    const raceMeleeBonus = isMelee ? (getRaceById(attacker?.race ?? '')?.bonusMeleeDamage ?? 0) : 0;
    const meleeDmgBonus = (isMelee && attacker?.special ? calcMeleeDamageBonus(attacker.special) : 0) + raceMeleeBonus;

    const damages = shotResults.map((shot, i) => {
      if (!shot.hit) return null;
      const critMult = shot.isCrit ? (critResult?.damageMultiplier ?? 1) * perkBonuses.critDamageMult : 1;
      const baseRolls = Array.from({ length: doubleShotActive ? weapon.damageDieCount * 2 : weapon.damageDieCount }, () => rollDie(weapon.damageDie));
      const rawBaseDmg = Math.round((baseRolls.reduce((a, b) => a + b, 0) + weapon.damageBonus + meleeDmgBonus + modBonuses.damage + perkBonuses.damage) * critMult);
      const cps = cpSpent[i] ?? 0;
      const cpRolls = Array.from({ length: cps }, () => rollDie(halfDie));
      const cpBonusDmg = cpRolls.reduce((a, b) => a + b, 0);
      const baseDmg = rawBaseDmg + cpBonusDmg;
      // Apply DT first, then DR: finalDmg = max(0, (baseDmg − DT) × (1 − DR/100))
      const afterDT = Math.max(0, baseDmg - combinedDT);
      const finalDmg = applyProtection(baseDmg, combinedDT, combinedDR);
      return { shotIndex: i, baseRolls, baseDmg: rawBaseDmg, cpRolls, cpBonusDmg, combinedDT, combinedDR, finalDmg, critMultiplier: critMult, meleeDmgBonus, afterDT };
    });
    setShotDamages(damages); setDamageApplied(false);
  }, [weapon, shotResults, cpSpent, bodyArmor, helmet, defenderNatural, critResult, doubleShotActive, isMelee, attacker, perkBonuses, modBonuses]);

  const totalDamage = shotDamages ? shotDamages.reduce((s, d) => s + (d?.finalDmg ?? 0), 0) : 0;

  const handleApplyDamage = useCallback(() => {
    if (!defender || totalDamage === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    applyDamage(defender.id, totalDamage);
    setDamageApplied(true);
  }, [defender, totalDamage, applyDamage]);

  const handleSpendAP = useCallback(() => {
    if (!attacker) return;
    spendAP(attacker.id, effectiveAPCost);
    setApSpent(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [attacker, effectiveAPCost, spendAP]);

  const handleReload = useCallback(() => {
    if (!attacker || !weapon) return;
    reloadWeapon(attacker.id, weapon.id);
    spendAP(attacker.id, AP_COSTS.RELOAD);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [attacker, weapon, reloadWeapon, spendAP]);

  // Spend AP on a movement/position action, auto-applying position when relevant.
  const handleApAction = useCallback((cost: number, newPosition?: PositionType) => {
    if (!attacker) return;
    const ok = spendAP(attacker.id, cost);
    if (!ok) {
      if (Platform.OS === 'web') alert(`Not enough AP (need ${cost}).`);
      else Alert.alert('Not Enough AP', `This action needs ${cost} AP; ${attacker.name} has ${attacker.currentAP}.`);
      return;
    }
    if (newPosition) setPosition(attacker.id, newPosition);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [attacker, spendAP, setPosition]);

  // Display-level DT/DR (before calculateDamage is called) — armor + natural protection
  const displayProt = weapon ? combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural) : { dt: 0, dr: 0 };
  const combinedDT = displayProt.dt;
  const combinedDR = displayProt.dr;

  // Compact DT/DR summary across all damage types for the defender info panel
  const defenderProtSummary = DAMAGE_TYPE_ORDER.map(dt => {
    const p = combinedProtectionFor(dt, bodyArmor as any, helmet as any, defenderNatural);
    return `${DAMAGE_TYPE_LABELS[dt]} ${p.dt}/${p.dr}%`;
  }).join('  ');

  // Streamlined burst hit results
  const streamlinedHits = streamlinedDice.filter(d => d <= streamlinedHitThreshold && d > 0).length;
  const streamlinedMisses = streamlinedDice.length - streamlinedHits;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>COMBAT CALCULATOR</Text>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: colors.radius, backgroundColor: combatActive ? '#4a8c3f33' : colors.secondary, borderWidth: 1, borderColor: combatActive ? '#4a8c3f' : colors.border }} onPress={() => setShowRoundTracker(v => !v)}>
            <Feather name="clock" size={13} color={combatActive ? '#4a8c3f' : colors.mutedForeground} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: combatActive ? '#4a8c3f' : colors.mutedForeground }}>
              {combatActive ? `R${currentRound}` : 'ROUNDS'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 0.5, marginBottom: 4 }}>Fallout PnP · Base − Range − Light − AC − Cover ± Mods − Shot</Text>

        {/* ─── Round Tracker ─── */}
        {showRoundTracker && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: combatActive ? '#4a8c3f88' : colors.border, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>ROUND TRACKER</Text>
                {combatActive && <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>Round {currentRound}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {combatActive && (
                  <>
                    <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: colors.primary, flexDirection: 'row', gap: 5, alignItems: 'center' }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); nextTurn(); }}>
                      <Feather name="chevrons-right" size={14} color={colors.primaryForeground} />
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>END TURN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.destructive + '88' }} onPress={() => { endCombat(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>END</Text>
                    </TouchableOpacity>
                  </>
                )}
                {!combatActive && (
                  <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: colors.primary, flexDirection: 'row', gap: 5, alignItems: 'center' }} onPress={() => setShowInitSetup(true)}>
                    <Feather name="play" size={13} color={colors.primaryForeground} />
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>START COMBAT</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Setup modal inline */}
            {showInitSetup && !combatActive && (
              <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>SET INITIATIVE ROLLS</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Sequence = PER×2. Roll 1d10 and add Sequence for initiative. Unspent AP → tempAC each turn.</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: colors.radius, backgroundColor: colors.primary }} onPress={() => {
                  const rolls: Record<string, number> = {};
                  activeCharacters.filter(c => c.currentHp > 0).forEach(c => {
                    const seq = c.sequence ?? c.special.perception * 2;
                    rolls[c.id] = Math.floor(Math.random() * 10) + 1 + seq;
                  });
                  setInitRolls(rolls);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}>
                  <Feather name="refresh-cw" size={14} color={colors.primaryForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primaryForeground }}>ROLL ALL (1d10 + SEQ)</Text>
                </TouchableOpacity>
                {activeCharacters.filter(c => c.currentHp > 0).map(c => (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CharacterAvatar portrait={c.portrait} name={c.name} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>{c.name}</Text>
                      <Text style={{ fontSize: 10, color: colors.mutedForeground }}>SEQ {c.sequence ?? c.special.perception * 2} · HP {c.currentHp}/{c.maxHp} · AP {c.maxAP}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setInitRolls(prev => ({ ...prev, [c.id]: Math.max(0, (prev[c.id] ?? 10) - 1) }))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{initRolls[c.id] ?? 10}</Text>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setInitRolls(prev => ({ ...prev, [c.id]: Math.min(50, (prev[c.id] ?? 10) + 1) }))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                    </View>
                    <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => {
                      const seq = c.sequence ?? c.special.perception * 2;
                      const roll = Math.floor(Math.random() * 10) + 1;
                      setInitRolls(prev => ({ ...prev, [c.id]: roll + seq }));
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}>
                      <Feather name="refresh-cw" size={12} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }} onPress={() => setShowInitSetup(false)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 2, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: '#4a8c3f', flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={() => {
                    const entries: InitiativeEntry[] = activeCharacters.filter(c => c.currentHp > 0).map(c => ({
                      id: `init-${c.id}`,
                      characterId: c.id,
                      name: c.name,
                      initiative: initRolls[c.id] ?? 10,
                      sequence: c.sequence ?? c.special.perception * 2,
                      maxHp: c.maxHp,
                      currentHp: c.currentHp,
                      maxAP: c.maxAP,
                      currentAP: c.maxAP,
                      armorClass: c.armorClass,
                      tempAC: 0,
                      position: c.position,
                      isActive: false,
                      hasActed: false,
                    }));
                    if (entries.length > 0) { startCombat(entries); setShowInitSetup(false); setInitRolls({}); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
                  }}>
                    <Feather name="play" size={14} color="#fff" />
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' }}>BEGIN COMBAT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Active combatants */}
            {combatActive && initiativeEntries.map((entry, idx) => {
              const isActive = entry.id === activeEntryId;
              const entryChar = characters.find(c => c.id === entry.characterId);
              return (
                <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: isActive ? '#4a8c3f' : colors.border, backgroundColor: isActive ? '#4a8c3f11' : colors.secondary, gap: 8 }}>
                  {isActive && <Feather name="chevron-right" size={14} color="#4a8c3f" />}
                  <CharacterAvatar portrait={entryChar?.portrait} name={entry.name} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: isActive ? 'Inter_700Bold' : 'Inter_500Medium', color: isActive ? '#4a8c3f' : colors.foreground }} numberOfLines={1}>{entry.name}</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      Init {entry.initiative} · HP {entry.currentHp}/{entry.maxHp} · AP {entry.currentAP}/{entry.maxAP}{entry.tempAC > 0 ? ` · +${entry.tempAC}AC` : ''}
                    </Text>
                  </View>
                  {entry.hasActed && <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>DONE</Text>}
                  <View style={{ flexDirection: 'column', gap: 2 }}>
                    <TouchableOpacity onPress={() => moveInitiativeEntry(entry.id, 'up')} disabled={idx === 0} style={{ padding: 2, opacity: idx === 0 ? 0.3 : 1 }}>
                      <Feather name="chevron-up" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveInitiativeEntry(entry.id, 'down')} disabled={idx === initiativeEntries.length - 1} style={{ padding: 2, opacity: idx === initiativeEntries.length - 1 ? 0.3 : 1 }}>
                      <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => removeInitiativeEntry(entry.id)} style={{ padding: 4 }}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add combatant during active combat */}
            {combatActive && (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed' }} onPress={() => setShowAddCombatantPicker(true)}>
                <Feather name="user-plus" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ADD COMBATANT</Text>
              </TouchableOpacity>
            )}

            {combatActive && (
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
                End Turn: leftover AP converts to +tempAC · Next round: AP replenishes, tempAC clears
              </Text>
            )}
          </View>
        )}

        {/* ─── Combatants ─── */}
        <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>COMBATANTS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Attacker */}
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: attacker ? colors.primary : colors.border, padding: 10, gap: 10, minHeight: 80 }} onPress={() => setShowAttackerPicker(true)}>
              {attacker ? (
                <>
                  <CharacterAvatar portrait={attacker.portrait} name={attacker.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>{attacker.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 1 }}>{weapon ? weapon.name : 'No weapon'}</Text>
                    {weapon && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Skill: {baseSkill}%{perkBonuses.toHit !== 0 ? ` (${perkBonuses.toHit >= 0 ? '+' : ''}${perkBonuses.toHit}% perks)` : ''}</Text>}
                    {weapon && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      Range: {effectiveRange} sq{modBonuses.range > 0 ? ` (${weapon.rangeNormal}+${modBonuses.range} mods)` : ''}
                    </Text>}
                    {weapon && weaponBroken && <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>⚠ JAMMED / BROKEN</Text>}
                    {attacker.special && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>AP {attacker.currentAP}/{attacker.maxAP}</Text>}
                    {/* Ammo display */}
                    {weapon && weapon.magazineSize > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: hasAmmo ? colors.primary : colors.destructive }}>
                          [{currentAmmo}/{weapon.magazineSize}]
                        </Text>
                        {/* Condition dots */}
                        {[...Array(CONDITION_MAX)].map((_, i) => (
                          <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i < conditionBoxes ? '#4a8c3f' : colors.destructive }} />
                        ))}
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Feather name="plus-circle" size={22} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Attacker</Text>
                </View>
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ATK</Text>
            </TouchableOpacity>

            <Feather name="arrow-right" size={20} color={colors.mutedForeground} />

            {/* Defender */}
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: defender ? colors.destructive : colors.border, padding: 10, gap: 10, minHeight: 80 }} onPress={() => setShowDefenderPicker(true)}>
              {defender ? (
                <>
                  <CharacterAvatar portrait={defender.portrait} name={defender.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>{defender.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive, marginTop: 1 }}>
                      AC: {defenderAC}{defender.tempAC > 0 ? ` (${defender.armorClass}+${defender.tempAC} temp)` : ''}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }} numberOfLines={2}>
                      {defenderProtSummary}
                    </Text>
                    {defenderNatural && <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.primary }}>incl. natural protection</Text>}
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Pos: {defender.position ?? 'standing'}</Text>
                  </View>
                </>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Feather name="plus-circle" size={22} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Defender</Text>
                </View>
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.destructive }}>DEF</Text>
            </TouchableOpacity>
          </View>
          {defender && <HPBar current={defender.currentHp} max={defender.maxHp} height={6} showText />}

          {/* AP Cost + Reload row */}
          {canRoll && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1, backgroundColor: colors.secondary, borderRadius: 6, padding: 8, borderWidth: 1, borderColor: attackerHasAP ? colors.primary + '44' : colors.destructive + '44' }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>AP COST</Text>
                <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: attackerHasAP ? colors.primary : colors.destructive }}>
                  {effectiveAPCost} AP {!attackerHasAP ? `(need ${effectiveAPCost}, have ${attacker?.currentAP ?? 0})` : ''}
                </Text>
              </View>
              {!apSpent && (
                <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: attackerHasAP ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.primary }} onPress={handleSpendAP}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: attackerHasAP ? colors.primaryForeground : colors.mutedForeground }}>SPEND AP</Text>
                </TouchableOpacity>
              )}
              {apSpent && <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: '#4a8c3f22', borderWidth: 1, borderColor: '#4a8c3f' }}><Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>✓ AP SPENT</Text></View>}
              {weapon && weapon.magazineSize > 0 && (
                <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={handleReload}>
                  <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>RELOAD</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Spend AP — movement & position actions */}
          {attacker && (
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => setShowApActions(v => !v)}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>SPEND AP — MOVE / POSITION</Text>
                <Feather name={showApActions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showApActions && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    {attacker.name} · Position: {(attacker.position ?? 'standing').toUpperCase()} · AP {attacker.currentAP}/{attacker.maxAP}
                  </Text>
                  {/* Movement */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {(() => {
                      const pos = attacker.position ?? 'standing';
                      const moveCost = pos === 'standing' ? AP_COSTS.WALK_1 : pos === 'crouching' ? AP_COSTS.CROUCH_1 : AP_COSTS.PRONE_1;
                      return (
                        <TouchableOpacity style={{ flexGrow: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={() => handleApAction(moveCost)}>
                          <Feather name="move" size={14} color={colors.primary} />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary }}>MOVE 1 HEX ({moveCost} AP)</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                  {/* Position transitions — context-appropriate */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {(attacker.position ?? 'standing') === 'standing' && (
                      <TouchableOpacity style={{ flexGrow: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => handleApAction(AP_COSTS.CHANGE_POSITION, 'crouching')}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>CROUCH ({AP_COSTS.CHANGE_POSITION} AP)</Text>
                      </TouchableOpacity>
                    )}
                    {(attacker.position ?? 'standing') === 'crouching' && (
                      <>
                        <TouchableOpacity style={{ flexGrow: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => handleApAction(AP_COSTS.CHANGE_POSITION, 'standing')}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>STAND ({AP_COSTS.CHANGE_POSITION} AP)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flexGrow: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => handleApAction(AP_COSTS.CHANGE_POSITION, 'prone')}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>PRONE ({AP_COSTS.CHANGE_POSITION} AP)</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {(attacker.position ?? 'standing') === 'prone' && (
                      <TouchableOpacity style={{ flexGrow: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => handleApAction(AP_COSTS.CHANGE_POSITION, 'crouching')}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>CROUCH ({AP_COSTS.CHANGE_POSITION} AP)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─── Burst / Double-Shot Mode ─── */}
        {canRoll && weapon && (weapon.burstLimit > 1 || weapon.isDoubleShot) && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>FIRE MODE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: !isBurst && !doubleShotActive ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => { setIsBurst(false); setDoubleShotActive(false); }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: !isBurst && !doubleShotActive ? colors.primaryForeground : colors.mutedForeground }}>SINGLE</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: !isBurst && !doubleShotActive ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>4 AP</Text>
              </TouchableOpacity>
              {weapon.burstLimit > 1 && (
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: isBurst ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => { setIsBurst(true); setDoubleShotActive(false); }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: isBurst ? colors.primaryForeground : colors.mutedForeground }}>BURST</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: isBurst ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>6 AP</Text>
                </TouchableOpacity>
              )}
              {weapon.isDoubleShot && (
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: doubleShotActive ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => { setDoubleShotActive(true); setIsBurst(false); }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: doubleShotActive ? colors.primaryForeground : colors.mutedForeground }}>DOUBLE</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: doubleShotActive ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>5 AP</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Burst sub-options */}
            {isBurst && (
              <>
                {/* Burst mode selector */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['streamlined', 'complex'] as const).map(mode => (
                    <TouchableOpacity key={mode} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: burstMode === mode ? colors.secondary : 'transparent', borderWidth: 1, borderColor: burstMode === mode ? colors.primary : colors.border }} onPress={() => setBurstMode(mode)}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: burstMode === mode ? colors.primary : colors.mutedForeground, letterSpacing: 0.5 }}>{mode === 'streamlined' ? 'STREAMLINED' : 'COMPLEX'}</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{mode === 'streamlined' ? 'Single roll' : 'Per shot'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Shot count */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }}>Shots:</Text>
                  <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setBurstShots(n => Math.max(1, n - 1))}><Feather name="minus" size={16} color={colors.foreground} /></TouchableOpacity>
                  <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 30, textAlign: 'center' }}>{burstShots}</Text>
                  <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setBurstShots(n => Math.min(weapon.burstLimit, n + 1))}><Feather name="plus" size={16} color={colors.foreground} /></TouchableOpacity>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>(max {weapon.burstLimit})</Text>
                </View>

                {burstMode === 'streamlined' && (
                  <View style={{ backgroundColor: colors.secondary, borderRadius: 6, padding: 8, gap: 4 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 0.5 }}>STREAMLINED: roll {burstShots}×d10</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      CtH {shotChances[0]}% → rounded to {roundedCtH}%
                      {burstShots <= 5 ? ' (≤5 shots: round up)' : weapon.burstLimit >= 10 ? ' (minigun: always round up)' : ' (>5 shots: round down)'}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
                      d10 result ≤ {streamlinedHitThreshold} = HIT
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ─── Chance to Hit ─── */}
        {canRoll && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>CHANCE TO HIT</Text>

            {isBurst && burstMode === 'streamlined' ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 8 }}>Rounded CtH for streamlined burst:</Text>
                <ChanceToHitBadge value={roundedCtH} label={`THRESHOLD: d10 ≤ ${streamlinedHitThreshold}`} />
              </View>
            ) : effectiveBurstShots === 1 ? (
              <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                <ChanceToHitBadge value={shotChances[0]} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingTop: 4 }}>
                {shotChances.map((cth, i) => <ChanceToHitBadge key={i} value={cth} label={`SHOT ${i + 1}${i > 0 ? ` (${burstPenalties[i]}%)` : ''}`} />)}
              </View>
            )}

            {/* Formula breakdown */}
            <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 }}>
              <FormulaLine label="Base skill" value={`${baseSkill}%`} color={colors.primary} />
              {rangeMod !== 0 && <FormulaLine label="Range modifier" value={`${rangeMod >= 0 ? '+' : ''}${rangeMod}%`} color={rangeMod > 0 ? '#4a8c3f' : colors.destructive} />}
              {effectiveLightPenalty !== 0 && <FormulaLine label={`Light penalty${perkBonuses.lightReduction > 0 ? ` (−${perkBonuses.lightReduction}% from perks)` : ''}`} value={`−${effectiveLightPenalty}%`} color={colors.destructive} />}
              <FormulaLine label="Armor Class" value={`−${defenderAC}%`} color={colors.destructive} />
              {defender?.tempAC && defender.tempAC > 0 ? <FormulaLine label="  (temp AC)" value={`+${defender.tempAC} from unspent AP`} color={colors.mutedForeground} /> : null}
              {coverPenalty !== 0 && <FormulaLine label="Cover penalty" value={`−${coverPenalty}%`} color={colors.destructive} />}
              {weaponBonus !== 0 && <FormulaLine label="Manual to-hit adjust" value={`${weaponBonus >= 0 ? '+' : ''}${weaponBonus}%`} color={weaponBonus > 0 ? '#4a8c3f' : colors.destructive} />}
              {modBonuses.toHit !== 0 && <FormulaLine label="Weapon mods (auto)" value={`${modBonuses.toHit >= 0 ? '+' : ''}${modBonuses.toHit}%`} color={modBonuses.toHit > 0 ? '#4a8c3f' : colors.destructive} />}
              {conditionPenalty > 0 && <FormulaLine label="Weapon condition" value={`−${conditionPenalty}%`} color={colors.destructive} />}
              {positionBonus !== 0 && <FormulaLine label={`Position (${POSITION_OPTIONS[positionIdx].label})`} value={`+${positionBonus}%`} color="#4a8c3f" />}
              {targetedPenalty !== 0 && <FormulaLine label={`Targeted (${TARGETED_OPTIONS[targetedIdx].label})`} value={`−${targetedPenalty}%`} color={colors.destructive} />}
              {perkBonuses.toHit !== 0 && <FormulaLine label="Perk to-hit bonus" value={`+${perkBonuses.toHit}%`} color="#4a8c3f" />}
              {attackerInjuryPenalty > 0 && <FormulaLine label="Injury penalty" value={`−${attackerInjuryPenalty}%`} color={colors.destructive} />}
              {strReqPenalty > 0 && <FormulaLine label="STR req penalty" value={`−${strReqPenalty}%`} color={colors.destructive} />}
              {isBurst && effectiveBurstShots > 1 && <FormulaLine label="Burst penalties" value={burstPenalties.slice(1).map(p => `${p}%`).join(', ')} color={colors.destructive} />}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
              <FormulaLine label="= Chance to Hit" value={`${shotChances[0]}%`} color={shotChances[0] >= 60 ? '#4a8c3f' : shotChances[0] >= 35 ? colors.primary : colors.destructive} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 2 }}>
                Crit chance: {totalCritChance}% (LCK/2 {baseCritChance}%{aimCritBonus > 0 ? ` + aimed ${aimCritBonus}%` : ''}{perkBonuses.critChance > 0 ? ` + perks ${perkBonuses.critChance}%` : ''})
              </Text>
            </View>

            {/* Perk bonuses summary */}
            {perkBonuses.notes.length > 0 && (
              <View style={{ backgroundColor: colors.secondary, borderRadius: 6, padding: 8, gap: 2 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#4a8c3f', letterSpacing: 1 }}>⚔ ACTIVE PERK BONUSES</Text>
                {perkBonuses.notes.map((n, i) => <Text key={i} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>• {n}</Text>)}
              </View>
            )}

            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>Roll d10×10 + d10. Roll at or below to hit.</Text>
          </View>
        )}

        {/* ─── Modifiers ─── */}
        {canRoll && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => setShowModifiers(v => !v)}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>MODIFIERS</Text>
              <Feather name={showModifiers ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showModifiers && (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>RANGE</Text><Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>+1% per sq close · −3% per sq far</Text></View>
                  <Stepper value={rangeMod} step={3} min={-99} max={99} onChange={setRangeMod} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>LIGHT</Text><Text numberOfLines={1} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{LIGHT_OPTIONS.find(o => o.value === lightPenalty)?.label ?? '—'}</Text></View>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 10, paddingVertical: 6 }} onPress={() => setShowLightPicker(true)}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: lightPenalty === 0 ? '#4a8c3f' : colors.destructive }}>{lightPenalty === 0 ? '0%' : `−${lightPenalty}%`}</Text>
                    <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>COVER</Text><Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>% of body concealed</Text></View>
                  <Stepper value={coverPenalty} step={5} min={0} max={100} onChange={setCoverPenalty} formatValue={v => v === 0 ? '0%' : `−${v}%`} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>MANUAL TO-HIT ADJUST</Text><Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>GM ad-hoc modifier</Text></View>
                  <Stepper value={weaponBonus} step={5} min={-50} max={50} onChange={setWeaponBonus} />
                </View>

                {/* Auto-computed weapon-mod to-hit (from equipped weapon's mods) */}
                {weapon && modBonuses.toHit !== 0 && (
                  <View style={{ backgroundColor: colors.secondary, borderRadius: 6, padding: 8 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>Weapon mods: {modBonuses.toHit >= 0 ? '+' : ''}{modBonuses.toHit}% to-hit (auto)</Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Computed from equipped weapon's mods — no manual entry needed.</Text>
                  </View>
                )}

                {/* Weapon condition modifier (manual intervals via condition boxes) */}
                {weapon && (
                  <View style={{ backgroundColor: colors.secondary, borderRadius: 6, padding: 8, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>WEAPON CONDITION</Text>
                      <View style={{ flexDirection: 'row', gap: 3 }}>
                        {[...Array(CONDITION_MAX)].map((_, i) => (
                          <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < conditionBoxes ? '#4a8c3f' : colors.destructive }} />
                        ))}
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: weaponBroken ? colors.destructive : conditionPenalty > 0 ? colors.destructive : '#4a8c3f' }}>
                      {weaponBroken ? '⚠ Jammed / broken — cannot fire until repaired' : conditionPenalty > 0 ? `Degraded: −${conditionPenalty}% to hit` : 'Good condition: 0% penalty'}
                    </Text>
                  </View>
                )}

                {isRanged && (
                  <View>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1, marginBottom: 6 }}>ATTACKER POSITION (no AP cost)</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {POSITION_OPTIONS.map((opt, i) => (
                        <TouchableOpacity key={i} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: positionIdx === i ? colors.primary : colors.secondary, borderWidth: 1, borderColor: positionIdx === i ? colors.primary : colors.border }} onPress={() => {
                          setPositionIdx(i);
                          const posMap: PositionType[] = ['standing', 'crouching', 'prone'];
                          if (attacker) setPosition(attacker.id, posMap[i]);
                        }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: positionIdx === i ? colors.primaryForeground : colors.mutedForeground }}>{opt.label.toUpperCase()}</Text>
                          {opt.bonus !== 0 && <Text style={{ fontSize: 10, color: positionIdx === i ? colors.primaryForeground + 'cc' : '#4a8c3f' }}>+{opt.bonus}%</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1, marginBottom: 6 }}>TARGETED SHOT</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {TARGETED_OPTIONS.map((opt, i) => {
                      const pen = isRanged ? opt.ranged : opt.melee;
                      return (
                        <TouchableOpacity key={i} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: targetedIdx === i ? colors.primary : colors.secondary, borderWidth: 1, borderColor: targetedIdx === i ? colors.primary : colors.border }} onPress={() => setTargetedIdx(i)}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: targetedIdx === i ? colors.primaryForeground : colors.foreground }}>{opt.label}</Text>
                          {pen !== 0 && <Text style={{ fontSize: 10, color: targetedIdx === i ? colors.primaryForeground + 'cc' : colors.destructive }}>−{pen}%</Text>}
                          {(AIMED_SHOT_CRIT_BONUS[opt.key] ?? 0) > 0 && <Text style={{ fontSize: 10, color: targetedIdx === i ? colors.primaryForeground + 'cc' : colors.primary }}>+{AIMED_SHOT_CRIT_BONUS[opt.key]}% crit</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ─── Dice Roll (Complex burst / Single) ─── */}
        {canRoll && (!isBurst || burstMode === 'complex' || !isBurst) && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>PERCENTILE ROLL (d10 × 10 + d10)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <DieFace face={tensFace} rolling={rolling} label="× 10" highlight />
                {tensFace !== null && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>= {digitVal(tensFace) * 10}</Text>}
              </View>
              <Text style={{ fontSize: 22, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>+</Text>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <DieFace face={unitsFace} rolling={rolling} label="units" />
                {unitsFace !== null && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>= {digitVal(unitsFace)}</Text>}
              </View>
              {rollTotal !== null && (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>=</Text>
                  <Text style={{ fontSize: 42, fontFamily: 'Inter_700Bold', color: colors.primary, lineHeight: 48 }}>{String(rollTotal).padStart(2, '0')}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 12, gap: 8, backgroundColor: canRoll ? colors.primary : colors.secondary, opacity: canRoll ? 1 : 0.5 }} onPress={rollDice} disabled={!canRoll}>
              <Feather name="refresh-cw" size={16} color={canRoll ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: canRoll ? colors.primaryForeground : colors.mutedForeground }}>ROLL DICE</Text>
            </TouchableOpacity>
            {!canRoll && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>Select an attacker with a weapon and a defender first.</Text>}
          </View>
        )}

        {/* ─── Streamlined Burst Dice ─── */}
        {canRoll && isBurst && burstMode === 'streamlined' && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>BURST DICE ROLL ({burstShots}× d10, hit if ≤ {streamlinedHitThreshold})</Text>
            {streamlinedDice.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {streamlinedDice.map((d, i) => {
                    const isHit = d > 0 && d <= streamlinedHitThreshold;
                    return <DieFace key={i} face={d === 0 ? 10 : d} rolling={false} label={`Die ${i+1}`} hit={isHit} />;
                  })}
                </View>
                <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#4a8c3f33', borderRadius: 6 }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>{streamlinedHits} HITS</Text>
                  </View>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.destructive + '33', borderRadius: 6 }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{streamlinedMisses} MISSES</Text>
                  </View>
                </View>
              </>
            )}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 12, gap: 8, backgroundColor: colors.primary }} onPress={rollStreamlined}>
              <Feather name="zap" size={16} color={colors.primaryForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primaryForeground }}>ROLL {burstShots} BURST DICE</Text>
            </TouchableOpacity>
            {streamlinedRolled && streamlinedHits > 0 && weapon && (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 12, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary }} onPress={() => {
                const burstProt = combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural);
                const burstDT = Math.max(0, burstProt.dt - perkBonuses.ignoreDT);
                const burstDR = burstProt.dr;
                const raceMeleeBonus = isMelee ? (getRaceById(attacker?.race ?? '')?.bonusMeleeDamage ?? 0) : 0;
                const meleeDmgBonus = (isMelee && attacker?.special ? calcMeleeDamageBonus(attacker.special) : 0) + raceMeleeBonus;
                const totalBurstDmg = Array.from({ length: streamlinedHits }, () => {
                  const rolls = Array.from({ length: weapon.damageDieCount }, () => rollDie(weapon.damageDie));
                  const raw = rolls.reduce((a, b) => a + b, 0) + weapon.damageBonus + meleeDmgBonus + modBonuses.damage + perkBonuses.damage;
                  return applyProtection(raw, burstDT, burstDR);
                }).reduce((a, b) => a + b, 0);
                if (defender) { applyDamage(defender.id, totalBurstDmg); Alert.alert('Burst Damage', `${streamlinedHits} hits dealt ${totalBurstDmg} total damage to ${defender.name}`); }
              }}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ROLL & APPLY {streamlinedHits} HIT DAMAGE</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── Shot Results (Complex/Single) ─── */}
        {rollTotal !== null && canRoll && (!isBurst || burstMode === 'complex') && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>SHOT RESULTS</Text>
            {shotResults.map((shot, i) => (
              <View key={i} style={{ paddingBottom: 10, borderBottomWidth: i < shotResults.length - 1 ? 1 : 0, borderBottomColor: colors.border, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: shot.hit ? '#4a8c3f' : colors.destructive }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: '#fff' }}>{shot.isCrit ? '⚡ CRIT' : shot.isCritFail ? '💀 FAIL' : shot.hit ? 'HIT' : 'MISS'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }}>
                      Shot {i + 1}{shot.penalty !== 0 && <Text style={{ color: colors.mutedForeground }}> ({shot.penalty}%)</Text>}
                      {'  '}
                      <Text style={{ color: colors.primary }}>{String(shot.roll ?? 0).padStart(2, '0')}</Text>
                      <Text style={{ color: colors.mutedForeground }}> vs </Text>
                      <Text style={{ color: shot.hit ? '#4a8c3f' : colors.destructive }}>{shot.chanceToHit}%</Text>
                    </Text>
                    {shot.hit && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 2 }}>Beat by {shot.margin}% → {shot.cpsEarned} Critical Point{shot.cpsEarned !== 1 ? 's' : ''}</Text>}
                  </View>
                </View>
                {shot.hit && shot.cpsEarned > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Spend CP:</Text>
                    <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => toggleCPSpent(i, -1)}><Feather name="minus" size={14} color={colors.foreground} /></TouchableOpacity>
                    <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 40, textAlign: 'center' }}>{cpSpent[i] ?? 0}/{shot.cpsEarned}</Text>
                    <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => toggleCPSpent(i, 1)}><Feather name="plus" size={14} color={colors.foreground} /></TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ─── Critical Hit ─── */}
        {critResult && (
          <CritResultCard
            result={critResult}
            damage={shotDamages?.find(d => d !== null)?.finalDmg ?? 0}
            onApplyInjury={defender && critResult.injuryLocation ? () => {
              const injury: Injury = {
                id: genId(), location: critResult.injuryLocation as any, severity: critResult.injurySeverity ?? 'crippled',
                description: critResult.name, toHitPenalty: critResult.blindTarget ? 40 : critResult.injuryLocation === 'rightArm' ? 20 : 0,
                skillPenalty: {}, movementPenalty: critResult.injuryLocation?.includes('Leg') ? 1 : 0,
                isActive: true, source: `Critical hit (${weapon?.name})`,
              };
              addInjury(defender.id, injury);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } : undefined}
            onKnockDown={defender && critResult.knockDown ? () => { setPosition(defender.id, 'prone'); } : undefined}
          />
        )}

        {/* ─── Critical Failure ─── */}
        {critFailResult && (
          <CritFailCard
            result={critFailResult}
            onApplyEffect={critFailResult.effect === 'prone' && attacker ? () => { setPosition(attacker.id, 'prone'); } : critFailResult.effect === 'selfHarm' && attacker ? () => {
              const selfDmg = Math.floor(Math.random() * 6) + 1;
              applyDamage(attacker.id, selfDmg);
              Alert.alert('Self Injury', `${attacker.name} took ${selfDmg} damage from critical failure!`);
            } : undefined}
          />
        )}

        {/* ─── Damage ─── */}
        {rollTotal !== null && shotResults.some(s => s.hit) && weapon && (!isBurst || burstMode === 'complex') && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>DAMAGE CALCULATION</Text>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                {doubleShotActive ? `Double-shot: ${weapon.damageDieCount * 2}` : weapon.damageDieCount}d{weapon.damageDie}{weapon.damageBonus > 0 ? `+${weapon.damageBonus}` : ''} · {weapon.damageType.toUpperCase()} · Crit die: d{Math.ceil(weapon.damageDie / 2)}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                DT {weapon ? DAMAGE_TYPE_LABELS[weapon.damageType] : ''}: {combinedDT}{perkBonuses.ignoreDT > 0 ? ` (−${perkBonuses.ignoreDT} ignored)` : ''} → effective {Math.max(0, combinedDT - perkBonuses.ignoreDT)}{combinedDR > 0 ? ` · DR ${combinedDR}%` : ''} — formula: max(0,(base−DT)×(1−DR%))
              </Text>
              {perkBonuses.damage > 0 && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>Perk damage bonus: +{perkBonuses.damage}</Text>}
            </View>

            {!shotDamages ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 12, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary }} onPress={calculateDamage}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ROLL DAMAGE{critResult ? ` (×${critResult.damageMultiplier} CRIT)` : ''}</Text>
              </TouchableOpacity>
            ) : (
              <>
                {shotDamages.map((dmg, i) => !dmg ? (
                  <View key={i} style={{ borderWidth: 1, borderRadius: colors.radius, padding: 10, borderColor: colors.border }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>Shot {i + 1}: MISS</Text>
                  </View>
                ) : (
                  <View key={i} style={{ borderWidth: 1, borderRadius: colors.radius, padding: 10, borderColor: colors.border, gap: 4 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>Shot {i + 1}{dmg.critMultiplier > 1 ? ` ⚡ ×${dmg.critMultiplier} CRIT` : ''}</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
                      Weapon dice: [{dmg.baseRolls.join(', ')}]{weapon.damageBonus > 0 ? ` +${weapon.damageBonus} wpn` : ''}
                      {dmg.meleeDmgBonus > 0 ? ` +${dmg.meleeDmgBonus} melee` : ''}{modBonuses.damage > 0 ? ` +${modBonuses.damage} mods` : ''}{perkBonuses.damage > 0 ? ` +${perkBonuses.damage} perks` : ''}{dmg.critMultiplier > 1 ? ` ×${dmg.critMultiplier}` : ''} = {dmg.baseDmg}
                    </Text>
                    {dmg.cpRolls.length > 0 && <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>CP bonus: [{dmg.cpRolls.join(', ')}] = +{dmg.cpBonusDmg}</Text>}
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>− DT {dmg.combinedDT} → {dmg.afterDT}</Text>
                    {dmg.combinedDR > 0 && <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>× (1 − DR {dmg.combinedDR}%) → {dmg.finalDmg}</Text>}
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: dmg.finalDmg > 0 ? colors.destructive : colors.mutedForeground }}>= {dmg.finalDmg} damage</Text>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>TOTAL DAMAGE</Text>
                  <Text style={{ fontSize: 36, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{totalDamage}</Text>
                </View>

                {/* Knockdown check (melee) */}
                {isMelee && defender?.special && totalDamage > 0 && (
                  <KnockdownCard
                    damage={totalDamage}
                    defenderStr={defender.special.strength}
                    defenderEnd={defender.special.endurance}
                    onProne={() => { setPosition(defender.id, 'prone'); }}
                  />
                )}

                {!damageApplied ? (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 14, gap: 8, backgroundColor: totalDamage === 0 ? colors.secondary : colors.destructive, opacity: totalDamage === 0 ? 0.5 : 1 }} onPress={handleApplyDamage} disabled={totalDamage === 0}>
                    <Feather name="activity" size={16} color="#fff" />
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: '#fff' }}>APPLY {totalDamage} DMG → {defender?.name?.toUpperCase()}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: colors.radius, borderWidth: 1, backgroundColor: '#4a8c3f22', borderColor: '#4a8c3f' }}>
                    <Feather name="check-circle" size={16} color="#4a8c3f" />
                    <Text style={{ color: '#4a8c3f', fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>Damage applied to {defender?.name}</Text>
                  </View>
                )}

                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderWidth: 1, borderRadius: colors.radius, borderColor: colors.border }} onPress={calculateDamage}>
                  <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Re-roll damage</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <CharacterPickerModal visible={showAttackerPicker} onClose={() => setShowAttackerPicker(false)} onSelect={setAttackerId} title="SELECT ATTACKER" characters={activeCharacters.filter(c => c.id !== defenderId)} allWeapons={allWeapons} />
      <CharacterPickerModal visible={showDefenderPicker} onClose={() => setShowDefenderPicker(false)} onSelect={setDefenderId} title="SELECT DEFENDER" characters={activeCharacters.filter(c => c.id !== attackerId)} allWeapons={allWeapons} />
      <CharacterPickerModal visible={showAddCombatantPicker} onClose={() => setShowAddCombatantPicker(false)} onSelect={(id) => {
        const c = characters.find(ch => ch.id === id);
        if (!c) return;
        addInitiativeEntry({
          id: `init-${c.id}-${genId()}`,
          characterId: c.id,
          name: c.name,
          initiative: (c.sequence ?? c.special.perception * 2) + Math.floor(Math.random() * 10) + 1,
          sequence: c.sequence ?? c.special.perception * 2,
          maxHp: c.maxHp,
          currentHp: c.currentHp,
          maxAP: c.maxAP,
          currentAP: c.maxAP,
          armorClass: c.armorClass,
          tempAC: 0,
          position: c.position,
          isActive: false,
          hasActed: false,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }} title="ADD COMBATANT" characters={activeCharacters.filter(c => !initiativeEntries.some(e => e.characterId === c.id))} allWeapons={allWeapons} />
      <LightPickerModal visible={showLightPicker} value={lightPenalty} onChange={setLightPenalty} onClose={() => setShowLightPicker(false)} />
    </View>
  );
}
