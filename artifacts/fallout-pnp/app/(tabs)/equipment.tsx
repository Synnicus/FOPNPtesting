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
import { BUILT_IN_WEAPONS, MINE_TRAP_PROFILES, WEAPON_CATEGORIES, WEAPON_CATEGORY_LABELS, WEAPON_CATEGORY_ORDER, DAMAGE_TYPES, formatWeaponDamage, formatWeaponAP, getWeaponHands, weaponCategorySupportsAmmo } from '@/data/weapons';
import { WEAPON_MOD_DEFS, computeModEffects, WeaponModDef, ModAppliesTo } from '@/data/mods';
import { AMMO_TYPES } from '@/data/ammo';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { AP_COSTS } from '@/data/apCosts';
import { CONDITION_BOXES_MAX, clampConditionBoxes, conditionLabel, conditionToHitPenalty, isWeaponJammed } from '@/data/condition';
import { Weapon, WeaponCategory, Armor, DamageType, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_NAMES, SPECIALStats, CharacterSkills } from '@/context/types';

const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const SKILL_LABELS: Record<string, string> = {
  smallGuns: 'Small Guns', bigGuns: 'Big Guns', energyWeapons: 'Energy Weapons',
  meleeWeapons: 'Melee Weapons', unarmed: 'Unarmed', throwing: 'Throwing', natural: 'Natural', minesTraps: 'Mines & Traps',
};

const ARMOR_SPECIAL_FIELDS: { key: keyof SPECIALStats; label: string }[] = [
  { key: 'strength', label: 'Strength' }, { key: 'perception', label: 'Perception' },
  { key: 'endurance', label: 'Endurance' }, { key: 'charisma', label: 'Charisma' },
  { key: 'intelligence', label: 'Intelligence' }, { key: 'agility', label: 'Agility' },
  { key: 'luck', label: 'Luck' },
];
const ARMOR_SKILL_FIELDS: { key: keyof CharacterSkills; label: string }[] = [
  { key: 'smallGuns', label: 'Small Guns' }, { key: 'bigGuns', label: 'Big Guns' },
  { key: 'energyWeapons', label: 'Energy Weapons' }, { key: 'meleeWeapons', label: 'Melee Weapons' },
  { key: 'unarmed', label: 'Unarmed' }, { key: 'throwing', label: 'Throwing' },
  { key: 'firstAid', label: 'First Aid' }, { key: 'doctor', label: 'Doctor' },
  { key: 'sneak', label: 'Sneak' }, { key: 'lockpick', label: 'Lockpick' },
  { key: 'steal', label: 'Steal' }, { key: 'traps', label: 'Traps' },
  { key: 'science', label: 'Science' }, { key: 'repair', label: 'Repair' },
  { key: 'speech', label: 'Speech' }, { key: 'barter', label: 'Barter' },
  { key: 'gambling', label: 'Gambling' }, { key: 'outdoorsman', label: 'Outdoorsman' },
  { key: 'pilot', label: 'Pilot' },
];
const EMPTY_ARMOR_SPECIAL: Record<keyof SPECIALStats, number> = {
  strength: 0, perception: 0, endurance: 0, charisma: 0, intelligence: 0, agility: 0, luck: 0,
};
const EMPTY_ARMOR_SKILLS: Record<keyof CharacterSkills, number> = {
  smallGuns: 0, bigGuns: 0, energyWeapons: 0, meleeWeapons: 0, unarmed: 0, throwing: 0,
  firstAid: 0, doctor: 0, sneak: 0, lockpick: 0, steal: 0, traps: 0, science: 0, repair: 0,
  speech: 0, barter: 0, gambling: 0, outdoorsman: 0, pilot: 0,
};

// Categories that behave like a "gun" (use ammo types + gun-style mods).
const GUN_CATEGORIES: string[] = ['smallGuns', 'bigGuns', 'energyWeapons'];
const isGunCategory = (cat: string) => GUN_CATEGORIES.includes(cat);
const isMeleeCategory = (cat: string) => cat === 'meleeWeapons' || cat === 'unarmed' || cat === 'natural';

