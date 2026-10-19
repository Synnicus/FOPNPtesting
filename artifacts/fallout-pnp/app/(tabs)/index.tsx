import {
  FlatList, Modal, Platform, ScrollView, View, useWindowDimensions,
} from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity, localizedConfirm } from '@/components/LocalizedText';
import { getActiveLocale, translateText } from '@/data/localization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import CharacterAvatar from '@/components/CharacterAvatar';
import HPBar from '@/components/HPBar';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import {
  TARGETED_CRIT_BONUS, TARGETED_CRIT_EFFECTS, CRITICAL_HIT_TABLE, CritTableEntry,
  CRITICAL_FAILURE_TABLE, CritFailTableEntry,
  baseCritChance as calcBaseCritChance, hasPerk, BodyPart, HELMET_HEAD_CRIT_REDUCTION,
  applyHelmetHeadCritReduction, criticalFailureSelfDamage,
} from '@/data/criticals';
import { computeInjuryEffects, createCombatInjury } from '@/data/injuries';
import {
  CONDITION_BOXES_MAX, clampConditionBoxes, conditionAfterCriticalFailure, conditionToHitPenalty, isWeaponJammed, conditionLabel,
} from '@/data/condition';
import { PERKS, getPerkById } from '@/data/perks';
import { AP_COSTS } from '@/data/apCosts';
import { isMeleeWeapon, isRangedWeapon, getWeaponHands, getWeaponAreaAttack, compactWeaponCombatLabel, MINE_TRAP_PROFILES, WEAPON_CATEGORY_LABELS, WEAPON_CATEGORY_ORDER } from '@/data/weapons';
import { computeModEffects } from '@/data/mods';
import { computeCustomPerkEffects, computeCustomWeaponModEffects } from '@/data/customRules';
import { AMMO_TYPES, getAmmoById, describeAmmoAccuracyModifier, describeAmmoMods, resolveEquippedAmmoType, AmmoType } from '@/data/ammo';
import { makePoisonedEffect, poisonExposuresForAttack, resolvePoisonResistance, type PoisonResistanceResult } from '@/data/poisonEffects';
import { ALCOHOL_CONSUMABLES, CHEMS, getChem } from '@/data/chems';
import { CHEM_AP_COST, makeChemEffect, computeEffectModifiers, effectiveSpecial, computePerkStatBonuses } from '@/data/effects';
import { computeTraitEffects } from '@/data/traits';
import { applyTightNutsDamageResistance, isCriticalFailureRoll } from '@/data/traitRules';
import { calcMeleeDamageBonus, calcSequence } from '@/data/derived';
import { applyProtection } from '@/data/armor';
import { computeDefensivePerkBonuses, describeAmmoProtectionModifier, resolveAmmoDamageComponents, resolveAttackWeapon, resolveDamagePipeline, resolveDamageProtection, type DamageProtectionBreakdown } from '@/data/attackResolution';
import { getRaceById } from '@/data/races';
import { computeConditionModifiers, type ConditionDefinition } from '@/data/conditions';
import {
  fastShotAppliesToSkill,
} from '@/data/effectiveRules';
import { resolveArmorAwareSheet } from '@/data/armorEffects';
import type { ResolvedArmorSheet } from '@/data/armorEffects';
import { resolveDefenderHandWeapon } from '@/data/combatantEquipment';
import {
  hasAreaCombatDamage,
  hasDirectCombatDamage,
  requestCombatImpact,
} from '@/data/combatImpact';
import { BUILT_IN_VEHICLE_WEAPONS } from '@/data/vehicleWeapons';
import { vehicleTargetToHitPenalty, vehicleWeaponSlotsFromNames } from '@/data/vehicles';
import {
  getCombatAttackSoundFamily,
  getCombatAttackSoundIntervalMs,
  getCombatAttackSoundShotCount,
  type CombatAttackSoundFamily,
} from '@/data/combatAttackSounds';
import {
  getCombatOutcomeSoundKind,
  requestCombatOutcomeSound,
  type CombatOutcomeSoundPlayers,
} from '@/data/combatOutcomeSounds';
import {
  SPECIAL_UNARMED_ATTACKS,
  SpecialUnarmedGroup,
  evaluateEligibility,
  formatEffects as formatSpecialUnarmedEffects,
  formatRequirements as formatSpecialUnarmedRequirements,
  getSpecialUnarmedAttack,
} from '@/data/specialUnarmedAttacks';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AreaAttack, AreaAttackKind, AreaResolution, formatAreaResolution } from '@/data/areaEffects';
import { Character, Injury, Weapon, InitiativeEntry, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_NAMES, NaturalProtection, DamageType, PositionType, SkillType } from '@/context/types';
import { HEAL_FALLEN_AP_COST, HEAL_FALLEN_SKILLS, armorOnlyArmorClass, getHealFallenAPCost, getHealFallenSkillOptions, type CombatSkillResolutionMethod, type HealFallenSkill, type TimedCombatSkillAction } from '@/data/combatSkills';

function resolveCombatSheet(
  character: Character,
  allArmor: Parameters<typeof resolveArmorAwareSheet>[0]['allArmor'],
  includeTempAC = true,
  hardcoreRadiationRules = false,
  mutantGhoulRadiationRules = false,
  ghoulRadiationHealingOption: 1 | 2 | 3 | 4 = 1,
): ResolvedArmorSheet {
  const race = getRaceById(character.race);
  const sheet = resolveArmorAwareSheet({
    special: character.special,
    skills: character.skills,
    taggedSkills: character.taggedSkills,
    traits: character.traits,
    perks: character.perks,
    conditions: character.conditions,
    effects: character.effects,
    raceBounds: race ? { min: race.specialMin, max: race.specialMax } : undefined,
    nightPersonPeriod: character.nightPersonPeriod,
    racialNaturalArmorClass: race?.naturalACBonus,
    naturalArmorClass: character.naturalProtection?.armorClass,
    manualDerivedStats: character.manualDerivedStats,
    usesDerivedArmorClass: character.usesDerivedArmorClass,
    tempAC: includeTempAC ? character.tempAC : 0,
    radiationResistance: character.radiationResistance,
    gasResistance: character.gasResistance,
    poisonResistance: character.poisonResistance,
    electricityResistance: character.electricityResistance,
    accumulatedRadiation: character.accumulatedRadiation,
    hardcoreRadiationRules,
    raceId: character.race,
    mutantGhoulRadiationRules,
    ghoulRadiationHealingOption,
    equippedBodyArmorId: character.equippedBodyArmorId,
    equippedHelmetId: character.equippedHelmetId,
    armorConditionStates: character.armorConditionStates,
    allArmor,
  });
  // During a timed or underfunded combat skill, only the AC printed on worn
  // armor remains. This shared helper deliberately excludes AGI, perks, and
  // unused AP so defender attack math and combat cards consume the same value.
  return character.combatDefenseSuppressed
    ? { ...sheet, armorClass: armorOnlyArmorClass([sheet.bodyArmor?.acBonus ?? 0, sheet.helmet?.acBonus ?? 0]) }
    : sheet;
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
  const dr = ((bodyArmor?.[drField] as number) ?? 0)
    + ((helmet?.[drField] as number) ?? 0)
    + ((natural?.[drField as keyof NaturalProtection] as number) ?? 0)
    + ((shield?.[drField] as number) ?? 0);
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
  physicalDmg: number;
  poisonBonusDamage: number;
  poisonResults: PoisonResistanceResult[];
  protection: DamageProtectionBreakdown;
  componentBreakdown: string[];
  radiationExposure: number;
}

