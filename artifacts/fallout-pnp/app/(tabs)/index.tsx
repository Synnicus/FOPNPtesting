import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View,
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
import {
  TARGETED_CRIT_BONUS, TARGETED_CRIT_EFFECTS, CRITICAL_HIT_TABLE, CritTableEntry,
  CRITICAL_FAILURE_TABLE, CritFailTableEntry,
  baseCritChance as calcBaseCritChance, hasPerk, BodyPart,
} from '@/data/criticals';
import { computeInjuryEffects } from '@/data/injuries';
import {
  CONDITION_BOXES_MAX, clampConditionBoxes, conditionToHitPenalty, isWeaponJammed, conditionLabel,
} from '@/data/condition';
import { PERKS, getPerkById } from '@/data/perks';
import { AP_COSTS } from '@/data/apCosts';
import { isMeleeWeapon, getWeaponHands, WEAPON_CATEGORY_LABELS, WEAPON_CATEGORY_ORDER } from '@/data/weapons';
import { computeModEffects } from '@/data/mods';
import { AMMO_TYPES, getAmmoById, describeAmmoMods, AmmoType } from '@/data/ammo';
import { CHEMS, getChem } from '@/data/chems';
import { CHEM_AP_COST, makeChemEffect, computeEffectModifiers, effectiveDerivedStats, effectiveSpecial, computePerkStatBonuses } from '@/data/effects';
import { computeTraitEffects } from '@/data/traits';
import { calcMeleeDamageBonus } from '@/data/derived';
import { applyProtection } from '@/data/armor';
import { resolveAttackWeapon, resolveDamagePipeline } from '@/data/attackResolution';
import { getRaceById } from '@/data/races';
import { computeConditionModifiers } from '@/data/conditions';
import {
  SPECIAL_UNARMED_ATTACKS,
  SpecialUnarmedGroup,
  evaluateEligibility,
  formatEffects as formatSpecialUnarmedEffects,
  formatRequirements as formatSpecialUnarmedRequirements,
  getSpecialUnarmedAttack,
} from '@/data/specialUnarmedAttacks';

function combatSequence(character: Character): number {
  return effectiveDerivedStats(character).sequence;
}

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

interface TargetedOption { label: string; ranged: number; melee: number; key: string; bodyPart: BodyPart | null; }
const TARGETED_OPTIONS: TargetedOption[] = [
  { label: 'None',   ranged: 0,  melee: 0,  key: 'none',  bodyPart: null },
  { label: 'Torso',  ranged: 0,  melee: 0,  key: 'torso', bodyPart: 'torso' },
  { label: 'Arms',   ranged: 30, melee: 15, key: 'arms',  bodyPart: 'arms' },
  { label: 'Legs',   ranged: 20, melee: 10, key: 'legs',  bodyPart: 'legs' },
  { label: 'Groin',  ranged: 30, melee: 15, key: 'groin', bodyPart: 'groin' },
  { label: 'Head',   ranged: 40, melee: 20, key: 'head',  bodyPart: 'head' },
  { label: 'Eyes',   ranged: 60, melee: 30, key: 'eyes',  bodyPart: 'eyes' },
];

const POSITION_OPTIONS = [
  { label: 'Standing', bonus: 0 },
  { label: 'Crouching', bonus: 10 },
  { label: 'Prone', bonus: 25 },
];

// Worst-case darkness light penalty (Total darkness) — used for a blind attacker.
const TOTAL_DARKNESS_PENALTY = 200;

const RANGED_SKILLS = new Set(['smallGuns', 'bigGuns', 'energyWeapons']);

const DAMAGE_TYPE_ORDER: DamageType[] = ['normal', 'laser', 'fire', 'plasma', 'explosion'];

const SPECIAL_UNARMED_GROUP_LABELS: Record<SpecialUnarmedGroup, string> = {
  primaryPunch: 'PRIMARY PUNCHES',
  secondaryPunch: 'SECONDARY PUNCHES',
  primaryKick: 'PRIMARY KICKS',
  secondaryKick: 'SECONDARY KICKS',
};

// Combined DT/DR from armor pieces + natural protection for a given damage type
function combinedProtectionFor(
  dmgType: DamageType,
  bodyArmor: { [k: string]: any } | null,
  helmet: { [k: string]: any } | null,
  natural: NaturalProtection | null | undefined,
  shield?: { [k: string]: number } | null,
): { dt: number; dr: number } {
  const cap = dmgType.charAt(0).toUpperCase() + dmgType.slice(1);
  const dtField = `dt${cap}`;
  const drField = `dr${cap}`;
  const dt = ((bodyArmor?.[dtField] as number) ?? 0)
    + ((helmet?.[dtField] as number) ?? 0)
    + ((natural?.[dtField as keyof NaturalProtection] as number) ?? 0)
    + ((shield?.[dtField] as number) ?? 0);
  const dr = Math.min(90, ((bodyArmor?.[drField] as number) ?? 0)
    + ((helmet?.[drField] as number) ?? 0)
    + ((natural?.[drField as keyof NaturalProtection] as number) ?? 0)
    + ((shield?.[drField] as number) ?? 0));
  return { dt, dr };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ShotResult {
  index: number; chanceToHit: number; penalty: number;
  roll: number | null; hit: boolean; margin: number;
  isCrit: boolean; isCritFail: boolean;
}
interface ShotDamage {
  shotIndex: number; baseRolls: number[]; baseDmg: number;
  combinedDT: number; combinedDR: number; finalDmg: number; critMultiplier: number;
  meleeDmgBonus: number; afterDT: number; bypassArmor: boolean; critNotes: string[];
  manualBaseDamage: number | null;
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
  lightReduction: number; // Night Vision/Night Person: % of the light penalty removed (50 = halved)
  burstApDiscount: number; // Steady Arm: −1 AP on burst attacks
  strReqReduction: number; // Weapon Handling: weapon STR requirement −2
  notes: string[];
}

// Web-safe alert: RN's Alert.alert is a silent no-op on react-native-web.
// Compact ammo label for the combatant card, e.g. "10mm JHP" from
// "10mm JHP (Jacketed Hollow Point)" — strips parentheticals, caps length.
function shortAmmoName(name: string): string {
  const stripped = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return stripped.length > 18 ? stripped.slice(0, 17) + '…' : stripped;
}

// One-line summary of what an active effect changes (for combat cards).
function describeEffectMods(e: {
  statMods?: Partial<Record<string, number>>; acMod?: number; drMod?: number;
  apMod?: number; sequenceMod?: number;
}): string {
  const bits: string[] = [];
  for (const [k, v] of Object.entries(e.statMods ?? {})) {
    if (v) bits.push(`${k.slice(0, 3).toUpperCase()} ${v > 0 ? '+' : ''}${v}`);
  }
  if (e.acMod) bits.push(`AC ${e.acMod > 0 ? '+' : ''}${e.acMod}`);
  if (e.drMod) bits.push(`DR ${e.drMod > 0 ? '+' : ''}${e.drMod}%`);
  if (e.apMod) bits.push(`AP ${e.apMod > 0 ? '+' : ''}${e.apMod}`);
  if (e.sequenceMod) bits.push(`SEQ ${e.sequenceMod > 0 ? '+' : ''}${e.sequenceMod}`);
  return bits.join(', ');
}

function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

function computePerkBonuses(char: Character | null, weapon: Weapon | null, isRanged: boolean): PerkBonus {
  const result: PerkBonus = {
    toHit: 0, damage: 0, critChance: 0, critDamageMult: 1.0,
    allHitsAreCrits: false, ignoreDT: 0, apDiscount: 0, lightReduction: 0, burstApDiscount: 0,
    strReqReduction: 0, notes: [],
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
      // Bonus HtH Damage raises the Melee Damage (MD) stat itself — it is
      // counted inside the MD term of the damage sum, NOT here (would double).
      if (fx.meleeDamageBonus && perk.id !== 'bonus_hth_damage') { result.damage += fx.meleeDamageBonus * rank; result.notes.push(`${perk.name}: +${fx.meleeDamageBonus * rank} melee dmg`); }
      if (fx.allHitsAreCrits) { result.allHitsAreCrits = true; result.notes.push(`${perk.name}: all hits are crits`); }
    }
    // Penetrator etc.: DT ignore applies to the attack regardless of ranged/melee
    // (Penetrator is a RANGED perk — previously this was melee-only and dead).
    if (fx.ignoreDT) { result.ignoreDT += fx.ignoreDT * rank; result.notes.push(`${perk.name}: ignore ${fx.ignoreDT * rank} DT`); }
    if (fx.weaponStrReqReduction) { result.strReqReduction += fx.weaponStrReqReduction * rank; result.notes.push(`${perk.name}: weapon STR req −${fx.weaponStrReqReduction * rank}`); }
    // Pyromaniac / Demolition Expert: extra damage with fire / explosion weapons.
    if (fx.fireWeaponDamageBonus && weapon?.damageType === 'fire') { result.damage += fx.fireWeaponDamageBonus * rank; result.notes.push(`${perk.name}: +${fx.fireWeaponDamageBonus * rank} fire dmg`); }
    if (fx.explosionDamageBonus && weapon?.damageType === 'explosion') { result.damage += fx.explosionDamageBonus * rank; result.notes.push(`${perk.name}: +${fx.explosionDamageBonus * rank} explosion dmg`); }
    // Adrenaline Rush: +STR while below half HP → +melee damage (STR-derived).
    if (fx.adrenalineRushActive && char.currentHp < char.maxHp / 2 && !isRanged) {
      result.damage += fx.adrenalineStrBonus ?? 1;
      result.notes.push(`${perk.name}: +${fx.adrenalineStrBonus ?? 1} melee dmg (HP < 50%)`);
    }
    if (fx.damageBonus) { result.damage += fx.damageBonus * rank; result.notes.push(`${perk.name}: +${fx.damageBonus * rank} all dmg`); }
    if (fx.critChanceBonus) { result.critChance += fx.critChanceBonus * rank; }
    if (fx.critDamageMultiplier) { result.critDamageMult = Math.max(result.critDamageMult, fx.critDamageMultiplier); }
    if (fx.attackAPDiscount) { result.apDiscount += fx.attackAPDiscount * rank; }
    if (perk.id === 'night_vision' && fx.combatNote) { result.lightReduction = 50; result.notes.push(`${perk.name}: dark-condition penalties halved`); }
    if (perk.id === 'night_person' && fx.combatNote) { result.lightReduction = Math.max(result.lightReduction, 50); result.notes.push(`${perk.name}: light penalties halved`); }
    if (perk.id === 'steady_arm' && fx.combatNote) { result.burstApDiscount += 1; result.notes.push(`${perk.name}: burst attacks −1 AP`); }
  }
  return result;
}

// Defender-side perk bonuses: AC (Dodger, Hit the Deck…) and DR (Toughness…).
// Conditional "when HP < 50%" perks gate on the defender's current HP.
function computeDefensivePerkBonuses(char: Character | null, dmgType?: DamageType): { ac: number; dr: number; notes: string[] } {
  const out = { ac: 0, dr: 0, notes: [] as string[] };
  if (!char || !char.perks) return out;
  const lowHp50 = char.currentHp < char.maxHp / 2;
  const lowHp20 = char.currentHp < char.maxHp * 0.2;
  for (const cp of char.perks) {
    const perk = getPerkById(cp.perkId);
    const fx = perk?.combatEffect;
    if (!perk || !fx) continue;
    const rank = cp.rank;
    // Generic HP<50% conditional defensive perks only apply when actually below half.
    const conditional = /HP\s*<\s*50%/i.test(fx.combatNote ?? '');
    if (conditional && !lowHp50) continue;
    if (fx.armorClassBonus) { out.ac += fx.armorClassBonus * rank; out.notes.push(`${perk.name}: +${fx.armorClassBonus * rank} AC`); }
    if (fx.damageResistBonus) { out.dr += fx.damageResistBonus * rank; out.notes.push(`${perk.name}: +${fx.damageResistBonus * rank}% DR`); }
    // Manual-specific defensive perks without structured fields:
    if (perk.id === 'die_hard' && lowHp20) { out.dr += 10; out.notes.push('Die Hard: +10% DR (HP < 20%)'); }
    if (perk.id === 'hide_of_scars' && dmgType !== 'fire') { out.dr += 15 * rank; out.notes.push(`Hide of Scars: +${15 * rank}% DR (not fire)`); }
    if (perk.id === 'tough_hide') { out.dr += 10 * rank; out.notes.push(`Tough Hide: +${10 * rank}% DR`); }
    if (perk.id === 'hit_the_deck' && dmgType === 'explosion') { out.dr += 50; out.notes.push('Hit the Deck!: +50% Explosive DR'); }
  }
  return out;
}