/**
 * Whether a weapon mod (by its appliesTo tag) can be applied to a weapon of
 * the given category. Gun-specific tags (revolver/rifle/pistolSmg/heavy) are
 * offered on any gun category since the app doesn't model sub-types; the mod's
 * own description explains the manual restriction. 'any' always applies.
 */
function modAppliesToCategory(appliesTo: ModAppliesTo, category: string): boolean {
  if (appliesTo === 'any') return true;
  const gun = isGunCategory(category);
  const melee = isMeleeCategory(category);
  switch (appliesTo) {
    case 'melee':
    case 'blade':
    case 'piercing':
      return melee;
    case 'ranged':
    case 'gun':
    case 'revolver':
    case 'pistolSmg':
    case 'rifle':
    case 'heavy':
      return gun;
    default:
      return false;
  }
}

/** Short structured-behaviour chip text for a mod definition. */
function modBehaviorSummary(mod: WeaponModDef): string {
  const parts: string[] = [];
  if (mod.toHitBonus) parts.push(`${mod.toHitBonus > 0 ? '+' : ''}${mod.toHitBonus}% hit`);
  if (mod.damageBonus) parts.push(`${mod.damageBonus > 0 ? '+' : ''}${mod.damageBonus} dmg`);
  if (mod.rangeBonus) parts.push(`+${mod.rangeBonus}m range`);
  if (mod.magazineMult && mod.magazineMult !== 1) parts.push(`×${mod.magazineMult} mag`);
  if (mod.negatesAimedPenalty) parts.push('no aim penalty');
  if (mod.ignoresLightPenalty) parts.push('ignores light');
  if (mod.forcesAimed) parts.push('always targeted');
  if (mod.silencer) parts.push('silent');
  if (mod.sling) parts.push('sling');
  if (mod.reloadApOverride !== undefined) parts.push(`reload ${mod.reloadApOverride} AP`);
  if (mod.poison) parts.push(`poison ${mod.poison.type}`);
  if (mod.festering) parts.push('festering');
  if (mod.barbed) parts.push('barbed');
  return parts.join(' · ');
}