// ─── Perk Bonuses Computed ────────────────────────────────────────────────────
interface PerkBonus {
  toHit: number;
  damage: number;
  damageMultiplier: number;
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
// Compact ammo label for combat controls, e.g. "10mm JHP" from
// "10mm JHP (Jacketed Hollow Point)" — strips parentheticals, caps length.
function shortAmmoName(name: string): string {
  const stripped = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return stripped.length > 18 ? stripped.slice(0, 17) + '…' : stripped;
}

// One-line summary of what an active effect changes (for combat cards).
function describeEffectMods(e: {
  statMods?: Partial<Record<string, number>>; acMod?: number; drMod?: number;
  apMod?: number; sequenceMod?: number; radResistMod?: number;
  poisonResistMod?: number; healingRateMod?: number;
}): string {
  const bits: string[] = [];
  for (const [k, v] of Object.entries(e.statMods ?? {})) {
    if (v) bits.push(`${k.slice(0, 3).toUpperCase()} ${v > 0 ? '+' : ''}${v}`);
  }
  if (e.acMod) bits.push(`AC ${e.acMod > 0 ? '+' : ''}${e.acMod}`);
  if (e.drMod) bits.push(`DR ${e.drMod > 0 ? '+' : ''}${e.drMod}%`);
  if (e.apMod) bits.push(`AP ${e.apMod > 0 ? '+' : ''}${e.apMod}`);
  if (e.sequenceMod) bits.push(`SEQ ${e.sequenceMod > 0 ? '+' : ''}${e.sequenceMod}`);
  if (e.radResistMod) bits.push(`RAD RES ${e.radResistMod > 0 ? '+' : ''}${e.radResistMod}%`);
  if (e.poisonResistMod) bits.push(`POISON RES ${e.poisonResistMod > 0 ? '+' : ''}${e.poisonResistMod}%`);
  if (e.healingRateMod) bits.push(`HEAL RATE ${e.healingRateMod > 0 ? '+' : ''}${e.healingRateMod}`);
  return bits.join(', ');
}

function describeCombatConditionStatMods(condition: ConditionDefinition): string {
  return Object.entries(condition.statMods)
    .filter(([, value]) => value !== undefined && value !== 0)
    .map(([stat, value]) => `${stat.slice(0, 3).toUpperCase()} ${value! > 0 ? '+' : ''}${value}`)
    .join(', ');
}

function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${translateText(title, getActiveLocale())}\n\n${translateText(message, getActiveLocale())}` : translateText(title, getActiveLocale()));
  else Alert.alert(title, message);
}

type CombatSkillKey = HealFallenSkill;
function computePerkBonuses(char: Character | null, weapon: Weapon | null, isRanged: boolean, target: Character | null = null): PerkBonus {
  const result: PerkBonus = {
    toHit: 0, damage: 0, damageMultiplier: 1, critChance: 0, critDamageMult: 1.0,
    allHitsAreCrits: false, ignoreDT: 0, apDiscount: 0, lightReduction: 0, burstApDiscount: 0,
    strReqReduction: 0, notes: [],
  };
  if (!char || !char.perks) return result;
  const livingTarget = !!target && !target.vehicle && target.race !== 'robot';

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
      if (fx.meleeDamageBonus && perk.id !== 'bonus_hth_damage' && perk.id !== 'deathclaw_rampage') { result.damage += fx.meleeDamageBonus * rank; result.notes.push(`${perk.name}: +${fx.meleeDamageBonus * rank} melee dmg`); }
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
    if (fx.damageBonus && (perk.id !== 'living_anatomy' || livingTarget)) {
      result.damage += fx.damageBonus * rank;
      result.notes.push(`${perk.name}: +${fx.damageBonus * rank}${perk.id === 'living_anatomy' ? ' damage vs living targets' : ' all dmg'}`);
    }
    if (perk.id === 'deathclaw_rampage'
      && char.race === 'deathclaw'
      && char.maxHp > 0
      && char.currentHp < char.maxHp / 2
      && !isRanged
      && /claw/i.test(weapon?.name ?? '')) {
      result.damageMultiplier *= 1.5;
      result.notes.push('Deathclaw Rampage: claw damage ×1.5 (HP < 50%)');
    }
    if (fx.critChanceBonus) { result.critChance += fx.critChanceBonus * rank; }
    if (fx.critDamageMultiplier) { result.critDamageMult = Math.max(result.critDamageMult, fx.critDamageMultiplier); }
    if (fx.attackAPDiscount) {
      const appliesToWeapon = perk.id === 'bonus_hth_attacks'
        ? !isRanged
        : perk.id === 'bonus_rate_of_fire'
          ? isRanged
          : true;
      if (appliesToWeapon) result.apDiscount += fx.attackAPDiscount * rank;
    }
    if (perk.id === 'night_vision' && fx.combatNote) { result.lightReduction = 50; result.notes.push(`${perk.name}: dark-condition penalties halved`); }
    if (perk.id === 'night_person' && fx.combatNote) { result.lightReduction = Math.max(result.lightReduction, 50); result.notes.push(`${perk.name}: light penalties halved`); }
    if (perk.id === 'steady_arm' && fx.combatNote) { result.burstApDiscount += 1; result.notes.push(`${perk.name}: burst attacks −1 AP`); }
  }
  return result;
}

function empShieldingResistance(defender: Character | null, ammo?: { id: string; name?: string } | null): number {
  const empAmmo = `${ammo?.id ?? ''} ${ammo?.name ?? ''}`.toLowerCase().includes('emp');
  return defender?.race === 'robot'
    && (defender.traits ?? []).includes('emp_shielding')
    && empAmmo
    ? 30
    : 0;
}

function tightNutsAdjustedDR(
  totalDamageResistance: number,
  damageType: DamageType,
  defender: Character | null,
  natural: NaturalProtection | null | undefined,
): number {
  const key = `dr${damageType.charAt(0).toUpperCase()}${damageType.slice(1)}` as keyof NaturalProtection;
  return applyTightNutsDamageResistance(
    totalDamageResistance,
    Number(natural?.[key] ?? 0),
    defender?.race ?? '',
    defender?.traits,
  );
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

function ProtectionBreakdownLines({
  protection,
  ammoName,
}: {
  protection: DamageProtectionBreakdown;
  ammoName?: string;
}) {
  const colors = useColors();
  const ammoProtectionLine = describeAmmoProtectionModifier(protection, ammoName);
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
        Base protection: DT {protection.baseDT} · DR {protection.baseDR}%
      </Text>
      {ammoProtectionLine && (
        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
          {ammoProtectionLine}
        </Text>
      )}
      {protection.ignoredDT > 0 && !protection.ammoIgnoresDT && !protection.bypassesArmor && (
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.primary }}>
          Attack effects: −{protection.ignoredDT} DT
        </Text>
      )}
      {protection.defenderDRModifier !== 0 && !protection.bypassesArmor && (
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: protection.defenderDRModifier > 0 ? '#4a8c3f' : colors.destructive }}>
          Defender perks/effects: DR {protection.defenderDRModifier > 0 ? '+' : ''}{protection.defenderDRModifier}%
        </Text>
      )}
      {protection.bypassesArmor && (
        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
          Critical effect: all DT/DR bypassed
        </Text>
      )}
      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
        Effective protection: DT {protection.effectiveDT} · DR {protection.effectiveDR}%
      </Text>
    </View>
  );
}

// ─── Character Picker Modal ───────────────────────────────────────────────────
function CharacterPickerModal({ visible, onClose, onSelect, title, characters, allWeapons, allArmor, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption, clearRole, onClear }: {
  visible: boolean; onClose: () => void; onSelect: (id: string) => void;
  title: string; characters: Character[]; allWeapons: Weapon[]; allArmor: Parameters<typeof resolveArmorAwareSheet>[0]['allArmor'];
  hardcoreRadiationRules: boolean;
  mutantGhoulRadiationRules: boolean;
  ghoulRadiationHealingOption: 1 | 2 | 3 | 4;
  clearRole?: 'Attacker' | 'Defender'; onClear?: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{ maxHeight: '80%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
            <TouchableOpacity testID="combat-character-picker-close" accessibilityRole="button" accessibilityLabel="Close character picker" onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          {onClear && clearRole && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
              onPress={() => { onClear(); onClose(); }}
            >
              <Feather name="x-circle" size={18} color={colors.destructive} />
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>
                <Text>CLEAR</Text><Text> · </Text><Text style={{ textTransform: 'uppercase' }}>{clearRole}</Text>
              </Text>
            </TouchableOpacity>
          )}
          {characters.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>No characters yet. Add them in the Characters tab.</Text>
            </View>
          ) : (
            <FlatList data={characters} keyExtractor={c => c.id} renderItem={({ item: c }) => {
              const weapon = allWeapons.find(w => w.id === c.equippedWeaponId);
              const ammoState = c.weaponAmmoStates?.find(a => a.weaponId === c.equippedWeaponId);
               const sheet = resolveCombatSheet(
                 c, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
               );
              return (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => { onSelect(c.id); onClose(); }}>
                  <CharacterAvatar portrait={c.portrait} name={c.name} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{c.name}</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                      {c.vehicle
                        ? `VEHICLE · AC ${c.vehicle.armorClass} · Structure ${c.currentHp}/${c.maxHp} HP${c.vehicle.mountedWeapons.length ? ` · ${c.vehicle.mountedWeapons.join(', ')}` : ''}`
                        : `AC ${sheet.armorClass} · HP ${c.currentHp}/${c.maxHp} · AP ${c.currentAP ?? sheet.maxAP}/${sheet.maxAP}${weapon ? ` · ${weapon.name}` : ''}${weapon && weapon.magazineSize > 0 ? ` [${ammoState?.currentAmmo ?? weapon.magazineSize}/${weapon.magazineSize}]` : ''}`}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: c.type === 'pc' ? colors.primary : colors.destructive }}>{c.vehicle ? 'VEHICLE' : c.type.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const AREA_ATTACK_OPTIONS: { kind: AreaAttackKind; label: string; note: string }[] = [
  { kind: 'explosion', label: 'Explosion', note: 'Explosion DT/DR' },
  { kind: 'fragmentation', label: 'Fragmentation', note: 'Normal DT/DR' },
  { kind: 'concussion', label: 'Concussion', note: 'Ignores DT; Explosion DR' },
  { kind: 'flamethrower', label: 'Flamethrower / Firestream', note: 'Fire DT/DR + 1d6 ongoing' },
  { kind: 'gasInhaled', label: 'Gas — Inhaled', note: 'Inhaled gas resistance' },
  { kind: 'gasContact', label: 'Gas — Contact', note: 'Contact gas resistance' },
  { kind: 'electricity', label: 'Electricity', note: 'Resistance, then Endurance; failure = 1d10 rounds unconscious' },
  { kind: 'acid', label: 'Acid', note: 'Fire protection + 1d6 ongoing' },
];

function catalogProfileLabel(profileId: string): string {
  return profileId
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

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
function CriticalFailureModal({ visible, onClose, rolledEntry, appliedNotes, onRoll, onSelect }: {
  visible: boolean; onClose: () => void; rolledEntry: CritFailTableEntry | null;
  appliedNotes: string[]; onRoll: () => void; onSelect: (entry: CritFailTableEntry) => void;
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
            <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 2 }}>
              {rolledEntry ? 'Result applied — resolves once per critical failure.' : 'Rolled the dice at the table? Tap a row to apply that result manually.'}
            </Text>
            {CRITICAL_FAILURE_TABLE.map(entry => {
              const active = rolledEntry?.roll === entry.roll;
              return (
                <TouchableOpacity key={entry.roll} disabled={!!rolledEntry} onPress={() => onSelect(entry)} style={{ flexDirection: 'row', gap: 10, padding: 8, borderRadius: 6, opacity: rolledEntry && !active ? 0.5 : 1, backgroundColor: active ? colors.destructive + '33' : colors.secondary, borderWidth: 1, borderColor: active ? colors.destructive : colors.border }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: active ? colors.destructive : colors.mutedForeground, minWidth: 22, textAlign: 'center' }}>{entry.roll}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: active ? colors.destructive : colors.foreground }}>{entry.title}</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{entry.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
            <TouchableOpacity disabled={!!rolledEntry} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: colors.radius, backgroundColor: rolledEntry ? colors.secondary : colors.destructive }} onPress={onRoll}>
              <Feather name="refresh-cw" size={16} color={rolledEntry ? colors.mutedForeground : '#fff'} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: rolledEntry ? colors.mutedForeground : '#fff' }}>ROLL 1d10</Text>
            </TouchableOpacity>
            {rolledEntry && (
              <View style={{ padding: 10, borderRadius: colors.radius, backgroundColor: colors.destructive + '22', borderWidth: 1, borderColor: colors.destructive, gap: 2 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.destructive }}>[{rolledEntry.roll}] {rolledEntry.title} — APPLIED</Text>
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
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const stackCombatantCards = windowWidth < 420 || fontScale > 1.2;
  const app = useApp();
  const combatScrollRef = useRef<ScrollView>(null);
  const combatImpactPlayer = useAudioPlayer(require('../../assets/combat-impact.wav'));
  const combatMissPlayer = useAudioPlayer(require('../../assets/combat-miss.wav'));
  const combatCriticalHitPlayer = useAudioPlayer(require('../../assets/combat-critical-hit.wav'));
  const combatFirearmPlayer = useAudioPlayer(require('../../assets/combat-firearm-shot.wav'));
  const combatBladePlayer = useAudioPlayer(require('../../assets/combat-blade-slice.wav'));
  const combatBluntPlayer = useAudioPlayer(require('../../assets/combat-blunt-hit.wav'));
  const combatLaserPlayer = useAudioPlayer(require('../../assets/combat-energy-laser.wav'));
  const { characters, allWeapons, allArmor, allAmmo, customWeaponMods, customPerks, applyDamage, applyCombatDamage, adjustRadiation, applyAreaAttack, areaAttackReceipt, markAreaEffectForRemoval, removeAreaEffect, spendAmmo, reloadWeapon, jamWeapon, setWeaponCondition, setAmmoType, equipWeapon, setActiveWeapon, applyChem, addEffect, setPosition, setKnockedOut, addInjury, updateCharacter, spendAP, addTempAC,
    initiativeEntries, currentRound, combatActive, activeEntryId, pendingCombatSkillActions, combatSkillReceipt,
    hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
    startCombat, endCombat, addInitiativeEntry, removeInitiativeEntry, moveInitiativeEntry, nextTurn, nextRound,
    startTimedSkillAction, resolveHealFallen, completeHealFallen, cancelCombatSkillAction,
  } = app;
  const combatSoundsEnabledRef = useRef(app.combatSoundsEnabled);
  combatSoundsEnabledRef.current = app.combatSoundsEnabled;
  const combatOutcomeSoundPlayers: CombatOutcomeSoundPlayers = {
    miss: combatMissPlayer,
    critical: combatCriticalHitPlayer,
  };
  const outcomeSoundReceiptRef = useRef('');
  const attackSoundSequenceIdRef = useRef(0);
  const attackSoundTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playCombatImpact = useCallback(() => {
    requestCombatImpact(combatImpactPlayer, () => combatSoundsEnabledRef.current);
  }, [combatImpactPlayer]);
  const playCombatAttackSounds = useCallback((family: CombatAttackSoundFamily | null, shotCount: number) => {
    attackSoundSequenceIdRef.current += 1;
    const sequenceId = attackSoundSequenceIdRef.current;
    attackSoundTimersRef.current.forEach(clearTimeout);
    attackSoundTimersRef.current = [];
    if (!family || !combatSoundsEnabledRef.current) return;

    const player = {
      firearm: combatFirearmPlayer,
      blade: combatBladePlayer,
      blunt: combatBluntPlayer,
      laser: combatLaserPlayer,
    }[family];
    const intervalMs = getCombatAttackSoundIntervalMs(family);
    const safeShotCount = Math.max(1, Math.floor(shotCount));
    const playShot = (shotIndex: number) => {
      if (sequenceId !== attackSoundSequenceIdRef.current || !combatSoundsEnabledRef.current) return;
      player.volume = 0.48;
      void player.seekTo(0).then(() => {
        if (sequenceId === attackSoundSequenceIdRef.current && combatSoundsEnabledRef.current) {
          player.play();
        }
      }).catch(() => {});
      if (shotIndex + 1 < safeShotCount) {
        attackSoundTimersRef.current.push(setTimeout(() => playShot(shotIndex + 1), intervalMs));
      }
    };
    playShot(0);
  }, [combatFirearmPlayer, combatBladePlayer, combatBluntPlayer, combatLaserPlayer]);
  useEffect(() => () => {
    attackSoundSequenceIdRef.current += 1;
    attackSoundTimersRef.current.forEach(clearTimeout);
    attackSoundTimersRef.current = [];
  }, []);
  const lastAreaImpactRequestId = useRef(areaAttackReceipt?.requestId);
  useEffect(() => {
    if (!areaAttackReceipt || lastAreaImpactRequestId.current === areaAttackReceipt.requestId) return;
    lastAreaImpactRequestId.current = areaAttackReceipt.requestId;
    if (hasAreaCombatDamage(areaAttackReceipt.results)) playCombatImpact();
  }, [areaAttackReceipt, playCombatImpact]);

  // Round tracker
  const [showRoundTracker, setShowRoundTracker] = useState(false);
  const [showInitSetup, setShowInitSetup] = useState(false);
  const [initRolls, setInitRolls] = useState<Record<string, number>>({});
  const [excludedInitiativeIds, setExcludedInitiativeIds] = useState<string[]>([]);
  const [showAreaAttack, setShowAreaAttack] = useState(false);

  // Combatants
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [defenderId, setDefenderId] = useState<string | null>(null);
  const [selectedVehicleSystemId, setSelectedVehicleSystemId] = useState<string | null>(null);
  const [showVehicleSystemPicker, setShowVehicleSystemPicker] = useState(false);
  const [pilotRollResult, setPilotRollResult] = useState<string | null>(null);

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
  const attackReceipt = useRef('');
  const attackApplied = useRef(false);
  const beginAttack = () => {
    attackReceipt.current = `hit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    attackApplied.current = false;
  };

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
  const [manualCritFailConfirmed, setManualCritFailConfirmed] = useState(false);
  const [showCritFailModal, setShowCritFailModal] = useState(false);
  const [critFailEntry, setCritFailEntry] = useState<CritFailTableEntry | null>(null);
  const [critFailNotes, setCritFailNotes] = useState<string[]>([]);
  const [divineFavorRoll, setDivineFavorRoll] = useState<{ roll: number; tens: number; units: number } | null>(null);
  const [showGlowingAuraModal, setShowGlowingAuraModal] = useState(false);
  const [glowingAuraTargetIds, setGlowingAuraTargetIds] = useState<string[]>([]);

  // AP spent flag
  const [apSpent, setApSpent] = useState(false);
  // Local attack-session weapon. Null means the character's active weapon.
  const [attackWeaponId, setAttackWeaponId] = useState<string | null>(null);

  // Pickers
  const [showAttackerPicker, setShowAttackerPicker] = useState(false);
  const [showDefenderPicker, setShowDefenderPicker] = useState(false);
  const [showAddCombatantPicker, setShowAddCombatantPicker] = useState(false);
  const [showApActions, setShowApActions] = useState(false);
  // A mine/trap opens the same area-attack modal as the GM AoE action, but
  // carries its catalog profile and selected defender into that modal.
  const [areaAttackPreset, setAreaAttackPreset] = useState<AreaAttack | null>(null);
  const [showChemPicker, setShowChemPicker] = useState(false);
  const [showAmmoPicker, setShowAmmoPicker] = useState(false);
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showSpecialUnarmedPicker, setShowSpecialUnarmedPicker] = useState(false);
  const [showCombatSkill, setShowCombatSkill] = useState(false);
  const [completionHealActionId, setCompletionHealActionId] = useState<string | null>(null);
  const [specialUnarmedAttackId, setSpecialUnarmedAttackId] = useState<string | null>(null);
  // Whether the currently open ammo/weapon picker should charge AP on selection.
  const [weaponPickerFree, setWeaponPickerFree] = useState(false);
  // Pending 1H equip that needs a hand choice (both hands hold 1H weapons).
  const [pendingHandChoice, setPendingHandChoice] = useState<{ weaponId: string; free: boolean } | null>(null);
  // Dual-gun reload chooser.
  const [showReloadPicker, setShowReloadPicker] = useState(false);
  // Inline result of the last streamlined-burst damage application.
  const [streamlinedDmgResult, setStreamlinedDmgResult] = useState<{
    perHit: number[];
    total: number;
    protection: DamageProtectionBreakdown;
    poisonResults: PoisonResistanceResult[];
    poisonBonusDamage: number;
    componentBreakdown: string[];
    radiationExposure: number;
  } | null>(null);

  // Manual base-damage override ('' = use rolled dice). Recomputes DT/DR/crit.
  const [damageOverride, setDamageOverride] = useState('');

  // Remember the last defender chosen per attacker; restore on re-select.
  const lastDefenderByAttacker = React.useRef<Record<string, string>>({});

  // Non-storage characters — used for pickers and initiative setup
  const activeCharacters = characters.filter(c => !c.inStorage);
  const initiativeSetupCharacters = activeCharacters.filter(c => !c.vehicle && c.currentHp > 0 && !excludedInitiativeIds.includes(c.id));

  // Derived values
  const attacker = characters.find(c => c.id === attackerId) ?? null;
  const defender = characters.find(c => c.id === defenderId) ?? null;
  const vehiclePilot = attacker?.vehicle && attacker.vehicleCrew?.pilotCharacterId
    ? characters.find(character => character.id === attacker.vehicleCrew?.pilotCharacterId && !character.inStorage && !character.vehicle) ?? null
    : null;
  const vehicleGunner = attacker?.vehicle && attacker.vehicleCrew?.gunnerCharacterId
    ? characters.find(character => character.id === attacker.vehicleCrew?.gunnerCharacterId && !character.inStorage && !character.vehicle) ?? null
    : null;
  const attackActor = attacker?.vehicle ? vehicleGunner : attacker;
  const pilotSheet = vehiclePilot ? resolveCombatSheet(
    vehiclePilot, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
  ) : null;
  const selectedVehicleSystem = defender?.vehicle?.systems.find(system => system.id === selectedVehicleSystemId)
    ?? defender?.vehicle?.systems.find(system => system.kind === 'structure')
    ?? defender?.vehicle?.systems[0]
    ?? null;
  const completionHealAction = completionHealActionId
    ? (pendingCombatSkillActions ?? []).find(action => action.id === completionHealActionId && action.kind === 'healFallen') ?? null
    : null;
  const completionHealActor = completionHealAction
    ? characters.find(character => character.id === completionHealAction.actorId) ?? null
    : null;
  const completionHealTarget = completionHealAction?.targetId
    ? characters.find(character => character.id === completionHealAction.targetId) ?? null
    : null;
  // This is the authoritative combat sheet: equipped armor is resolved before
  // skills, SPECIAL-derived values, AC, and elemental resistances are consumed.
  const attackerSheet = attackActor ? resolveCombatSheet(
    attackActor, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
  ) : attacker ? resolveCombatSheet(
    attacker, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
  ) : null;
  const defenderSheet = defender ? resolveCombatSheet(
    defender, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
  ) : null;
  // Empty hands still make a normal Unarmed attack. Treat them as the built-in
  // Fists and Feet profile without mutating the character's carried inventory.
  const vehicleWeapons = attacker?.vehicle
    ? (attacker.vehicle.weaponSlots ?? vehicleWeaponSlotsFromNames(attacker.vehicle.mountedWeapons))
        .map(slot => [...allWeapons, ...BUILT_IN_VEHICLE_WEAPONS].find(candidate => candidate.id === slot.weaponId))
        .filter((candidate): candidate is Weapon => !!candidate)
    : [];
  const activeWeapon = attacker
    ? attacker.vehicle
      ? vehicleWeapons[0] ?? null
      : (attacker.equippedWeaponId
          ? allWeapons.find(w => w.id === attacker.equippedWeaponId) ?? null
          : allWeapons.find(w => w.id === 'unarmed') ?? null)
    : null;
  const defenderWeapon = defender ? resolveDefenderHandWeapon(defender, allWeapons) : null;
  const naturalAttackWeapons = (attacker?.naturalAttacks ?? [])
    .map(attack => allWeapons.find(candidate => candidate.id === attack.weaponId))
    .filter((candidate): candidate is Weapon => !!candidate);
  const bodyArmor = defenderSheet?.bodyArmor ?? null;
  const helmet = defenderSheet?.helmet ?? null;

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
  const attackCandidates = Array.from(new Map(
    (attacker?.vehicle ? vehicleWeapons : [leftWeapon, rightWeapon, ...naturalAttackWeapons])
      .filter((candidate): candidate is Weapon => !!candidate)
      .map(candidate => [candidate.id, candidate]),
  ).values());
  // Every rule below consumes this one authoritative attack-session weapon.
  const weapon = resolveAttackWeapon(activeWeapon, attackWeaponId, attackCandidates);
  const weaponAreaAttack = weapon ? getWeaponAreaAttack(weapon) : undefined;
  // Profiled devices use the area resolver. Legacy/custom mines and traps
  // without a profile deliberately retain the normal custom weapon dice path.
  const isMineTrap = weapon?.category === 'minesTraps' || !!weaponAreaAttack;
  const usesAreaAttackProfile = !!weaponAreaAttack;
  const heldWeapons: Weapon[] = attacker?.vehicle
    ? (weapon ? [weapon] : [])
    : dualWielding
      ? [leftWeapon, rightWeapon].filter((w): w is Weapon => !!w)
      : (weapon ? [weapon] : []);
  const reloadableHeldWeapons = heldWeapons.filter(w => w.magazineSize > 0);
  const heldAmmoStatuses = [
    { weapon: attacker?.vehicle ? weapon : activeWeapon, role: 'PRIMARY' },
    { weapon: offhandWeapon, role: 'OFF-HAND' },
  ]
    .filter((candidate): candidate is { weapon: Weapon; role: string } =>
      !!candidate.weapon && candidate.weapon.magazineSize > 0)
    .filter((candidate, index, candidates) =>
      candidates.findIndex(other => other.weapon.id === candidate.weapon.id) === index)
    .map(({ weapon: heldWeapon, role }) => {
      const state = attacker?.weaponAmmoStates.find(candidate => candidate.weaponId === heldWeapon.id);
      const effects = computeModEffects(heldWeapon);
      const customEffects = computeCustomWeaponModEffects(heldWeapon.mods, customWeaponMods, heldWeapon);
      const magazineSize = Math.round(heldWeapon.magazineSize * (effects.magazineMult ?? 1) * customEffects.magazineMult);
      return {
        weapon: heldWeapon,
        role,
        currentAmmo: state?.currentAmmo ?? magazineSize,
        magazineSize,
        ammo: resolveEquippedAmmoType(heldWeapon, state?.ammoTypeId, allAmmo),
      };
    });
  const allHeldMagazinesFull = reloadableHeldWeapons.every(w => {
    const fx = computeModEffects(w);
    const customFx = computeCustomWeaponModEffects(w.mods, customWeaponMods, w);
    const mag = Math.round(w.magazineSize * (fx.magazineMult ?? 1) * customFx.magazineMult);
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
  const isRanged = weapon ? isRangedWeapon(weapon) || RANGED_SKILLS.has(weapon.skill) : true;
  const isMelee = weapon ? isMeleeWeapon(weapon) : false;
  const isUnarmed = weapon ? weapon.skill === 'unarmed' && !isRanged : false;
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
  const customModEffects = computeCustomWeaponModEffects(weapon?.mods ?? [], customWeaponMods, weapon);
  const modBonuses = {
    toHit: modEffects.toHit + customModEffects.toHit,
    damage: modEffects.damage + customModEffects.damage,
    range: modEffects.range + customModEffects.range,
  };

  // Injury effects (manual): attacker & defender.
  const attackerInjury = attackActor ? computeInjuryEffects(attackActor) : null;
  const defenderInjury = defender ? computeInjuryEffects(defender) : null;
  // Armor-aware sheets already include tag, trait, condition, and active-effect
  // skill changes. Explicit Injury.skillPenalty values are applied here as the
  // final combat-facing adjustment.
  const combatSkillValues: Partial<Record<SkillType, number>> = attackActor && attackerSheet
    ? (['firstAid', 'doctor', 'science', 'repair'] as CombatSkillKey[]).reduce<Partial<Record<SkillType, number>>>((values, skill) => {
        const injuryDelta = (attackActor.injuries ?? [])
          .filter(injury => injury.isActive)
          .reduce((sum, injury) => sum + (injury.skillPenalty[skill] ?? 0), 0);
        values[skill] = Math.max(0, (attackerSheet.effectiveSkills[skill] ?? 0) + injuryDelta);
        return values;
      }, {})
    : {};
  const completionHealSheet = completionHealActor ? resolveCombatSheet(
    completionHealActor, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
  ) : null;
  const completionHealSkillValues: Partial<Record<SkillType, number>> = completionHealActor && completionHealSheet
    ? HEAL_FALLEN_SKILLS.reduce<Partial<Record<SkillType, number>>>((values, skill) => {
        const injuryDelta = (completionHealActor.injuries ?? [])
          .filter(injury => injury.isActive)
          .reduce((sum, injury) => sum + (injury.skillPenalty[skill] ?? 0), 0);
        values[skill] = Math.max(0, (completionHealSheet.effectiveSkills[skill] ?? 0) + injuryDelta);
        return values;
      }, {})
    : {};

  // Attacker position drives the ranged To-Hit bonus (gun skills only, per manual).
  const attackerPos = attackActor?.position ?? 'standing';
  const posIdxFromChar = attackerPos === 'crouching' ? 1 : attackerPos === 'prone' ? 2 : 0;
  const positionBonus = isRanged ? POSITION_OPTIONS[posIdxFromChar].bonus : 0;
  // Gate targeting on the weapon: apTargeted === null means the weapon cannot
  // make targeted shots (e.g. thrown explosives, flamethrowers).
  const traitEffects = attackActor ? computeTraitEffects(attackActor) : {};
  const fastShotApplies = fastShotAppliesToSkill(weapon?.skill)
    && !!traitEffects.cannotTargetedShot;
  const weaponCanTarget = (!weapon || weapon.apTargeted !== null) && !specialUnarmedAttack && !fastShotApplies;
  const vehicleTargeting = !!defender?.vehicle;
  let effTargetedIdx = !vehicleTargeting && weaponCanTarget ? targetedIdx : 0;
  // Sniper scope forces an aimed shot: if no body part is targeted, default to Torso.
  if (modEffects.forcesAimed && weaponCanTarget && effTargetedIdx === 0) effTargetedIdx = 1;
  const rawTargetedPenalty = vehicleTargeting ? 0
    : isRanged ? TARGETED_OPTIONS[effTargetedIdx].ranged : TARGETED_OPTIONS[effTargetedIdx].melee;
  // Laser sight negates the aimed-shot to-hit penalty.
  const targetedPenalty = specialUnarmedAttack ? 0 : (modEffects.negatesAimedPenalty ? 0 : rawTargetedPenalty);
  const targetedBodyPart = vehicleTargeting ? null : TARGETED_OPTIONS[effTargetedIdx].bodyPart;
  const isAimed = targetedBodyPart !== null && !specialUnarmedAttack;
  const effectiveAttackerSkills = attackerSheet?.effectiveSkills ?? null;
  const manualNaturalAttack = weapon
    ? attackActor?.naturalAttacks?.find(attack => attack.weaponId === weapon.id)
    : undefined;
  const manualSkillDelta = manualNaturalAttack && attackActor && effectiveAttackerSkills
    ? (effectiveAttackerSkills.unarmed ?? attackActor.skills.unarmed) - attackActor.skills.unarmed
    : 0;
  const baseSkill = manualNaturalAttack
    ? Math.max(0, manualNaturalAttack.hitChance + manualSkillDelta)
    : (effectiveAttackerSkills && weapon)
      ? effectiveAttackerSkills[weapon.skill] ?? 0
      : 0;

  // Perk bonuses
  const attackRuleArmor = allArmor.filter(armor =>
    armor.id === attackActor?.equippedBodyArmorId || armor.id === attackActor?.equippedHelmetId);
  const actionRuleMode = isBurst ? 'burst' : isAimed ? 'targeted' : 'single';
  const customAttackPerkEffects = computeCustomPerkEffects(attackActor, customPerks, {
    weapon, armor: attackRuleArmor, mode: actionRuleMode,
  });
  const perkBonuses = computePerkBonuses(attackActor, weapon, isRanged, defender);
  perkBonuses.toHit += customAttackPerkEffects.toHit
    + (weapon ? customAttackPerkEffects.skillBonuses[weapon.skill] ?? 0 : 0);
  perkBonuses.damage += customAttackPerkEffects.damage;
  perkBonuses.apDiscount += customAttackPerkEffects.apDiscount;
  perkBonuses.ignoreDT += customAttackPerkEffects.ignoreDT + customModEffects.ignoreDT;

  const defenderRuleWeapon = defender?.equippedWeaponId
    ? allWeapons.find(candidate => candidate.id === defender.equippedWeaponId) ?? null
    : null;
  const defenderRuleArmor = allArmor.filter(armor =>
    armor.id === defender?.equippedBodyArmorId || armor.id === defender?.equippedHelmetId);
  const customDefenderPerkEffects = computeCustomPerkEffects(defender, customPerks, {
    weapon: defenderRuleWeapon, armor: defenderRuleArmor, mode: null,
  });

  // Effective magazine size after mods (extended/drum magazines).
  const effectiveMagazine = weapon
    ? Math.round(weapon.magazineSize * (modEffects.magazineMult ?? 1) * customModEffects.magazineMult)
    : 0;

  // Reload AP cost — Speed Loader mod (reloadApOverride) can reduce it.
  const reloadApCost = Math.min(
    modEffects.reloadApOverride ?? AP_COSTS.RELOAD,
    customModEffects.reloadApOverride ?? AP_COSTS.RELOAD,
  );

  // Active-effect (chem) modifiers on attacker & defender (data/effects.ts).
  const defenderEffectMods = defender ? computeEffectModifiers(defender) : null;
  const attackerEffSpecial = attackerSheet?.effectiveSpecial ?? null;
  const defenderEffSpecial = defenderSheet?.effectiveSpecial ?? null;
  const specialUnarmedEligibility = attackActor && specialUnarmedAttack
    ? evaluateEligibility(
        specialUnarmedAttack,
        attackActor.level,
        attackerEffSpecial ?? attackActor.special,
        effectiveAttackerSkills ?? attackActor.skills,
        [],
      )
    : null;
  // Defender-side perk bonuses (Dodger AC, Toughness DR, …) + chem AC mods.
  const builtinDefenderPerkDef = computeDefensivePerkBonuses(defender, weapon?.damageType, getPerkById);
  const defenderPerkDef = {
    ...builtinDefenderPerkDef,
    ac: builtinDefenderPerkDef.ac + customDefenderPerkEffects.armorClass,
    dr: builtinDefenderPerkDef.dr
      + (weapon ? customDefenderPerkEffects.damageResistance[weapon.damageType] ?? 0 : 0),
  };

  // Effective weapon range: base rangeNormal + mod range bonuses
  const effectiveRange = weapon ? weapon.rangeNormal + modBonuses.range + customAttackPerkEffects.range : 0;

  // ─── Loaded ammo type (data/ammo.ts) ───────────────────────────────────────
  const ammoTypeId = (attacker && weapon)
    ? attacker.weaponAmmoStates?.find(a => a.weaponId === weapon.id)?.ammoTypeId
    : undefined;
  const loadedAmmo: AmmoType | null = resolveEquippedAmmoType(weapon, ammoTypeId, allAmmo) ?? null;
  const attackPoisons = defender?.vehicle ? [] : poisonExposuresForAttack(weapon, loadedAmmo);
  // Only the weapon's compatible ammo may be loaded.
  const compatibleAmmo: AmmoType[] = weapon?.compatibleAmmo
    ? weapon.compatibleAmmo.map(id => getAmmoById(id, allAmmo)).filter((a): a is AmmoType => !!a)
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
  const defenderEffectiveAgi = defenderEffSpecial?.agility ?? 0;
  const injuredAgi = defenderInjury?.effectiveAgility;
  const defenderBaseAgi = Math.max(0, injuredAgi ?? defenderEffectiveAgi);
  const defenderKamikaze = !!defender && (defender.traits ?? []).includes('kamikaze');
  const uprightNaturalAgiAC = defenderKamikaze ? 0 : defenderBaseAgi;
  let defenderPositionalAgiAC = uprightNaturalAgiAC;
  if (defenderPos === 'crouching') defenderPositionalAgiAC = Math.min(uprightNaturalAgiAC, 3);
  else if (defenderPos === 'prone') defenderPositionalAgiAC = Math.min(uprightNaturalAgiAC, 1);
  const defenderAgiAcDelta = uprightNaturalAgiAC - defenderPositionalAgiAC;
  const defenderEffectiveAC = defenderSheet?.armorClass ?? 0;
  const defenderAC = defender
    ? defender.combatDefenseSuppressed
      ? defenderEffectiveAC
      : Math.max(0, defenderEffectiveAC - defenderAgiAcDelta
          + defenderPerkDef.ac + defenderShield.ac)
    : 0;
  const defenderACAffectsHit = specialUnarmedAttack?.armorClassPiercing ? 0 : defenderAC;

  // Blind attacker suffers worst-case darkness penalty (manual light table).
  const blindDarknessPenalty = attackerInjury?.blind ? TOTAL_DARKNESS_PENALTY : 0;
  const rawLightPenalty = Math.max(lightPenalty, blindDarknessPenalty);

  // Light penalty after Night Vision perk; a night sight or armor optics ignores it entirely.
  const effectiveLightPenalty = modEffects.ignoresLightPenalty || attackerSheet?.ignoresLightPenalties
    ? 0
    : Math.max(0, Math.round(rawLightPenalty * (1 - perkBonuses.lightReduction / 100)));

  // STR requirement penalty
  const effectiveMinStr = weapon ? Math.max(1, weapon.minStr - perkBonuses.strReqReduction) : 0;
  // Uses effective STR (chems like Buffout can raise it past the requirement).
  const attackerStr = attackerEffSpecial?.strength ?? attackActor?.special?.strength ?? 0;
  const strReqPenalty = (attackActor && weapon && attackActor.special)
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
  const ammoAccuracyModifier = describeAmmoAccuracyModifier(loadedAmmo);
  const ammoToHitAdjust = ammoAccuracyModifier?.chanceToHitAdjustment ?? 0;
  const vehicleMotionPenalty = vehicleTargetToHitPenalty(defender?.vehicle);

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
      + (traitEffects.toHitBonus ?? 0)
      + vehicleMotionPenalty
    ));

  // Double shot: single shot, range −3
  const weaponCanBurst = !!weapon && !specialUnarmedAttack && weapon.apBurst !== null && weapon.burstLimit > 1;
  // Reset stale fire-mode/aim selections when switching to a weapon that
  // doesn't support them.
  useEffect(() => {
    if (weapon && !weaponCanBurst && isBurst) setIsBurst(false);
    if (weapon && !weaponCanTarget && targetedIdx !== 0) setTargetedIdx(0);
    if (fastShotApplies && targetedIdx !== 0) setTargetedIdx(0);
  }, [weapon?.id, weaponCanBurst, weaponCanTarget, fastShotApplies]);
  const effectiveBurstShots = doubleShotActive ? 1 : (isBurst && weaponCanBurst ? burstShots : 1);
  const burstPenalties = Array.from({ length: effectiveBurstShots }, (_, i) => i === 0 ? 0 : -i * 10);
  const shotChances = burstPenalties.map(p => computeCtH(p));

  const rollTotal = (tensFace !== null && unitsFace !== null) ? percentileRoll(tensFace, unitsFace) : null;

  // ─── Crit chance (manual: baseCritChance = Luck + 5×More Criticals rank) ──────
  // Aimed shots add TARGETED_CRIT_BONUS[bodyPart].
  const attackerBaseCrit = attackActor
    ? calcBaseCritChance(attackerEffSpecial ? { ...attackActor, special: attackerEffSpecial } : attackActor)
    : 0;
  const aimCritBonus = isAimed && targetedBodyPart ? TARGETED_CRIT_BONUS[targetedBodyPart] : 0;
  const specialCritBonus = specialUnarmedAttack?.critBonus ?? 0;
  const rawCritChance = attackerBaseCrit + aimCritBonus + perkBonuses.critChance + (traitEffects.critChanceBonus ?? 0) + specialCritBonus;
  const helmetHeadCritReduction = isAimed
    && targetedBodyPart === 'head'
    && !!defenderSheet?.helmet
    && defenderSheet.helmet.id !== 'no_helmet'
    ? HELMET_HEAD_CRIT_REDUCTION
    : 0;
  const totalCritChance = applyHelmetHeadCritReduction(
    rawCritChance,
    targetedBodyPart,
    helmetHeadCritReduction > 0,
  );

  // Perks: Sniper (ranged) / Slayer (melee+unarmed) — on a successful hit, also
  // roll 1d10; if <= Luck the hit is critical. Whether that perk applies here:
  const attackerLuck = attackerEffSpecial?.luck ?? attackActor?.special?.luck ?? 5;
  const sniperApplies = !!attacker && isRanged && hasPerk(attacker, 'sniper');
  const slayerApplies = !!attacker && isMeleeOrUnarmed && hasPerk(attacker, 'slayer');
  // Gunslinger: one-handed ranged weapons crit on a successful Luck roll.
  const gunslingerApplies = !!attacker && isRanged && weaponHands === 1 && hasPerk(attacker, 'gunslinger');
  const luckPerkApplies = sniperApplies || slayerApplies || gunslingerApplies;
  const hasBetterCriticals = !!attackActor && hasPerk(attackActor, 'better_criticals');

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
    const critFailResult = (manualCritFailConfirmed && i === 0)
      || (!physicalHitConfirmed && !hit && isCritFail);
    const margin = (roll !== null && hit) ? cth - roll : 0;
    return { index: i, chanceToHit: cth, penalty: burstPenalties[i], roll, hit, margin, isCrit, isCritFail: critFailResult };
  });

  const canRoll = !!(attacker && defender && weapon && (!attacker.vehicle || vehicleGunner));
  const attackResolved = rollTotal !== null || physicalHitConfirmed || manualCritFailConfirmed;

  // ─── AP cost (per-weapon apSingle/apTargeted/apBurst; fallback AP_COSTS) ───────
  const wSingle = weapon?.apSingle ?? AP_COSTS.ATTACK_SINGLE;
  const wTargeted = weapon === null ? AP_COSTS.ATTACK_AIMED
    : (weapon.apTargeted === undefined ? AP_COSTS.ATTACK_AIMED : weapon.apTargeted); // null = cannot target
  const wBurst = weapon === null ? AP_COSTS.ATTACK_BURST
    : (weapon.apBurst === undefined ? AP_COSTS.ATTACK_BURST : weapon.apBurst); // null = no burst
  const canTarget = wTargeted !== null && !specialUnarmedAttack && !fastShotApplies;
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
  const traitAPDelta = (traitEffects.attackAPPenalty ?? 0) - (fastShotApplies ? (traitEffects.attackAPDiscount ?? 0) : 0);
  const effectiveAPCost = Math.max(
    1,
    baseAPCost + traitAPDelta - perkBonuses.apDiscount - customModEffects.apDiscount
      - (isBurst ? perkBonuses.burstApDiscount : 0),
  );
  const attackerHasAP = (attackActor?.currentAP ?? 0) >= effectiveAPCost;

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

  useEffect(() => {
    const streamlinedOutcome = isBurst && burstMode === 'streamlined' && streamlinedRolled;
    if (!attackResolved && !streamlinedOutcome) return;

    const receipt = attackReceipt.current;
    if (!receipt || outcomeSoundReceiptRef.current === receipt) return;
    outcomeSoundReceiptRef.current = receipt;

    const kind = streamlinedOutcome
      ? (streamlinedDice.some(die => die > 0 && die <= streamlinedHitThreshold) ? null : 'miss')
      : getCombatOutcomeSoundKind(shotResults);
    if (kind) {
      requestCombatOutcomeSound(kind, combatOutcomeSoundPlayers, () => combatSoundsEnabledRef.current);
    }
  }, [
    attackResolved,
    isBurst,
    burstMode,
    streamlinedRolled,
    streamlinedDice,
    streamlinedHitThreshold,
    shotResults,
    combatMissPlayer,
    combatCriticalHitPlayer,
  ]);

  // Reset the full per-attack state (dice + crit + damage + AP flags). Used by
  // ATTACK AGAIN and the change-of-config effect below. Keeps attacker/defender/
  // weapon/modifier selections intact.
  const resetAttackState = useCallback(() => {
    beginAttack();
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
    setManualCritFailConfirmed(false);
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
    if (attackWeaponId && !attackCandidates.some(candidate => candidate.id === attackWeaponId)) {
      setAttackWeaponId(null);
    }
  }, [attackWeaponId, attackCandidates]);

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
    const skillIsTagged = !!attacker && !!weapon && (
      attacker.taggedSkills.includes(weapon.skill)
      || attacker.perks.some(perk => perk.bonusTaggedSkill === weapon.skill)
    );
    if (attacker && weapon && skillIsTagged && (attacker.traits ?? []).includes('beta_software')) {
      const luckTens = rollD10();
      const luckUnits = rollD10();
      const luckRoll = percentileRoll(luckTens, luckUnits);
      if (luckRoll > attacker.special.luck * 10) {
        setTensFace(luckTens);
        setUnitsFace(luckUnits);
        setShotDamages(null);
        setDamageApplied(false);
        setPrimaryIsCrit(false);
        setIsCritFail(false);
        setShowCritFailModal(false);
        spendAP(attacker.id, attacker.currentAP);
        notify('Beta Software Check Failed', `Luck check ${luckRoll} exceeded ${attacker.special.luck * 10}. The tagged-skill action fails and all remaining AP are lost.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCombatAttackSounds(
      getCombatAttackSoundFamily(weapon, isMeleeOrUnarmed),
      getCombatAttackSoundShotCount({ isBurst: isBurst && weaponCanBurst, burstShots, doubleShotActive }),
    );
    setRolling(true);
    setPhysicalHitConfirmed(false);
    const t = rollD10(); const u = rollD10();
    beginAttack();
    setTensFace(t); setUnitsFace(u);
    setShotDamages(null); setDamageApplied(false);
    setPrimaryIsCrit(false); setAimedCritPart(null); setAimedCritApplied(false); setAimedCritNotes([]);
    setShowCritModal(false); setCritTableEntry(null); setCritEffectNotes([]);
    setIsCritFail(false); setManualCritFailConfirmed(false); setShowCritFailModal(false); setCritFailEntry(null); setCritFailNotes([]);
    setDivineFavorRoll(null);
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
    } else if (attacker?.perks.some(perk => perk.perkId === 'divine_favor')
      && !attacker.perkTrackers?.divine_favor?.used) {
      setDivineFavorRoll({ roll, tens: t, units: u });
    } else if (isCriticalFailureRoll(
      roll,
      characters.some(character => !character.inStorage && (character.traits ?? []).includes('jinxed')),
      Math.random(),
    )) {
      // Critical Failure (manual p.31): a miss with roll 97-100 opens the
      // Critical Failure Table. The old auto-jam is replaced by the table flow
      // (result 2 = Weapon Jammed applies the jam via rollCritFailTable).
      setIsCritFail(true);
      setShowCritFailModal(true);
    }

    setTimeout(() => setRolling(false), 350);
  }, [weaponBroken, hasAmmo, attacker, weapon, shotChances, totalCritChance, isAimed, targetedBodyPart,
      luckPerkApplies, attackerLuck, spendAmmo, spendAP, reloadWeapon, playCombatAttackSounds,
      isMeleeOrUnarmed, isBurst, weaponCanBurst, burstShots, doubleShotActive, characters]);

  const resolveDivineFavorChoice = useCallback((useFavor: boolean) => {
    const pending = divineFavorRoll;
    setDivineFavorRoll(null);
    if (!pending || !attacker) return;
    const jinxedPresent = characters.some(character =>
      !character.inStorage && (character.traits ?? []).includes('jinxed'));
    if (!useFavor) {
      if (isCriticalFailureRoll(pending.roll, jinxedPresent, Math.random())) {
        setIsCritFail(true);
        setShowCritFailModal(true);
      }
      return;
    }

    updateCharacter({
      ...attacker,
      perkTrackers: {
        ...(attacker.perkTrackers ?? {}),
        divine_favor: { ...attacker.perkTrackers?.divine_favor, used: true },
      },
    });
    const t = rollD10();
    const u = rollD10();
    const roll = percentileRoll(t, u);
    setTensFace(t);
    setUnitsFace(u);
    setIsCritFail(false);
    setShowCritFailModal(false);
    setCritFailEntry(null);
    setCritFailNotes([]);
    setPrimaryIsCrit(false);
    setAimedCritPart(null);
    setAimedCritApplied(false);
    setAimedCritNotes([]);
    setShowCritModal(false);
    setCritTableEntry(null);
    setCritEffectNotes([]);
    if (roll <= shotChances[0]) {
      let isCrit = roll <= totalCritChance;
      if (!isCrit && luckPerkApplies && rollD10() <= attackerLuck) isCrit = true;
      if (isCrit) {
        setPrimaryIsCrit(true);
        if (isAimed && targetedBodyPart) setAimedCritPart(targetedBodyPart);
        else setShowCritModal(true);
      }
    } else if (isCriticalFailureRoll(roll, jinxedPresent, Math.random())) {
      setIsCritFail(true);
      setShowCritFailModal(true);
    }
  }, [divineFavorRoll, attacker, characters, updateCharacter, shotChances, totalCritChance,
    luckPerkApplies, attackerLuck, isAimed, targetedBodyPart]);

  const confirmPhysicalHit = useCallback(() => {
    if (isBurst) return;
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
    beginAttack();
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
    setManualCritFailConfirmed(false);
    setShowCritFailModal(false);
    setCritFailEntry(null);
    setCritFailNotes([]);
    setApSpent(false);
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, 1);
    }
  }, [isBurst, weaponBroken, hasAmmo, attacker, weapon, spendAmmo]);

  const confirmManualCritical = useCallback((outcome: 'hit' | 'fail') => {
    if (isBurst) return;
    if (weaponBroken) {
      notify('Weapon Broken', 'This weapon is jammed/broken and cannot attack until repaired.');
      return;
    }
    if (!hasAmmo) {
      notify('Empty Magazine', 'No ammo remaining. Reload first!');
      return;
    }
    const confirmsHit = outcome === 'hit';
    beginAttack();
    Haptics.notificationAsync(
      confirmsHit
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    setTensFace(null);
    setUnitsFace(null);
    setPhysicalHitConfirmed(confirmsHit);
    setManualCritFailConfirmed(!confirmsHit);
    setShotDamages(null);
    setDamageApplied(false);
    setPrimaryIsCrit(confirmsHit);
    // Explicit critical-hit confirmation always uses the selectable table.
    setAimedCritPart(null);
    setAimedCritApplied(false);
    setAimedCritNotes([]);
    setShowCritModal(confirmsHit);
    setCritTableEntry(null);
    setCritEffectNotes([]);
    setIsCritFail(!confirmsHit);
    setShowCritFailModal(!confirmsHit);
    setCritFailEntry(null);
    setCritFailNotes([]);
    setApSpent(false);
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, 1);
    }
  }, [isBurst, weaponBroken, hasAmmo, attacker, weapon, spendAmmo]);

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
    playCombatAttackSounds(
      getCombatAttackSoundFamily(weapon, isMeleeOrUnarmed),
      getCombatAttackSoundShotCount({ isBurst: true, burstShots, doubleShotActive: false }),
    );
    const dice = Array.from({ length: burstShots }, () => Math.floor(Math.random() * 10));
    beginAttack();
    setStreamlinedDice(dice);
    setStreamlinedRolled(true);
    setStreamlinedDmgResult(null);
    setShotDamages(null); setDamageApplied(false); setApSpent(false);
    if (attacker && weapon && weapon.magazineSize > 0) {
      spendAmmo(attacker.id, weapon.id, burstShots);
    }
  }, [weaponBroken, hasAmmo, attacker, weapon, burstShots, spendAmmo, currentAmmo,
    playCombatAttackSounds, isMeleeOrUnarmed]);

  const calculateDamage = useCallback(() => {
    if (!weapon || shotResults.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Combined DT/DR from armor + defender natural protection.
    const prot = combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot);
    const damageResistanceCap = defender?.manualDerivedStats ? 100 : 90;
    const defenderDRModifier = defenderPerkDef.dr + (defenderEffectMods?.drMod ?? 0)
      + empShieldingResistance(defender, loadedAmmo);
    // Optional manual base-damage override (replaces the rolled dice total).
    const overrideVal = damageOverride.trim() === '' ? null : Math.max(0, parseInt(damageOverride, 10) || 0);

    // Melee Damage (MD): STR table (chem-adjusted STR, e.g. Buffout) + race
    // bonus (e.g. Deathclaw +5) + Bonus HtH Damage perk (+2/rank — the perk
    // raises MD itself, so it lives HERE and not in perkBonuses) + traits
    // (Heavy Handed +4, Domesticated −2).
    const raceMeleeBonus = isMeleeOrUnarmed ? (getRaceById(attacker?.race ?? '')?.bonusMeleeDamage ?? 0) : 0;
    const hthPerkBonus = isMeleeOrUnarmed ? 2 * (attacker?.perks.find(p => p.perkId === 'bonus_hth_damage')?.rank ?? 0) : 0;
    const traitMeleeBonus = isMeleeOrUnarmed && attacker ? (computeTraitEffects(attacker).meleeDamageBonus ?? 0) : 0;
    const meleeDmgBonus = isMeleeOrUnarmed && !manualNaturalAttack
      ? Math.max(0, (attackerSheet?.meleeDamage ?? 0) + raceMeleeBonus + hthPerkBonus + traitMeleeBonus)
      : 0;

    const damages = shotResults.map((shot, i) => {
      if (!shot.hit) return null;
      const notes: string[] = [];
      let critMult = perkBonuses.damageMultiplier;
      if (critMult !== 1) notes.push(`Perk damage multiplier ×${critMult}`);
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
        if (traitEffects.critDamageMultiplier && traitEffects.critDamageMultiplier !== 1) {
          critMult *= traitEffects.critDamageMultiplier;
          notes.push(`Heavy Handed: critical damage ×${traitEffects.critDamageMultiplier}`);
        }
      }

      const dieCount = doubleShotActive ? weapon.damageDieCount * 2 : weapon.damageDieCount;
      const weaponRolls = overrideVal === null
        ? Array.from({ length: dieCount }, () => rollDie(weapon.damageDie))
        : [];
      // Ammo contributes its own dice (manual: gun damage = weapon dice + ammo).
      const ammoRolls = overrideVal === null && loadedAmmo && !loadedAmmo.components?.length && loadedAmmo.dmgDieCount > 0 && loadedAmmo.dmgDie > 0
        ? Array.from({ length: loadedAmmo.dmgDieCount }, () => rollDie(loadedAmmo.dmgDie))
        : [];
      if (loadedAmmo && (ammoRolls.length > 0 || loadedAmmo.dmgBonus)) {
        notes.push(`Ammo (${loadedAmmo.name})${ammoRolls.length ? ` +[${ammoRolls.join(', ')}]` : ''}${loadedAmmo.dmgBonus ? ` +${loadedAmmo.dmgBonus}` : ''}`);
      }
      const baseRolls = [...weaponRolls, ...ammoRolls];
      // Manual override replaces the summed dice total (mods/melee/perks still add).
      const rolledSum = overrideVal !== null ? overrideVal : baseRolls.reduce((a, b) => a + b, 0);
      if (overrideVal !== null) notes.push(`Manual base damage: ${overrideVal}`);
      const ammoFlat = loadedAmmo?.components?.length ? 0 : loadedAmmo?.dmgBonus ?? 0;
      const specialDamageBonus = specialUnarmedAttack?.damageBonus ?? 0;
      if (specialUnarmedAttack) {
        notes.push(`${specialUnarmedAttack.name}: +${specialDamageBonus} damage${specialUnarmedAttack.armorClassPiercing ? ', Armor Class ignored for hit roll' : ''}`);
      }
      const protection = resolveDamageProtection({
        baseDT: prot.dt,
        baseDR: tightNutsAdjustedDR(prot.dr, weapon?.damageType ?? 'normal', defender, defenderNatural),
        ammoIgnoresDT: loadedAmmo?.ignoresDT,
        ammoDRModifier: loadedAmmo?.drMod,
        ignoredDT: perkBonuses.ignoreDT,
        defenderDRModifier,
        damageResistanceCap,
        bypassesArmor: bypassArmor,
      });
      const dt = protection.effectiveDT;
      const dr = protection.effectiveDR;
      if (bypassArmor) notes.push('Bypasses armor (DT/DR ignored)');
      // Apply DT first, then DR: finalDmg = max(0, (baseDmg − DT) × (1 − DR/100))
      const resolvedDamage = resolveDamagePipeline({
        initialDiceDamage: rolledSum,
        flatDamageBonus: weapon.damageBonus + ammoFlat + meleeDmgBonus + specialDamageBonus + modBonuses.damage + perkBonuses.damage,
        criticalMultiplier: critMult,
        damageThreshold: dt,
        damageResistance: dr,
        damageResistanceCap,
      });
      const rawBaseDmg = resolvedDamage.baseDamage;
      const afterDT = resolvedDamage.afterDamageThreshold;
      const weaponPhysicalDmg = Math.round(resolvedDamage.finalDamage * (traitEffects.damageMultiplier ?? 1));
      const bonusDamageComponents = [
        ...(loadedAmmo?.components ?? []),
        ...customModEffects.damageComponents,
        ...customAttackPerkEffects.damageComponents,
      ];
      const componentResolution = bonusDamageComponents.length
        ? resolveAmmoDamageComponents({
            components: bonusDamageComponents,
            rollDie,
            radiationResistance: (defenderSheet?.radiationResistance ?? 0)
              + customDefenderPerkEffects.radiationResistance,
            criticalMultiplier: critMult,
            postProtectionMultiplier: traitEffects.damageMultiplier ?? 1,
            resolveProtection: damageType => {
              const typedProtection = combinedProtectionFor(damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot);
              const typedDefenderPerks = computeDefensivePerkBonuses(defender, damageType, getPerkById);
              const resolved = resolveDamageProtection({
                baseDT: typedProtection.dt,
                baseDR: tightNutsAdjustedDR(typedProtection.dr, damageType, defender, defenderNatural),
                ammoIgnoresDT: loadedAmmo?.ignoresDT,
                ammoDRModifier: loadedAmmo?.drMod,
                ignoredDT: perkBonuses.ignoreDT,
                defenderDRModifier: typedDefenderPerks.dr
                  + (customDefenderPerkEffects.damageResistance[damageType] ?? 0)
                  + (defenderEffectMods?.drMod ?? 0)
                  + empShieldingResistance(defender, loadedAmmo),
                damageResistanceCap,
                bypassesArmor: bypassArmor,
              });
              return { damageThreshold: resolved.effectiveDT, damageResistance: resolved.effectiveDR };
            },
          })
        : null;
      const componentBreakdown = componentResolution?.components.map(component => {
        const rolled = component.rolls.length ? `[${component.rolls.join(', ')}]${component.component.dmgBonus ? ` ${component.component.dmgBonus > 0 ? '+' : ''}${component.component.dmgBonus}` : ''}` : `${component.component.dmgBonus}`;
        const multipliers = component.component.type !== 'radiation'
          ? `${critMult !== 1 ? ` · crit ×${critMult}` : ''}${(traitEffects.damageMultiplier ?? 1) !== 1 ? ` · trait ×${traitEffects.damageMultiplier}` : ''}`
          : '';
        return component.component.type === 'radiation'
          ? `${component.component.label}: ${rolled} = ${component.rawDamage} incoming radiation; ${defenderSheet?.radiationResistance ?? 0}% resistance → ${component.finalRadiation ?? 0} applied`
          : `${component.component.label} (${component.component.type}): ${rolled} = ${component.rawDamage}${multipliers}; DT ${component.protection?.damageThreshold ?? 0} / DR ${component.protection?.damageResistance ?? 0}% → ${component.finalHp ?? 0} HP`;
      }) ?? [];
      const physicalDmg = weaponPhysicalDmg + (componentResolution?.totalHpDamage ?? 0);
      const poisonResistance = (defenderSheet?.poisonResistance ?? 0)
        + customDefenderPerkEffects.poisonResistance;
      const poisonResults = attackPoisons.map(poison =>
        resolvePoisonResistance(poison, poisonResistance, Math.floor(Math.random() * 100) + 1));
      const poisonBonusDamage = poisonResults.reduce((sum, result) => sum + result.bonusDamage, 0);
      const finalDmg = physicalDmg + poisonBonusDamage;
      if (traitEffects.damageMultiplier && traitEffects.damageMultiplier !== 1) notes.push(`Finesse: post-DR damage ×${traitEffects.damageMultiplier}`);
      return {
        shotIndex: i, baseRolls, baseDmg: rawBaseDmg, combinedDT: dt, combinedDR: dr,
        finalDmg, physicalDmg, poisonBonusDamage, poisonResults,
        critMultiplier: critMult, meleeDmgBonus, afterDT, bypassArmor,
        critNotes: notes, manualBaseDamage: overrideVal, protection,
        componentBreakdown, radiationExposure: componentResolution?.totalRadiation ?? 0,
      };
    });
    setShotDamages(damages); setDamageApplied(false);
  }, [weapon, shotResults, bodyArmor, helmet, defenderNatural, isAimed, aimedCritPart, critTableEntry, hasBetterCriticals, doubleShotActive, isMeleeOrUnarmed, manualNaturalAttack, attacker, attackerSheet, perkBonuses, modBonuses, loadedAmmo, damageOverride, defenderPerkDef, defenderEffectMods, specialUnarmedAttack, traitEffects, defenderSheet, attackPoisons]);

  const totalDamage = shotDamages ? shotDamages.reduce((s, d) => s + (d?.finalDmg ?? 0), 0) : 0;
  const totalPhysicalDamage = shotDamages ? shotDamages.reduce((s, d) => s + (d?.physicalDmg ?? 0), 0) : 0;
  const totalRadiationExposure = shotDamages ? shotDamages.reduce((s, d) => s + (d?.radiationExposure ?? 0), 0) : 0;
  const appliedPoisonResults = shotDamages?.flatMap(damage =>
    damage?.poisonResults.filter(result => result.applied) ?? []) ?? [];
  const hasAppliedPoison = appliedPoisonResults.length > 0;

  const applyPoisonExposure = useCallback((results: PoisonResistanceResult[]) => {
    if (!defender || !weapon) return;
    for (const result of results) {
      if (result.applied) addEffect(defender.id, makePoisonedEffect(result.poison, weapon.name));
    }
  }, [defender, weapon, addEffect]);

  const handleSpendAP = useCallback(() => {
    if (!attackActor) return;
    if (!spendAP(attackActor.id, effectiveAPCost)) {
      notify('Not Enough AP', `${attackActor.name} needs ${effectiveAPCost} AP for this attack.`);
      return;
    }
    setApSpent(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [attackActor, effectiveAPCost, spendAP]);

  const openMineTrapAreaAttack = useCallback(() => {
    if (!weaponAreaAttack || !weapon) {
      notify('Missing Area Profile', `${weapon?.name ?? 'This mine/trap'} has no catalog area profile yet.`);
      return;
    }
    setAreaAttackPreset(loadedAmmo?.components?.length
      ? {
          ...weaponAreaAttack,
          components: loadedAmmo.components,
          ammoIgnoresDT: loadedAmmo.ignoresDT,
          ammoDRModifier: loadedAmmo.drMod,
        }
      : weaponAreaAttack);
    setShowAreaAttack(true);
  }, [weaponAreaAttack, weapon, loadedAmmo]);

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
    const customFx = computeCustomWeaponModEffects(w.mods, customWeaponMods, w);
    const mag = Math.round(w.magazineSize * (fx.magazineMult ?? 1) * customFx.magazineMult);
    const state = attacker.weaponAmmoStates.find(a => a.weaponId === w.id);
    const cur = state?.currentAmmo ?? mag;
    const cost = Math.min(
      fx.reloadApOverride ?? AP_COSTS.RELOAD,
      customFx.reloadApOverride ?? AP_COSTS.RELOAD,
    );
    setShowReloadPicker(false);
    if (cur >= mag) {
      if (Platform.OS === 'web') alert(`${w.name} is already fully loaded (${cur}/${mag}).`);
      else Alert.alert('Magazine Full', `${w.name} is already fully loaded (${cur}/${mag}).`);
      return;
    }
    if (!attackActor || !spendAP(attackActor.id, cost)) {
      if (Platform.OS === 'web') alert(`Not enough AP (need ${cost}) to reload.`);
      else Alert.alert('Not Enough AP', `Reload needs ${cost} AP; ${attackActor?.name ?? 'the gunner'} has ${attackActor?.currentAP ?? 0}.`);
      return;
    }
    reloadWeapon(attacker.id, w.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [attacker, attackActor, customWeaponMods, spendAP, reloadWeapon]);

  // Take a chem (manual: using an item costs 3 AP). Applies the chem's immediate
  // stage as an ActiveEffect and resolves any HP heal/damage.
  const handleTakeChem = useCallback((chemId: string) => {
    if (!attacker) return;
    if ((attacker.traits ?? []).includes('rabid')) {
      notify('Chem Has No Effect', `${attacker.name} has the Rabid trait; chems and stimpaks have no effect.`);
      return;
    }
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

  const handleTakeAlcohol = useCallback(() => {
    if (!attacker) return;
    if ((attacker.traits ?? []).includes('rabid')) {
      notify('Alcohol Has No Effect', `${attacker.name} has the Rabid trait; chems have no effect.`);
      return;
    }
    if (!spendAP(attacker.id, CHEM_AP_COST)) {
      notify('Not Enough AP', `Taking alcohol needs ${CHEM_AP_COST} AP; ${attacker.name} has ${attacker.currentAP}.`);
      return;
    }
    updateCharacter({
      ...attacker,
      conditions: (attacker.conditions ?? []).includes('drunk')
        ? (attacker.conditions ?? [])
        : [...(attacker.conditions ?? []), 'drunk'],
    });
    setShowChemPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [attacker, spendAP, updateCharacter]);

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

  const handleCombatSkillResolution = useCallback((request: CombatSkillRequest) => {
    if (request.action === 'completeHealFallen') {
      if (!request.actionId || !request.method) return;
      completeHealFallen({
        actionId: request.actionId,
        resolution: { method: request.method, roll: request.roll },
      });
      setCompletionHealActionId(null);
    } else if (!combatActive) {
      notify('Start Combat First', 'Combat-skill AP and timing can only be recorded while tracked combat is active.');
      return;
    } else if (!attacker) {
      return;
    } else if (request.action === 'general') {
      startTimedSkillAction({
        actorId: attacker.id,
        label: request.label ?? 'GM skill action',
        apCost: request.ap,
        durationRounds: request.rounds,
        confirmSpendAllRemaining: request.spendAllRemaining,
      });
    } else {
      if (!defender || !request.skill) return;
      resolveHealFallen({
        actorId: attacker.id,
        targetId: defender.id,
        skill: request.skill,
        resolution: request.method ? { method: request.method, roll: request.roll } : undefined,
        confirmSpendAllRemaining: request.spendAllRemaining,
      });
    }
    setShowCombatSkill(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [attacker, defender, combatActive, startTimedSkillAction, resolveHealFallen, completeHealFallen]);

  const handleCancelCombatSkillAction = useCallback((action: TimedCombatSkillAction) => {
    const actorName = characters.find(character => character.id === action.actorId)?.name ?? 'this combatant';
    const message = `Cancel ${action.label} for ${actorName}? ${action.spentAP} AP already spent will not be refunded.`;
    const cancel = () => {
      cancelCombatSkillAction(action.id);
      if (completionHealActionId === action.id) {
        setCompletionHealActionId(null);
        setShowCombatSkill(false);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };
    if (Platform.OS === 'web') {
      if (localizedConfirm(message)) cancel();
    } else {
      Alert.alert('Cancel Pending Skill?', message, [
        { text: 'Keep Action', style: 'cancel' },
        { text: 'Cancel — no refund', style: 'destructive', onPress: cancel },
      ]);
    }
  }, [characters, cancelCombatSkillAction, completionHealActionId]);

  // Setting up a tripod costs ALL remaining AP for the round (success or fail).
  const handleSetupTripod = useCallback(() => {
    if (!attacker || attacker.currentAP < 1) return;
    spendAP(attacker.id, attacker.currentAP);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [attacker, spendAP]);

  const handleLayMine = () => {
    if (!attacker || !attackerSheet) return;
    const message = `${attacker.name} — effective Traps ${attackerSheet.effectiveSkills.traps}%.\n\nTrap setting is a roll for the GM. The app does not roll Traps automatically or assume success.\n\nSpend ${AP_COSTS.LAYING_MINE} AP to attempt placement? Cancelling spends no AP.`;
    const confirm = () => {
      if (!spendAP(attacker.id, AP_COSTS.LAYING_MINE)) {
        notify('Not Enough AP', `Lay Mine needs ${AP_COSTS.LAYING_MINE} AP.`);
      }
    };
    if (Platform.OS === 'web') {
      if (localizedConfirm(message)) confirm();
    } else {
      Alert.alert('Lay Mine — 6 AP', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spend 6 AP — attempt placement', onPress: confirm },
      ]);
    }
  };

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
    ...createCombatInjury(genId(), { location, description }, attacker?.name, weapon?.name),
  }), [attacker, weapon]);

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
    if (!defender || attackApplied.current || (totalDamage === 0 && totalRadiationExposure === 0 && !hasAppliedPoison)) return;
    attackApplied.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (totalDamage > 0) applyCombatDamage(attackReceipt.current, defender.id, totalDamage,
      shotDamages?.filter(d => d && d.physicalDmg > 0).length ?? 0, targetedBodyPart ?? undefined,
      selectedVehicleSystem?.id, attacker?.id);
    if (hasDirectCombatDamage(totalDamage)) playCombatImpact();
    if (totalRadiationExposure > 0 && !defender.vehicle) adjustRadiation(defender.id, totalRadiationExposure);
    if (hasAppliedPoison && !defender.vehicle) applyPoisonExposure(appliedPoisonResults);
    // Auto-apply the aimed-shot targeted crit injury (no hidden extra tap).
    if (primaryIsCrit && isAimed && aimedCritPart && !aimedCritApplied) {
      applyAimedCritEffect();
    }
    setDamageApplied(true);
  }, [defender, totalDamage, totalRadiationExposure, hasAppliedPoison, appliedPoisonResults, applyCombatDamage, shotDamages, targetedBodyPart, selectedVehicleSystem?.id, adjustRadiation, applyPoisonExposure, primaryIsCrit, isAimed, aimedCritPart, aimedCritApplied, applyAimedCritEffect, playCombatImpact]);

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

  // Apply a critical-failure entry to the attacker. Random rolls and manual
  // row selections share this guarded path so effects and condition apply once.
  const applyCritFailEntry = useCallback((entry: CritFailTableEntry, manual: boolean) => {
    if (!attacker) return;
    if (critFailEntry) return;
    setCritFailEntry(entry);
    const notes: string[] = [`${manual ? 'Manual pick' : 'Rolled'} ${entry.roll}: ${entry.title}`];
    const isExplosiveOrEnergy = !!weapon && (weapon.damageType === 'explosion' || weapon.damageType === 'plasma' || weapon.damageType === 'laser' || weapon.damageType === 'fire' || weapon.skill === 'energyWeapons');

    if (weapon) {
      const nextCondition = conditionAfterCriticalFailure(conditionBoxes);
      setWeaponCondition(attacker.id, weapon.id, nextCondition);
      notes.push(`Weapon condition −10% (${nextCondition}/${CONDITION_BOXES_MAX} boxes filled)`);
    }
    if (entry.emptyAmmo) {
      if (weapon && weapon.magazineSize > 0) {
        spendAmmo(attacker.id, weapon.id, currentAmmo); // discard the whole magazine
        notes.push('Magazine discarded — ammo set to 0');
      } else notes.push('Gun does not fire (no magazine to discard)');
    }
    if (entry.jam) {
      if (weapon) { notes.push('Weapon jammed — 1 turn to unjam; ammo discarded'); if (weapon.magazineSize > 0) spendAmmo(attacker.id, weapon.id, currentAmmo); }
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
        const maximumDamage = Math.max(0, weapon.damageDieCount * weapon.damageDie + weapon.damageBonus);
        const half = criticalFailureSelfDamage(weapon);
        // Attacker's own armor applies per normal damage rules.
        const selfBodyArmor = attackerSheet?.bodyArmor ?? null;
        const selfHelmet = attackerSheet?.helmet ?? null;
        const selfNatural = attacker.naturalProtection ?? getRaceById(attacker.race)?.naturalProtection ?? null;
        const sp = combinedProtectionFor(weapon.damageType, selfBodyArmor as any, selfHelmet as any, selfNatural, shieldFor(attacker).prot);
        const finalSelf = applyProtection(half, sp.dt, sp.dr);
        applyDamage(attacker.id, finalSelf);
        notes.push(`Damaged self — ${finalSelf} damage (half of maximum ${maximumDamage} = ${half}, then DT ${sp.dt} / DR ${sp.dr}% applied)`);
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
  }, [attacker, attackerSheet, weapon, critFailEntry, conditionBoxes, currentAmmo, spendAmmo, spendAP, applyDamage, setPosition, setWeaponCondition]);

  // Roll on the Critical Failure table (1d10) and auto-apply to the ATTACKER.
  const rollCritFailTable = useCallback(() => {
    const failRoll = rollD10();
    const entry = CRITICAL_FAILURE_TABLE.find(e => e.roll === failRoll) ?? CRITICAL_FAILURE_TABLE[0];
    applyCritFailEntry(entry, false);
  }, [applyCritFailEntry]);

  // Display-level DT/DR (before calculateDamage is called) — armor + natural protection
  const displayProt = weapon ? combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot) : { dt: 0, dr: 0 };
  const displayProtectionBreakdown = resolveDamageProtection({
    baseDT: displayProt.dt,
    baseDR: tightNutsAdjustedDR(displayProt.dr, weapon?.damageType ?? 'normal', defender, defenderNatural),
    ammoIgnoresDT: loadedAmmo?.ignoresDT,
    ammoDRModifier: loadedAmmo?.drMod,
    ignoredDT: perkBonuses.ignoreDT,
    defenderDRModifier: defenderPerkDef.dr + (defenderEffectMods?.drMod ?? 0)
      + empShieldingResistance(defender, loadedAmmo),
    damageResistanceCap: defender?.manualDerivedStats ? 100 : 90,
  });

  // Streamlined burst hit results
  const streamlinedHits = streamlinedDice.filter(d => d <= streamlinedHitThreshold && d > 0).length;
  const streamlinedMisses = streamlinedDice.length - streamlinedHits;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      <ScrollView ref={combatScrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 12 }} showsVerticalScrollIndicator={false}>
        {attacker?.traits?.includes('glowing_one') && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setGlowingAuraTargetIds(activeCharacters.filter(character => character.id !== attacker.id).map(character => character.id));
              setShowGlowingAuraModal(true);
            }}
            style={{ alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary, padding: 10, backgroundColor: colors.card }}
          >
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>GLOWING ONE — APPLY 1 HOUR OF EXPOSURE</Text>
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>COMBAT CALCULATOR</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={combatActive ? `Round ${currentRound} tracker` : 'Initiative and round tracker'}
            testID="initiative-round-tracker-toggle"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 150, paddingHorizontal: 10, paddingVertical: 6, borderRadius: colors.radius, backgroundColor: combatActive ? '#4a8c3f33' : colors.secondary, borderWidth: 1, borderColor: combatActive ? '#4a8c3f' : colors.border }}
            onPress={() => {
              const openingTracker = !showRoundTracker;
              setShowRoundTracker(openingTracker);
              if (!combatActive && openingTracker) {
                setExcludedInitiativeIds([]);
                setShowInitSetup(true);
              }
            }}
          >
            <Feather name="clock" size={13} color={combatActive ? '#4a8c3f' : colors.mutedForeground} />
            <Text style={{ flexShrink: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_700Bold', color: combatActive ? '#4a8c3f' : colors.mutedForeground }}>
              {combatActive ? `R${currentRound}` : 'INITIATIVE / ROUND TRACKER'}
            </Text>
          </TouchableOpacity>
        </View>
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
              </View>
            </View>

            {combatSkillReceipt && (
              <View style={{ padding: 9, gap: 2, borderRadius: colors.radius, borderWidth: 1, borderColor: combatSkillReceipt.status === 'rejected' ? colors.destructive : colors.primary, backgroundColor: colors.secondary }}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: combatSkillReceipt.status === 'rejected' ? colors.destructive : colors.primary, letterSpacing: 1 }}>
                  {combatSkillReceipt.kind === 'healFallen' ? 'HEAL FALLEN' : 'GM SKILL'} · {combatSkillReceipt.status.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  {combatSkillReceipt.reason
                    ?? `${combatSkillReceipt.spentAP} AP spent${combatSkillReceipt.status === 'pending' && combatSkillReceipt.completesOnRound ? ` · resolves at the actor’s turn in round ${combatSkillReceipt.completesOnRound}` : ''}${combatSkillReceipt.success === true ? ' · revival successful' : combatSkillReceipt.success === false ? ' · no revival' : ''}`}
                </Text>
              </View>
            )}
            {(pendingCombatSkillActions ?? []).map(action => {
              const actor = characters.find(character => character.id === action.actorId);
              const target = action.targetId ? characters.find(character => character.id === action.targetId) : null;
              const readyToResolve = action.kind === 'healFallen' && action.readyToResolve;
              return (
                <View key={action.id} style={{ padding: 9, gap: 2, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primary + '12' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>
                    {readyToResolve ? 'HEAL FALLEN READY TO RESOLVE' : action.kind === 'healFallen' ? 'HEAL FALLEN IN PROGRESS' : 'GM SKILL IN PROGRESS'}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    {readyToResolve
                      ? `${actor?.name ?? 'Unknown actor'} → ${target?.name ?? 'unknown target'} · choose one final outcome now; no additional AP is spent.`
                      : `${actor?.name ?? 'Unknown actor'}${target ? ` → ${target.name}` : ''} · ${action.label} · ends at ${actor?.name ?? 'actor'}’s turn in round ${action.completesOnRound}.`}
                  </Text>
                  {characters.find(character => character.id === action.actorId)?.combatDefenseSuppressed && <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>Armor-only AC until the actor’s next turn begins.</Text>}
                  {readyToResolve && <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>The AP cost and armor-only period are complete.</Text>}
                  {readyToResolve && (
                    target?.isKnockedOut ? (
                      <TouchableOpacity
                        testID={`resolve-pending-heal-fallen-${action.id}`}
                        onPress={() => { setCompletionHealActionId(action.id); setShowCombatSkill(true); }}
                        style={{ marginTop: 5, paddingVertical: 8, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive }}
                      >
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructiveForeground }}>RESOLVE HEAL FALLEN · 0 AP</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ marginTop: 4, fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>Target is no longer unconscious; this pending action cannot resolve.</Text>
                    )
                  )}
                  {action.kind === 'healFallen' && action.readyToResolve && <TouchableOpacity
                    testID={`cancel-pending-combat-skill-${action.id}`}
                    onPress={() => handleCancelCombatSkillAction(action)}
                    style={{ marginTop: 5, paddingVertical: 7, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive }}
                  >
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>CANCEL ACTION · NO AP REFUND</Text>
                  </TouchableOpacity>}
                </View>
              );
            })}

            {/* Setup modal inline */}
            {showInitSetup && !combatActive && (
              <View style={{ backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, textAlign: 'center' }}>SET INITIATIVE ROLLS</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>{'Sequence = PER×2.\nRoll 1d10 and add Sequence for initiative.'}</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: colors.radius, backgroundColor: colors.primary }} onPress={() => {
                  const rolls: Record<string, number> = {};
                  initiativeSetupCharacters.forEach(c => {
                    const seq = resolveCombatSheet(
                      c, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
                    ).sequence;
                    rolls[c.id] = Math.floor(Math.random() * 10) + 1 + seq;
                  });
                  setInitRolls(rolls);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}>
                  <Feather name="refresh-cw" size={14} color={colors.primaryForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primaryForeground }}>ROLL ALL (1d10 + SEQ)</Text>
                </TouchableOpacity>
                {initiativeSetupCharacters.map(c => {
                  const sheet = resolveCombatSheet(
                    c, allArmor, true, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
                  );
                  return (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <CharacterAvatar portrait={c.portrait} name={c.name} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }} numberOfLines={1}>{c.name}</Text>
                       <Text style={{ fontSize: 10, color: colors.mutedForeground }}>SEQ {sheet.sequence} · HP {c.currentHp}/{c.maxHp} · AP {sheet.maxAP}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setInitRolls(prev => ({ ...prev, [c.id]: Math.max(0, (prev[c.id] ?? 10) - 1) }))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{initRolls[c.id] ?? 10}</Text>
                      <TouchableOpacity style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setInitRolls(prev => ({ ...prev, [c.id]: Math.min(50, (prev[c.id] ?? 10) + 1) }))}><Feather name="plus" size={12} color={colors.foreground} /></TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      testID={`remove-initiative-${c.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${c.name} from initiative`}
                      style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: colors.destructive, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setExcludedInitiativeIds(prev => prev.includes(c.id) ? prev : [...prev, c.id])}
                    >
                      <Feather name="x" size={15} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                  );
                })}
                {initiativeSetupCharacters.length === 0 && (
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
                    {activeCharacters.some(c => c.currentHp > 0)
                      ? 'All living characters were removed. Cancel and reopen setup to restore them.'
                      : 'No living characters are available for initiative.'}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }} onPress={() => setShowInitSetup(false)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={initiativeSetupCharacters.length === 0} style={{ flex: 2, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: initiativeSetupCharacters.length > 0 ? '#4a8c3f' : colors.border, flexDirection: 'row', justifyContent: 'center', gap: 6 }} onPress={() => {
                    const entries: InitiativeEntry[] = initiativeSetupCharacters.map(c => {
                      // temp AC is turn-specific and starts separately at zero.
                      const sheet = resolveCombatSheet(
                        c, allArmor, false, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
                      );
                      return ({
                      id: `init-${c.id}`,
                      characterId: c.id,
                      name: c.name,
                      initiative: initRolls[c.id] ?? 10,
                      sequence: sheet.sequence,
                      maxHp: c.maxHp,
                      currentHp: c.currentHp,
                      maxAP: sheet.maxAP,
                      currentAP: sheet.maxAP,
                      armorClass: sheet.armorClass,
                      tempAC: 0,
                      position: c.position,
                      isActive: false,
                      hasActed: false,
                    });
                    });
                    if (entries.length > 0) { startCombat(entries); setShowInitSetup(false); setInitRolls({}); setExcludedInitiativeIds([]); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
                  }}>
                    <Feather name="play" size={14} color={initiativeSetupCharacters.length > 0 ? '#fff' : colors.mutedForeground} />
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: initiativeSetupCharacters.length > 0 ? '#fff' : colors.mutedForeground }}>BEGIN COMBAT</Text>
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
                    {entryChar?.isKnockedOut && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>
                        Unconscious for {entryChar.knockOutRoundsLeft} rounds · Prone
                      </Text>
                    )}
                    {entryChar?.combatDefenseSuppressed && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>
                        Armor-only AC · restores at this character’s next turn
                      </Text>
                    )}
                    {!entryChar?.isKnockedOut && entryChar?.revivedNoAPUntilRound === currentRound && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                        Revived at 1 HP · no AP until next round · Prone
                      </Text>
                    )}
                    {(entryChar?.areaEffects ?? []).map(effect => (
                      <View key={effect.id} style={{ marginTop: 3, gap: 3 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
                          {effect.name}: 1d6/round · {effect.persistent
                            ? (effect.removeAfterTick ? 'removing after this turn' : 'until removed')
                            : `${effect.roundsLeft ?? 0} rounds`}
                        </Text>
                        {effect.kind === 'fire' ? (
                          <TouchableOpacity
                            testID={`extinguish-fire-${entryChar?.id}`}
                            disabled={!isActive || effect.removeAfterTick}
                            onPress={() => {
                              if (!entryChar || !isActive) return;
                              markAreaEffectForRemoval(entryChar.id, effect.id);
                              nextTurn();
                            }}
                            style={{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4, backgroundColor: isActive ? colors.primary : colors.border, opacity: isActive ? 1 : 0.5 }}
                          >
                            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: isActive ? colors.primaryForeground : colors.mutedForeground }}>ROLL & EXTINGUISH — FULL TURN</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            testID={`remove-acid-${entryChar?.id}`}
                            onPress={() => {
                              if (!entryChar) return;
                              const remove = () => removeAreaEffect(entryChar.id, effect.id);
                              const message = 'Confirm the acid was washed off with water or chemicals the GM ruled appropriate.';
                              if (Platform.OS === 'web') {
                                if (localizedConfirm(message)) remove();
                              } else {
                                Alert.alert('GM: Acid Removed?', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm Removed', onPress: remove }]);
                              }
                            }}
                            style={{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: colors.primary }}
                          >
                            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>GM: CONFIRM WASHED OFF</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
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

            {/* Area effects and adding combatants during active combat */}
            {combatActive && (
              <View style={{ gap: 7 }}>
                <TouchableOpacity testID="open-aoe-damage" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: colors.destructive }} onPress={() => { setAreaAttackPreset(null); setShowAreaAttack(true); }}>
                  <Feather name="target" size={14} color="#fff" />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: '#fff' }}>AOE ATTACK</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed' }} onPress={() => setShowAddCombatantPicker(true)}>
                  <Feather name="user-plus" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ADD COMBATANT</Text>
                </TouchableOpacity>
              </View>
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
          <View style={{ flexDirection: stackCombatantCards ? 'column' : 'row', alignItems: 'stretch', gap: 8 }}>
            {/* Attacker */}
            <TouchableOpacity testID="combat-attacker-card" accessibilityRole="button" accessibilityHint="Opens the attacker character picker." style={{ flex: stackCombatantCards ? undefined : 1, width: stackCombatantCards ? '100%' : undefined, minWidth: 0, flexDirection: 'column', alignItems: 'stretch', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: attacker ? colors.primary : colors.border, padding: 9, gap: 7, minHeight: 100 }} onPress={() => setShowAttackerPicker(true)}>
              {attacker ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <CharacterAvatar portrait={attacker.portrait} name={attacker.name} size={36} />
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }} android_hyphenationFrequency="none" textBreakStrategy="simple">{attacker.name}</Text>
                  </View>
                  <View style={{ width: '100%', gap: 3 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>{weapon ? weapon.name : 'No weapon'}</Text>
                    {attacker.vehicle && (
                      <>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
                          MOUNTED: {attacker.vehicle.mountedWeapons.length ? attacker.vehicle.mountedWeapons.join(' · ') : 'No weapons assigned'}
                        </Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                          Pilot: {vehiclePilot?.name ?? 'Unassigned'} · Gunner: {vehicleGunner?.name ?? 'Unassigned'}
                        </Text>
                        {vehiclePilot && pilotSheet ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={event => {
                              event.stopPropagation?.();
                              const chance = Math.max(0, Math.min(100,
                                (pilotSheet.effectiveSkills.pilot ?? 0) + attacker.vehicle!.terrainPilotModifier,
                              ));
                              const roll = Math.floor(Math.random() * 100) + 1;
                              setPilotRollResult(`${roll} vs ${chance}% — ${roll <= chance ? 'SUCCESS' : 'FAILURE'}`);
                              Haptics.notificationAsync(roll <= chance
                                ? Haptics.NotificationFeedbackType.Success
                                : Haptics.NotificationFeedbackType.Error);
                            }}
                            style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, marginTop: 3, borderRadius: 5, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card }}
                          >
                            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                              ROLL PILOT CHECK · {Math.max(0, Math.min(100, (pilotSheet.effectiveSkills.pilot ?? 0) + attacker.vehicle.terrainPilotModifier))}%
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={{ fontSize: 9, color: colors.mutedForeground }}>Assign a pilot in the vehicle editor to roll a piloting check.</Text>
                        )}
                        {pilotRollResult && <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: pilotRollResult.includes('SUCCESS') ? '#4a8c3f' : colors.destructive }}>Pilot: {pilotRollResult}</Text>}
                        {attacker.vehicle.mountedWeapons.length > 0 && !vehicleGunner && (
                          <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>Assign a gunner to fire the mounted weapons.</Text>
                        )}
                      </>
                    )}
                    {weapon && <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
                      {DAMAGE_TYPE_NAMES[weapon.damageType]} · {weapon.damageDieCount}d{weapon.damageDie}{weapon.damageBonus !== 0 ? (weapon.damageBonus > 0 ? `+${weapon.damageBonus}` : `${weapon.damageBonus}`) : ''}
                    </Text>}
                    {!!manualNaturalAttack?.notes && <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>{manualNaturalAttack.notes}</Text>}
                    {weapon && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      Range: {effectiveRange}{modBonuses.range > 0 ? ` (${weapon.rangeNormal}+${modBonuses.range} mods)` : ''}
                    </Text>}
                    {attackActor && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      {attacker.vehicle ? `GUNNER AP ${Math.min(attackActor.currentAP, attackerSheet?.maxAP ?? attackActor.maxAP)}/${attackerSheet?.maxAP ?? attackActor.maxAP}` : `AP ${Math.min(attackActor.currentAP, attackerSheet?.maxAP ?? attackActor.maxAP)}/${attackerSheet?.maxAP ?? attackActor.maxAP} · ${attackerPos}`}
                    </Text>}
                    {attackActor?.isKnockedOut && <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>GUNNER KO · {attackActor.knockOutRoundsLeft} turn(s)</Text>}
                    {attackerInjury && attackerInjury.notes.length > 0 && attackerInjury.notes.map((n, i) => (
                      <Text key={i} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#f59e0b' }}>⚠ {n}</Text>
                    ))}
                    {(attacker.effects ?? []).filter(e => e.isActive).map(e => (
                      <Text key={e.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>
                        ⚗ {e.name}{describeEffectMods(e) ? ` · ${describeEffectMods(e)}` : ''}
                      </Text>
                    ))}
                    {computeConditionModifiers(attacker).active.map(condition => {
                      const statMods = describeCombatConditionStatMods(condition);
                      return (
                        <Text key={condition.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
                          ⚠ <Text>{condition.name}</Text>
                          {statMods ? ` · ${statMods}` : ''}
                          {condition.blocksHealing && <><Text> · </Text><Text>Healing blocked</Text></>}
                        </Text>
                      );
                    })}
                  </View>
                </>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Feather name="plus-circle" size={22} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Attacker</Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: colors.primary }}>ATK</Text>
                </View>
              )}
            </TouchableOpacity>

            <Feather name={stackCombatantCards ? 'arrow-down' : 'arrow-right'} size={20} color={colors.mutedForeground} style={{ alignSelf: "center" }} />

            {/* Defender */}
            <TouchableOpacity testID="combat-defender-card" accessibilityRole="button" accessibilityHint="Opens the defender character picker." style={{ flex: stackCombatantCards ? undefined : 1, width: stackCombatantCards ? '100%' : undefined, minWidth: 0, flexDirection: 'column', alignItems: 'stretch', backgroundColor: colors.secondary, borderRadius: colors.radius, borderWidth: 1, borderColor: defender ? colors.destructive : colors.border, padding: 9, gap: 7, minHeight: 100 }} onPress={() => setShowDefenderPicker(true)}>
              {defender ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <CharacterAvatar portrait={defender.portrait} name={defender.name} size={36} />
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }} android_hyphenationFrequency="none" textBreakStrategy="simple">{defender.name}</Text>
                  </View>
                  <View style={{ width: '100%', gap: 3 }}>
                    <Text style={{ fontSize: 8, fontFamily: 'Inter_700Bold', color: colors.destructive }}>
                      <Text>AC {defenderAC}{!defender.combatDefenseSuppressed && defender.tempAC > 0 ? ` (+${defender.tempAC})` : ''}{!defender.combatDefenseSuppressed && defenderAgiAcDelta > 0 ? ` (−${defenderAgiAcDelta} ${defenderPos})` : ''}</Text>
                      {' · '}<Text>DT</Text>{' '}{weapon ? displayProt.dt : '—'}
                      {' · '}<Text>DR</Text>{' '}{weapon ? `${displayProt.dr}%` : '—'}
                    </Text>
                    <Text style={{ fontSize: 8, fontFamily: 'Inter_700Bold', color: colors.destructive }}>
                      <Text>VS.</Text>{' '}{weapon ? <Text>{DAMAGE_TYPE_NAMES[weapon.damageType]}</Text> : '—'}
                    </Text>
                    {defender.combatDefenseSuppressed && <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>ARMOR-ONLY AC · AGI, PERKS & UNUSED AP SUPPRESSED</Text>}
                    {defender.vehicle ? (
                      <>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>
                          VEHICLE · Structure {defender.currentHp}/{defender.maxHp} HP · {defender.vehicle.inMotion ? 'Moving (−10% to hit)' : 'Stopped'}
                        </Text>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Choose vehicle system to target. Current target: ${selectedVehicleSystem?.name ?? 'Structure'}`}
                          onPress={event => {
                            event.stopPropagation?.();
                            setShowVehicleSystemPicker(true);
                          }}
                          style={{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                            TARGET: {selectedVehicleSystem?.name ?? 'Structure'} {selectedVehicleSystem ? `${selectedVehicleSystem.currentHp}/${selectedVehicleSystem.maxHp} HP` : ''}
                          </Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
                          {defender.vehicle.mountedWeapons.length ? defender.vehicle.mountedWeapons.join(', ') : 'No Vehicle Weapons'}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                          {defenderPos === 'standing' ? 'Standing' : defenderPos === 'crouching' ? 'Crouching' : 'Prone'}{defender.special ? ` · HP ${defender.currentHp}/${defender.maxHp}` : ''}
                        </Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{defenderWeapon?.name ?? 'No Weapon'}</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{bodyArmor?.name ?? 'No Armor'}</Text>
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{helmet?.name ?? (bodyArmor?.integratedHelmet ? bodyArmor.name : 'No Helmet')}</Text>
                      </>
                    )}
                    {defender.isKnockedOut && <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>KO · {defender.knockOutRoundsLeft} turn(s)</Text>}
                    {defenderInjury && defenderInjury.notes.length > 0 && defenderInjury.notes.map((n, i) => (
                      <Text key={i} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#f59e0b' }}>⚠ {n}</Text>
                    ))}
                    {(defender.effects ?? []).filter(e => e.isActive).map(e => (
                      <Text key={e.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>
                        ⚗ {e.name}{describeEffectMods(e) ? ` · ${describeEffectMods(e)}` : ''}
                      </Text>
                    ))}
                    {computeConditionModifiers(defender).active.map(condition => {
                      const statMods = describeCombatConditionStatMods(condition);
                      return (
                        <Text key={condition.id} style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
                          ⚠ <Text>{condition.name}</Text>
                          {statMods ? ` · ${statMods}` : ''}
                          {condition.blocksHealing && <><Text> · </Text><Text>Healing blocked</Text></>}
                        </Text>
                      );
                    })}
                  </View>
                </>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Feather name="plus-circle" size={22} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Defender</Text>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: colors.destructive }}>DEF</Text>
                </View>
              )}
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
                       <Text style={{ textAlign: 'center', fontSize: 11, fontFamily: 'Inter_600SemiBold', color: selected ? colors.primaryForeground : colors.foreground }} numberOfLines={1}>{compactWeaponCombatLabel(option.value)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {canRoll && naturalAttackWeapons.length > 1 && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.5 }}>NATURAL ATTACK</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {naturalAttackWeapons.map(option => {
                  const selected = weapon?.id === option.id;
                  const attack = attacker?.naturalAttacks?.find(candidate => candidate.weaponId === option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => selectAttackWeapon(option.id)}
                      style={{ minWidth: '47%', flexGrow: 1, paddingHorizontal: 10, paddingVertical: 9, borderRadius: colors.radius, backgroundColor: selected ? colors.primary : colors.secondary, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                    >
                       <Text style={{ textAlign: 'center', fontSize: 11, fontFamily: 'Inter_600SemiBold', color: selected ? colors.primaryForeground : colors.foreground }} numberOfLines={1}>{compactWeaponCombatLabel(option)}</Text>
                      <Text style={{ textAlign: 'center', fontSize: 9, fontFamily: 'Inter_400Regular', color: selected ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>{attack?.hitChance}% · {option.apSingle} AP · {option.damageDieCount}d{option.damageDie}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Attack AP controls; the active weapon name removes dual-wield ambiguity. */}
          {canRoll && !usesAreaAttackProfile && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {!apSpent && (
                  <TouchableOpacity
                    disabled={!attackerHasAP || attackBlocked}
                    accessibilityRole="button"
                    accessibilityLabel={`Spend ${effectiveAPCost} AP with ${weapon?.name ?? 'weapon'}`}
                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, flexBasis: '100%', flexGrow: 0, paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: attackerHasAP && !attackBlocked ? colors.primary : colors.secondary, borderWidth: 1, borderColor: attackerHasAP ? colors.primary : colors.destructive, opacity: attackBlocked ? 0.45 : 1 }}
                    onPress={handleSpendAP}
                  >
                    <Text numberOfLines={2} ellipsizeMode="tail" style={{ width: '100%', minWidth: 0, flexShrink: 1, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_700Bold', color: attackerHasAP && !attackBlocked ? colors.primaryForeground : colors.mutedForeground }}>
                      <Text>SPEND</Text> {effectiveAPCost} <Text>AP</Text> — <Text style={{ textTransform: 'uppercase' }}>{weapon ? compactWeaponCombatLabel(weapon) : ''}</Text>
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
                  <View style={{ width: '100%', maxWidth: '100%', minWidth: 0, paddingHorizontal: 12, paddingVertical: 10, borderRadius: colors.radius, backgroundColor: '#4a8c3f22', borderWidth: 1, borderColor: '#4a8c3f' }}>
                    <Text numberOfLines={2} ellipsizeMode="tail" style={{ width: '100%', minWidth: 0, flexShrink: 1, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>
                      ✓ <Text>AP SPENT</Text> — <Text style={{ textTransform: 'uppercase' }}>{weapon ? compactWeaponCombatLabel(weapon) : ''}</Text>
                    </Text>
                  </View>
                )}
              </View>
              {heldAmmoStatuses.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {heldAmmoStatuses.map(status => {
                    const selected = weapon?.id === status.weapon.id;
                    const hasLoadedAmmo = status.currentAmmo > 0;
                    return (
                      <View
                        key={status.weapon.id}
                        style={{ flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 7, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                      >
                        <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: selected ? colors.primary : colors.mutedForeground, letterSpacing: 1 }} numberOfLines={1}>
                          {status.role} · {compactWeaponCombatLabel(status.weapon).toUpperCase()}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: hasLoadedAmmo ? colors.primary : colors.destructive }}>
                            [{status.currentAmmo}/{status.magazineSize}]
                          </Text>
                          <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Inter_600SemiBold', color: status.ammo ? colors.foreground : colors.mutedForeground }} numberOfLines={1}>
                            {shortAmmoName(status.ammo?.name ?? 'standard')}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
              {/* Reload belongs below the attack-spend control(s). */}
              {reloadableHeldWeapons.length > 0 && (
                <TouchableOpacity disabled={allHeldMagazinesFull} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: allHeldMagazinesFull ? 0.4 : 1 }} onPress={() => {
                  if (reloadableHeldWeapons.length > 1) setShowReloadPicker(true);
                  else handleReloadWeapon(reloadableHeldWeapons[0]);
                }}>
                  <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>
                    {reloadableHeldWeapons.length > 1 ? 'RELOAD HELD WEAPON' : `RELOAD ${Math.min(
                      computeModEffects(reloadableHeldWeapons[0]).reloadApOverride ?? AP_COSTS.RELOAD,
                      computeCustomWeaponModEffects(reloadableHeldWeapons[0].mods, customWeaponMods, reloadableHeldWeapons[0]).reloadApOverride ?? AP_COSTS.RELOAD,
                    )} AP`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Mines and traps are triggered through their catalog area profile.
              They must not use the normal percentile attack or weapon-dice
              damage path.  AP setup/placement remains in the AP actions owned
              by the combat screen, so this only opens the resolver modal. */}
          {canRoll && isMineTrap && usesAreaAttackProfile && (
            <View style={{ gap: 6, padding: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: weaponAreaAttack ? colors.primary : colors.destructive, backgroundColor: colors.secondary }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1.5 }}>MINE / TRAP TRIGGER</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                {weaponAreaAttack
                  ? 'Uses the printed blast, fragmentation, concussion, or trap profile. Select the affected area and resolve it once.'
                  : 'This device is missing a catalog area profile.'}
              </Text>
              <TouchableOpacity
                testID="trigger-mine-trap"
                disabled={!defender}
                onPress={openMineTrapAreaAttack}
                style={{ paddingVertical: 11, alignItems: 'center', borderRadius: colors.radius, backgroundColor: defender ? colors.destructive : colors.border, opacity: defender ? 1 : 0.55 }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: weaponAreaAttack && defender ? '#fff' : colors.mutedForeground, letterSpacing: 1 }}>
                  {defender ? `TRIGGER PROFILE → ${defender.name.toUpperCase()}` : 'SELECT A DEFENDER FIRST'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Spend AP — movement & position actions */}
          {attacker && !attacker.vehicle && (
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: showApActions }}
                accessibilityLabel={`Spend AP actions${showApActions ? ', expanded' : ', collapsed'}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: colors.radius,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.primary,
                }}
                onPress={() => setShowApActions(v => !v)}
              >
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>MOVEMENT / ACTIONS</Text>
                <Feather name={showApActions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showApActions && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    {attacker.name} · Position: {(attacker.position ?? 'standing').toUpperCase()} · AP {Math.min(attacker.currentAP, attackerSheet?.maxAP ?? attacker.maxAP)}/{attackerSheet?.maxAP ?? attacker.maxAP}
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
                      { key: 'use_skill', label: 'USE SKILL', cost: AP_COSTS.USE_SKILL, costText: 'GM AP', onPress: () => { setCompletionHealActionId(null); setShowCombatSkill(true); } },
                      { key: 'lay_mine', label: 'LAY MINE', cost: AP_COSTS.LAYING_MINE, onPress: handleLayMine },
                    ] as { key: string; label: string; cost: number; costText?: string; onPress: () => void }[]).map(action => {
                      // Timing is GM-selected in the combat-skill sheet, so it
                      // must remain available for an underfunded skill action.
                      const disabled = action.key === 'use_skill' ? attacker.currentAP < 1 : attacker.currentAP < action.cost;
                      return (
                        <TouchableOpacity
                          key={action.key}
                          disabled={disabled}
                          style={{ minWidth: '30%', flexGrow: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, opacity: disabled ? 0.4 : 1 }}
                          onPress={action.onPress}
                        >
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{action.label}</Text>
                          <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{action.costText ?? `${action.cost} AP`}</Text>
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
        {canRoll && !usesAreaAttackProfile && weapon && !specialUnarmedAttack && (canBurst || weapon.isDoubleShot) && (
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
              {loadedAmmo && ammoAccuracyModifier && (
                <View style={{ paddingVertical: 2, gap: 1 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    {ammoAccuracyModifier.category} · {loadedAmmo.name}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: ammoToHitAdjust > 0 ? '#4a8c3f' : colors.destructive }}>
                    {ammoAccuracyModifier.adjustmentText}
                  </Text>
                </View>
              )}
              {rangeMod !== 0 && (
                <FormulaLine
                  label={`Range modifier · weapon range ${weapon ? effectiveRange : '—'}`}
                  value={`${rangeMod >= 0 ? '+' : ''}${rangeMod}%`}
                  color={rangeMod > 0 ? '#4a8c3f' : colors.destructive}
                />
              )}
              {effectiveLightPenalty !== 0 && <FormulaLine label={`Light penalty${perkBonuses.lightReduction > 0 ? ' (halved by perk)' : ''}`} value={`−${effectiveLightPenalty}%`} color={colors.destructive} />}
              {specialUnarmedAttack?.armorClassPiercing
                ? <FormulaLine label="Armor Class (piercing technique)" value="IGNORED" color="#4a8c3f" />
                : <FormulaLine label="Armor Class" value={`−${defenderAC}%`} color={colors.destructive} />}
              {defender?.tempAC && defender.tempAC > 0 ? <FormulaLine label="  (temp AC)" value={`+${defender.tempAC} from unspent AP`} color={colors.mutedForeground} /> : null}
              {vehicleMotionPenalty !== 0 && <FormulaLine label="Vehicle is Moving?" value={`${vehicleMotionPenalty}%`} color={colors.destructive} />}
              {coverPenalty !== 0 && <FormulaLine label="Cover penalty" value={`−${coverPenalty}%`} color={colors.destructive} />}
              {weaponBonus !== 0 && <FormulaLine label="Manual to-hit adjust" value={`${weaponBonus >= 0 ? '+' : ''}${weaponBonus}%`} color={weaponBonus > 0 ? '#4a8c3f' : colors.destructive} />}
              {modBonuses.toHit !== 0 && <FormulaLine label="Weapon mods (auto)" value={`${modBonuses.toHit >= 0 ? '+' : ''}${modBonuses.toHit}%`} color={modBonuses.toHit > 0 ? '#4a8c3f' : colors.destructive} />}
              {conditionPenalty > 0 && <FormulaLine label="Weapon condition" value={`−${conditionPenalty}%`} color={colors.destructive} />}
              {positionBonus !== 0 && <FormulaLine label={`Position (${POSITION_OPTIONS[posIdxFromChar].label})`} value={`+${positionBonus}%`} color="#4a8c3f" />}
              {targetedPenalty !== 0 && <FormulaLine label={`Targeted (${TARGETED_OPTIONS[targetedIdx].label})`} value={`−${targetedPenalty}%`} color={colors.destructive} />}
              {perkBonuses.toHit !== 0 && <FormulaLine label="Perk to-hit bonus" value={`+${perkBonuses.toHit}%`} color="#4a8c3f" />}
              {(traitEffects.toHitBonus ?? 0) !== 0 && <FormulaLine label="Trait to-hit bonus" value={`+${traitEffects.toHitBonus}%`} color="#4a8c3f" />}
              {strReqPenalty > 0 && <FormulaLine label={`STR req penalty (STR ${attackerStr}/${effectiveMinStr})`} value={`−${strReqPenalty}%`} color={colors.destructive} />}
              {isBurst && effectiveBurstShots > 1 && <FormulaLine label="Burst penalties" value={burstPenalties.slice(1).map(p => `${p}%`).join(', ')} color={colors.destructive} />}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
              <FormulaLine label="= Chance to Hit" value={`${shotChances[0]}%`} color={shotChances[0] >= 60 ? '#4a8c3f' : shotChances[0] >= 35 ? colors.primary : colors.destructive} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 2 }}>
                Crit chance: {totalCritChance}% (base {attackerBaseCrit}%{aimCritBonus > 0 ? ` + aimed ${aimCritBonus}%` : ''}{perkBonuses.critChance > 0 ? ` + perks ${perkBonuses.critChance}%` : ''}{specialCritBonus > 0 ? ` + ${specialUnarmedAttack?.name} ${specialCritBonus}%` : ''}{helmetHeadCritReduction > 0 ? ` − helmet ${helmetHeadCritReduction}%` : ''})
              </Text>
              {luckPerkApplies && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary }}>
                  {sniperApplies ? 'Sniper' : 'Slayer'}: on a hit, also crit if 1d10 ≤ Luck ({attackerLuck})
                </Text>
              )}
              {traitEffects.critCrippleMultiplier && traitEffects.critCrippleMultiplier !== 1 && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  Heavy Handed: critical cripple/knockout chance is 30% lower (manual adjudication; no random roll is added).
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
                {defender?.vehicle && (
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: defender.vehicle.inMotion }}
                    onPress={() => updateCharacter({
                      ...defender,
                      vehicle: { ...defender.vehicle!, inMotion: !defender.vehicle!.inMotion },
                    })}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 7, borderWidth: 1, borderColor: defender.vehicle.inMotion ? colors.destructive : colors.border, backgroundColor: colors.secondary }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground }}>Vehicle is Moving?</Text>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                        {defender.vehicle.inMotion ? '−10% chance to hit' : '0% stationary penalty'}
                      </Text>
                    </View>
                    <Feather name={defender.vehicle.inMotion ? 'check-square' : 'square'} size={18} color={defender.vehicle.inMotion ? colors.destructive : colors.mutedForeground} />
                  </TouchableOpacity>
                )}

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
                {(canTarget || defender?.vehicle) && (
                <View>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1, marginBottom: 6 }}>TARGETED SHOT</Text>
                  {defender?.vehicle ? (
                    <>
                      <Text style={{ fontSize: 10, color: colors.mutedForeground, marginBottom: 6 }}>Choose the vehicle system this hit targets.</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {defender.vehicle.systems.map(system => {
                          const selected = selectedVehicleSystem?.id === system.id;
                          return (
                            <TouchableOpacity
                              key={system.id}
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              onPress={() => setSelectedVehicleSystemId(system.id)}
                              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: selected ? colors.primary : colors.secondary, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}
                            >
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: selected ? colors.primaryForeground : colors.foreground }}>{system.name}</Text>
                              <Text style={{ fontSize: 9, color: selected ? colors.primaryForeground + 'cc' : colors.mutedForeground }}>{system.currentHp}/{system.maxHp} HP</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  ) : (
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
                  )}
                </View>
                )}
              </View>
            )}
          </View>
        )}

        {attacker && ((attacker.traits ?? []).includes('night_person') || hasPerk(attacker, 'drunken_master')) && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CONDITIONAL TRAITS & PERKS</Text>
            {(attacker.traits ?? []).includes('night_person') && (
              <View style={{ gap: 5 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>NIGHT PERSON — persist current period</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['day', 'night'] as const).map(period => (
                    <TouchableOpacity key={period} accessibilityRole="button" accessibilityLabel={`Night Person ${period}`} onPress={() => updateCharacter({ ...attacker, nightPersonPeriod: period })}
                      style={{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: (attacker.nightPersonPeriod ?? 'day') === period ? colors.primary : colors.secondary, borderWidth: 1, borderColor: (attacker.nightPersonPeriod ?? 'day') === period ? colors.primary : colors.border }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: (attacker.nightPersonPeriod ?? 'day') === period ? colors.primaryForeground : colors.foreground }}>{period.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {hasPerk(attacker, 'drunken_master') && (
              <View style={{ gap: 5 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>DRUNKEN MASTER</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={(attacker.conditions ?? []).includes('drunk') ? 'Set Drunken Master sober' : 'Set Drunken Master drunk'} onPress={() => updateCharacter({
                  ...attacker,
                  conditions: (attacker.conditions ?? []).includes('drunk')
                    ? (attacker.conditions ?? []).filter(id => id !== 'drunk')
                    : [...(attacker.conditions ?? []), 'drunk'],
                })} style={{ paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: (attacker.conditions ?? []).includes('drunk') ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: (attacker.conditions ?? []).includes('drunk') ? colors.primaryForeground : colors.foreground }}>{(attacker.conditions ?? []).includes('drunk') ? 'DRUNK — SET SOBER' : 'SOBER — SET DRUNK'}</Text>
                </TouchableOpacity>
                {(attacker.conditions ?? []).includes('drunk') && <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>+20 Unarmed active</Text>}
              </View>
            )}
          </View>
        )}

        {/* ─── Dice Roll (Complex burst / Single) ─── */}
        {canRoll && !usesAreaAttackProfile && (!isBurst || burstMode === 'complex' || !isBurst) && (
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
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: canRoll ? colors.primaryForeground : colors.mutedForeground }}>ROLL FOR ATTACK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 11, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: physicalHitConfirmed ? '#4a8c3f' : colors.primary, opacity: (!canRoll || attackBlocked || isBurst) ? 0.5 : 1 }}
              onPress={confirmPhysicalHit}
              disabled={!canRoll || attackBlocked || isBurst}
            >
              <Feather name="check-circle" size={16} color={physicalHitConfirmed ? '#4a8c3f' : colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: physicalHitConfirmed ? '#4a8c3f' : colors.primary }}>
                {physicalHitConfirmed ? 'PHYSICAL HIT CONFIRMED' : 'CONFIRM PHYSICAL HIT'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 11, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: primaryIsCrit ? '#4a8c3f' : colors.primary, opacity: (!canRoll || attackBlocked || isBurst) ? 0.5 : 1 }}
              onPress={() => confirmManualCritical('hit')}
              disabled={!canRoll || attackBlocked || isBurst}
            >
              <Feather name="zap" size={16} color={primaryIsCrit ? '#4a8c3f' : colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: primaryIsCrit ? '#4a8c3f' : colors.primary }}>
                {primaryIsCrit ? 'CRITICAL HIT CONFIRMED' : 'CONFIRM CRITICAL HIT'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 11, gap: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: isCritFail ? colors.destructive : colors.border, opacity: (!canRoll || attackBlocked || isBurst) ? 0.5 : 1 }}
              onPress={() => confirmManualCritical('fail')}
              disabled={!canRoll || attackBlocked || isBurst}
            >
              <Feather name="alert-triangle" size={16} color={colors.destructive} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.destructive }}>
                {isCritFail ? 'CRITICAL FAIL CONFIRMED' : 'CONFIRM CRITICAL FAIL'}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
              {isBurst
                ? 'Manual outcome confirmation is available for single attacks only.'
                : 'Use these after a physical percentile roll. Each records one attack and consumes this weapon’s ammo.'}
            </Text>
            {attackResolved && (
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
                Press ROLL FOR ATTACK again to make another attack (costs {effectiveAPCost} AP — spend it above).
              </Text>
            )}
            {!canRoll && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>Select an attacker with a weapon and a defender first.</Text>}
          </View>
        )}

        {/* ─── Streamlined Burst Dice ─── */}
        {canRoll && !usesAreaAttackProfile && isBurst && burstMode === 'streamlined' && (
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
                if (attackApplied.current) return;
                attackApplied.current = true;
                const burstProt = combinedProtectionFor(weapon.damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot);
                const protection = resolveDamageProtection({
                  baseDT: burstProt.dt,
                  baseDR: burstProt.dr,
                  ammoIgnoresDT: loadedAmmo?.ignoresDT,
                  ammoDRModifier: loadedAmmo?.drMod,
                  ignoredDT: perkBonuses.ignoreDT,
                  defenderDRModifier: defenderPerkDef.dr + (defenderEffectMods?.drMod ?? 0)
                    + empShieldingResistance(defender, loadedAmmo),
                  damageResistanceCap: defender?.manualDerivedStats ? 100 : 90,
                });
                const raceMeleeBonus = isMelee ? (getRaceById(attacker?.race ?? '')?.bonusMeleeDamage ?? 0) : 0;
                const hthPerkBonus = isMelee ? 2 * (attacker?.perks.find(p => p.perkId === 'bonus_hth_damage')?.rank ?? 0) : 0;
                const traitMeleeBonus = isMelee && attacker ? (computeTraitEffects(attacker).meleeDamageBonus ?? 0) : 0;
                const meleeDmgBonus = isMelee
                  ? Math.max(0, (attackerSheet?.meleeDamage ?? 0) + raceMeleeBonus + hthPerkBonus + traitMeleeBonus)
                  : 0;
                const poisonResults: PoisonResistanceResult[] = [];
                const componentBreakdown: string[] = [];
                let radiationExposure = 0;
                let damagingHits = 0;
                const perHit = Array.from({ length: streamlinedHits }, (_, hitIndex) => {
                  const rolls = Array.from({ length: weapon.damageDieCount }, () => rollDie(weapon.damageDie));
                  const ammoRolls = loadedAmmo && !loadedAmmo.components?.length && loadedAmmo.dmgDieCount > 0 && loadedAmmo.dmgDie > 0
                    ? Array.from({ length: loadedAmmo.dmgDieCount }, () => rollDie(loadedAmmo.dmgDie)) : [];
                  const raw = rolls.reduce((a, b) => a + b, 0) + ammoRolls.reduce((a, b) => a + b, 0)
                    + (loadedAmmo?.components?.length ? 0 : loadedAmmo?.dmgBonus ?? 0) + weapon.damageBonus + meleeDmgBonus + modBonuses.damage + perkBonuses.damage;
                  let physicalDamage = applyProtection(raw, protection.effectiveDT, protection.effectiveDR);
                  if (loadedAmmo?.components?.length) {
                    const componentResult = resolveAmmoDamageComponents({
                      components: loadedAmmo.components,
                      rollDie,
                      radiationResistance: defenderSheet?.radiationResistance ?? 0,
                      resolveProtection: damageType => {
                        const typed = combinedProtectionFor(damageType, bodyArmor as any, helmet as any, defenderNatural, defenderShield.prot);
                        const typedPerks = computeDefensivePerkBonuses(defender, damageType, getPerkById);
                        const resolved = resolveDamageProtection({
                          baseDT: typed.dt,
                          baseDR: tightNutsAdjustedDR(typed.dr, damageType, defender, defenderNatural),
                          ammoIgnoresDT: loadedAmmo.ignoresDT, ammoDRModifier: loadedAmmo.drMod,
                          ignoredDT: perkBonuses.ignoreDT,
                          defenderDRModifier: typedPerks.dr + (defenderEffectMods?.drMod ?? 0)
                            + empShieldingResistance(defender, loadedAmmo),
                          damageResistanceCap: defender?.manualDerivedStats ? 100 : 90,
                        });
                        return { damageThreshold: resolved.effectiveDT, damageResistance: resolved.effectiveDR };
                      },
                    });
                    physicalDamage += componentResult.totalHpDamage;
                    radiationExposure += componentResult.totalRadiation;
                    componentResult.components.forEach(component => {
                      componentBreakdown.push(
                        `Hit ${hitIndex + 1} · ${component.component.label}: ${component.rawDamage} ${component.component.type === 'radiation'
                          ? `radiation; ${defenderSheet?.radiationResistance ?? 0}% resistance → ${component.finalRadiation ?? 0} applied`
                          : `${component.component.type} → ${component.finalHp ?? 0} HP`}`,
                      );
                    });
                  }
                  const hitPoisonResults = attackPoisons.map(poison =>
                    resolvePoisonResistance(poison, defenderSheet?.poisonResistance ?? 0, Math.floor(Math.random() * 100) + 1));
                  poisonResults.push(...hitPoisonResults);
                  if (physicalDamage > 0) damagingHits += 1;
                  return physicalDamage + hitPoisonResults.reduce((sum, result) => sum + result.bonusDamage, 0);
                });
                const totalBurstDmg = perHit.reduce((a, b) => a + b, 0);
                const poisonBonusDamage = poisonResults.reduce((sum, result) => sum + result.bonusDamage, 0);
                setStreamlinedDmgResult({ perHit, total: totalBurstDmg, protection, poisonResults, poisonBonusDamage, componentBreakdown, radiationExposure });
                if (defender) {
                  if (totalBurstDmg > 0) applyCombatDamage(
                    attackReceipt.current, defender.id, totalBurstDmg, damagingHits, undefined,
                    selectedVehicleSystem?.id, attacker?.id,
                  );
                    if (radiationExposure > 0 && !defender.vehicle) adjustRadiation(defender.id, radiationExposure);
                  if (!defender.vehicle) applyPoisonExposure(poisonResults);
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primary }}>ROLL & APPLY {streamlinedHits} HIT DAMAGE</Text>
              </TouchableOpacity>
            )}
            {streamlinedDmgResult && (
              <View style={{ borderWidth: 1, borderRadius: colors.radius, padding: 10, borderColor: colors.destructive, gap: 4 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>BURST DAMAGE APPLIED{defender ? ` → ${defender.name.toUpperCase()}` : ''}</Text>
                <ProtectionBreakdownLines protection={streamlinedDmgResult.protection} ammoName={loadedAmmo?.name} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
                  Per hit (after DT {streamlinedDmgResult.protection.effectiveDT}{streamlinedDmgResult.protection.effectiveDR > 0 ? ` / DR ${streamlinedDmgResult.protection.effectiveDR}%` : ''}): [{streamlinedDmgResult.perHit.join(', ')}]
                </Text>
                {streamlinedDmgResult.componentBreakdown.map((line, index) => (
                  <Text key={index} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary }}>{line}</Text>
                ))}
                {streamlinedDmgResult.radiationExposure > 0 && (
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                    Radiation applied: {streamlinedDmgResult.radiationExposure}
                  </Text>
                )}
                {streamlinedDmgResult.poisonResults.map((result, index) => (
                  <Text key={`${result.poison.type}-${index}`} style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: result.applied ? colors.destructive : '#4a8c3f' }}>
                    Poison Type {result.poison.type}: rolled {result.roll} vs {result.resistance}% — {result.applied ? `NOT RESISTED${result.bonusDamage > 0 ? ` · +${result.bonusDamage} damage` : ' · status applied'}` : 'RESISTED'}
                  </Text>
                ))}
                {streamlinedDmgResult.poisonBonusDamage > 0 && (
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>Poison bonus (bypasses DT/DR): +{streamlinedDmgResult.poisonBonusDamage}</Text>
                )}
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.destructive }}>= {streamlinedDmgResult.total} total damage</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Shot Results (Complex/Single) ─── */}
        {attackResolved && canRoll && !usesAreaAttackProfile && (!isBurst || burstMode === 'complex') && (
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

        {/* ─── Critical-table Hit summary ─── */}
        {primaryIsCrit && !aimedCritPart && (
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
        {attackResolved && !usesAreaAttackProfile && shotResults.some(s => s.hit) && weapon && (!isBurst || burstMode === 'complex') && (
          <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>DAMAGE CALCULATION</Text>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                {doubleShotActive ? `Double-shot: ${weapon.damageDieCount * 2}` : weapon.damageDieCount}d{weapon.damageDie}{weapon.damageBonus > 0 ? `+${weapon.damageBonus}` : ''} · {weapon.damageType.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>
                {DAMAGE_TYPE_LABELS[weapon.damageType]} PROTECTION
              </Text>
              <ProtectionBreakdownLines protection={displayProtectionBreakdown} ammoName={loadedAmmo?.name} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                Formula: max(0,(base−DT)×(1−DR%))
              </Text>
              {perkBonuses.damage > 0 && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#4a8c3f' }}>Perk damage bonus: +{perkBonuses.damage}</Text>}
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.5 }}>PHYSICAL DAMAGE DICE (OPTIONAL)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={damageOverride}
                  editable={!damageApplied}
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
                    disabled={damageApplied}
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
                {loadedAmmo?.components?.length
                  ? 'Replaces the weapon’s initial dice. Custom ammunition components remain independently rolled; critical multipliers, traits, flat bonuses, DT, and DR still apply.'
                  : 'Replaces only the initial weapon and ammunition dice. Critical multipliers, flat bonuses, DT, and DR still apply.'}
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
                    <ProtectionBreakdownLines protection={dmg.protection} ammoName={loadedAmmo?.name} />
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>− DT {dmg.combinedDT} → {dmg.afterDT}</Text>
                    {dmg.combinedDR > 0 && <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>× (1 − DR {dmg.combinedDR}%) → {dmg.physicalDmg}</Text>}
                    {dmg.componentBreakdown.map((line, index) => <Text key={index} style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary }}>{line}</Text>)}
                    {dmg.radiationExposure > 0 && <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary }}>Resolved radiation: {dmg.radiationExposure}</Text>}
                    {dmg.poisonResults.map(result => (
                      <Text key={result.poison.type} style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: result.applied ? colors.destructive : '#4a8c3f' }}>
                        Poison Type {result.poison.type}: rolled {result.roll} vs {result.resistance}% — {result.applied ? `NOT RESISTED${result.bonusDamage > 0 ? ` · +${result.bonusDamage} damage` : ' · status applied'}` : 'RESISTED'}
                      </Text>
                    ))}
                    {dmg.poisonBonusDamage > 0 && (
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>Poison bonus bypasses DT/DR: {dmg.physicalDmg} + {dmg.poisonBonusDamage}</Text>
                    )}
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: dmg.finalDmg > 0 ? colors.destructive : colors.mutedForeground }}>= {dmg.finalDmg} damage</Text>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 1 }}>TOTAL DAMAGE</Text>
                  <Text style={{ fontSize: 36, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{totalDamage}</Text>
                </View>
                {totalRadiationExposure > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary }}>RADIATION TO APPLY</Text>
                    <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.primary }}>{totalRadiationExposure}</Text>
                  </View>
                )}

                {/* Knockdown check (melee) */}
                {isMeleeOrUnarmed && defender?.special && totalPhysicalDamage > 0 && (
                  <KnockdownCard
                    damage={totalPhysicalDamage}
                    defenderStr={defenderEffSpecial?.strength ?? defender.special.strength}
                    defenderEnd={defenderEffSpecial?.endurance ?? defender.special.endurance}
                    onProne={() => { setPosition(defender.id, 'prone'); }}
                  />
                )}

                {!damageApplied ? (
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, paddingVertical: 14, gap: 8, backgroundColor: totalDamage === 0 && totalRadiationExposure === 0 && !hasAppliedPoison ? colors.secondary : colors.destructive, opacity: totalDamage === 0 && totalRadiationExposure === 0 && !hasAppliedPoison ? 0.5 : 1 }} onPress={handleApplyDamage} disabled={totalDamage === 0 && totalRadiationExposure === 0 && !hasAppliedPoison}>
                    <Feather name="activity" size={16} color="#fff" />
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: '#fff' }}>APPLY {totalDamage} DMG{totalRadiationExposure > 0 ? ` + ${totalRadiationExposure} RAD` : ''}{hasAppliedPoison ? ' + POISON' : ''} → {defender?.name?.toUpperCase()}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: colors.radius, borderWidth: 1, backgroundColor: '#4a8c3f22', borderColor: '#4a8c3f' }}>
                    <Feather name="check-circle" size={16} color="#4a8c3f" />
                    <Text style={{ color: '#4a8c3f', fontFamily: 'Inter_600SemiBold', marginLeft: 8 }}>{totalDamage > 0 ? 'Damage' : 'Hit'}{totalRadiationExposure > 0 ? ' and radiation' : ''}{hasAppliedPoison ? ' and poison' : ''} applied to {defender?.name}</Text>
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

        {shotDamages !== null && (
          <TouchableOpacity
            testID="combat-back-to-top"
            accessibilityRole="button"
            accessibilityLabel="Back to top"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: colors.radius, backgroundColor: colors.primary }}
            onPress={() => combatScrollRef.current?.scrollTo({ y: 0, animated: true })}
          >
            <Feather name="arrow-up" size={16} color={colors.primaryForeground} />
            <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: colors.primaryForeground }}>BACK TO TOP</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      <Modal visible={showVehicleSystemPicker && !!defender?.vehicle} transparent animationType="slide" onRequestClose={() => setShowVehicleSystemPicker(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' }}>
          <View style={{ maxHeight: '72%', backgroundColor: colors.card, borderTopLeftRadius: 15, borderTopRightRadius: 15, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1.3 }}>TARGET VEHICLE SYSTEM</Text>
              <TouchableOpacity onPress={() => setShowVehicleSystemPicker(false)} accessibilityLabel="Close vehicle system picker"><Feather name="x" size={20} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <FlatList
              data={defender?.vehicle?.systems ?? []}
              keyExtractor={system => system.id}
              contentContainerStyle={{ padding: 12, gap: 7, paddingBottom: insets.bottom + 14 }}
              renderItem={({ item: system }) => (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Target ${system.name}, ${system.currentHp} of ${system.maxHp} HP`}
                  onPress={() => { setSelectedVehicleSystemId(system.id); setShowVehicleSystemPicker(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: system.id === selectedVehicleSystem?.id ? colors.primary : colors.border, backgroundColor: system.id === selectedVehicleSystem?.id ? colors.primary + '18' : colors.secondary }}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 12 }}>{system.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11 }}>{system.currentHp}/{system.maxHp} HP</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      <CharacterPickerModal visible={showAttackerPicker} onClose={() => setShowAttackerPicker(false)} onSelect={id => { setAttackerId(id); setPilotRollResult(null); }} onClear={() => { setAttackerId(null); setPilotRollResult(null); }} clearRole="Attacker" title="SELECT ATTACKER" characters={activeCharacters.filter(c => c.id !== defenderId)} allWeapons={allWeapons} allArmor={allArmor} hardcoreRadiationRules={hardcoreRadiationRules} mutantGhoulRadiationRules={mutantGhoulRadiationRules} ghoulRadiationHealingOption={ghoulRadiationHealingOption} />
      <CharacterPickerModal
        visible={showDefenderPicker}
        onClose={() => setShowDefenderPicker(false)}
        onSelect={id => {
          setDefenderId(id);
          const selected = characters.find(character => character.id === id)?.vehicle;
          setSelectedVehicleSystemId(selected?.systems.find(system => system.kind === 'structure')?.id ?? selected?.systems[0]?.id ?? null);
        }}
        onClear={() => { setDefenderId(null); setSelectedVehicleSystemId(null); }}
        clearRole="Defender"
        title="SELECT DEFENDER"
        characters={activeCharacters.filter(c => c.id !== attackerId)}
        allWeapons={allWeapons}
        allArmor={allArmor}
        hardcoreRadiationRules={hardcoreRadiationRules}
        mutantGhoulRadiationRules={mutantGhoulRadiationRules}
        ghoulRadiationHealingOption={ghoulRadiationHealingOption}
      />
      <CombatSkillModal
        visible={showCombatSkill}
        actor={completionHealAction ? completionHealActor : attacker}
        target={completionHealAction ? completionHealTarget : defender}
        effectiveSkills={completionHealAction ? completionHealSkillValues : combatSkillValues}
        currentRound={currentRound}
        canStart={combatActive}
        completionAction={completionHealAction}
        onClose={() => { setShowCombatSkill(false); setCompletionHealActionId(null); }}
        onResolve={handleCombatSkillResolution}
      />
      <AreaAttackModal
        visible={showAreaAttack}
        combatants={initiativeEntries.flatMap(entry => {
          const c = characters.find(character => character.id === entry.characterId);
          return c && c.currentHp > 0 ? [c] : [];
        }).concat(
          areaAttackPreset && defender && defender.currentHp > 0
            && !initiativeEntries.some(entry => entry.characterId === defender.id)
            ? [defender]
            : [],
        )}
        initialAttack={areaAttackPreset ?? undefined}
        initialDefenderId={areaAttackPreset ? defender?.id : undefined}
        sourceWeaponName={areaAttackPreset ? weapon?.name : undefined}
        onClose={() => { setShowAreaAttack(false); setAreaAttackPreset(null); }}
        onApply={applyAreaAttack}
        receipt={areaAttackReceipt}
      />
      <CharacterPickerModal visible={showAddCombatantPicker} onClose={() => setShowAddCombatantPicker(false)} onSelect={(id) => {
        const c = characters.find(ch => ch.id === id);
        if (!c) return;
        // Snapshot resolved permanent armor AC; temp AC remains its own entry field.
        const sheet = resolveCombatSheet(
          c, allArmor, false, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
        );
        addInitiativeEntry({
          id: `init-${c.id}-${genId()}`,
          characterId: c.id,
          name: c.name,
          initiative: sheet.sequence + Math.floor(Math.random() * 10) + 1,
          sequence: sheet.sequence,
          maxHp: c.maxHp,
          currentHp: c.currentHp,
          maxAP: sheet.maxAP,
          currentAP: sheet.maxAP,
          armorClass: sheet.armorClass,
          tempAC: 0,
          position: c.position,
          isActive: false,
          hasActed: false,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }} title="ADD COMBATANT" characters={activeCharacters.filter(c => !c.vehicle && !initiativeEntries.some(e => e.characterId === c.id))} allWeapons={allWeapons} allArmor={allArmor} hardcoreRadiationRules={hardcoreRadiationRules} mutantGhoulRadiationRules={mutantGhoulRadiationRules} ghoulRadiationHealingOption={ghoulRadiationHealingOption} />
      <LightPickerModal visible={showLightPicker} value={lightPenalty} onChange={setLightPenalty} onClose={() => setShowLightPicker(false)} />
      <Modal
        visible={showGlowingAuraModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGlowingAuraModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.82)' }}>
          <View style={{ maxHeight: '80%', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, padding: 18, gap: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 15 }}>GLOWING ONE — RADIATION AURA</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>
              Apply one hour of the 10 rads/hour aura. Choose affected combatants; each target’s resistance from race, perks, and worn armor reduces the exposure.
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {activeCharacters.filter(character => character.id !== attacker?.id).map(character => {
                const selected = glowingAuraTargetIds.includes(character.id);
                return (
                  <TouchableOpacity
                    key={character.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setGlowingAuraTargetIds(ids => selected
                      ? ids.filter(id => id !== character.id)
                      : [...ids, character.id])}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ color: selected ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{selected ? '☑' : '□'}</Text>
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>{character.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  for (const characterId of glowingAuraTargetIds) {
                    const target = activeCharacters.find(character => character.id === characterId);
                    if (!target) continue;
                    const targetSheet = resolveCombatSheet(
                      target, allArmor, false, hardcoreRadiationRules, mutantGhoulRadiationRules, ghoulRadiationHealingOption,
                    );
                    const resistance = Math.max(0, Math.min(100, targetSheet.radiationResistance ?? 0));
                    adjustRadiation(target.id, Math.max(0, Math.round(10 * (1 - resistance / 100))));
                  }
                  setShowGlowingAuraModal(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 7, backgroundColor: colors.primary }}
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>APPLY EXPOSURE</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowGlowingAuraModal(false)} style={{ alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={divineFavorRoll !== null}
        transparent
        animationType="fade"
        onRequestClose={() => resolveDivineFavorChoice(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.82)' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, padding: 18, gap: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 15 }}>DIVINE FAVOR</Text>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 12 }}>
              {attacker?.name ?? 'This character'} failed the attack roll ({divineFavorRoll?.roll}). Use Divine Favor to reroll it? This does not spend AP or ammunition again.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity accessibilityRole="button" onPress={() => resolveDivineFavorChoice(true)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 7, backgroundColor: colors.primary }}>
                <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>REROLL</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => resolveDivineFavorChoice(false)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11 }}>KEEP ROLL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
        onSelect={(entry) => applyCritFailEntry(entry, true)}
      />
      {/* ─── Chem picker (TAKE CHEMS — AP charged on selection) ─── */}
      <OptionPickerModal
        visible={showChemPicker}
        title="TAKE CHEMS"
        subtitle={`${CHEM_AP_COST} AP — applied to ${attacker?.name ?? 'attacker'} on selection`}
        options={[...CHEMS.map(chem => {
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
        }), ...ALCOHOL_CONSUMABLES.map(alcohol => ({
          key: alcohol.id,
          label: alcohol.name,
          sublabel: alcohol.description,
          section: 'ALCOHOL',
          note: 'Activates Drunk only; no universal duration or stat effects.',
        }))]}
        onSelect={(id) => id === 'alcohol' ? handleTakeAlcohol() : handleTakeChem(id)}
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
          const customFx = computeCustomWeaponModEffects(w.mods, customWeaponMods, w);
          const mag = Math.round(w.magazineSize * (fx.magazineMult ?? 1) * customFx.magazineMult);
          const cur = attacker?.weaponAmmoStates.find(a => a.weaponId === w.id)?.currentAmmo ?? mag;
          return {
            key: w.id,
            label: `${w.name}  [${cur}/${mag}]`,
            sublabel: `${Math.min(fx.reloadApOverride ?? AP_COSTS.RELOAD, customFx.reloadApOverride ?? AP_COSTS.RELOAD)} AP`,
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
function AreaAttackModal({ visible, combatants, onClose, onApply, receipt, initialAttack, initialDefenderId, sourceWeaponName }: {
  visible: boolean;
  combatants: Character[];
  onClose: () => void;
  onApply: (attack: AreaAttack, targetIds: string[]) => string;
  receipt?: { requestId: string; results: AreaResolution[] };
  initialAttack?: AreaAttack;
  initialDefenderId?: string;
  sourceWeaponName?: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<AreaAttackKind>('explosion');
  const [rawDamage, setRawDamage] = useState(10);
  const [targets, setTargets] = useState<string[]>([]);
  const [summary, setSummary] = useState<AreaResolution[] | null>(null);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [profileComponent, setProfileComponent] = useState<'main' | 'fragmentation' | 'concussion'>('main');
  const [profileDamageRolled, setProfileDamageRolled] = useState<number | null>(null);
  const [catalogProfileId, setCatalogProfileId] = useState<string | null>(null);
  const [gasExposure, setGasExposure] = useState<'gasInhaled' | 'gasContact' | null>(null);
  const activeProfile = initialAttack ?? (catalogProfileId ? MINE_TRAP_PROFILES[catalogProfileId] : undefined);
  const profileMode = !!activeProfile;
  const ongoing = kind === 'flamethrower' || kind === 'acid';

  // A profile is intentionally copied into local modal state.  This makes
  // opening a second trigger start clean, while a receipt can only resolve the
  // request that this modal submitted.
  useEffect(() => {
    if (!visible) return;
    setGasExposure(null);
    if (initialAttack) {
      setKind(initialAttack.kind);
      setRawDamage(initialAttack.rawDamage);
      setProfileComponent('main');
      setProfileDamageRolled(null);
      setTargets(initialDefenderId ? [initialDefenderId] : []);
      setCatalogProfileId(null);
    } else {
      setTargets([]);
      setProfileDamageRolled(null);
      setCatalogProfileId(null);
    }
    setSummary(null);
    setApplying(false);
    applyingRef.current = false;
    setPendingRequestId(null);
  }, [visible, initialAttack, initialDefenderId]);

  useEffect(() => {
    if (pendingRequestId && receipt?.requestId === pendingRequestId) {
      setSummary(receipt.results);
      setPendingRequestId(null);
    }
  }, [pendingRequestId, receipt]);

  const close = () => {
    setTargets([]);
    setSummary(null);
    setApplying(false);
    applyingRef.current = false;
    setPendingRequestId(null);
    setCatalogProfileId(null);
    onClose();
  };
  const profileParts = activeProfile ? [
    { key: 'main' as const, label: 'MAIN BLAST', component: activeProfile },
    ...(activeProfile.fragmentation ? [{ key: 'fragmentation' as const, label: 'FRAGMENTATION', component: activeProfile.fragmentation }] : []),
    ...(activeProfile.concussion ? [{ key: 'concussion' as const, label: 'CONCUSSION', component: activeProfile.concussion }] : []),
  ] : [];
  const selectedPart = profileParts.find(part => part.key === profileComponent) ?? profileParts[0];
  const selectedComponent = selectedPart?.component;
  const selectedDiceCount = selectedComponent?.damageDieCount ?? 0;
  const selectedDice = selectedComponent?.damageDie ?? 0;
  const selectedBonus = selectedComponent?.damageBonus ?? 0;
  const selectedNotes = [
    ...(activeProfile?.notes ?? []),
    ...(selectedComponent?.notes ?? []),
  ];
  const attackToApply: AreaAttack = activeProfile && selectedComponent
    ? {
        ...activeProfile,
        kind: activeProfile.requiresGasChoice ? (gasExposure ?? selectedComponent.kind) : selectedComponent.kind,
        requiresGasChoice: activeProfile.requiresGasChoice ? !gasExposure : false,
        rawDamage,
        damageDieCount: selectedDiceCount,
        damageDie: selectedDice,
        damageBonus: selectedBonus,
        damageType: selectedComponent.damageType,
        radius: selectedComponent.radius ?? activeProfile.radius,
        diameter: selectedComponent.diameter ?? activeProfile.diameter,
        notes: selectedNotes,
      }
    : { kind, rawDamage, gmAdjudicatedLanding: kind === 'flamethrower' };
  const rollProfileDamage = () => {
    if (!selectedComponent || selectedDiceCount <= 0 || selectedDice <= 0) return;
    const rolls = Array.from({ length: selectedDiceCount }, () => Math.floor(Math.random() * selectedDice) + 1);
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + selectedBonus;
    setRawDamage(total);
    setProfileDamageRolled(total);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#000c' }}>
        <View style={{ maxHeight: '92%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: Math.max(insets.bottom, 12), borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View>
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1.5 }}>{summary ? 'AREA EFFECT RESULTS' : profileMode ? 'TRIGGER MINE / TRAP' : 'AOE ATTACK'}</Text>
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{summary ? 'Applied once. Closing this summary will not apply it again.' : profileMode ? `${sourceWeaponName ?? (catalogProfileId ? catalogProfileLabel(catalogProfileId) : 'Device')} — choose a printed component and resolve its affected targets.` : 'Select an effect and every active combatant in its area.'}</Text>
            </View>
            <TouchableOpacity testID="aoe-close" onPress={close}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          {summary ? (
            <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }}>
              {summary.map(result => (
                <View key={result.targetId} style={{ padding: 12, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{result.targetName}</Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 3 }}>{formatAreaResolution(result)}</Text>
                </View>
              ))}
              <TouchableOpacity testID="aoe-summary-done" onPress={close} style={{ paddingVertical: 12, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.primary }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>DONE</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
              {!initialAttack && (
                <>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>MINE / TRAP PROFILE (OPTIONAL)</Text>
                  <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Choose a catalog profile to use its printed components, dice, reach, and GM notes instead of a generic AoE approximation.</Text>
                  <View style={{ gap: 7 }}>
                    {Object.entries(MINE_TRAP_PROFILES).map(([profileId, profile]) => {
                      const selected = catalogProfileId === profileId;
                      return (
                        <TouchableOpacity
                          key={profileId}
                          testID={`aoe-mine-profile-${profileId}`}
                          onPress={() => { setCatalogProfileId(profileId); setProfileComponent('main'); setRawDamage(profile.rawDamage); setProfileDamageRolled(null); }}
                          style={{ padding: 9, borderRadius: colors.radius, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '22' : colors.secondary }}
                        >
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: selected ? colors.primary : colors.foreground }}>{catalogProfileLabel(profileId)}</Text>
                          <Text style={{ fontSize: 9, color: colors.mutedForeground }}>{profile.kind} · {profile.notes?.[0] ?? 'Catalog area profile'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>{profileMode ? 'PROFILE COMPONENT' : 'EFFECT'}</Text>
              {profileMode ? (
                <View style={{ gap: 7 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {profileParts.map(part => {
                      const selected = profileComponent === part.key;
                      const component = part.component;
                      const dice = (component.damageDieCount ?? 0) > 0 ? `${component.damageDieCount}d${component.damageDie}` : 'no printed dice';
                      const reach = component.radius !== undefined ? `radius ${component.radius}` : component.diameter !== undefined ? `diameter ${component.diameter}` : 'device target';
                      return (
                        <TouchableOpacity key={part.key} testID={`aoe-profile-${part.key}`} onPress={() => { setProfileComponent(part.key); setRawDamage('rawDamage' in component ? component.rawDamage : 0); setProfileDamageRolled(null); }} style={{ minWidth: '47%', flexGrow: 1, padding: 9, borderRadius: colors.radius, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '22' : colors.secondary }}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: selected ? colors.primary : colors.foreground }}>{part.label}</Text>
                          <Text style={{ fontSize: 9, color: colors.mutedForeground }}>{dice} · {reach}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {selectedNotes.map((note, index) => <Text key={index} style={{ fontSize: 10, color: colors.mutedForeground }}>• {note}</Text>)}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {AREA_ATTACK_OPTIONS.map(option => (
                    <TouchableOpacity key={option.kind} testID={`aoe-kind-${option.kind}`} onPress={() => setKind(option.kind)} style={{ width: '48%', padding: 9, borderRadius: colors.radius, borderWidth: 1, borderColor: kind === option.kind ? colors.primary : colors.border, backgroundColor: kind === option.kind ? colors.primary + '22' : colors.secondary }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: kind === option.kind ? colors.primary : colors.foreground }}>{option.label}</Text>
                      <Text style={{ fontSize: 9, color: colors.mutedForeground }}>{option.note}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{profileMode ? 'Manual damage roll' : 'Rolled / base damage'}</Text>
                {profileMode ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      testID="aoe-raw-damage"
                      value={String(rawDamage)}
                      onChangeText={value => { const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10); setRawDamage(Number.isFinite(parsed) ? parsed : 0); setProfileDamageRolled(null); }}
                      keyboardType="numeric"
                      style={{ minWidth: 58, paddingVertical: 5, paddingHorizontal: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 5, color: colors.foreground, textAlign: 'center', fontFamily: 'Inter_700Bold' }}
                    />
                    {selectedDiceCount > 0 && selectedDice > 0 && (
                      <TouchableOpacity testID="aoe-roll-profile-damage" onPress={rollProfileDamage} style={{ paddingVertical: 7, paddingHorizontal: 8, borderRadius: 5, backgroundColor: colors.primary }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primaryForeground }}>ROLL {selectedDiceCount}d{selectedDice}{selectedBonus ? `+${selectedBonus}` : ''}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : <Stepper value={rawDamage} min={0} max={999} onChange={setRawDamage} formatValue={v => String(v)} />}
              </View>
              {activeProfile?.requiresGasChoice && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.foreground }}>GM: determine the canister payload and damage, then select its exposure. Other effects remain GM-adjudicated.</Text>
                  {(['gasInhaled', 'gasContact'] as const).map(exposure => (
                    <TouchableOpacity key={exposure} onPress={() => setGasExposure(exposure)} style={{ padding: 10, borderWidth: 1, borderColor: gasExposure === exposure ? colors.primary : colors.border }}>
                      <Text style={{ color: colors.foreground }}>{exposure === 'gasInhaled' ? 'Inhaled gas' : 'Contact gas'}{gasExposure === exposure ? ' — selected' : ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {profileMode && profileDamageRolled !== null && <Text style={{ fontSize: 10, color: colors.primary }}>Rolled profile damage: {profileDamageRolled}. You may replace it with the table roll.</Text>}
              {ongoing && (
                <Text style={{ fontSize: 10, color: colors.primary }}>
                  Mandatory 1d6 each round until removed. Fire requires a full turn rolling on safe ground; acid requires GM-confirmed washing with an appropriate material.
                </Text>
              )}
              {kind === 'flamethrower' && <Text style={{ fontSize: 10, color: colors.primary }}>On a miss, the GM chooses the landing hex from the miss margin; select only combatants in the line from attacker to that hex.</Text>}
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>TARGETS</Text>
              {combatants.map(c => {
                const selected = targets.includes(c.id);
                return (
                  <TouchableOpacity key={c.id} testID={`aoe-target-${c.id}`} onPress={() => setTargets(prev => selected ? prev.filter(id => id !== c.id) : [...prev, c.id])} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '18' : colors.secondary }}>
                    <Feather name={selected ? 'check-square' : 'square'} size={17} color={selected ? colors.primary : colors.mutedForeground} />
                    <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{c.name}</Text>
                    <Text style={{ fontSize: 10, color: colors.mutedForeground }}>HP {c.currentHp}/{c.maxHp}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity testID="aoe-apply" disabled={targets.length === 0 || applying} onPress={() => {
                if (applyingRef.current) return;
                if (attackToApply.requiresGasChoice) {
                  notify('GM Gas Choice Required', 'Select the canister exposure and enter its GM-determined damage first.');
                  return;
                }
                applyingRef.current = true;
                setApplying(true);
                const requestId = onApply({
                  ...attackToApply,
                }, targets);
                setPendingRequestId(requestId);
              }} style={{ paddingVertical: 13, alignItems: 'center', borderRadius: colors.radius, backgroundColor: targets.length && !applying ? colors.destructive : colors.secondary, opacity: targets.length && !applying ? 1 : 0.5 }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: targets.length && !applying ? '#fff' : colors.mutedForeground }}>{applying ? 'APPLYING…' : `APPLY TO ${targets.length} TARGET${targets.length === 1 ? '' : 'S'}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={close} style={{ paddingVertical: 11, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>CANCEL — APPLY NOTHING</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface CombatSkillRequest {
  action: 'general' | 'healFallen' | 'completeHealFallen';
  actionId?: string;
  label?: string;
  skill?: CombatSkillKey;
  method?: CombatSkillResolutionMethod;
  roll?: number;
  ap: number;
  rounds: number;
  spendAllRemaining?: boolean;
}

type CombatSkillOutcome = 'success' | 'failure';

/**
 * The combat-skill state reducer owns the effect of a submitted request.  This
 * sheet deliberately owns only the GM-facing selection, timing, and roll UI so
 * all AP/AC/round effects remain atomic in shared combat state.
 */
function CombatSkillModal({ visible, actor, target, effectiveSkills, currentRound, canStart, completionAction, onClose, onResolve }: {
  visible: boolean;
  actor: Character | null;
  target: Character | null;
  effectiveSkills: Partial<Record<SkillType, number>>;
  currentRound: number;
  canStart: boolean;
  completionAction?: TimedCombatSkillAction | null;
  onClose: () => void;
  onResolve: (request: CombatSkillRequest) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedSkill, setSelectedSkill] = useState<CombatSkillKey>('firstAid');
  const [ap, setAp] = useState(3);
  const [rounds, setRounds] = useState(1);
  const [generalLabel, setGeneralLabel] = useState('GM skill action');
  const [outcome, setOutcome] = useState<CombatSkillOutcome | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const [confirmAllRemaining, setConfirmAllRemaining] = useState(false);

  const isCompletion = !!completionAction;
  const isRobot = target?.race === 'robot';
  const isUnconscious = !!target?.isKnockedOut;
  const backendSkillOptions = target ? getHealFallenSkillOptions(target) : [];
  const skillOptions: { key: CombatSkillKey; label: string; targetLabel: string; reminder?: string; valid: boolean }[] = HEAL_FALLEN_SKILLS.map(key => {
    const option = backendSkillOptions.find(candidate => candidate.skill === key);
    return {
      key,
      label: key === 'firstAid' ? 'FIRST AID' : key.toUpperCase(),
      targetLabel: key === 'firstAid' || key === 'doctor' ? 'Living targets' : 'Robot targets',
      reminder: option?.reminder ? `Reminder only: ${option.reminder}` : undefined,
      valid: option?.allowed ?? false,
    };
  });
  const selected = skillOptions.find(option => option.key === selectedSkill) ?? skillOptions[0];
  const effectiveValue = Math.max(0, effectiveSkills[selectedSkill] ?? 0);
  const requestedAP = Math.max(1, ap);
  const underfunded = !!actor && requestedAP > actor.currentAP;
  const completionRound = currentRound + Math.max(rounds - 1, underfunded ? 1 : 0);
  const healFallenAPCost = actor ? getHealFallenAPCost(actor) : HEAL_FALLEN_AP_COST;
  const healFallenUnderfunded = !!actor && actor.currentAP < healFallenAPCost;
  const delayedHealStart = !isCompletion && isUnconscious && healFallenUnderfunded;
  const canResolveOutcome = isCompletion || canStart;
  useEffect(() => {
    if (visible && completionAction?.skill) {
      setSelectedSkill(completionAction.skill);
      setOutcome(null);
      setRoll(null);
    }
  }, [visible, completionAction?.id, completionAction?.skill]);
  const resolveSkill = (nextOutcome: CombatSkillOutcome, method: CombatSkillResolutionMethod, nextRoll?: number) => {
    if (!selected.valid || delayedHealStart || outcome || !canResolveOutcome || (isCompletion && completionAction?.skill !== selectedSkill)) return;
    setOutcome(nextOutcome);
    setRoll(nextRoll ?? null);
    if (!actor || !target) return;
    onResolve({
      action: isCompletion ? 'completeHealFallen' : 'healFallen',
      actionId: completionAction?.id,
      skill: selectedSkill,
      method,
      roll: nextRoll,
      ap: isCompletion ? 0 : healFallenAPCost,
      rounds: 1,
    });
  };
  const rollSkill = () => {
    const result = Math.floor(Math.random() * 100) + 1;
    resolveSkill(result <= effectiveValue ? 'success' : 'failure', 'roll', result);
  };
  const submitGeneralSkill = () => {
    if (!actor || !generalLabel.trim()) return;
    const request: CombatSkillRequest = {
      action: 'general',
      label: generalLabel,
      ap: requestedAP,
      rounds: Math.max(1, rounds),
    };
    if (!underfunded) {
      onResolve(request);
      return;
    }
    const message = `${generalLabel} needs ${requestedAP} AP, but ${actor.name} has ${actor.currentAP}. Spend all remaining AP? Only equipped-armor AC applies until their next turn.`;
    const confirm = () => onResolve({ ...request, spendAllRemaining: true });
    if (Platform.OS === 'web') {
      if (localizedConfirm(message)) confirm();
    } else {
      Alert.alert('Underfunded GM Skill', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: `Spend all ${actor.currentAP} AP`, style: 'destructive', onPress: confirm },
      ]);
    }
  };
  const submitHealFallen = () => {
    if (!actor || !target || !selected.valid || !delayedHealStart || !canStart) return;
    onResolve({
      action: 'healFallen',
      skill: selectedSkill,
      ap: actor.currentAP,
      rounds: 1,
      spendAllRemaining: true,
    });
  };
  const resetForSelection = (key: CombatSkillKey) => {
    setSelectedSkill(key);
    setOutcome(null);
    setRoll(null);
    setConfirmAllRemaining(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background + 'ee', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '88%', paddingBottom: Math.max(insets.bottom, 12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1.7 }}>{isCompletion ? 'RESOLVE HEAL FALLEN' : 'COMBAT SKILL'}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
                {actor?.name ?? 'Select an actor'} → {target?.name ?? 'select a target'}
              </Text>
            </View>
            <TouchableOpacity testID="close-combat-skill" onPress={onClose} style={{ padding: 6 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }} showsVerticalScrollIndicator={false}>
            {!target ? (
              <View style={{ padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.secondary }}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>Select a defender to choose a Heal Fallen target. GM-timed skills can still be started below.</Text>
              </View>
            ) : (
              <>
                <View style={{ padding: 10, gap: 3, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>TARGET TYPE</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
                    {target.name} · {isRobot ? 'ROBOT' : 'LIVING'}
                    {isUnconscious ? ' · UNCONSCIOUS' : ''}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    Muted choices cannot affect this target type.
                  </Text>
                </View>

                <View style={{ gap: 7 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CHOOSE A SKILL</Text>
                  {isCompletion && <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>The pending action is bound to {completionAction?.skill === 'firstAid' ? 'First Aid' : completionAction?.skill?.toUpperCase()}; its skill cannot be changed.</Text>}
                  {skillOptions.map(option => {
                    const chosen = option.key === selectedSkill;
                    const selectable = option.valid && (!isCompletion || option.key === completionAction?.skill);
                    return (
                      <TouchableOpacity
                        key={option.key}
                        testID={`combat-skill-${option.key}`}
                        disabled={!selectable}
                        onPress={() => resetForSelection(option.key)}
                        style={{
                          padding: 11, borderRadius: colors.radius, borderWidth: 1,
                          borderColor: chosen && selectable ? colors.primary : colors.border,
                          backgroundColor: chosen && selectable ? colors.primary + '18' : colors.secondary,
                          opacity: selectable ? 1 : 0.38,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: chosen && selectable ? colors.primary : colors.foreground }}>{option.label}</Text>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: chosen && selectable ? colors.primary : colors.mutedForeground }}>{Math.max(0, effectiveSkills[option.key] ?? 0)}%</Text>
                        </View>
                        <Text style={{ marginTop: 2, fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{option.targetLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isUnconscious && (
                  <View style={{ gap: 7, padding: 11, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.destructive + '12' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>HEAL FALLEN</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>On success: restore exactly 1 HP and remove unconsciousness. An underfunded action revives them at the healer’s next own turn (round {currentRound + 1}).</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{healFallenAPCost} AP</Text>
                    </View>
                    {delayedHealStart && <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>
                      Armor-only AC applies through the delayed action — Agility and unused-AP AC do not apply.
                    </Text>}
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
                      GM prerequisite: {actor?.name ?? 'the healer'} must be in an adjacent hex to {target.name} before resolving Heal Fallen.
                    </Text>
                    {delayedHealStart && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>
                        Only {actor.currentAP} AP remain. Confirm below to spend all remaining AP instead.
                      </Text>
                    )}
                    {!isCompletion && !canStart && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>
                        Start tracked combat first. Heal Fallen AP and timing are only recorded in an active combat round.
                      </Text>
                    )}
                  </View>
                )}

                {isUnconscious && !delayedHealStart && (
                <View style={{ padding: 11, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>EFFECTIVE VALUE</Text>
                    <Text testID="combat-skill-effective-value" style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: selected.valid ? colors.primary : colors.mutedForeground }}>{effectiveValue}%</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    Includes tags, active effects, equipped armor, and active injury modifiers.
                  </Text>
                  {!!selected.reminder && <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>{selected.reminder}</Text>}
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    <TouchableOpacity testID="combat-skill-roll-d100" disabled={!selected.valid || !!outcome || !canResolveOutcome} onPress={rollSkill} style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, backgroundColor: selected.valid && !outcome && canResolveOutcome ? colors.primary : colors.border, opacity: selected.valid && !outcome && canResolveOutcome ? 1 : 0.5 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: selected.valid && !outcome && canResolveOutcome ? colors.primaryForeground : colors.mutedForeground }}>{isCompletion ? 'ROLL d100 · RESOLVE' : `ROLL d100 · ${healFallenAPCost} AP`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="combat-skill-auto-success" disabled={!selected.valid || !!outcome || !canResolveOutcome} onPress={() => resolveSkill('success', 'automaticSuccess')} style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary, opacity: selected.valid && !outcome && canResolveOutcome ? 1 : 0.4 }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>AUTOMATIC SUCCESS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="combat-skill-auto-failure" disabled={!selected.valid || !!outcome || !canResolveOutcome} onPress={() => resolveSkill('failure', 'automaticFailure')} style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive, opacity: selected.valid && !outcome && canResolveOutcome ? 1 : 0.4 }}>
                      <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.destructive }}>AUTOMATIC FAILURE</Text>
                    </TouchableOpacity>
                  </View>
                  {outcome && (
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: outcome === 'success' ? colors.primary : colors.destructive }}>
                      {roll ? `Rolled ${roll}: ` : 'GM ruling: '}{outcome === 'success' ? 'SUCCESS' : 'FAILURE'}
                    </Text>
                  )}
                </View>
                )}

                {delayedHealStart && (
                  <>
                    {!confirmAllRemaining ? (
                      <TouchableOpacity
                        testID="resolve-heal-fallen"
                        disabled={!selected.valid || !actor || actor.currentAP < 1 || !canStart}
                        onPress={() => setConfirmAllRemaining(true)}
                        style={{ paddingVertical: 12, alignItems: 'center', borderRadius: colors.radius, backgroundColor: selected.valid && actor && actor.currentAP > 0 && canStart ? colors.destructive : colors.border, opacity: selected.valid && actor && actor.currentAP > 0 && canStart ? 1 : 0.5 }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: selected.valid && actor && actor.currentAP > 0 && canStart ? colors.destructiveForeground : colors.mutedForeground }}>
                          REVIEW ALL {actor?.currentAP ?? 0} AP — START HEAL FALLEN
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ padding: 11, gap: 8, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.destructive, backgroundColor: colors.secondary }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructive }}>Spend all {actor?.currentAP ?? 0} remaining AP?</Text>
                        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>This action spends all remaining AP, leaves only equipped-armor AC, and applies a successful revival at the healer’s next own turn.</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => setConfirmAllRemaining(false)} style={{ flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>CANCEL</Text>
                          </TouchableOpacity>
                          <TouchableOpacity testID="confirm-heal-fallen-all-ap" onPress={submitHealFallen} style={{ flex: 2, paddingVertical: 9, alignItems: 'center', borderRadius: colors.radius, backgroundColor: colors.destructive }}>
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.destructiveForeground }}>SPEND ALL & START</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
            {!isCompletion && <>
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>GM TIMING</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Set the AP spent now and the action’s duration. Long or underfunded actions use armor-only AC until the actor’s next turn.</Text>
              {!canStart && !isCompletion && <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.destructive }}>Start tracked combat first to record AP spending and round duration.</Text>}
              <TextInput
                value={generalLabel}
                onChangeText={setGeneralLabel}
                placeholder="GM action label"
                placeholderTextColor={colors.mutedForeground}
                style={{ paddingHorizontal: 10, paddingVertical: 9, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 12, backgroundColor: colors.background }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { label: 'AP NOW', value: requestedAP, decrement: () => setAp(value => Math.max(1, value - 1)), increment: () => setAp(value => Math.min(30, value + 1)) },
                  { label: 'ROUNDS', value: rounds, decrement: () => setRounds(value => Math.max(1, value - 1)), increment: () => setRounds(value => Math.min(20, value + 1)) },
                ].map(control => (
                  <View key={control.label} style={{ flex: 1, padding: 9, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textAlign: 'center', letterSpacing: 1 }}>{control.label}</Text>
                    <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <TouchableOpacity onPress={control.decrement} style={{ padding: 4 }}><Feather name="minus" size={15} color={colors.foreground} /></TouchableOpacity>
                      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary }}>{control.value}</Text>
                      <TouchableOpacity onPress={control.increment} style={{ padding: 4 }}><Feather name="plus" size={15} color={colors.foreground} /></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
              {underfunded && <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive }}>Underfunded: {actor?.currentAP ?? 0}/{requestedAP} AP. Confirm spending all remaining AP; armor-only AC warning applies.</Text>}
              <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>
                {completionRound > currentRound
                  ? `Action completes at ${actor?.name ?? 'the actor'}’s turn in round ${completionRound}; defense restores then.`
                  : 'This action resolves immediately in the current round; no armor-only defense penalty applies.'}
              </Text>
            </View>

            <TouchableOpacity
              testID="resolve-combat-skill"
              disabled={!generalLabel.trim() || !actor || actor.currentAP < 1 || !canStart}
              onPress={submitGeneralSkill}
              style={{ paddingVertical: 12, alignItems: 'center', borderRadius: colors.radius, backgroundColor: generalLabel.trim() && actor && actor.currentAP > 0 && canStart ? colors.primary : colors.border, opacity: generalLabel.trim() && actor && actor.currentAP > 0 && canStart ? 1 : 0.5 }}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: generalLabel.trim() && actor && actor.currentAP > 0 && canStart ? colors.primaryForeground : colors.mutedForeground }}>
                START GM SKILL · {requestedAP} AP / {rounds} ROUND{rounds === 1 ? '' : 'S'}
              </Text>
            </TouchableOpacity>
            </>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