// ─── Generic option picker modal (weapons / chems / ammo) ────────────────────
function OptionPickerModal({ visible, title, subtitle, options, onSelect, onClose }: {
  visible: boolean; title: string; subtitle?: string;
  options: {
    key: string;
    label: string;
    sublabel?: string;
    disabled?: boolean;
    muted?: boolean;
    note?: string;
    section?: string;
  }[];
  onSelect: (key: string) => void; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80%', paddingBottom: Math.max(insets.bottom, 12) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
              {!!subtitle && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
            {options.length === 0 && (
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', paddingVertical: 20 }}>Nothing available.</Text>
            )}
            {options.map((opt, index) => (
              <React.Fragment key={opt.key}>
                {!!opt.section && (index === 0 || options[index - 1]?.section !== opt.section) && (
                  <Text style={{ marginTop: index === 0 ? 0 : 8, fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.5 }}>
                    {opt.section}
                  </Text>
                )}
                <TouchableOpacity
                  disabled={opt.disabled}
                  onPress={() => onSelect(opt.key)}
                  style={{
                    padding: 12,
                    borderRadius: colors.radius,
                    borderWidth: 1,
                    borderColor: opt.disabled || opt.muted ? colors.border : colors.primary + '66',
                    backgroundColor: colors.card,
                    opacity: opt.disabled || opt.muted ? 0.48 : 1,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{opt.label}</Text>
                  {!!opt.sublabel && <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{opt.sublabel}</Text>}
                  {!!opt.note && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.destructive }}>{opt.note}</Text>}
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={{ marginHorizontal: 12, marginTop: 4, paddingVertical: 12, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CANCEL — NO AP SPENT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
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

// ─── Critical Hit Modal (non-aimed) ──────────────────────────────────────────
function CriticalHitModal({ visible, onClose, rolledEntry, onRoll, onSelect, betterCriticals }: {
  visible: boolean; onClose: () => void; rolledEntry: CritTableEntry | null;
  onRoll: () => void; onSelect: (entry: CritTableEntry) => void; betterCriticals: boolean;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: 16 }}>
        <View style={{ maxHeight: '86%', backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: colors.primary, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="zap" size={20} color={colors.primary} />
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>CRITICAL HIT!</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 4 }}>CRITICAL HITS</Text>
            {betterCriticals && (
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#4a8c3f', marginBottom: 4 }}>Better Criticals: non-fatal crits deal ×1.5 damage.</Text>
            )}
            <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 2 }}>
              {rolledEntry ? 'Result applied — resolves once per critical.' : 'Rolled the dice at the table? Tap a row to apply that result manually.'}
            </Text>
            {CRITICAL_HIT_TABLE.map(entry => {
              const active = rolledEntry?.roll === entry.roll;
              return (
                <TouchableOpacity key={entry.roll} disabled={!!rolledEntry} onPress={() => onSelect(entry)} style={{ flexDirection: 'row', gap: 10, padding: 8, borderRadius: 6, opacity: rolledEntry && !active ? 0.5 : 1, backgroundColor: active ? colors.primary + '33' : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: active ? colors.primary : colors.mutedForeground, minWidth: 22, textAlign: 'center' }}>{entry.roll}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: active ? colors.primary : colors.foreground }}>{entry.title}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{entry.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
            <TouchableOpacity disabled={!!rolledEntry} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: colors.radius, backgroundColor: rolledEntry ? colors.secondary : colors.primary }} onPress={onRoll}>
              <Feather name="refresh-cw" size={16} color={rolledEntry ? colors.mutedForeground : colors.primaryForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: rolledEntry ? colors.mutedForeground : colors.primaryForeground }}>ROLL 1d10</Text>
            </TouchableOpacity>
            {rolledEntry && (
              <View style={{ padding: 10, borderRadius: colors.radius, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>Rolled {rolledEntry.roll}: {rolledEntry.title} — APPLIED</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Critical Failure Modal ──────────────────────────────────────────────────
function CriticalFailureModal({ visible, onClose, rolledEntry, appliedNotes, onRoll }: {
  visible: boolean; onClose: () => void; rolledEntry: CritFailTableEntry | null;
  appliedNotes: string[]; onRoll: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)', padding: 16 }}>
        <View style={{ maxHeight: '86%', backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: colors.destructive, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>💀</Text>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 2 }}>CRITICAL FAILURE!</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 6 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 4 }}>CRITICAL FAILURES</Text>
            {CRITICAL_FAILURE_TABLE.map(entry => {
              const active = rolledEntry?.roll === entry.roll;
              return (
                <View key={entry.roll} style={{ flexDirection: 'row', gap: 10, padding: 8, borderRadius: 6, backgroundColor: active ? colors.destructive + '33' : colors.secondary, borderWidth: 1, borderColor: active ? colors.destructive : colors.border }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: active ? colors.destructive : colors.mutedForeground, minWidth: 22, textAlign: 'center' }}>{entry.roll}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: active ? colors.destructive : colors.foreground }}>{entry.title}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{entry.description}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: colors.radius, backgroundColor: colors.destructive }} onPress={onRoll}>
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: '#fff' }}>ROLL 1d10</Text>
            </TouchableOpacity>
            {rolledEntry && (
              <View style={{ padding: 10, borderRadius: colors.radius, backgroundColor: colors.destructive + '22', borderWidth: 1, borderColor: colors.destructive, gap: 2 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.destructive }}>Rolled {rolledEntry.roll}: {rolledEntry.title}</Text>
                {appliedNotes.map((n, i) => <Text key={i} style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>• {n}</Text>)}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Combat Screen ───────────────────────────────────────────────────────
export default function CombatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { characters, allWeapons, allArmor, applyDamage, spendAmmo, reloadWeapon, jamWeapon, setWeaponCondition, setAmmoType, equipWeapon, setActiveWeapon, applyChem, setPosition, setKnockedOut, addInjury, updateCharacter, spendAP, addTempAC,
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
  const [physicalHitConfirmed, setPhysicalHitConfirmed] = useState(false);

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
  const [targetedIdx, setTargetedIdx] = useState(0);
  const [showLightPicker, setShowLightPicker] = useState(false);
  const [showModifiers, setShowModifiers] = useState(true);

  // Damage
  const [shotDamages, setShotDamages] = useState<(ShotDamage | null)[] | null>(null);
  const [damageApplied, setDamageApplied] = useState(false);

  // Crit state
  // isCrit: whether the primary shot is a critical hit this roll.
  const [primaryIsCrit, setPrimaryIsCrit] = useState(false);
  // For aimed crits, the manual targeted effect that will apply (multiplier/injury).
  const [aimedCritPart, setAimedCritPart] = useState<BodyPart | null>(null);
  const [aimedCritApplied, setAimedCritApplied] = useState(false);
  const [aimedCritNotes, setAimedCritNotes] = useState<string[]>([]);
  // For non-aimed crits: modal + rolled critical-table entry.
  const [showCritModal, setShowCritModal] = useState(false);
  const [critTableEntry, setCritTableEntry] = useState<CritTableEntry | null>(null);
  const [critEffectNotes, setCritEffectNotes] = useState<string[]>([]);

  // Critical failure (miss with roll 97-100): table + modal + applied notes.
  const [isCritFail, setIsCritFail] = useState(false);
  const [showCritFailModal, setShowCritFailModal] = useState(false);
  const [critFailEntry, setCritFailEntry] = useState<CritFailTableEntry | null>(null);
  const [critFailNotes, setCritFailNotes] = useState<string[]>([]);

  // AP spent flag
  const [apSpent, setApSpent] = useState(false);
  // Local attack-session weapon. Null means the character's active weapon.
  const [attackWeaponId, setAttackWeaponId] = useState<string | null>(null);

  // Pickers
  const [showAttackerPicker, setShowAttackerPicker] = useState(false);
  const [showDefenderPicker, setShowDefenderPicker] = useState(false);
  const [showAddCombatantPicker, setShowAddCombatantPicker] = useState(false);
  const [showApActions, setShowApActions] = useState(false);
  const [showChemPicker, setShowChemPicker] = useState(false);
  const [showAmmoPicker, setShowAmmoPicker] = useState(false);
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showSpecialUnarmedPicker, setShowSpecialUnarmedPicker] = useState(false);
  const [specialUnarmedAttackId, setSpecialUnarmedAttackId] = useState<string | null>(null);
  // Whether the currently open ammo/weapon picker should charge AP on selection.
  const [weaponPickerFree, setWeaponPickerFree] = useState(false);
  // Pending 1H equip that needs a hand choice (both hands hold 1H weapons).
  const [pendingHandChoice, setPendingHandChoice] = useState<{ weaponId: string; free: boolean } | null>(null);
  // Dual-gun reload chooser.
  const [showReloadPicker, setShowReloadPicker] = useState(false);
  // Inline result of the last streamlined-burst damage application.
  const [streamlinedDmgResult, setStreamlinedDmgResult] = useState<{ perHit: number[]; total: number; dt: number; dr: number } | null>(null);

  // Manual base-damage override ('' = use rolled dice). Recomputes DT/DR/crit.
  const [damageOverride, setDamageOverride] = useState('');

  // Remember the last defender chosen per attacker; restore on re-select.
  const lastDefenderByAttacker = React.useRef<Record<string, string>>({});

  // Non-storage characters — used for pickers and initiative setup
  const activeCharacters = characters.filter(c => !c.inStorage);

  // Derived values
  const attacker = characters.find(c => c.id === attackerId) ?? null;
  const defender = characters.find(c => c.id === defenderId) ?? null;
  // Empty hands still make a normal Unarmed attack. Treat them as the built-in
  // Fists and Feet profile without mutating the character's carried inventory.
  const activeWeapon = attacker
    ? (attacker.equippedWeaponId
        ? allWeapons.find(w => w.id === attacker.equippedWeaponId) ?? null
        : allWeapons.find(w => w.id === 'unarmed') ?? null)
    : null;
  const bodyArmor = defender?.equippedBodyArmorId ? allArmor.find(a => a.id === defender.equippedBodyArmorId) ?? null : null;
  const helmet = defender?.equippedHelmetId ? allArmor.find(a => a.id === defender.equippedHelmetId) ?? null : null;

  // ── Dual-wield state (two DIFFERENT 1H weapons, one per hand) ──────────────
  // Absent hand ids fall back to "equipped weapon in the right hand".
  const attackerLeftId = attacker?.leftHandWeaponId;
  const attackerRightId = attacker?.rightHandWeaponId ?? (attacker?.leftHandWeaponId ? undefined : attacker?.equippedWeaponId);
  const leftWeapon = attackerLeftId ? allWeapons.find(w => w.id === attackerLeftId) ?? null : null;
  const rightWeapon = attackerRightId ? allWeapons.find(w => w.id === attackerRightId) ?? null : null;
  const dualWielding = !!(leftWeapon && rightWeapon && leftWeapon.id !== rightWeapon.id);
  // The held weapon that is NOT the active (equipped) one.
  const offhandWeapon = dualWielding
    ? (activeWeapon?.id === leftWeapon!.id ? rightWeapon : leftWeapon)
    : null;
  // Every rule below consumes this one authoritative attack-session weapon.
  const weapon = resolveAttackWeapon(activeWeapon, attackWeaponId, [leftWeapon, rightWeapon]);
  const heldWeapons: Weapon[] = dualWielding
    ? [leftWeapon, rightWeapon].filter((w): w is Weapon => !!w)
    : (weapon ? [weapon] : []);
  const reloadableHeldWeapons = heldWeapons.filter(w => w.magazineSize > 0);
  const allHeldMagazinesFull = reloadableHeldWeapons.every(w => {
    const fx = computeModEffects(w);
    const mag = Math.round(w.magazineSize * (fx.magazineMult ?? 1));
    const cur = attacker?.weaponAmmoStates.find(a => a.weaponId === w.id)?.currentAmmo ?? mag;
    return cur >= mag;
  });

  // ── Shield mods: a held weapon with a shield buffs the wielder's AC/DT/DR ──
  const shieldFor = (c: Character | null): { ac: number; prot: Record<string, number> | null } => {
    if (!c) return { ac: 0, prot: null };
    const ids = new Set<string>();
    if (c.leftHandWeaponId) ids.add(c.leftHandWeaponId);
    if (c.rightHandWeaponId) ids.add(c.rightHandWeaponId);
    if (ids.size === 0 && c.equippedWeaponId) ids.add(c.equippedWeaponId);
    let ac = 0; let prot: Record<string, number> | null = null;
    for (const id of ids) {
      const w = allWeapons.find(x => x.id === id);
      if (!w) continue;
      const fx = computeModEffects(w);
      ac += fx.acBonus;
      if (fx.shieldProtection) {
        prot = prot ?? { dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0, drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 0 };
        for (const k of Object.keys(fx.shieldProtection)) prot[k] += (fx.shieldProtection as any)[k];
      }
    }
    return { ac, prot };
  };
  const defenderShield = shieldFor(defender);
  const isRanged = weapon ? RANGED_SKILLS.has(weapon.skill) : true;
  const isMelee = weapon ? isMeleeWeapon(weapon) : false;
  const isUnarmed = weapon ? weapon.skill === 'unarmed' : false;
  // Special techniques apply to the Unarmed weapon category (including
  // knuckles/power fists), but never to bestiary "natural" attacks.
  const canUseSpecialUnarmed = weapon?.category === 'unarmed';
  const specialUnarmedAttack = canUseSpecialUnarmed && specialUnarmedAttackId
    ? getSpecialUnarmedAttack(specialUnarmedAttackId) ?? null
    : null;
  const isMeleeOrUnarmed = isMelee || isUnarmed;

  // Auto-computed weapon-mod effects (to-hit/damage/range + magazine/sight/scope
  // behaviour, sling, poison/festering/barbed, reload override). Needed early
  // for targeting/light derivations below.
  const modEffects = computeModEffects(weapon ? (weapon.mods ?? []) : []);
  const modBonuses = { toHit: modEffects.toHit, damage: modEffects.damage, range: modEffects.range };

  // Injury effects (manual): attacker & defender.
  const attackerInjury = attacker ? computeInjuryEffects(attacker) : null;
  const defenderInjury = defender ? computeInjuryEffects(defender) : null;

  // Attacker position drives the ranged To-Hit bonus (gun skills only, per manual).
  const attackerPos = attacker?.position ?? 'standing';
  const posIdxFromChar = attackerPos === 'crouching' ? 1 : attackerPos === 'prone' ? 2 : 0;
  const positionBonus = isRanged ? POSITION_OPTIONS[posIdxFromChar].bonus : 0;
  // Gate targeting on the weapon: apTargeted === null means the weapon cannot
  // make targeted shots (e.g. thrown explosives, flamethrowers).
  const weaponCanTarget = (!weapon || weapon.apTargeted !== null) && !specialUnarmedAttack;
  let effTargetedIdx = weaponCanTarget ? targetedIdx : 0;
  // Sniper scope forces an aimed shot: if no body part is targeted, default to Torso.
  if (modEffects.forcesAimed && weaponCanTarget && effTargetedIdx === 0) effTargetedIdx = 1;
  const rawTargetedPenalty = isRanged ? TARGETED_OPTIONS[effTargetedIdx].ranged : TARGETED_OPTIONS[effTargetedIdx].melee;
  // Laser sight negates the aimed-shot to-hit penalty.
  const targetedPenalty = specialUnarmedAttack ? 0 : (modEffects.negatesAimedPenalty ? 0 : rawTargetedPenalty);
  const targetedBodyPart = TARGETED_OPTIONS[effTargetedIdx].bodyPart;
  const isAimed = targetedBodyPart !== null && !specialUnarmedAttack;
  // Include tagged skill +20 bonus in base skill
  const rawBaseSkill = (attacker && weapon) ? (attacker.skills as any)[weapon.skill] ?? 0 : 0;
  const isTaggedSkill = weapon ? (attacker?.taggedSkills ?? []).includes(weapon.skill as any) : false;
  const baseSkill = rawBaseSkill + (isTaggedSkill ? 20 : 0);

  // Perk bonuses
  const perkBonuses = computePerkBonuses(attacker, weapon, isRanged);

  // Trait effects (One Hander to-hit swing, etc.)
  const traitEffects = attacker ? computeTraitEffects(attacker) : {};

  // Effective magazine size after mods (extended/drum magazines).
  const effectiveMagazine = weapon ? Math.round(weapon.magazineSize * (modEffects.magazineMult ?? 1)) : 0;

  // Reload AP cost — Speed Loader mod (reloadApOverride) can reduce it.
  const reloadApCost = modEffects.reloadApOverride ?? AP_COSTS.RELOAD;

  // Attack verb by weapon type: THROW (thrown), FIRE (ranged guns/energy),
  // ATTACK (melee/unarmed/default).
  const attackVerb = weapon
    ? (weapon.category === 'throwing' ? 'THROW' : isRanged ? 'FIRE' : 'ATTACK')
    : 'ATTACK';
  const attackActionLabel = specialUnarmedAttack?.name.toUpperCase() ?? attackVerb;

  // Active-effect (chem) modifiers on attacker & defender (data/effects.ts).
  const attackerEffectMods = attacker ? computeEffectModifiers(attacker) : null;
  const defenderEffectMods = defender ? computeEffectModifiers(defender) : null;
  // Attacker SPECIAL after chem statMods (drives melee dmg / crit luck below).
  // Chems may push stats PAST racial limits — no upper cap, floor 1.
  const attackerEffSpecial = (attacker && attacker.special)
    ? effectiveSpecial(attacker).stats
    : null;
  const defenderEffSpecial = (defender && defender.special)
    ? effectiveSpecial(defender).stats
    : null;
  const attackerEffDerived = attacker?.special ? effectiveDerivedStats(attacker) : null;
  const specialUnarmedEligibility = attacker && specialUnarmedAttack
    ? evaluateEligibility(
        specialUnarmedAttack,
        attacker.level,
        attackerEffSpecial ?? attacker.special,
        attacker.skills,
        attacker.taggedSkills ?? [],
      )
    : null;
  // Defender-side perk bonuses (Dodger AC, Toughness DR, …) + chem AC mods.
  const defenderPerkDef = computeDefensivePerkBonuses(defender, weapon?.damageType);

  // Effective weapon range: base rangeNormal + mod range bonuses
  const effectiveRange = weapon ? weapon.rangeNormal + modBonuses.range : 0;

  // ─── Loaded ammo type (data/ammo.ts) ───────────────────────────────────────
  const ammoTypeId = (attacker && weapon)
    ? attacker.weaponAmmoStates?.find(a => a.weaponId === weapon.id)?.ammoTypeId
    : undefined;
  const loadedAmmo: AmmoType | null = ammoTypeId ? (getAmmoById(ammoTypeId) ?? null) : null;
  // Only the weapon's compatible ammo may be loaded.
  const compatibleAmmo: AmmoType[] = weapon?.compatibleAmmo
    ? weapon.compatibleAmmo.map(id => getAmmoById(id)).filter((a): a is AmmoType => !!a)
    : [];

  // Defender natural protection (creatures like Deathclaws)
  const defenderNatural: NaturalProtection | null = defender
    ? (defender.naturalProtection ?? getRaceById(defender.race)?.naturalProtection ?? null)
    : null;

  // Effective defender AC (with tempAC), adjusted for defender position (manual):
  //  Base AC from Agility is reduced when crouching (cap 3) / prone (=1).
  //  We recompute using effective Agility (accounts for crippled limbs) and
  //  subtract the "lost" base-AC when the defender is crouching/prone.
  const defenderPos = defender?.position ?? 'standing';
  // AGI baked into the stored armorClass = base + permanent Gain Agility perks.
  const defenderStoredAgi = defender?.special
    ? defender.special.agility + (computePerkStatBonuses(defender).agility ?? 0)
    : 0;
  // Working AGI: injuries override, then chem statMods apply (may exceed 10).
  const defenderTemporaryAgiDelta = defender?.special
    ? (effectiveSpecial(defender).chemDelta.agility ?? 0) + (effectiveSpecial(defender).conditionDelta.agility ?? 0)
    : 0;
  const defenderBaseAgi = Math.max(0, (defenderInjury?.effectiveAgility ?? defenderStoredAgi) + defenderTemporaryAgiDelta);
  let defenderPositionalAgiAC = defenderBaseAgi;
  if (defenderPos === 'crouching') defenderPositionalAgiAC = Math.min(defenderBaseAgi, 3);
  else if (defenderPos === 'prone') defenderPositionalAgiAC = Math.min(defenderBaseAgi, 1);
  // AC delta vs the stored armorClass (which baked in defenderStoredAgi).
  // Negative when a chem AGI boost exceeds positional loss (i.e. AC goes UP).
  const defenderAgiAcDelta = defenderStoredAgi - defenderPositionalAgiAC;
  const defenderAC = defender
    ? Math.max(0, defender.armorClass + (defender.tempAC ?? 0) - defenderAgiAcDelta
        + defenderPerkDef.ac + (defenderEffectMods?.acMod ?? 0) + defenderShield.ac)
    : 0;
  const defenderACAffectsHit = specialUnarmedAttack?.armorClassPiercing ? 0 : defenderAC;

  // Blind attacker suffers worst-case darkness penalty (manual light table).
  const blindDarknessPenalty = attackerInjury?.blind ? TOTAL_DARKNESS_PENALTY : 0;
  const rawLightPenalty = Math.max(lightPenalty, blindDarknessPenalty);

  // Light penalty after Night Vision perk; a night sight mod ignores light entirely.
  const effectiveLightPenalty = modEffects.ignoresLightPenalty
    ? 0
    : Math.max(0, Math.round(rawLightPenalty * (1 - perkBonuses.lightReduction / 100)));

  // STR requirement penalty
  const effectiveMinStr = weapon ? Math.max(1, weapon.minStr - perkBonuses.strReqReduction) : 0;
  // Uses effective STR (chems like Buffout can raise it past the requirement).
  const attackerStr = attackerEffSpecial?.strength ?? attacker?.special?.strength ?? 0;
  const strReqPenalty = (attacker && weapon && attacker.special)
    ? (attackerStr < effectiveMinStr ? (effectiveMinStr - attackerStr) * 20 : 0)
    : 0;

  // Ammo state
  const ammoState = (attacker && weapon) ? attacker.weaponAmmoStates?.find(a => a.weaponId === weapon.id) : null;
  const currentAmmo = ammoState?.currentAmmo ?? effectiveMagazine;
  const hasAmmo = !weapon || weapon.magazineSize === 0 || currentAmmo > 0;

  // ─── Weapon condition (data/condition.ts — FILLED boxes 0..10) ─────────────────
  // conditionBoxes counts FILLED boxes (0 pristine … 10 jammed). Legacy stored
  // values (old 0..5 "remaining") are clamped into range.
  const conditionBoxes = clampConditionBoxes(ammoState?.conditionBoxes ?? 0);
  const weaponBroken = !!weapon && isWeaponJammed(conditionBoxes);
  const conditionPenalty = weapon ? -conditionToHitPenalty(conditionBoxes) : 0; // positive number to subtract

  // Ammo AC modifier lowers the TARGET's AC (manual: AP/HP rounds). acMod is
  // negative for armor-piercing → treat as a positive to-hit adjustment.
  const ammoToHitAdjust = loadedAmmo ? -loadedAmmo.acMod : 0;

  // One Hander trait: +20% with one-handed weapons, −40% with two-handed.
  const weaponHands = weapon ? getWeaponHands(weapon) : 1;
  const oneHanderToHit = weapon
    ? (weaponHands === 1 ? (traitEffects.oneHandedToHit ?? 0) : (traitEffects.twoHandedToHit ?? 0))
    : 0;

  // CtH formula (weapon-mod to-hit auto-included; condition penalty auto-included)
  const computeCtH = (extraBurstPenalty: number) =>
    Math.max(1, Math.min(99,
      baseSkill
      + rangeMod
      - effectiveLightPenalty
      - defenderACAffectsHit
      - coverPenalty
      + weaponBonus
      + modBonuses.toHit
      - conditionPenalty
      + positionBonus
      - targetedPenalty
      + extraBurstPenalty
      + perkBonuses.toHit
      - strReqPenalty
      + ammoToHitAdjust
      + oneHanderToHit
    ));

  // Double shot: single shot, range −3
  const weaponCanBurst = !!weapon && !specialUnarmedAttack && weapon.apBurst !== null && weapon.burstLimit > 1;
  // Reset stale fire-mode/aim selections when switching to a weapon that
  // doesn't support them.
  useEffect(() => {
    if (weapon && !weaponCanBurst && isBurst) setIsBurst(false);
    if (weapon && !weaponCanTarget && targetedIdx !== 0) setTargetedIdx(0);
  }, [weapon?.id, weaponCanBurst, weaponCanTarget]);
  const effectiveBurstShots = doubleShotActive ? 1 : (isBurst && weaponCanBurst ? burstShots : 1);
  const burstPenalties = Array.from({ length: effectiveBurstShots }, (_, i) => i === 0 ? 0 : -i * 10);
  const shotChances = burstPenalties.map(p => computeCtH(p));

  const rollTotal = (tensFace !== null && unitsFace !== null) ? percentileRoll(tensFace, unitsFace) : null;

  // ─── Crit chance (manual: baseCritChance = Luck + 5×More Criticals rank) ──────
  // Aimed shots add TARGETED_CRIT_BONUS[bodyPart].
  const attackerBaseCrit = attacker
    ? calcBaseCritChance(attackerEffSpecial ? { ...attacker, special: attackerEffSpecial } : attacker)
    : 0;
  const aimCritBonus = isAimed && targetedBodyPart ? TARGETED_CRIT_BONUS[targetedBodyPart] : 0;
  const specialCritBonus = specialUnarmedAttack?.critBonus ?? 0;
  const totalCritChance = attackerBaseCrit + aimCritBonus + perkBonuses.critChance + specialCritBonus;

  // Perks: Sniper (ranged) / Slayer (melee+unarmed) — on a successful hit, also
  // roll 1d10; if <= Luck the hit is critical. Whether that perk applies here:
  const attackerLuck = attackerEffSpecial?.luck ?? attacker?.special?.luck ?? 5;
  const sniperApplies = !!attacker && isRanged && hasPerk(attacker, 'sniper');
  const slayerApplies = !!attacker && isMeleeOrUnarmed && hasPerk(attacker, 'slayer');
  // Gunslinger: one-handed ranged weapons crit on a successful Luck roll.
  const gunslingerApplies = !!attacker && isRanged && weaponHands === 1 && hasPerk(attacker, 'gunslinger');
  const luckPerkApplies = sniperApplies || slayerApplies || gunslingerApplies;
  const hasBetterCriticals = !!attacker && hasPerk(attacker, 'better_criticals');

  // Shot results
  const resolvedShotChances = physicalHitConfirmed ? shotChances.slice(0, 1) : shotChances;
  const shotResults: ShotResult[] = resolvedShotChances.map((cth, i) => {
    const roll = rollTotal;
    const hit = physicalHitConfirmed ? i === 0 : roll !== null && roll <= cth;
    // Primary shot crit is resolved in rollDice() (needs the luck roll); other
    // burst shots use the crit-chance threshold directly for display.
    const isCrit = i === 0
      ? (hit && primaryIsCrit)
      : (hit && roll !== null && roll <= totalCritChance);
    const isCritFail = !physicalHitConfirmed && !hit && roll !== null && roll >= 97;
    const margin = (roll !== null && hit) ? cth - roll : 0;
    return { index: i, chanceToHit: cth, penalty: burstPenalties[i], roll, hit, margin, isCrit, isCritFail };
  });

  const canRoll = !!(attacker && defender && weapon);
  const attackResolved = rollTotal !== null || physicalHitConfirmed;

  // ─── AP cost (per-weapon apSingle/apTargeted/apBurst; fallback AP_COSTS) ───────
  const wSingle = weapon?.apSingle ?? AP_COSTS.ATTACK_SINGLE;
  const wTargeted = weapon === null ? AP_COSTS.ATTACK_AIMED
    : (weapon.apTargeted === undefined ? AP_COSTS.ATTACK_AIMED : weapon.apTargeted); // null = cannot target
  const wBurst = weapon === null ? AP_COSTS.ATTACK_BURST
    : (weapon.apBurst === undefined ? AP_COSTS.ATTACK_BURST : weapon.apBurst); // null = no burst
  const canTarget = wTargeted !== null && !specialUnarmedAttack;
  const canBurst = wBurst !== null && !!weapon && !specialUnarmedAttack && weapon.burstLimit > 1;

  const baseAPCost = specialUnarmedAttack
    ? specialUnarmedAttack.ap
    : doubleShotActive
      ? AP_COSTS.ATTACK_DOUBLE_SHOT
      : (isBurst && canBurst)
        ? (wBurst as number)
        : (isAimed && canTarget)
          ? (wTargeted as number)
          : wSingle;
  const effectiveAPCost = Math.max(1, baseAPCost - perkBonuses.apDiscount - (isBurst ? perkBonuses.burstApDiscount : 0));
  const attackerHasAP = (attacker?.currentAP ?? 0) >= effectiveAPCost;

  // Weapon-usability warnings from injuries (manual):
  //  • Both arms crippled → cannot use any weapon.
  //  • One arm crippled → one-handed weapons only. A two-handed weapon with a
  //    sling mod can still be used one-handed.
  const cannotUseWeapons = !!attackerInjury?.cannotUseWeapons;
  const twoHandedBlocked = !!attackerInjury?.cannotUseTwoHanded
    && !!weapon && weaponHands === 2 && !modEffects.sling;
  // Prone attacker cannot make melee/unarmed attacks (manual).
  const proneMeleeBlocked = attackerPos === 'prone' && isMeleeOrUnarmed;

  // Streamlined burst params
  const roundedCtH = (() => {
    const cth = shotChances[0];
    if (!weapon) return cth;
    const isMinigun = weapon.burstLimit >= 10;
    if (burstShots <= 5 || isMinigun) return Math.ceil(cth / 10) * 10;
    return Math.floor(cth / 10) * 10;
  })();
  const streamlinedHitThreshold = Math.floor(roundedCtH / 10);

  // Reset the full per-attack state (dice + crit + damage + AP flags). Used by
  // ATTACK AGAIN and the change-of-config effect below. Keeps attacker/defender/
  // weapon/modifier selections intact.
  const resetAttackState = useCallback(() => {
    setTensFace(null);
    setUnitsFace(null);
    setPhysicalHitConfirmed(false);
    setShotDamages(null);
    setDamageApplied(false);
    setPrimaryIsCrit(false);
    setAimedCritPart(null);
    setAimedCritApplied(false);
    setAimedCritNotes([]);
    setShowCritModal(false);
    setCritTableEntry(null);
    setCritEffectNotes([]);
    setIsCritFail(false);
    setShowCritFailModal(false);
    setCritFailEntry(null);
    setCritFailNotes([]);
    setApSpent(false);
    setStreamlinedDice([]);
    setStreamlinedRolled(false);
    setStreamlinedDmgResult(null);
  }, []);

  // Reset on combatant/weapon/config change. NOTE: tensFace/unitsFace are NOT
  // deps here — rollDice() sets the crit state right after setting the dice, so
  // including them would wipe primaryIsCrit/aimedCritPart before damage is rolled.
  useEffect(() => {
    resetAttackState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attackerId, defenderId, weapon?.id, isBurst, burstShots, burstMode, doubleShotActive,
      rangeMod, lightPenalty, coverPenalty, weaponBonus, targetedIdx, specialUnarmedAttackId]);

  useEffect(() => {
    setIsBurst(false); setBurstShots(1); setTargetedIdx(0);
    setDoubleShotActive(false); setStreamlinedDice([]); setStreamlinedRolled(false); setStreamlinedDmgResult(null);
    setSpecialUnarmedAttackId(null);
    setAttackWeaponId(null);
    setDamageOverride('');
  }, [attackerId]);

  // If equipment changes and the selected session weapon is no longer held,
  // return to the character's active weapon.
  useEffect(() => {
    if (attackWeaponId && attackWeaponId !== leftWeapon?.id && attackWeaponId !== rightWeapon?.id) {
      setAttackWeaponId(null);
    }
  }, [attackWeaponId, leftWeapon?.id, rightWeapon?.id]);

  useEffect(() => {
    if (!canUseSpecialUnarmed) {
      setSpecialUnarmedAttackId(null);
      setShowSpecialUnarmedPicker(false);
    }
  }, [canUseSpecialUnarmed]);

  // Persist the last defender per attacker; restore it when the attacker changes.
  useEffect(() => {
    if (defenderId && attackerId) lastDefenderByAttacker.current[attackerId] = defenderId;
  }, [defenderId, attackerId]);
  useEffect(() => {
    if (!attackerId) return;
    const remembered = lastDefenderByAttacker.current[attackerId];
    if (remembered && remembered !== attackerId && characters.some(c => c.id === remembered && !c.inStorage)) {
      setDefenderId(remembered);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        { text: `Reload (${reloadApCost} AP)`, onPress: () => { if (attacker && weapon && spendAP(attacker.id, reloadApCost)) reloadWeapon(attacker.id, weapon.id); else Alert.alert('Not Enough AP', `Reload needs ${reloadApCost} AP.`); } },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRolling(true);
    setPhysicalHitConfirmed(false);
    const t = rollD10(); const u = rollD10();
    setTensFace(t); setUnitsFace(u);
    setShotDamages(null); setDamageApplied(false);
    setPrimaryIsCrit(false); setAimedCritPart(null); setAimedCritApplied(false); setAimedCritNotes([]);
    setShowCritModal(false); setCritTableEntry(null); setCritEffectNotes([]);
    setIsCritFail(false); setShowCritFailModal(false); setCritFailEntry(null); setCritFailNotes([]);
    setApSpent(false);
    const roll = percentileRoll(t, u);

    // Spend ammo
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, 1);
    }

    // ─── Manual critical check ──────────────────────────────────────────────────
    // On a successful hit, it's critical if roll <= critChance. Sniper/Slayer:
    // on a successful hit, also roll 1d10; if <= Luck the hit is critical.
    const hitSuccess = roll <= shotChances[0];
    if (hitSuccess) {
      let isCrit = roll <= totalCritChance;
      if (!isCrit && luckPerkApplies) {
        const luckRoll = rollD10();
        if (luckRoll <= attackerLuck) isCrit = true;
      }
      if (isCrit) {
        setPrimaryIsCrit(true);
        if (isAimed && targetedBodyPart) {
          // Aimed crit: apply TARGETED_CRIT_EFFECTS[bodyPart].
          setAimedCritPart(targetedBodyPart);
        } else {
          // Non-aimed crit: open the critical-hit table modal.
          setShowCritModal(true);
        }
      }
    } else if (roll >= 97) {
      // Critical Failure (manual p.31): a miss with roll 97-100 opens the
      // Critical Failure Table. The old auto-jam is replaced by the table flow
      // (result 2 = Weapon Jammed applies the jam via rollCritFailTable).
      setIsCritFail(true);
      setShowCritFailModal(true);
    }

    setTimeout(() => setRolling(false), 350);
  }, [weaponBroken, hasAmmo, attacker, weapon, shotChances, totalCritChance, isAimed, targetedBodyPart,
      luckPerkApplies, attackerLuck, spendAmmo, spendAP, reloadWeapon]);

  const confirmPhysicalHit = useCallback(() => {
    if (attackResolved || isBurst) return;
    if (weaponBroken) {
      notify('Weapon Broken', 'This weapon is jammed/broken and cannot attack until repaired.');
      return;
    }
    if (!hasAmmo) {
      notify('Empty Magazine', 'No ammo remaining. Reload first!');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTensFace(null);
    setUnitsFace(null);
    setPhysicalHitConfirmed(true);
    setShotDamages(null);
    setDamageApplied(false);
    setPrimaryIsCrit(false);
    setAimedCritPart(null);
    setAimedCritApplied(false);
    setAimedCritNotes([]);
    setShowCritModal(false);
    setCritTableEntry(null);
    setCritEffectNotes([]);
    setIsCritFail(false);
    setShowCritFailModal(false);
    setCritFailEntry(null);
    setCritFailNotes([]);
    setApSpent(false);
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, 1);
    }
  }, [attackResolved, isBurst, weaponBroken, hasAmmo, attacker, weapon, spendAmmo]);

  const rollStreamlined = useCallback(() => {
    if (weaponBroken) {
      notify('Weapon Broken', 'This weapon is jammed/broken and cannot fire until repaired.');
      return;
    }
    if (!hasAmmo) {
      notify('Empty Magazine', 'No ammo remaining. Reload first!');
      return;
    }
    if (weapon && weapon.magazineSize > 0 && currentAmmo < burstShots) {
      notify('Not Enough Ammo', `Burst needs ${burstShots} rounds; only ${currentAmmo} loaded. Reload or reduce the burst.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const dice = Array.from({ length: burstShots }, () => Math.floor(Math.random() * 10));
    setStreamlinedDice(dice);
    setStreamlinedRolled(true);
    setStreamlinedDmgResult(null);
    setShotDamages(null); setDamageApplied(false); setApSpent(false);
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, burstShots);
    }
  }, [weaponBroken, hasAmmo, attacker, weapon, burstShots, spendAmmo, currentAmmo]);

  const calculateDamage = useCallback(() => {
    if (!weapon || shotResults.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Combined DT/DR from armor + defender natural protection (DT adds, DR sums capped at 90%)
    const prot = combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot);
    // Ammo: ignoresDT bypasses DT; drMod adjusts the target's DR (negative = AP).
    const ammoIgnoresDT = !!loadedAmmo?.ignoresDT;
    const ammoDrMod = loadedAmmo?.drMod ?? 0;
    const baseDT = ammoIgnoresDT ? 0 : Math.max(0, prot.dt - perkBonuses.ignoreDT);
    // Defender DR: armor/natural + ammo modifier + defender perks (Toughness…)
    // + active chem effects (e.g. Voodoo +20% DR). Capped at 90%.
    const baseDR = Math.max(0, Math.min(90,
      prot.dr + ammoDrMod + defenderPerkDef.dr + (defenderEffectMods?.drMod ?? 0)));
    // Optional manual base-damage override (replaces the rolled dice total).
    const overrideVal = damageOverride.trim() === '' ? null : Math.max(0, parseInt(damageOverride, 10) || 0);

    // Melee Damage (MD): STR table (chem-adjusted STR, e.g. Buffout) + race
    // bonus (e.g. Deathclaw +5) + Bonus HtH Damage perk (+2/rank — the perk
    // raises MD itself, so it lives HERE and not in perkBonuses) + traits
    // (Heavy Handed +4, Domesticated −2).
    const raceMeleeBonus = isMeleeOrUnarmed ? (getRaceById(attacker?.race ?? '')?.bonusMeleeDamage ?? 0) : 0;
    const hthPerkBonus = isMeleeOrUnarmed ? 2 * (attacker?.perks.find(p => p.perkId === 'bonus_hth_damage')?.rank ?? 0) : 0;
    const traitMeleeBonus = isMeleeOrUnarmed && attacker ? (computeTraitEffects(attacker).meleeDamageBonus ?? 0) : 0;
    const meleeDmgBonus = isMeleeOrUnarmed
      ? Math.max(0, (attackerEffSpecial ? calcMeleeDamageBonus(attackerEffSpecial) : 0) + raceMeleeBonus + hthPerkBonus + traitMeleeBonus)
      : 0;

    const damages = shotResults.map((shot, i) => {
      if (!shot.hit) return null;
      const notes: string[] = [];
      let critMult = 1;
      let bypassArmor = false;

      // Crit damage multiplier (applied to PRE-DT/DR damage).
      if (shot.isCrit) {
        if (i === 0 && isAimed && aimedCritPart) {
          // Aimed crit — manual targeted effect.
          const fx = TARGETED_CRIT_EFFECTS[aimedCritPart];
          critMult = fx.damageMultiplier;
          notes.push(`Critical ×${fx.damageMultiplier} (${aimedCritPart})`);
          notes.push(`Aimed crit (${aimedCritPart}): ${fx.label}`);
        } else if (i === 0 && critTableEntry) {
          // Non-aimed crit — rolled table entry.
          if (critTableEntry.damageMultiplier) critMult = critTableEntry.damageMultiplier;
          if (critTableEntry.bypassesArmor) bypassArmor = true;
          notes.push(`Crit table [${critTableEntry.roll}]: ${critTableEntry.title}`);
        } else {
          // Burst extra shot crit (no table roll) — default 2× per manual torso.
          critMult = 2;
          notes.push('Critical hit ×2');
        }
        // Better Criticals: non-fatal crits ×1.5 on top.
        const fatal = i === 0 && !!critTableEntry?.instantDeath;
        if (hasBetterCriticals && !fatal) {
          critMult = critMult * 1.5;
          notes.push('Better Criticals: ×1.5');
        }
      }

      const dieCount = doubleShotActive ? weapon.damageDieCount * 2 : weapon.damageDieCount;
      const weaponRolls = overrideVal === null
        ? Array.from({ length: dieCount }, () => rollDie(weapon.damageDie))
        : [];
      // Ammo contributes its own dice (manual: gun damage = weapon dice + ammo).
      const ammoRolls = overrideVal === null && loadedAmmo && loadedAmmo.dmgDieCount > 0 && loadedAmmo.dmgDie > 0
        ? Array.from({ length: loadedAmmo.dmgDieCount }, () => rollDie(loadedAmmo.dmgDie))
        : [];
      if (loadedAmmo && (ammoRolls.length > 0 || loadedAmmo.dmgBonus)) {
        notes.push(`Ammo (${loadedAmmo.name})${ammoRolls.length ? ` +[${ammoRolls.join(', ')}]` : ''}${loadedAmmo.dmgBonus ? ` +${loadedAmmo.dmgBonus}` : ''}`);
      }
      const baseRolls = [...weaponRolls, ...ammoRolls];
      // Manual override replaces the summed dice total (mods/melee/perks still add).
      const rolledSum = overrideVal !== null ? overrideVal : baseRolls.reduce((a, b) => a + b, 0);
      if (overrideVal !== null) notes.push(`Manual base damage: ${overrideVal}`);
      const ammoFlat = loadedAmmo?.dmgBonus ?? 0;
      const specialDamageBonus = specialUnarmedAttack?.damageBonus ?? 0;
      if (specialUnarmedAttack) {
        notes.push(`${specialUnarmedAttack.name}: +${specialDamageBonus} damage${specialUnarmedAttack.armorClassPiercing ? ', Armor Class ignored for hit roll' : ''}`);
      }
      const dt = bypassArmor ? 0 : baseDT;
      const dr = bypassArmor ? 0 : baseDR;
      if (bypassArmor) notes.push('Bypasses armor (DT/DR ignored)');
      // Apply DT first, then DR: finalDmg = max(0, (baseDmg − DT) × (1 − DR/100))
      const resolvedDamage = resolveDamagePipeline({
        initialDiceDamage: rolledSum,
        flatDamageBonus: weapon.damageBonus + ammoFlat + meleeDmgBonus + specialDamageBonus + modBonuses.damage + perkBonuses.damage,
        criticalMultiplier: critMult,
        damageThreshold: dt,
        damageResistance: dr,
      });
      const rawBaseDmg = resolvedDamage.baseDamage;
      const afterDT = resolvedDamage.afterDamageThreshold;
      const finalDmg = resolvedDamage.finalDamage;
      return { shotIndex: i, baseRolls, baseDmg: rawBaseDmg, combinedDT: dt, combinedDR: dr, finalDmg, critMultiplier: critMult, meleeDmgBonus, afterDT, bypassArmor, critNotes: notes, manualBaseDamage: overrideVal };
    });
    setShotDamages(damages); setDamageApplied(false);
  }, [weapon, shotResults, bodyArmor, helmet, defenderNatural, isAimed, aimedCritPart, critTableEntry, hasBetterCriticals, doubleShotActive, isMeleeOrUnarmed, attacker, perkBonuses, modBonuses, loadedAmmo, damageOverride, defenderPerkDef, defenderEffectMods, attackerEffSpecial, specialUnarmedAttack]);

  const totalDamage = shotDamages ? shotDamages.reduce((s, d) => s + (d?.finalDmg ?? 0), 0) : 0;

  const handleSpendAP = useCallback(() => {
    if (!attacker) return;
    if (!spendAP(attacker.id, effectiveAPCost)) {
      notify('Not Enough AP', `${attacker.name} needs ${effectiveAPCost} AP for this attack.`);
      return;
    }
    setApSpent(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [attacker, effectiveAPCost, spendAP]);

  const selectAttackWeapon = useCallback((weaponId: string) => {
    if (weapon?.id === weaponId) return;
    setAttackWeaponId(weaponId === activeWeapon?.id ? null : weaponId);
    setIsBurst(false);
    setBurstShots(1);
    setTargetedIdx(0);
    setDoubleShotActive(false);
    setSpecialUnarmedAttackId(null);
    setDamageOverride('');
    resetAttackState();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [weapon?.id, activeWeapon?.id, resetAttackState]);

  // Reload a SPECIFIC held gun (dual-wield chooser) — uses that weapon's own
  // mods for reload cost/magazine, not the active weapon's.
  const handleReloadWeapon = useCallback((w: Weapon) => {
    if (!attacker) return;
    const fx = computeModEffects(w);
    const mag = Math.round(w.magazineSize * (fx.magazineMult ?? 1));
    const state = attacker.weaponAmmoStates.find(a => a.weaponId === w.id);
    const cur = state?.currentAmmo ?? mag;
    const cost = fx.reloadApOverride ?? AP_COSTS.RELOAD;
    setShowReloadPicker(false);
    if (cur >= mag) {
      if (Platform.OS === 'web') alert(`${w.name} is already fully loaded (${cur}/${mag}).`);
      else Alert.alert('Magazine Full', `${w.name} is already fully loaded (${cur}/${mag}).`);
      return;
    }
    if (!spendAP(attacker.id, cost)) {
      if (Platform.OS === 'web') alert(`Not enough AP (need ${cost}) to reload.`);
      else Alert.alert('Not Enough AP', `Reload needs ${cost} AP; ${attacker.name} has ${attacker.currentAP}.`);
      return;
    }
    reloadWeapon(attacker.id, w.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [attacker, spendAP, reloadWeapon]);

  // Take a chem (manual: using an item costs 3 AP). Applies the chem's immediate
  // stage as an ActiveEffect and resolves any HP heal/damage.
  const handleTakeChem = useCallback((chemId: string) => {
    if (!attacker) return;
    const chem = getChem(chemId);
    if (!chem) return;
    if (!spendAP(attacker.id, CHEM_AP_COST)) {
      if (Platform.OS === 'web') alert(`Not enough AP (need ${CHEM_AP_COST}) to take a chem.`);
      else Alert.alert('Not Enough AP', `Taking a chem needs ${CHEM_AP_COST} AP; ${attacker.name} has ${attacker.currentAP}.`);
      return;
    }
    applyChem(attacker.id, makeChemEffect(chem, 0));
    setShowChemPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [attacker, spendAP, applyChem]);

  // Set the loaded ammo type. Changing ammo is FREE (GM bookkeeping) — the AP
  // cost of loading is handled by the RELOAD action, not by picking a type.
  const handleSetAmmo = useCallback((newAmmoId: string | undefined) => {
    if (!attacker || !weapon) return;
    setAmmoType(attacker.id, weapon.id, newAmmoId);
    setShowAmmoPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [attacker, weapon, setAmmoType]);

  // Equip into a specific hand, charging AP unless free. Used directly for
  // unambiguous switches and by the hand-choice modal for dual-wield swaps.
  const equipWithHand = useCallback((weaponId: string, free: boolean, hand: 'left' | 'right' | 'both') => {
    if (!attacker) return;
    if (!free) {
      if (!spendAP(attacker.id, AP_COSTS.EQUIP_WEAPON)) {
        if (Platform.OS === 'web') alert(`Not enough AP (need ${AP_COSTS.EQUIP_WEAPON}) to switch weapons.`);
        else Alert.alert('Not Enough AP', `Switching weapons needs ${AP_COSTS.EQUIP_WEAPON} AP; ${attacker.name} has ${attacker.currentAP}.`);
        return;
      }
    }
    equipWeapon(attacker.id, weaponId, hand);
    setShowWeaponPicker(false);
    setPendingHandChoice(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [attacker, spendAP, equipWeapon]);

  // Equip/switch to a weapon from the inventory. Free manual SET WEAPON.
  // Hand-aware: a 1H weapon goes to an open hand when one is free; when both
  // hands hold different 1H weapons, the user chooses which one to replace.
  const handleEquipWeapon = useCallback((weaponId: string, free: boolean) => {
    if (!attacker) return;
    const newW = allWeapons.find(w => w.id === weaponId);
    if (!newW) return;
    if (getWeaponHands(newW) === 2) { equipWithHand(weaponId, free, 'both'); return; }
    // Effective hands (absent hands fall back to equipped-in-right-hand).
    const L = attacker.leftHandWeaponId;
    const R = attacker.rightHandWeaponId ?? (attacker.leftHandWeaponId ? undefined : attacker.equippedWeaponId);
    // Already holding this weapon → just make it the active one (free, no
    // hand reassignment — prevents a 1H weapon occupying both hand slots).
    if (weaponId === L || weaponId === R) {
      setActiveWeapon(attacker.id, weaponId);
      setShowWeaponPicker(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    const lW = L ? allWeapons.find(w => w.id === L) : undefined;
    const heldTwoHanded = !!(L && R && L === R && lW && getWeaponHands(lW) === 2);
    if (heldTwoHanded) { equipWithHand(weaponId, free, 'right'); return; } // stows the 2H (context clears the other hand)
    if (!L && !R) { equipWithHand(weaponId, free, 'right'); return; }
    if (!L) { equipWithHand(weaponId, free, 'left'); return; }   // left hand open
    if (!R) { equipWithHand(weaponId, free, 'right'); return; }  // right hand open
    // Both hands hold 1H weapons → ask which to replace.
    setPendingHandChoice({ weaponId, free });
  }, [attacker, allWeapons, equipWithHand, setActiveWeapon]);

  // Weapons the attacker can switch to: their carried inventory (equipped
  // weapon included as fallback for older characters).
  const attackerInventory: Weapon[] = attacker
    ? (attacker.inventoryWeaponIds && attacker.inventoryWeaponIds.length > 0
        ? attacker.inventoryWeaponIds
        : (attacker.equippedWeaponId ? [attacker.equippedWeaponId] : []))
        .map(id => allWeapons.find(w => w.id === id))
        .filter((w): w is Weapon => !!w)
    : [];

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

  // Generic labelled AP action (reload/equip/item/skills/mine). Optionally runs
  // the reload logic on the equipped weapon.
  const handleGenericApAction = useCallback((cost: number, label: string, alsoReload?: boolean) => {
    if (!attacker) return;
    const ok = spendAP(attacker.id, cost);
    if (!ok) {
      if (Platform.OS === 'web') alert(`Not enough AP (need ${cost}) for ${label}.`);
      else Alert.alert('Not Enough AP', `${label} needs ${cost} AP; ${attacker.name} has ${attacker.currentAP}.`);
      return;
    }
    if (alsoReload && weapon) reloadWeapon(attacker.id, weapon.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [attacker, weapon, spendAP, reloadWeapon]);

  // Setting up a tripod costs ALL remaining AP for the round (success or fail).
  const handleSetupTripod = useCallback(() => {
    if (!attacker || attacker.currentAP < 1) return;
    spendAP(attacker.id, attacker.currentAP);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [attacker, spendAP]);

  // Defend: forfeit remaining AP, converting it to temporary AC.
  const handleDefend = useCallback(() => {
    if (!attacker || attacker.currentAP < 1) return;
    const remaining = attacker.currentAP;
    spendAP(attacker.id, remaining);
    addTempAC(attacker.id, remaining);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [attacker, spendAP, addTempAC]);

  // ─── Injury helpers for crit effects ─────────────────────────────────────────
  const makeInjury = useCallback((location: Injury['location'], description: string): Injury => ({
    id: genId(), location, severity: 'crippled', description,
    toHitPenalty: 0, skillPenalty: {}, movementPenalty: 0, isActive: true,
    source: `Critical hit (${weapon?.name ?? 'attack'})`,
  }), [weapon]);

  // Pick a limb side (left/right) — prefer the side without an existing injury.
  const pickLimbSide = useCallback((kind: 'arm' | 'leg'): Injury['location'] => {
    const left = kind === 'arm' ? 'leftArm' : 'leftLeg';
    const right = kind === 'arm' ? 'rightArm' : 'rightLeg';
    const has = (loc: string) => (defender?.injuries ?? []).some(i => i.isActive && i.location === loc);
    if (has(left) && !has(right)) return right;
    if (has(right) && !has(left)) return left;
    return Math.random() < 0.5 ? left : right;
  }, [defender]);

  // Apply the aimed-shot targeted crit effect to the defender.
  const applyAimedCritEffect = useCallback(() => {
    if (!defender || !aimedCritPart) return;
    const fx = TARGETED_CRIT_EFFECTS[aimedCritPart];
    const notes: string[] = [];
    if (fx.cripples === 'arm') { const loc = pickLimbSide('arm'); addInjury(defender.id, makeInjury(loc, 'Crippled arm')); notes.push(`Crippled ${loc}`); }
    if (fx.cripples === 'leg') { const loc = pickLimbSide('leg'); addInjury(defender.id, makeInjury(loc, 'Crippled leg')); notes.push(`Crippled ${loc}`); }
    if (fx.blinds) { addInjury(defender.id, makeInjury('eyes', 'Blindness')); notes.push('Blinded (PE → 1)'); }
    if (fx.knocksUnconscious) {
      // Unconscious targets drop prone automatically and skip their turns (1d4).
      const turns = rollDie(4);
      setPosition(defender.id, 'prone');
      setKnockedOut(defender.id, turns);
      notes.push(`Target knocked unconscious for ${turns} turn(s) — knocked prone`);
    }
    setAimedCritNotes(notes);
    setAimedCritApplied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [defender, aimedCritPart, pickLimbSide, addInjury, makeInjury, setPosition, setKnockedOut]);

  const handleApplyDamage = useCallback(() => {
    if (!defender || totalDamage === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    applyDamage(defender.id, totalDamage);
    // Auto-apply the aimed-shot targeted crit injury (no hidden extra tap).
    if (primaryIsCrit && isAimed && aimedCritPart && !aimedCritApplied) {
      applyAimedCritEffect();
    }
    setDamageApplied(true);
  }, [defender, totalDamage, applyDamage, primaryIsCrit, isAimed, aimedCritPart, aimedCritApplied, applyAimedCritEffect]);

  // Apply a critical-hit table entry to the defender (shared by the 1d10 roll
  // and the manual "player rolled in real life" selection).
  const applyCritEntry = useCallback((entry: CritTableEntry, manual: boolean) => {
    if (!defender) return;
    // One resolution per critical event — repeated taps/rolls would stack
    // duplicate injuries. The entry resets when a new attack is rolled.
    if (critTableEntry) return;
    setCritTableEntry(entry);
    setShotDamages(null); setDamageApplied(false);
    const notes: string[] = [`${manual ? 'Manual pick' : 'Rolled'} ${entry.roll}: ${entry.title}`];
    if (entry.cripples === 'arm') { const loc = pickLimbSide('arm'); addInjury(defender.id, makeInjury(loc, 'Crippled arm')); notes.push(`Crippled ${loc}`); }
    if (entry.cripples === 'leg') { const loc = pickLimbSide('leg'); addInjury(defender.id, makeInjury(loc, 'Crippled leg')); notes.push(`Crippled ${loc}`); }
    if (entry.blinds) { addInjury(defender.id, makeInjury('eyes', 'Blindness')); notes.push('Blinded (PE → 1)'); }
    if (entry.knockdown) { setPosition(defender.id, 'prone'); notes.push('Knocked down (prone)'); }
    if (entry.unconsciousTurns) {
      const turns = rollDie(4);
      // Unconscious targets drop prone automatically and skip their turns.
      setPosition(defender.id, 'prone');
      setKnockedOut(defender.id, turns);
      notes.push(`Unconscious for ${turns} turn(s) (${entry.unconsciousTurns}) — knocked prone`);
    }
    if (entry.instantDeath) { applyDamage(defender.id, defender.currentHp); notes.push('INSTANT DEATH — HP set to 0'); }
    setCritEffectNotes(notes);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [defender, critTableEntry, pickLimbSide, addInjury, makeInjury, setPosition, setKnockedOut, applyDamage]);

  // Roll on the non-aimed critical-hit table (1d10) and apply the result.
  const rollCritTable = useCallback(() => {
    const critRoll = rollD10();
    const entry = CRITICAL_HIT_TABLE.find(e => e.roll === critRoll) ?? CRITICAL_HIT_TABLE[0];
    applyCritEntry(entry, false);
  }, [applyCritEntry]);

  // A critical failure must be resolved (rolled on the Critical Failure table)
  // before the attacker may continue — the failure effect can't be skipped.
  const critFailPending = isCritFail && !critFailEntry;
  // The attack button is blocked while a crit-fail is unresolved, or when the
  // attacker physically cannot make this attack (crippled arms / two-handed
  // block / prone melee).
  // A knocked-out attacker cannot act at all.
  const attackerKO = !!attacker?.isKnockedOut;
  const specialTechniqueUnavailable = !!specialUnarmedAttack && specialUnarmedEligibility?.eligible === false;
  const attackBlocked = critFailPending || cannotUseWeapons || twoHandedBlocked || proneMeleeBlocked || attackerKO || specialTechniqueUnavailable;

  // Roll on the Critical Failure table (1d10) and auto-apply to the ATTACKER.
  const rollCritFailTable = useCallback(() => {
    if (!attacker) return;
    const failRoll = rollD10();
    const entry = CRITICAL_FAILURE_TABLE.find(e => e.roll === failRoll) ?? CRITICAL_FAILURE_TABLE[0];
    setCritFailEntry(entry);
    const notes: string[] = [];
    const isExplosiveOrEnergy = !!weapon && (weapon.damageType === 'explosion' || weapon.damageType === 'plasma' || weapon.damageType === 'laser' || weapon.damageType === 'fire' || weapon.skill === 'energyWeapons');

    if (entry.emptyAmmo) {
      if (weapon && weapon.magazineSize > 0) {
        spendAmmo(attacker.id, weapon.id, currentAmmo); // discard the whole magazine
        notes.push('Magazine discarded — ammo set to 0');
      } else notes.push('Gun does not fire (no magazine to discard)');
    }
    if (entry.jam) {
      if (weapon) { jamWeapon(attacker.id, weapon.id); notes.push('Weapon jammed — 1 turn to unjam; ammo discarded'); if (weapon.magazineSize > 0) spendAmmo(attacker.id, weapon.id, currentAmmo); }
    }
    if (entry.loseAllAP) {
      if (attacker.currentAP > 0) spendAP(attacker.id, attacker.currentAP);
      notes.push('Lost all remaining AP');
    }
    if (entry.explode) {
      if (isExplosiveOrEnergy) {
        const dmg = rollDie(10) + rollDie(10) + rollDie(10) + 7;
        applyDamage(attacker.id, dmg);
        notes.push(`Weapon exploded — ${dmg} damage (3d10+7) to attacker; hits everyone within 2 hexes`);
      } else {
        notes.push('Weapon Explodes only applies to explosive/energy weapons — no effect');
      }
    }
    if (entry.damageSelfHalf) {
      if (weapon) {
        const rolls = Array.from({ length: weapon.damageDieCount }, () => rollDie(weapon.damageDie));
        const rawBase = rolls.reduce((a, b) => a + b, 0) + weapon.damageBonus;
        const half = Math.max(1, Math.floor(rawBase / 2));
        // Attacker's own armor applies per normal damage rules.
        const selfBodyArmor = attacker.equippedBodyArmorId ? allArmor.find(a => a.id === attacker.equippedBodyArmorId) ?? null : null;
        const selfHelmet = attacker.equippedHelmetId ? allArmor.find(a => a.id === attacker.equippedHelmetId) ?? null : null;
        const selfNatural = attacker.naturalProtection ?? getRaceById(attacker.race)?.naturalProtection ?? null;
        const sp = combinedProtectionFor(weapon.damageType, selfBodyArmor as any, selfHelmet as any, selfNatural, shieldFor(attacker).prot);
        const finalSelf = applyProtection(half, sp.dt, sp.dr);
        applyDamage(attacker.id, finalSelf);
        notes.push(`Damaged self — ${finalSelf} damage (half of ${rawBase}, armor applied)`);
      }
    }
    if (entry.slipAndFall) {
      if (attacker.currentAP > 0) spendAP(attacker.id, attacker.currentAP);
      setPosition(attacker.id, 'prone');
      notes.push('Slipped and fell — lost all AP, now prone (must get up next round; no AGI AC while down)');
    }
    if (entry.breaks) {
      if (weapon) { setWeaponCondition(attacker.id, weapon.id, CONDITION_BOXES_MAX); notes.push('Weapon broken beyond repair'); }
    }
    if (entry.anvil) {
      const dmg = rollDie(10);
      applyDamage(attacker.id, dmg); // raw — DT/DR disregarded
      notes.push(`Anvil! ${dmg} raw damage to attacker (DT/DR ignored)`);
    }
    if (entry.displayOnly) {
      if (entry.roll === 4) notes.push('Dropped weapon — it fell to the ground (GM adjudicates)');
      if (entry.roll === 6) notes.push('Hit the next closest target instead (GM adjudicates)');
    }
    setCritFailNotes(notes);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [attacker, weapon, currentAmmo, allArmor, spendAmmo, jamWeapon, spendAP, applyDamage, setPosition, setWeaponCondition]);

  // Display-level DT/DR (before calculateDamage is called) — armor + natural protection
  const displayProt = weapon ? combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot) : { dt: 0, dr: 0 };
  const combinedDT = displayProt.dt;
  const combinedDR = displayProt.dr;

  // Compact DT/DR summary across all damage types for the defender info panel
  const defenderProtSummary = DAMAGE_TYPE_ORDER.map(dt => {
    const p = combinedProtectionFor(dt, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot);
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
                    const seq = combatSequence(c);
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
                      <Text style={{ fontSize: 10, color: colors.mutedForeground }}>SEQ {combatSequence(c)} · HP {c.currentHp}/{c.maxHp} · AP {c.maxAP}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setInitRolls(prev => ({ ...prev, [c.id]: Math.max(0, (prev[c.id] ?? 10) - 1) }))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{initRolls[c.id] ?? 10}</Text>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setInitRolls(prev => ({ ...prev, [c.id]: Math.min(50, (prev[c.id] ?? 10) + 1) }))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                    </View>
                    <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 4, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => {
                      const seq = combatSequence(c);
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
                      sequence: combatSequence(c),
                      maxHp: c.maxHp,
                      currentHp: c.currentHp,
                      maxAP: effectiveDerivedStats(c).maxAP,
                      currentAP: effectiveDerivedStats(c).maxAP,
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
          <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
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
                    {attacker.isKnockedOut && <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>💫 KO — {attacker.knockOutRoundsLeft} turn(s)</Text>}
                    {attacker.special && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>AP {Math.min(attacker.currentAP, attackerEffDerived?.maxAP ?? attacker.maxAP)}/{attackerEffDerived?.maxAP ?? attacker.maxAP} · {attackerPos}</Text>}
                    {/* Ammo display: count + loaded ammo type (shorthand) */}
                    {weapon && weapon.magazineSize > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: hasAmmo ? colors.primary : colors.destructive }}>
                          [{currentAmmo}/{weapon.magazineSize}]
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: loadedAmmo ? colors.foreground : colors.mutedForeground }} numberOfLines={1}>
                          {loadedAmmo ? shortAmmoName(loadedAmmo.name) : 'standard'}
                        </Text>
                        {conditionBoxes > 0 && (
                          <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>COND {conditionBoxes}/{CONDITION_BOXES_MAX}</Text>
                        )}
                      </View>
                    )}
                    {/* Dual wield: off-hand weapon (+ its ammo) and attack-session selection. */}
                    {dualWielding && offhandWeapon && (
                      <TouchableOpacity onPress={() => selectAttackWeapon(offhandWeapon.id)} style={{ marginTop: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }} numberOfLines={1}>
                          ⇄ Off-hand: {offhandWeapon.name}
                          {offhandWeapon.magazineSize > 0
                            ? ` [${attacker.weaponAmmoStates.find(a => a.weaponId === offhandWeapon.id)?.currentAmmo ?? offhandWeapon.magazineSize}/${offhandWeapon.magazineSize}]`
                            : ''}
                          {weapon?.id === offhandWeapon.id ? '  (selected)' : '  (tap to attack)'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {attackerInjury && attackerInjury.notes.length > 0 && attackerInjury.notes.map((n, i) => (
                      <Text key={i} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#f59e0b' }}>⚠ {n}</Text>
                    ))}
                    {/* Active chem effects (green) */}
                    {(attacker.effects ?? []).filter(e => e.isActive).map(e => (
                      <Text key={e.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }} numberOfLines={1}>
                        ⚗ {e.name}{describeEffectMods(e) ? ` — ${describeEffectMods(e)}` : ''}
                      </Text>
                    ))}
                    {computeConditionModifiers(attacker).active.map(condition => (
                      <Text key={condition.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.destructive }} numberOfLines={2}>
                        ⚠ {condition.name} — {condition.description}
                      </Text>
                    ))}
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

            <Feather name="arrow-right" size={20} color={colors.mutedForeground} style={{ alignSelf: "center" }} />

            {/* Defender */}
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: defender ? colors.destructive : colors.border, padding: 10, gap: 10, minHeight: 80 }} onPress={() => setShowDefenderPicker(true)}>
              {defender ? (
                <>
                  <CharacterAvatar portrait={defender.portrait} name={defender.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>{defender.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive, marginTop: 1 }}>
                      AC: {defenderAC}{defender.tempAC > 0 ? ` (+${defender.tempAC} temp)` : ''}{defenderAgiAcDelta > 0 ? ` (−${defenderAgiAcDelta} ${defenderPos})` : ''}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }} numberOfLines={2}>
                      {defenderProtSummary}
                    </Text>
                    {defenderNatural && <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.primary }}>incl. natural protection</Text>}
                    {(defenderShield.ac > 0 || defenderShield.prot) && <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.primary }}>🛡 incl. shield{defenderShield.ac > 0 ? ` (+${defenderShield.ac} AC)` : ''}</Text>}
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      Pos: {defenderPos}{defender.special ? ` · HP ${defender.currentHp}/${defender.maxHp} · AP ${defender.currentAP}/${defender.maxAP}` : ''}
                    </Text>
                    {defender.isKnockedOut && <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>💫 KO — {defender.knockOutRoundsLeft} turn(s)</Text>}
                    {defenderInjury && defenderInjury.notes.length > 0 && defenderInjury.notes.map((n, i) => (
                      <Text key={i} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#f59e0b' }}>⚠ {n}</Text>
                    ))}
                    {/* Active chem effects (green) */}
                    {(defender.effects ?? []).filter(e => e.isActive).map(e => (
                      <Text key={e.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }} numberOfLines={1}>
                        ⚗ {e.name}{describeEffectMods(e) ? ` — ${describeEffectMods(e)}` : ''}
                      </Text>
                    ))}
                    {computeConditionModifiers(defender).active.map(condition => (
                      <Text key={condition.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.destructive }} numberOfLines={2}>
                        ⚠ {condition.name} — {condition.description}
                      </Text>
                    ))}
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

          {/* Special Unarmed Attack selector (manual pp. 18–19). */}
          {canRoll && canUseSpecialUnarmed && attacker && (
            <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: specialUnarmedAttack ? colors.primary : colors.border, padding: 10, gap: 4 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.5 }}>SPECIAL UNARMED ATTACK</Text>
              <TouchableOpacity
                onPress={() => setShowSpecialUnarmedPicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: specialUnarmedAttack ? colors.primary : colors.foreground }}>
                    {specialUnarmedAttack?.name ?? 'Standard Attack'}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    {specialUnarmedAttack
                      ? `${formatSpecialUnarmedEffects(specialUnarmedAttack)} · Requires ${formatSpecialUnarmedRequirements(specialUnarmedAttack)}`
                      : 'Choose one of the 12 manual techniques'}
                  </Text>
                </View>
                <Feather name="chevron-down" size={16} color={colors.primary} />
              </TouchableOpacity>
              {specialTechniqueUnavailable && (
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>
                  Requirements are no longer met. Choose another technique.
                </Text>
              )}
            </View>
          )}

          {/* A local attack choice keeps the persistent active hand separate from
              the weapon whose rules drive this attack. */}
          {canRoll && dualWielding && activeWeapon && offhandWeapon && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.5 }}>ATTACK WITH</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[{ label: 'PRIMARY', value: activeWeapon }, { label: 'OFF-HAND', value: offhandWeapon }].map(option => {
                  const selected = weapon?.id === option.value.id;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => selectAttackWeapon(option.value.id)}
                      style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 9, borderRadius: colors.radius, backgroundColor: selected ? colors.primary : colors.secondary, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                    >
                      <Text style={{ textAlign: 'center', fontSize: 10, fontFamily: 'Inter_700Bold', color: selected ? colors.primaryForeground : colors.mutedForeground, letterSpacing: 1 }}>{option.label}</Text>
                      <Text style={{ textAlign: 'center', fontSize: 11, fontFamily: 'Inter_600SemiBold', color: selected ? colors.primaryForeground : colors.foreground }} numberOfLines={1}>{option.value.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Attack AP controls; the active weapon name removes dual-wield ambiguity. */}
          {canRoll && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {!apSpent && (
                  <TouchableOpacity
                    disabled={!attackerHasAP || attackBlocked}
                    style={{ minWidth: '48%', flexGrow: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: attackerHasAP && !attackBlocked ? colors.primary : colors.secondary, borderWidth: 1, borderColor: attackerHasAP ? colors.primary : colors.destructive, opacity: attackBlocked ? 0.45 : 1 }}
                    onPress={handleSpendAP}
                  >
                    <Text style={{ textAlign: 'center', fontSize: 12, fontFamily: 'Inter_700Bold', color: attackerHasAP && !attackBlocked ? colors.primaryForeground : colors.mutedForeground }}>
                      SPEND {effectiveAPCost} AP — {weapon?.name.toUpperCase()}
                    </Text>
                    {!!specialUnarmedAttack && (
                      <Text style={{ textAlign: 'center', fontSize: 9, fontFamily: 'Inter_400Regular', color: attackerHasAP && !attackBlocked ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>
                        {specialUnarmedAttack.name.toUpperCase()}
                      </Text>
                    )}
                    {!attackerHasAP && (
                      <Text style={{ textAlign: 'center', fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
                        HAVE {attacker?.currentAP ?? 0} AP
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                {apSpent && (
                  <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: '#4a8c3f22', borderWidth: 1, borderColor: '#4a8c3f' }}>
                    <Text style={{ textAlign: 'center', fontSize: 12, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>✓ AP SPENT — {weapon?.name.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              {/* Reload belongs below the attack-spend control(s). */}
              {reloadableHeldWeapons.length > 0 && (
                <TouchableOpacity disabled={allHeldMagazinesFull} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: allHeldMagazinesFull ? 0.4 : 1 }} onPress={() => {
                  if (reloadableHeldWeapons.length > 1) setShowReloadPicker(true);
                  else handleReloadWeapon(reloadableHeldWeapons[0]);
                }}>
                  <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>
                    {reloadableHeldWeapons.length > 1 ? 'RELOAD HELD WEAPON' : `RELOAD ${computeModEffects(reloadableHeldWeapons[0]).reloadApOverride ?? AP_COSTS.RELOAD} AP`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Spend AP — movement & position actions */}
          {attacker && (
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => setShowApActions(v => !v)}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>SPEND AP — ACTIONS</Text>
                <Feather name={showApActions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showApActions && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    {attacker.name} · Position: {(attacker.position ?? 'standing').toUpperCase()} · AP {Math.min(attacker.currentAP, attackerEffDerived?.maxAP ?? attacker.maxAP)}/{attackerEffDerived?.maxAP ?? attacker.maxAP}
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

                  {/* Other AP-costed actions — compact grid */}
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 2 }}>ACTIONS</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {([
                      { key: 'take_chems', label: 'TAKE CHEMS', cost: CHEM_AP_COST, onPress: () => setShowChemPicker(true) },
                      { key: 'equip', label: 'EQUIP/SWITCH', cost: AP_COSTS.EQUIP_WEAPON, onPress: () => { setWeaponPickerFree(false); setShowWeaponPicker(true); } },
                      { key: 'grab_use_item', label: 'GRAB / USE ITEM', cost: AP_COSTS.USE_ITEM, onPress: () => handleGenericApAction(AP_COSTS.USE_ITEM, 'Grab / Use Item') },
                      { key: 'use_skill', label: 'USE SKILL', cost: AP_COSTS.USE_SKILL, onPress: () => handleGenericApAction(AP_COSTS.USE_SKILL, 'Use Skill') },
                      { key: 'lay_mine', label: 'LAY MINE', cost: AP_COSTS.LAYING_MINE, onPress: () => handleGenericApAction(AP_COSTS.LAYING_MINE, 'Lay Mine') },
                    ] as { key: string; label: string; cost: number; onPress: () => void }[]).map(action => {
                      const disabled = attacker.currentAP < action.cost;
                      return (
                        <TouchableOpacity
                          key={action.key}
                          disabled={disabled}
                          style={{ minWidth: '30%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, opacity: disabled ? 0.4 : 1 }}
                          onPress={action.onPress}
                        >
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{action.label}</Text>
                          <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{action.cost} AP</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Set Up Tripod — costs ALL remaining AP (success or fail) */}
                    <TouchableOpacity
                      disabled={attacker.currentAP < 1}
                      style={{ minWidth: '30%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, opacity: attacker.currentAP < 1 ? 0.4 : 1 }}
                      onPress={handleSetupTripod}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground }}>SET UP TRIPOD</Text>
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>ALL AP</Text>
                    </TouchableOpacity>
                    {/* Defend — forfeit remaining AP → temp AC */}
                    <TouchableOpacity
                      disabled={attacker.currentAP < 1}
                      style={{ minWidth: '30%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: '#4a8c3f', opacity: attacker.currentAP < 1 ? 0.4 : 1 }}
                      onPress={handleDefend}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>DEFEND</Text>
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>→ +AC</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, fontStyle: 'italic' }}>
                    Set Up Tripod spends ALL remaining AP this round (success or fail). Defend forfeits remaining AP, converting it to temporary AC.
                  </Text>
                  {/* GM overrides — free, no AP */}
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={{ minWidth: '30%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.mutedForeground }}
                      onPress={() => { setWeaponPickerFree(true); setShowWeaponPicker(true); }}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground }}>SET WEAPON</Text>
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>FREE</Text>
                    </TouchableOpacity>
                    {compatibleAmmo.length > 0 && (
                      <TouchableOpacity
                        style={{ minWidth: '30%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.mutedForeground }}
                        onPress={() => setShowAmmoPicker(true)}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground }}>CHANGE AMMO</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>FREE</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─── Burst / Double-Shot Mode ─── */}
        {canRoll && weapon && !specialUnarmedAttack && (canBurst || weapon.isDoubleShot) && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>FIRE MODE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: !isBurst && !doubleShotActive ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => { setIsBurst(false); setDoubleShotActive(false); }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: !isBurst && !doubleShotActive ? colors.primaryForeground : colors.mutedForeground }}>SINGLE</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: !isBurst && !doubleShotActive ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>{wSingle} AP</Text>
              </TouchableOpacity>
              {canBurst && (
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: isBurst ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => { setIsBurst(true); setDoubleShotActive(false); }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: isBurst ? colors.primaryForeground : colors.mutedForeground }}>BURST</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: isBurst ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>{wBurst} AP</Text>
                </TouchableOpacity>
              )}
              {weapon.isDoubleShot && (
                <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: doubleShotActive ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => { setDoubleShotActive(true); setIsBurst(false); }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: doubleShotActive ? colors.primaryForeground : colors.mutedForeground }}>DOUBLE</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: doubleShotActive ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>{AP_COSTS.ATTACK_DOUBLE_SHOT} AP</Text>
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
              {effectiveLightPenalty !== 0 && <FormulaLine label={`Light penalty${perkBonuses.lightReduction > 0 ? ' (halved by perk)' : ''}`} value={`−${effectiveLightPenalty}%`} color={colors.destructive} />}
              {specialUnarmedAttack?.armorClassPiercing
                ? <FormulaLine label="Armor Class (piercing technique)" value="IGNORED" color="#4a8c3f" />
                : <FormulaLine label="Armor Class" value={`−${defenderAC}%`} color={colors.destructive} />}
              {defender?.tempAC && defender.tempAC > 0 ? <FormulaLine label="  (temp AC)" value={`+${defender.tempAC} from unspent AP`} color={colors.mutedForeground} /> : null}
              {coverPenalty !== 0 && <FormulaLine label="Cover penalty" value={`−${coverPenalty}%`} color={colors.destructive} />}
              {weaponBonus !== 0 && <FormulaLine label="Manual to-hit adjust" value={`${weaponBonus >= 0 ? '+' : ''}${weaponBonus}%`} color={weaponBonus > 0 ? '#4a8c3f' : colors.destructive} />}
              {modBonuses.toHit !== 0 && <FormulaLine label="Weapon mods (auto)" value={`${modBonuses.toHit >= 0 ? '+' : ''}${modBonuses.toHit}%`} color={modBonuses.toHit > 0 ? '#4a8c3f' : colors.destructive} />}
              {conditionPenalty > 0 && <FormulaLine label="Weapon condition" value={`−${conditionPenalty}%`} color={colors.destructive} />}
              {positionBonus !== 0 && <FormulaLine label={`Position (${POSITION_OPTIONS[posIdxFromChar].label})`} value={`+${positionBonus}%`} color="#4a8c3f" />}
              {targetedPenalty !== 0 && <FormulaLine label={`Targeted (${TARGETED_OPTIONS[targetedIdx].label})`} value={`−${targetedPenalty}%`} color={colors.destructive} />}
              {perkBonuses.toHit !== 0 && <FormulaLine label="Perk to-hit bonus" value={`+${perkBonuses.toHit}%`} color="#4a8c3f" />}
              {strReqPenalty > 0 && <FormulaLine label={`STR req penalty (STR ${attackerStr}/${effectiveMinStr})`} value={`−${strReqPenalty}%`} color={colors.destructive} />}
              {isBurst && effectiveBurstShots > 1 && <FormulaLine label="Burst penalties" value={burstPenalties.slice(1).map(p => `${p}%`).join(', ')} color={colors.destructive} />}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
              <FormulaLine label="= Chance to Hit" value={`${shotChances[0]}%`} color={shotChances[0] >= 60 ? '#4a8c3f' : shotChances[0] >= 35 ? colors.primary : colors.destructive} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 2 }}>
                Crit chance: {totalCritChance}% (base {attackerBaseCrit}%{aimCritBonus > 0 ? ` + aimed ${aimCritBonus}%` : ''}{perkBonuses.critChance > 0 ? ` + perks ${perkBonuses.critChance}%` : ''}{specialCritBonus > 0 ? ` + ${specialUnarmedAttack?.name} ${specialCritBonus}%` : ''})
              </Text>
              {luckPerkApplies && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary }}>
                  {sniperApplies ? 'Sniper' : 'Slayer'}: on a hit, also crit if 1d10 ≤ Luck ({attackerLuck})
                </Text>
              )}
              {(cannotUseWeapons || twoHandedBlocked || proneMeleeBlocked || attackerKO || specialTechniqueUnavailable) && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive, marginTop: 2 }}>
                  {cannotUseWeapons ? '⚠ Both arms crippled — cannot use weapons. ' : ''}
                  {twoHandedBlocked ? '⚠ Cannot use two-handed weapon (crippled arm). ' : ''}
                  {proneMeleeBlocked ? '⚠ Prone characters cannot make melee/unarmed attacks.' : ''}
                  {attackerKO ? `⚠ Unconscious — cannot act (${attacker?.knockOutRoundsLeft ?? 0} turn(s) left).` : ''}
                  {specialTechniqueUnavailable ? '⚠ Selected special technique requirements are not met.' : ''}
                </Text>
              )}
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

                {/* Weapon condition — editable FILLED boxes (0 pristine … 10 jammed) */}
                {weapon && (
                  <View style={{ backgroundColor: colors.secondary, borderRadius: 6, padding: 8, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>WEAPON CONDITION</Text>
                      <Stepper value={conditionBoxes} step={1} min={0} max={CONDITION_BOXES_MAX} onChange={(v) => {
                        if (!attacker || !weapon) return;
                        setWeaponCondition(attacker.id, weapon.id, clampConditionBoxes(v));
                      }} formatValue={v => `${v}/${CONDITION_BOXES_MAX}`} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 3 }}>
                      {[...Array(CONDITION_BOXES_MAX)].map((_, i) => (
                        <View key={i} style={{ flex: 1, height: 8, borderRadius: 2, backgroundColor: i < conditionBoxes ? colors.destructive : '#4a8c3f' }} />
                      ))}
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: weaponBroken ? colors.destructive : conditionPenalty > 0 ? colors.destructive : '#4a8c3f' }}>
                      {conditionLabel(conditionBoxes)}{weaponBroken ? ' — jammed, cannot fire until repaired' : conditionPenalty > 0 ? ` — −${conditionPenalty}% to hit` : ' — 0% penalty'}
                    </Text>
                  </View>
                )}

                {isRanged && (
                  <View>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1, marginBottom: 6 }}>ATTACKER POSITION (no AP cost)</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {POSITION_OPTIONS.map((opt, i) => {
                        const posMap: PositionType[] = ['standing', 'crouching', 'prone'];
                        const selected = posIdxFromChar === i;
                        return (
                          <TouchableOpacity key={i} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: selected ? colors.primary : colors.secondary, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }} onPress={() => {
                            if (attacker) setPosition(attacker.id, posMap[i]);
                          }}>
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: selected ? colors.primaryForeground : colors.mutedForeground }}>{opt.label.toUpperCase()}</Text>
                            {opt.bonus !== 0 && <Text style={{ fontSize: 10, color: selected ? colors.primaryForeground + 'cc' : '#4a8c3f' }}>+{opt.bonus}%</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
                {canTarget && (
                <View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1, marginBottom: 6 }}>TARGETED SHOT</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {TARGETED_OPTIONS.map((opt, i) => {
                      const pen = isRanged ? opt.ranged : opt.melee;
                      const critB = opt.bodyPart ? TARGETED_CRIT_BONUS[opt.bodyPart] : 0;
                      return (
                        <TouchableOpacity key={i} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: targetedIdx === i ? colors.primary : colors.secondary, borderWidth: 1, borderColor: targetedIdx === i ? colors.primary : colors.border }} onPress={() => setTargetedIdx(i)}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: targetedIdx === i ? colors.primaryForeground : colors.foreground }}>{opt.label}</Text>
                          {pen !== 0 && <Text style={{ fontSize: 10, color: targetedIdx === i ? colors.primaryForeground + 'cc' : colors.destructive }}>−{pen}%</Text>}
                          {critB > 0 && <Text style={{ fontSize: 10, color: targetedIdx === i ? colors.primaryForeground + 'cc' : colors.primary }}>+{critB}% crit</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                )}
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
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 12, gap: 8, backgroundColor: (canRoll && !attackBlocked) ? colors.primary : colors.secondary, opacity: (canRoll && !attackBlocked) ? 1 : 0.5 }} onPress={rollDice} disabled={!canRoll || attackBlocked}>
              <Feather name="crosshair" size={16} color={canRoll ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: canRoll ? colors.primaryForeground : colors.mutedForeground }}>{attackActionLabel}{attackResolved ? ' AGAIN' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 11, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: physicalHitConfirmed ? '#4a8c3f' : colors.primary, opacity: (!canRoll || attackBlocked || attackResolved || isBurst) ? 0.5 : 1 }}
              onPress={confirmPhysicalHit}
              disabled={!canRoll || attackBlocked || attackResolved || isBurst}
            >
              <Feather name="check-circle" size={16} color={physicalHitConfirmed ? '#4a8c3f' : colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: physicalHitConfirmed ? '#4a8c3f' : colors.primary }}>
                {physicalHitConfirmed ? 'PHYSICAL HIT CONFIRMED' : 'CONFIRM PHYSICAL HIT'}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
              {isBurst
                ? 'Physical hit confirmation is available for single attacks only.'
                : 'Use after a successful physical percentile roll. Records one normal hit and consumes this weapon’s ammo.'}
            </Text>
            {attackResolved && (
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
                Press {attackActionLabel} again to make another attack (costs {effectiveAPCost} AP — spend it above).
              </Text>
            )}
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
            {streamlinedRolled && streamlinedHits > 0 && weapon && !streamlinedDmgResult && (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 12, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary }} onPress={() => {
                const burstProt = combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot);
                const ammoIgnoresDT = !!loadedAmmo?.ignoresDT;
                const burstDT = ammoIgnoresDT ? 0 : Math.max(0, burstProt.dt - perkBonuses.ignoreDT);
                const burstDR = Math.max(0, Math.min(90, burstProt.dr + (loadedAmmo?.drMod ?? 0) + defenderPerkDef.dr + (defenderEffectMods?.drMod ?? 0)));
                const raceMeleeBonus = isMelee ? (getRaceById(attacker?.race ?? '')?.bonusMeleeDamage ?? 0) : 0;
                const hthPerkBonus = isMelee ? 2 * (attacker?.perks.find(p => p.perkId === 'bonus_hth_damage')?.rank ?? 0) : 0;
                const traitMeleeBonus = isMelee && attacker ? (computeTraitEffects(attacker).meleeDamageBonus ?? 0) : 0;
                const meleeDmgBonus = isMelee
                  ? Math.max(0, (attackerEffSpecial ? calcMeleeDamageBonus(attackerEffSpecial) : 0) + raceMeleeBonus + hthPerkBonus + traitMeleeBonus)
                  : 0;
                const perHit = Array.from({ length: streamlinedHits }, () => {
                  const rolls = Array.from({ length: weapon.damageDieCount }, () => rollDie(weapon.damageDie));
                  const ammoRolls = loadedAmmo && loadedAmmo.dmgDieCount > 0 && loadedAmmo.dmgDie > 0
                    ? Array.from({ length: loadedAmmo.dmgDieCount }, () => rollDie(loadedAmmo.dmgDie)) : [];
                  const raw = rolls.reduce((a, b) => a + b, 0) + ammoRolls.reduce((a, b) => a + b, 0)
                    + (loadedAmmo?.dmgBonus ?? 0) + weapon.damageBonus + meleeDmgBonus + modBonuses.damage + perkBonuses.damage;
                  return applyProtection(raw, burstDT, burstDR);
                });
                const totalBurstDmg = perHit.reduce((a, b) => a + b, 0);
                setStreamlinedDmgResult({ perHit, total: totalBurstDmg, dt: burstDT, dr: burstDR });
                if (defender) applyDamage(defender.id, totalBurstDmg);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ROLL & APPLY {streamlinedHits} HIT DAMAGE</Text>
              </TouchableOpacity>
            )}
            {streamlinedDmgResult && (
              <View style={{ borderWidth: 1, borderRadius: colors.radius, padding: 10, borderColor: colors.destructive, gap: 4 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>BURST DAMAGE APPLIED{defender ? ` → ${defender.name.toUpperCase()}` : ''}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
                  Per hit (after DT {streamlinedDmgResult.dt}{streamlinedDmgResult.dr > 0 ? ` / DR ${streamlinedDmgResult.dr}%` : ''}): [{streamlinedDmgResult.perHit.join(', ')}]
                </Text>
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.destructive }}>= {streamlinedDmgResult.total} total damage</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Shot Results (Complex/Single) ─── */}
        {attackResolved && canRoll && (!isBurst || burstMode === 'complex') && (
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
                       {shot.roll === null ? (
                         <Text style={{ color: colors.primary }}>PHYSICAL ROLL</Text>
                       ) : (
                         <>
                           <Text style={{ color: colors.primary }}>{String(shot.roll).padStart(2, '0')}</Text>
                           <Text style={{ color: colors.mutedForeground }}> vs </Text>
                           <Text style={{ color: shot.hit ? '#4a8c3f' : colors.destructive }}>{shot.chanceToHit}%</Text>
                         </>
                       )}
                    </Text>
                    {shot.hit && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 2 }}>
                      {shot.roll === null ? 'Successful roll confirmed · NORMAL HIT' : `Beat by ${shot.margin}%${shot.isCrit ? ' · CRITICAL HIT' : ''}`}
                    </Text>}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── Prominent Critical Hit banner ─── */}
        {primaryIsCrit && (
          <View style={{ backgroundColor: colors.primary, borderRadius: colors.radius, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 3 }}>★ CRITICAL HIT</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primaryForeground + 'dd' }}>
              {isAimed && aimedCritPart
                ? `Aimed at ${aimedCritPart.toUpperCase()} — ${TARGETED_CRIT_EFFECTS[aimedCritPart].label}`
                : critTableEntry ? `${critTableEntry.title}` : 'Roll the Critical Hits table below'}
            </Text>
          </View>
        )}

        {/* ─── Aimed Critical (targeted body-part effect) ─── */}
        {primaryIsCrit && isAimed && aimedCritPart && (
          <View style={{ backgroundColor: colors.primary + '22', borderRadius: colors.radius, padding: 12, borderWidth: 2, borderColor: colors.primary, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="zap" size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>AIMED CRITICAL — {aimedCritPart.toUpperCase()}</Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{TARGETED_CRIT_EFFECTS[aimedCritPart].label} (×{TARGETED_CRIT_EFFECTS[aimedCritPart].damageMultiplier} damage)</Text>
            {!aimedCritApplied ? (
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, fontStyle: 'italic' }}>
                The ×{TARGETED_CRIT_EFFECTS[aimedCritPart].damageMultiplier} multiplier is included in the damage roll; the injury is applied automatically when you Apply Damage. (Or apply the effect now.)
              </Text>
            ) : null}
            {!aimedCritApplied ? (
              <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={applyAimedCritEffect} disabled={!defender}>
                <Feather name="alert-triangle" size={14} color="#fff" />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 1 }}>APPLY CRITICAL EFFECT NOW</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 2 }}>
                {aimedCritNotes.length === 0
                  ? <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>• Critical effect applied</Text>
                  : aimedCritNotes.map((n, i) => <Text key={i} style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>• {n}</Text>)}
              </View>
            )}
          </View>
        )}

        {/* ─── Non-aimed Critical Hit summary ─── */}
        {primaryIsCrit && !isAimed && (
          <View style={{ backgroundColor: colors.primary + '22', borderRadius: colors.radius, padding: 12, borderWidth: 2, borderColor: colors.primary, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="zap" size={18} color={colors.primary} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>CRITICAL HIT!</Text>
            </View>
            {!critTableEntry ? (
              <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={() => setShowCritModal(true)}>
                <Feather name="list" size={14} color={colors.primaryForeground} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>OPEN CRITICAL HITS TABLE</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>[{critTableEntry.roll}] {critTableEntry.title}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{critTableEntry.description}</Text>
                {critTableEntry.damageMultiplier ? <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>Damage ×{critTableEntry.damageMultiplier} (flows into damage roll)</Text> : null}
                {critEffectNotes.map((n, i) => <Text key={i} style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>• {n}</Text>)}
                <TouchableOpacity style={{ marginTop: 4, paddingVertical: 6, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary }} onPress={() => setShowCritModal(true)}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>VIEW CRITICAL HITS TABLE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ─── Critical Failure callout ─── */}
        {isCritFail && (
          <View style={{ backgroundColor: colors.destructive + '22', borderRadius: colors.radius, padding: 12, borderWidth: 2, borderColor: colors.destructive, gap: 6 }}>
            <View style={{ backgroundColor: colors.destructive, borderRadius: colors.radius, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 2 }}>💀 CRITICAL FAILURE</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Missed with 97-100% — roll on the Critical Failure Table</Text>
            </View>
            {!critFailEntry ? (
              <TouchableOpacity style={{ paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={() => setShowCritFailModal(true)}>
                <Feather name="list" size={14} color="#fff" />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 1 }}>OPEN CRITICAL FAILURE TABLE</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.destructive }}>[{critFailEntry.roll}] {critFailEntry.title}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{critFailEntry.description}</Text>
                {critFailNotes.map((n, i) => <Text key={i} style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>• {n}</Text>)}
                <TouchableOpacity style={{ marginTop: 4, paddingVertical: 6, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive }} onPress={() => setShowCritFailModal(true)}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>VIEW CRITICAL FAILURE TABLE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ─── Damage ─── */}
        {attackResolved && shotResults.some(s => s.hit) && weapon && (!isBurst || burstMode === 'complex') && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>DAMAGE CALCULATION</Text>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                {doubleShotActive ? `Double-shot: ${weapon.damageDieCount * 2}` : weapon.damageDieCount}d{weapon.damageDie}{weapon.damageBonus > 0 ? `+${weapon.damageBonus}` : ''} · {weapon.damageType.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                DT {weapon ? DAMAGE_TYPE_LABELS[weapon.damageType] : ''}: {combinedDT}{perkBonuses.ignoreDT > 0 ? ` (−${perkBonuses.ignoreDT} ignored)` : ''} → effective {Math.max(0, combinedDT - perkBonuses.ignoreDT)}{combinedDR > 0 ? ` · DR ${combinedDR}%` : ''} — formula: max(0,(base−DT)×(1−DR%))
              </Text>
              {perkBonuses.damage > 0 && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>Perk damage bonus: +{perkBonuses.damage}</Text>}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.5 }}>PHYSICAL DAMAGE DICE (OPTIONAL)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={damageOverride}
                  onChangeText={(value) => {
                    setDamageOverride(value.replace(/[^0-9]/g, ''));
                    setShotDamages(null);
                    setDamageApplied(false);
                  }}
                  keyboardType="number-pad"
                  placeholder="Enter weapon + ammo dice total"
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, color: colors.foreground, backgroundColor: colors.secondary, borderWidth: 1, borderColor: damageOverride ? colors.primary : colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}
                />
                {damageOverride !== '' && (
                  <TouchableOpacity
                    onPress={() => {
                      setDamageOverride('');
                      setShotDamages(null);
                      setDamageApplied(false);
                    }}
                    style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>CLEAR</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                Replaces only the initial weapon and ammunition dice. Critical multipliers, flat bonuses, DT, and DR still apply.
              </Text>
            </View>

            {!shotDamages ? (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 12, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.primary }} onPress={calculateDamage}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ROLL DAMAGE{primaryIsCrit ? ' (CRIT)' : ''}</Text>
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
                      {dmg.manualBaseDamage !== null ? `Physical dice total: ${dmg.manualBaseDamage}` : `Weapon/ammo dice: [${dmg.baseRolls.join(', ')}]`}{weapon.damageBonus > 0 ? ` +${weapon.damageBonus} wpn` : ''}
                      {dmg.meleeDmgBonus > 0 ? ` +${dmg.meleeDmgBonus} MD` : ''}{modBonuses.damage > 0 ? ` +${modBonuses.damage} mods` : ''}{perkBonuses.damage > 0 ? ` +${perkBonuses.damage} perks` : ''}{dmg.critMultiplier > 1 ? ` ×${dmg.critMultiplier}` : ''} = {dmg.baseDmg}
                    </Text>
                    {dmg.critNotes.length > 0 && dmg.critNotes.map((n, k) => <Text key={k} style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.primary }}>⚡ {n}</Text>)}
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
                {isMeleeOrUnarmed && defender?.special && totalDamage > 0 && (
                  <KnockdownCard
                    damage={totalDamage}
                    defenderStr={defenderEffSpecial?.strength ?? defender.special.strength}
                    defenderEnd={defenderEffSpecial?.endurance ?? defender.special.endurance}
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
          initiative: combatSequence(c) + Math.floor(Math.random() * 10) + 1,
          sequence: combatSequence(c),
          maxHp: c.maxHp,
          currentHp: c.currentHp,
          maxAP: effectiveDerivedStats(c).maxAP,
          currentAP: effectiveDerivedStats(c).maxAP,
          armorClass: c.armorClass,
          tempAC: 0,
          position: c.position,
          isActive: false,
          hasActed: false,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }} title="ADD COMBATANT" characters={activeCharacters.filter(c => !initiativeEntries.some(e => e.characterId === c.id))} allWeapons={allWeapons} />
      <LightPickerModal visible={showLightPicker} value={lightPenalty} onChange={setLightPenalty} onClose={() => setShowLightPicker(false)} />
      <CriticalHitModal
        visible={showCritModal}
        onClose={() => setShowCritModal(false)}
        rolledEntry={critTableEntry}
        onRoll={rollCritTable}
        onSelect={(entry) => applyCritEntry(entry, true)}
        betterCriticals={hasBetterCriticals}
      />
      <CriticalFailureModal
        visible={showCritFailModal}
        onClose={() => setShowCritFailModal(false)}
        rolledEntry={critFailEntry}
        appliedNotes={critFailNotes}
        onRoll={rollCritFailTable}
      />
      {/* ─── Chem picker (TAKE CHEMS — AP charged on selection) ─── */}
      <OptionPickerModal
        visible={showChemPicker}
        title="TAKE CHEMS"
        subtitle={`${CHEM_AP_COST} AP — applied to ${attacker?.name ?? 'attacker'} on selection`}
        options={CHEMS.map(chem => {
          const s = chem.stages[0];
          const bits: string[] = [];
          if (s) {
            for (const [k, v] of Object.entries(s.statMods ?? {})) if (v) bits.push(`${(v as number) > 0 ? '+' : ''}${v} ${k.slice(0, 3).toUpperCase()}`);
            if (s.hpHeal) bits.push(`heal ${s.hpHeal} HP`);
            if (s.hpDamage) bits.push(`${s.hpDamage} dmg`);
            if (s.acMod) bits.push(`${s.acMod > 0 ? '+' : ''}${s.acMod} AC`);
            if (s.apMod) bits.push(`${s.apMod > 0 ? '+' : ''}${s.apMod} AP`);
            if (s.drMod) bits.push(`${s.drMod > 0 ? '+' : ''}${s.drMod}% DR`);
            if (s.radResistMod) bits.push(`${s.radResistMod > 0 ? '+' : ''}${s.radResistMod}% rad resist`);
          }
          return {
            key: chem.id,
            label: chem.name,
            sublabel: bits.length ? bits.join(' · ') : (s?.durationText ?? chem.description.slice(0, 80)),
            note: chem.isMultiStage ? 'Multi-stage — progress later stages from the Effects tab' : undefined,
          };
        })}
        onSelect={handleTakeChem}
        onClose={() => setShowChemPicker(false)}
      />
      {/* ─── Special Unarmed Attacks (manual pp. 18–19) ─── */}
      <OptionPickerModal
        visible={showSpecialUnarmedPicker}
        title="SPECIAL UNARMED ATTACK"
        subtitle="Unavailable techniques remain tappable to explain their requirements"
        options={[
          {
            key: 'standard',
            label: 'Standard Attack',
            sublabel: 'Use the weapon’s normal attack, including targeted attacks where supported',
            section: 'ATTACK TYPE',
          },
          ...SPECIAL_UNARMED_ATTACKS.map(technique => {
            const eligibility = attacker
              ? evaluateEligibility(
                  technique,
                  attacker.level,
                  attackerEffSpecial ?? attacker.special,
                  attacker.skills,
                  attacker.taggedSkills ?? [],
                )
              : null;
            const missing = eligibility?.checks
              .filter(check => !check.met)
              .map(check => `${check.label} ${check.current}/${check.required}`)
              .join(' · ');
            return {
              key: technique.id,
              label: technique.name,
              sublabel: `${formatSpecialUnarmedEffects(technique)} · Requires ${formatSpecialUnarmedRequirements(technique)}`,
              section: SPECIAL_UNARMED_GROUP_LABELS[technique.group],
              muted: eligibility?.eligible === false,
              note: missing ? `Missing: ${missing}` : undefined,
            };
          }),
        ]}
        onSelect={(id) => {
          if (id === 'standard') {
            setSpecialUnarmedAttackId(null);
            setShowSpecialUnarmedPicker(false);
            return;
          }
          const technique = getSpecialUnarmedAttack(id);
          if (!technique || !attacker) return;
          const eligibility = evaluateEligibility(
            technique,
            attacker.level,
            attackerEffSpecial ?? attacker.special,
            attacker.skills,
            attacker.taggedSkills ?? [],
          );
          if (!eligibility.eligible) {
            const missing = eligibility.checks
              .filter(check => !check.met)
              .map(check => `${check.label}: ${check.current} / ${check.required}`)
              .join('\n');
            notify(`${technique.name} — Requirements Not Met`, missing);
            return;
          }
          setSpecialUnarmedAttackId(technique.id);
          setIsBurst(false);
          setDoubleShotActive(false);
          setTargetedIdx(0);
          setShowSpecialUnarmedPicker(false);
        }}
        onClose={() => setShowSpecialUnarmedPicker(false)}
      />
      {/* ─── Weapon switch picker (inventory) ─── */}
      <OptionPickerModal
        visible={showWeaponPicker}
        title={weaponPickerFree ? 'SET WEAPON (FREE)' : 'EQUIP / SWITCH WEAPON'}
        subtitle={weaponPickerFree
          ? 'GM override — no AP spent'
          : `${AP_COSTS.EQUIP_WEAPON} AP — charged when a weapon is selected`}
        options={WEAPON_CATEGORY_ORDER.flatMap(category =>
          attackerInventory
            .filter(w => w.category === category)
            .map(w => ({
              key: w.id,
              label: `${w.name}${w.id === attacker?.equippedWeaponId ? '  (equipped)' : ''}`,
              sublabel: `${w.damageDieCount}d${w.damageDie}${w.damageBonus ? `+${w.damageBonus}` : ''} ${DAMAGE_TYPE_LABELS[w.damageType]} · ${getWeaponHands(w)}H${w.magazineSize > 0 ? ` · mag ${w.magazineSize}` : ''}`,
              disabled: w.id === attacker?.equippedWeaponId,
              section: WEAPON_CATEGORY_LABELS[category].toUpperCase(),
            })),
        )}
        onSelect={(id) => handleEquipWeapon(id, weaponPickerFree)}
        onClose={() => setShowWeaponPicker(false)}
      />
      {/* ─── Hand chooser: both hands hold 1H weapons — which gets replaced? ─── */}
      <OptionPickerModal
        visible={!!pendingHandChoice}
        title="REPLACE WHICH WEAPON?"
        subtitle={pendingHandChoice
          ? `Equipping ${allWeapons.find(w => w.id === pendingHandChoice.weaponId)?.name ?? 'weapon'}${pendingHandChoice.free ? ' (free)' : ` — ${AP_COSTS.EQUIP_WEAPON} AP`}`
          : undefined}
        options={[
          { key: 'left', label: `Left hand — ${leftWeapon?.name ?? 'empty'}`, sublabel: 'Replace the left-hand weapon' },
          { key: 'right', label: `Right hand — ${rightWeapon?.name ?? 'empty'}`, sublabel: 'Replace the right-hand weapon' },
        ]}
        onSelect={(hand) => { if (pendingHandChoice) equipWithHand(pendingHandChoice.weaponId, pendingHandChoice.free, hand as 'left' | 'right'); }}
        onClose={() => setPendingHandChoice(null)}
      />
      {/* ─── Reload chooser (dual-wielded guns) ─── */}
      <OptionPickerModal
        visible={showReloadPicker}
        title="RELOAD WHICH GUN?"
        subtitle="AP is charged for the selected gun only"
        options={reloadableHeldWeapons.map(w => {
          const fx = computeModEffects(w);
          const mag = Math.round(w.magazineSize * (fx.magazineMult ?? 1));
          const cur = attacker?.weaponAmmoStates.find(a => a.weaponId === w.id)?.currentAmmo ?? mag;
          return {
            key: w.id,
            label: `${w.name}  [${cur}/${mag}]`,
            sublabel: `${fx.reloadApOverride ?? AP_COSTS.RELOAD} AP`,
            disabled: cur >= mag,
          };
        })}
        onSelect={(id) => { const w = reloadableHeldWeapons.find(x => x.id === id); if (w) handleReloadWeapon(w); }}
        onClose={() => setShowReloadPicker(false)}
      />
      {/* ─── Ammo picker (compatible types only) ─── */}
      <OptionPickerModal
        visible={showAmmoPicker}
        title="CHANGE AMMO"
        subtitle="Free — no AP spent (loading costs come from RELOAD)"
        options={compatibleAmmo.map(a => ({
          key: a.id,
          label: `${a.name}${a.id === loadedAmmo?.id ? '  (loaded)' : ''}`,
          sublabel: describeAmmoMods(a),
          disabled: a.id === loadedAmmo?.id,
        }))}
        onSelect={(id) => handleSetAmmo(id)}
        onClose={() => setShowAmmoPicker(false)}
      />
    </View>
  );
}