// ─── Weapon Form Modal ────────────────────────────────────────────────────────
function WeaponFormModal({ visible, onClose, onSave, editWeapon }: {
  visible: boolean; onClose: () => void; onSave: (w: Weapon) => void;
  editWeapon?: Weapon | null;
}) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WeaponCategory>('smallGuns');
  const [damageType, setDamageType] = useState<DamageType>('normal');
  const [dieCount, setDieCount] = useState(1);
  const [dieSides, setDieSides] = useState(6);
  const [damageBonus, setDamageBonus] = useState(0);
  const [burstLimit, setBurstLimit] = useState(1);
  const [isDoubleShot, setIsDoubleShot] = useState(false);
  const [magazineSize, setMagazineSize] = useState(0);
  const [minStr, setMinStr] = useState(3);
  const [rangeNormal, setRangeNormal] = useState(15);
  const [apSingle, setApSingle] = useState<number>(AP_COSTS.ATTACK_SINGLE);
  const [apTargeted, setApTargeted] = useState<number>(AP_COSTS.ATTACK_AIMED);
  const [canTarget, setCanTarget] = useState(true);
  const [apBurst, setApBurst] = useState<number>(AP_COSTS.ATTACK_BURST);
  const [canBurst, setCanBurst] = useState(false);
  const [hands, setHands] = useState<1 | 2>(1);
  const [compatibleAmmo, setCompatibleAmmo] = useState<string[]>([]);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [tab, setTab] = useState<'basic' | 'advanced' | 'mods'>('basic');
  const [showPresets, setShowPresets] = useState(false);
  const [areaAttackProfileId, setAreaAttackProfileId] = useState<string | undefined>();

  const isEditing = !!editWeapon;

  const applyWeaponFields = (w: Weapon, nameOverride?: string) => {
    setName(nameOverride ?? w.name);
    setCategory(w.category);
    setAreaAttackProfileId(w.areaAttackProfileId);
    setDamageType(w.damageType);
    setDieCount(w.damageDieCount);
    setDieSides(w.damageDie);
    setDamageBonus(w.damageBonus);
    setBurstLimit(w.burstLimit);
    setIsDoubleShot(w.isDoubleShot);
    setMagazineSize(w.magazineSize);
    setMinStr(w.minStr);
    setRangeNormal(w.rangeNormal);
    setApSingle(w.apSingle ?? AP_COSTS.ATTACK_SINGLE);
    setCanTarget(w.apTargeted !== null);
    setApTargeted(w.apTargeted ?? AP_COSTS.ATTACK_AIMED);
    setCanBurst(w.apBurst != null);
    setApBurst(w.apBurst ?? AP_COSTS.ATTACK_BURST);
    setHands(getWeaponHands(w));
    setCompatibleAmmo([...(w.compatibleAmmo ?? [])]);
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
      setApSingle(AP_COSTS.ATTACK_SINGLE); setCanTarget(true); setApTargeted(AP_COSTS.ATTACK_AIMED);
      setCanBurst(false); setApBurst(AP_COSTS.ATTACK_BURST);
      setHands(1); setCompatibleAmmo([]);
      setSelectedMods([]);
      setAreaAttackProfileId(undefined);
    }
  }, [visible, editWeapon]);

  const isValid = name.trim().length > 0 && ((dieCount > 0 && dieSides > 0) || !!areaAttackProfileId);

  const modEffects = computeModEffects(selectedMods);
  const ammoCompatibleCategory = weaponCategorySupportsAmmo(category);

  // Mods offered for the current category, plus any already-selected mods
  // (so editing an existing weapon never silently drops a mod).
  const availableMods = WEAPON_MOD_DEFS.filter(
    m => modAppliesToCategory(m.appliesTo, category) || selectedMods.includes(m.id)
  );

  const toggleMod = (id: string) => {
    setSelectedMods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const toggleAmmo = (id: string) => {
    setCompatibleAmmo(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
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
      category,
      areaAttackProfileId: category === 'minesTraps' ? areaAttackProfileId : undefined,
      damageType, damageDieCount: dieCount, damageDie: dieSides,
      damageBonus, skill: (category === 'minesTraps' ? 'traps' : category === 'meleeWeapons' ? 'meleeWeapons' : category === 'unarmed' || category === 'natural' ? 'unarmed' : category === 'throwing' ? 'throwing' : category) as Weapon['skill'],
      burstLimit, isDoubleShot, magazineSize,
      weight: 0, minStr, rangeNormal, knockdownChance: 0,
      apSingle, apTargeted: canTarget ? apTargeted : null, apBurst: canBurst ? apBurst : null,
      hands,
      compatibleAmmo: ammoCompatibleCategory && compatibleAmmo.length > 0 ? compatibleAmmo : undefined,
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
                {category === 'minesTraps' && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Shared trigger profile overrides the damage fields below. Choose custom damage to use your own dice.</Text>
                    {[undefined, ...Object.keys(MINE_TRAP_PROFILES)].map(id => (
                      <TouchableOpacity key={id ?? 'custom'} onPress={() => setAreaAttackProfileId(id)} style={{ padding: 8, borderWidth: 1, borderColor: areaAttackProfileId === id ? colors.primary : colors.border }}>
                        <Text style={{ color: colors.foreground }}>{id ? (BUILT_IN_WEAPONS.find(w => w.areaAttackProfileId === id)?.name ?? id) : 'Custom damage — no shared profile'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
                <NumStepper label="Magazine size (0 = unlimited / no ammo)" val={magazineSize} min={0} max={999} set={setMagazineSize} />
                <NumStepper label="Burst limit (1 = single shot)" val={burstLimit} min={1} max={20} set={setBurstLimit} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>Double-shot weapon</Text>
                  <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, backgroundColor: isDoubleShot ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setIsDoubleShot(v => !v)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: isDoubleShot ? colors.primaryForeground : colors.mutedForeground }}>{isDoubleShot ? 'YES' : 'NO'}</Text>
                  </TouchableOpacity>
                </View>
                <NumStepper label="Min STR required" val={minStr} min={1} max={10} set={setMinStr} />
                <NumStepper label="Range (squares)" val={rangeNormal} min={1} max={200} set={setRangeNormal} />

                {/* Hands */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 6 }}>HANDS REQUIRED</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([1, 2] as const).map(h => (
                    <TouchableOpacity key={h} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: hands === h ? colors.primary : colors.secondary, borderWidth: 1, borderColor: hands === h ? colors.primary : colors.border }} onPress={() => setHands(h)}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: hands === h ? colors.primaryForeground : colors.mutedForeground }}>{h === 1 ? 'ONE-HANDED (1H)' : 'TWO-HANDED (2H)'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Compatible ammo for guns and powered melee/unarmed weapons */}
                {ammoCompatibleCategory && (
                  <>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 6 }}>
                      COMPATIBLE AMMO {compatibleAmmo.length > 0 ? `(${compatibleAmmo.length})` : ''}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      Select the ammo types this weapon can load. Leave empty for a weapon that uses no ammo types.
                    </Text>
                    <View style={{ maxHeight: 240, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                      <ScrollView nestedScrollEnabled>
                        {AMMO_TYPES.map(ammo => {
                          const active = compatibleAmmo.includes(ammo.id);
                          return (
                            <TouchableOpacity key={ammo.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10, backgroundColor: active ? colors.primary + '22' : 'transparent' }} onPress={() => toggleAmmo(ammo.id)}>
                              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: active ? colors.primary : colors.mutedForeground, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : 'transparent' }}>
                                {active && <Feather name="check" size={11} color={colors.primaryForeground} />}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: active ? colors.primary : colors.foreground }}>{ammo.name}</Text>
                                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                                  {ammo.dmgDieCount > 0 ? `+${ammo.dmgDieCount}d${ammo.dmgDie}${ammo.dmgBonus !== 0 ? (ammo.dmgBonus > 0 ? `+${ammo.dmgBonus}` : ammo.dmgBonus) : ''} dmg` : 'no dice'}
                                  {ammo.ignoresDT ? ' · ignores DT' : ''}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
                )}

                {/* AP costs (manual per-weapon) */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 6 }}>ACTION POINT COSTS</Text>
                <NumStepper label="AP — Single attack (S)" val={apSingle} min={1} max={20} set={setApSingle} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>Can be targeted (aimed)</Text>
                  <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, backgroundColor: canTarget ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setCanTarget(v => !v)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: canTarget ? colors.primaryForeground : colors.mutedForeground }}>{canTarget ? 'YES' : 'NO'}</Text>
                  </TouchableOpacity>
                </View>
                {canTarget && <NumStepper label="AP — Targeted attack (T)" val={apTargeted} min={1} max={20} set={setApTargeted} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>Has burst mode (B)</Text>
                  <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, backgroundColor: canBurst ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setCanBurst(v => !v)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: canBurst ? colors.primaryForeground : colors.mutedForeground }}>{canBurst ? 'YES' : 'NO'}</Text>
                  </TouchableOpacity>
                </View>
                {canBurst && <NumStepper label="AP — Burst attack (B)" val={apBurst} min={1} max={20} set={setApBurst} />}
              </>
            )}

            {tab === 'mods' && (
              <>
                {(() => {
                  const summaryParts: string[] = [];
                  if (modEffects.toHit !== 0) summaryParts.push(`${modEffects.toHit > 0 ? '+' : ''}${modEffects.toHit}% to-hit`);
                  if (modEffects.damage !== 0) summaryParts.push(`${modEffects.damage > 0 ? '+' : ''}${modEffects.damage} damage`);
                  if (modEffects.range !== 0) summaryParts.push(`+${modEffects.range}m range`);
                  if (modEffects.magazineMult !== 1) summaryParts.push(`×${modEffects.magazineMult} magazine`);
                  if (modEffects.negatesAimedPenalty) summaryParts.push('negates aimed penalty');
                  if (modEffects.ignoresLightPenalty) summaryParts.push('ignores light penalty');
                  if (modEffects.forcesAimed) summaryParts.push('all shots targeted');
                  if (modEffects.silencer) summaryParts.push('silenced');
                  if (modEffects.sling) summaryParts.push('sling');
                  if (modEffects.reloadApOverride !== undefined) summaryParts.push(`reload ${modEffects.reloadApOverride} AP`);
                  if (modEffects.poisons.length) summaryParts.push(`poison ${modEffects.poisons.map(p => p.type).join('/')}`);
                  if (modEffects.festering) summaryParts.push('festering');
                  if (modEffects.barbed) summaryParts.push('barbed');
                  return summaryParts.length ? (
                    <View style={{ backgroundColor: '#4a8c3f22', borderRadius: colors.radius, padding: 10, gap: 2, borderWidth: 1, borderColor: '#4a8c3f66' }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: '#4a8c3f', letterSpacing: 1 }}>ACTIVE MOD EFFECTS</Text>
                      {summaryParts.map((p, i) => (
                        <Text key={i} style={{ fontSize: 12, color: '#4a8c3f' }}>{p}</Text>
                      ))}
                    </View>
                  ) : null;
                })()}
                {availableMods.length === 0 && (
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    No weapon enhancements apply to this category.
                  </Text>
                )}
                {availableMods.map(mod => {
                  const active = selectedMods.includes(mod.id);
                  const behavior = modBehaviorSummary(mod);
                  return (
                    <TouchableOpacity key={mod.id} style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '22' : colors.secondary, gap: 10 }} onPress={() => toggleMod(mod.id)}>
                      <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: active ? colors.primary : colors.mutedForeground, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : 'transparent', marginTop: 1 }}>
                        {active && <Feather name="check" size={12} color={colors.primaryForeground} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: active ? colors.primary : colors.foreground }}>{mod.name}</Text>
                        {behavior ? (
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#4a8c3f', marginTop: 1 }}>{behavior}</Text>
                        ) : null}
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 }}>{mod.description}</Text>
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
  const [tab, setTab] = useState<'dt' | 'dr' | 'effects'>('dt');
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
  const [specialEffects, setSpecialEffects] = useState<Record<keyof SPECIALStats, number>>({ ...EMPTY_ARMOR_SPECIAL });
  const [skillEffects, setSkillEffects] = useState<Record<keyof CharacterSkills, number>>({ ...EMPTY_ARMOR_SKILLS });
  const [gasResistance, setGasResistance] = useState(0);
  const [poisonResistance, setPoisonResistance] = useState(0);
  const [radiationResistance, setRadiationResistance] = useState(0);
  const [electricityResistance, setElectricityResistance] = useState(0);
  const [showPresets, setShowPresets] = useState(false);

  const isEditing = !!editArmor;

  const applyArmorFields = (a: Armor, nameOverride?: string) => {
    setName(nameOverride ?? a.name);
    setSlot(a.slot);
    setDtNormal(a.dtNormal); setDtLaser(a.dtLaser); setDtFire(a.dtFire); setDtPlasma(a.dtPlasma); setDtExplosion(a.dtExplosion);
    setDrNormal(a.drNormal); setDrLaser(a.drLaser); setDrFire(a.drFire); setDrPlasma(a.drPlasma); setDrExplosion(a.drExplosion);
    setAcBonus(a.acBonus);
    setSpecialEffects({ ...EMPTY_ARMOR_SPECIAL, ...(a.effects?.special ?? {}) });
    setSkillEffects({ ...EMPTY_ARMOR_SKILLS, ...(a.effects?.skills ?? {}) });
    setGasResistance(a.effects?.gasResistance ?? 0);
    setPoisonResistance(a.effects?.poisonResistance ?? 0);
    setRadiationResistance(a.effects?.radiationResistance ?? 0);
    setElectricityResistance(a.effects?.electricityResistance ?? 0);
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
      setSpecialEffects({ ...EMPTY_ARMOR_SPECIAL });
      setSkillEffects({ ...EMPTY_ARMOR_SKILLS });
      setGasResistance(0); setPoisonResistance(0); setRadiationResistance(0); setElectricityResistance(0);
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
    const nonZeroSpecial = Object.fromEntries(Object.entries(specialEffects).filter(([, value]) => value !== 0)) as Partial<SPECIALStats>;
    const nonZeroSkills = Object.fromEntries(Object.entries(skillEffects).filter(([, value]) => value !== 0)) as Partial<CharacterSkills>;
    onSave({
      id: isEditing ? editArmor!.id : genId(), name: name.trim(), slot,
      dtNormal, dtLaser, dtFire, dtPlasma, dtExplosion,
      drNormal, drLaser, drFire, drPlasma, drExplosion,
      acBonus, weight: 0, isCustom: true,
      effects: {
        special: nonZeroSpecial,
        skills: nonZeroSkills,
        ...(gasResistance !== 0 ? { gasResistance } : {}),
        ...(poisonResistance !== 0 ? { poisonResistance } : {}),
        ...(radiationResistance !== 0 ? { radiationResistance } : {}),
        ...(electricityResistance !== 0 ? { electricityResistance } : {}),
      },
    });
    onClose();
  };

  const NumStepper = ({ label, val, min, max, set }: { label: string; val: number; min: number; max: number; set: (v: number) => void }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => set(Math.max(min, val - 1))}><Feather name="minus" size={12} color={colors.foreground} /></TouchableOpacity>
        <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 36, textAlign: 'center' }}>{tab === 'effects' && val > 0 ? '+' : ''}{val}{tab === 'dr' ? '%' : ''}</Text>
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
            {(['dt', 'dr', 'effects'] as const).map(t => (
              <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: tab === t ? colors.primary : 'transparent' }} onPress={() => setTab(t)}>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: tab === t ? colors.primary : colors.mutedForeground, letterSpacing: 1 }}>{t === 'dt' ? 'DT (FLAT)' : t === 'dr' ? 'DR (% RESIST)' : 'EFFECTS'}</Text>
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
            {tab === 'effects' && (
              <>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  Worn modifiers. Positive and negative values are applied while this armor is equipped.
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1, marginTop: 4 }}>SPECIAL</Text>
                {ARMOR_SPECIAL_FIELDS.map(({ key, label }) => (
                  <NumStepper key={key} label={label} val={specialEffects[key]} min={-10} max={10}
                    set={value => setSpecialEffects(current => ({ ...current, [key]: value }))} />
                ))}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1, marginTop: 8 }}>SKILLS</Text>
                {ARMOR_SKILL_FIELDS.map(({ key, label }) => (
                  <NumStepper key={key} label={label} val={skillEffects[key]} min={-100} max={100}
                    set={value => setSkillEffects(current => ({ ...current, [key]: value }))} />
                ))}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1, marginTop: 8 }}>RESISTANCES</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>Gas, poison, radiation, and electricity resistance modifiers.</Text>
                <NumStepper label="Gas Resistance" val={gasResistance} min={-100} max={100} set={setGasResistance} />
                <NumStepper label="Poison Resistance" val={poisonResistance} min={-100} max={100} set={setPoisonResistance} />
                <NumStepper label="Radiation Resistance" val={radiationResistance} min={-100} max={100} set={setRadiationResistance} />
                <NumStepper label="Electricity Resistance" val={electricityResistance} min={-100} max={100} set={setElectricityResistance} />
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
function WeaponRow({ weapon, onDelete, onEdit, onCopy, onCondition }: { weapon: Weapon; onDelete?: () => void; onEdit?: () => void; onCopy?: () => void; onCondition?: () => void }) {
  const colors = useColors();
  const modEffects = computeModEffects(weapon.mods);
  const modDefs = weapon.mods.map(id => WEAPON_MOD_DEFS.find(m => m.id === id)).filter((m): m is WeaponModDef => !!m);
  const hands = getWeaponHands(weapon);
  const ammoNames = (weapon.compatibleAmmo ?? [])
    .map(id => AMMO_TYPES.find(a => a.id === id)?.name)
    .filter((n): n is string => !!n);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{weapon.name}</Text>
          {weapon.isCustom && <View style={{ paddingHorizontal: 5, paddingVertical: 2, backgroundColor: colors.primary + '33', borderRadius: 3 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>CUSTOM</Text></View>}
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.secondary, borderRadius: 3, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>{DAMAGE_TYPE_LABELS[weapon.damageType]}</Text>
          </View>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.secondary, borderRadius: 3, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>{hands}H</Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
          {formatWeaponDamage(weapon)} · {SKILL_LABELS[weapon.category] ?? weapon.category}
          {weapon.magazineSize > 0 ? ` · Mag ${weapon.magazineSize}` : ' · Melee'}
          {weapon.burstLimit > 1 ? ` · Burst ${weapon.burstLimit}` : ''}
          {weapon.isDoubleShot ? ' · Double' : ''}
          {` · Range ${weapon.rangeNormal}sq`}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 2 }}>
          AP {formatWeaponAP(weapon)}
        </Text>
        {ammoNames.length > 0 && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>
            Ammo: {ammoNames.slice(0, 3).join(', ')}{ammoNames.length > 3 ? ` +${ammoNames.length - 3} more` : ''}
          </Text>
        )}
        {modDefs.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {modDefs.map(mod => {
              const behavior = modBehaviorSummary(mod);
              return (
                <View key={mod.id} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#4a8c3f22', borderRadius: 3, borderWidth: 1, borderColor: '#4a8c3f66' }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>
                    {mod.name}{behavior ? ` · ${behavior}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {onCondition && (
          <TouchableOpacity onPress={onCondition} style={{ padding: 6 }}>
            <Feather name="tool" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
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
  const effectSummary = [
    ...ARMOR_SPECIAL_FIELDS.map(({ key, label }) => ({ label, value: armor.effects?.special?.[key] ?? 0 })),
    ...ARMOR_SKILL_FIELDS.map(({ key, label }) => ({ label, value: armor.effects?.skills?.[key] ?? 0 })),
    { label: 'Gas Resistance', value: armor.effects?.gasResistance ?? 0 },
    { label: 'Poison Resistance', value: armor.effects?.poisonResistance ?? 0 },
    { label: 'Radiation Resistance', value: armor.effects?.radiationResistance ?? 0 },
    { label: 'Electricity Resistance', value: armor.effects?.electricityResistance ?? 0 },
  ].filter(effect => effect.value !== 0);
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
      {effectSummary.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
          {effectSummary.map(({ label, value }) => (
            <View key={label} style={{ paddingHorizontal: 6, paddingVertical: 3, backgroundColor: colors.primary + '1c', borderRadius: 4, borderWidth: 1, borderColor: colors.primary + '55' }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>
                {label} {value > 0 ? '+' : ''}{value}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Weapon Condition Modal ─────────────────────────────────────────────────
function WeaponConditionModal({ visible, weapon, onClose }: {
  visible: boolean; weapon: Weapon | null; onClose: () => void;
}) {
  const colors = useColors();
  const { characters, setWeaponCondition } = useApp();

  // Characters who have this weapon equipped or in their ammo/condition states.
  const owners = React.useMemo(() => {
    if (!weapon) return [];
    return characters.filter(c =>
      c.equippedWeaponId === weapon.id ||
      (c.weaponAmmoStates ?? []).some(a => a.weaponId === weapon.id)
    );
  }, [characters, weapon]);

  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    setSelectedCharId(owners[0]?.id ?? null);
  }, [visible, weapon]);

  const selectedChar = characters.find(c => c.id === selectedCharId) ?? null;
  const currentFilled = weapon && selectedChar
    ? clampConditionBoxes(selectedChar.weaponAmmoStates?.find(a => a.weaponId === weapon.id)?.conditionBoxes ?? 0)
    : 0;

  const setFilled = (n: number) => {
    if (!weapon || !selectedChar) return;
    Haptics.selectionAsync();
    setWeaponCondition(selectedChar.id, weapon.id, clampConditionBoxes(n));
  };

  const penalty = conditionToHitPenalty(currentFilled);
  const jammed = isWeaponJammed(currentFilled);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ maxHeight: '85%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>WEAPON CONDITION</Text>
              {weapon && <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 }}>{weapon.name}</Text>}
            </View>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
            {owners.length === 0 ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
                <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
                <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
                  No character has this weapon equipped. Equip it on a character to track its condition.
                </Text>
              </View>
            ) : (
              <>
                {/* Character picker */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CHARACTER</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {owners.map(c => {
                    const active = c.id === selectedCharId;
                    return (
                      <TouchableOpacity key={c.id} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: colors.radius, backgroundColor: active ? colors.primary : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border }} onPress={() => setSelectedCharId(c.id)}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: active ? colors.primaryForeground : colors.foreground }}>{c.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {selectedChar && (
                  <>
                    {/* Status */}
                    <View style={{ backgroundColor: jammed ? colors.destructive + '22' : (penalty !== 0 ? '#c8941a22' : colors.secondary), borderRadius: colors.radius, padding: 12, borderWidth: 1, borderColor: jammed ? colors.destructive : (penalty !== 0 ? colors.primary : colors.border), gap: 4 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: jammed ? colors.destructive : colors.primary, letterSpacing: 1 }}>
                        {conditionLabel(currentFilled).toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                        {currentFilled} / {CONDITION_BOXES_MAX} boxes filled
                        {penalty !== 0 ? ` · ${penalty}% to hit` : ''}
                        {jammed ? ' · Cannot fire' : ''}
                      </Text>
                    </View>

                    {/* Visual boxes */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      {Array.from({ length: CONDITION_BOXES_MAX }).map((_, i) => {
                        const filled = i < currentFilled;
                        return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => setFilled(i + 1 === currentFilled ? i : i + 1)}
                            style={{ width: 26, height: 26, borderRadius: 4, borderWidth: 2, borderColor: filled ? (i >= 8 ? colors.destructive : colors.primary) : colors.border, backgroundColor: filled ? (i >= 8 ? colors.destructive : colors.primary) : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: filled ? colors.primaryForeground : colors.mutedForeground }}>{i + 1}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Steppers */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, flex: 1 }}>Filled condition boxes</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setFilled(currentFilled - 1)}><Feather name="minus" size={16} color={colors.foreground} /></TouchableOpacity>
                        <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 40, textAlign: 'center' }}>{currentFilled}</Text>
                        <TouchableOpacity style={{ width: 34, height: 34, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setFilled(currentFilled + 1)}><Feather name="plus" size={16} color={colors.foreground} /></TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: colors.radius, alignItems: 'center', backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setFilled(0)}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>REPAIR (PRISTINE)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: colors.radius, alignItems: 'center', backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setFilled(CONDITION_BOXES_MAX)}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>JAM (BROKEN)</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      0 = pristine, {CONDITION_BOXES_MAX} = jammed. 8–9 boxes → −10% to hit; {CONDITION_BOXES_MAX} → the weapon cannot fire.
                    </Text>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  const [categoryFilter, setCategoryFilter] = useState<WeaponCategory | 'all'>('all');
  const [conditionWeapon, setConditionWeapon] = useState<Weapon | null>(null);

  const openNewWeapon = () => { setEditingWeapon(null); setShowWeaponForm(true); };
  const openNewArmor = () => { setEditingArmor(null); setShowArmorForm(true); };
  const openEditWeapon = (w: Weapon) => { setEditingWeapon(w); setShowWeaponForm(true); };
  const openEditArmor = (a: Armor) => { setEditingArmor(a); setShowArmorForm(true); };
  // Duplicate: open the creator pre-filled from an existing weapon/armor as a NEW custom.
  const openCopyWeapon = (w: Weapon) => { setEditingWeapon({ ...w, id: genId(), name: `${w.name} (Copy)`, isCustom: true }); setShowWeaponForm(true); };
  const openCopyArmor = (a: Armor) => { setEditingArmor({ ...a, id: genId(), name: `${a.name} (Copy)`, isCustom: true }); setShowArmorForm(true); };

  const allWeapons = [...BUILT_IN_WEAPONS, ...customWeapons];
  const allArmor = [...BUILT_IN_ARMOR, ...customArmor];

  const filteredWeapons = allWeapons.filter(w =>
    (!search || w.name.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === 'all' || w.category === categoryFilter)
  );
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

        {/* Category filter chips (weapons only) */}
        {tab === 'weapons' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {(['all', ...WEAPON_CATEGORY_ORDER] as const).map(cat => {
              const active = categoryFilter === cat;
              const label = cat === 'all' ? 'All' : WEAPON_CATEGORY_LABELS[cat];
              return (
                <TouchableOpacity key={cat} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: colors.radius, backgroundColor: active ? colors.primary : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border }} onPress={() => setCategoryFilter(cat)}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: active ? colors.primaryForeground : colors.mutedForeground }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
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
              onCondition={() => setConditionWeapon(item)}
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
      <WeaponConditionModal
        visible={conditionWeapon !== null}
        weapon={conditionWeapon}
        onClose={() => setConditionWeapon(null)}
      />
    </View>
  );
}
