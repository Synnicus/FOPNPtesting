import React, { useState } from 'react';
import {
  FlatList, Modal, Platform, ScrollView, View,
} from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity, localizedConfirm } from '@/components/LocalizedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { BUILT_IN_WEAPONS, MINE_TRAP_PROFILES, WEAPON_CATEGORIES, WEAPON_CATEGORY_LABELS, WEAPON_CATEGORY_ORDER, DAMAGE_TYPES, formatWeaponDamage, formatWeaponAP, formatWeaponCapacity, getWeaponHands, weaponCategorySupportsAmmo } from '@/data/weapons';
import { WEAPON_MOD_DEFS, computeModEffects, WeaponModDef, ModAppliesTo } from '@/data/mods';
import { AMMO_TYPES, getAmmoReferenceEffects, validateCustomAmmo, type AmmoDamageComponent, type AmmoType, type AmmoComponentType } from '@/data/ammo';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { AP_COSTS } from '@/data/apCosts';
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
  const { allAmmo } = useApp();
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
                        {allAmmo.map(ammo => {
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

// ─── Ammo Form Modal ──────────────────────────────────────────────────────────
function AmmoFormModal({ visible, onClose, onSave, editAmmo, catalog }: {
  visible: boolean;
  onClose: () => void;
  onSave: (ammo: AmmoType) => void;
  editAmmo?: AmmoType | null;
  catalog: readonly AmmoType[];
}) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [acMod, setAcMod] = useState(0);
  const [drMod, setDrMod] = useState(0);
  const [ignoresDT, setIgnoresDT] = useState(false);
  const [notes, setNotes] = useState('');
  const [poisonEnabled, setPoisonEnabled] = useState(false);
  const [poisonType, setPoisonType] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'>('A');
  const [poisonEffect, setPoisonEffect] = useState('');
  const [components, setComponents] = useState<AmmoDamageComponent[]>([]);

  const newComponent = (index: number): AmmoDamageComponent => ({
    id: genId(),
    label: `Component ${index + 1}`,
    type: 'normal',
    dmgDieCount: 1,
    dmgDie: 6,
    dmgBonus: 0,
  });

  React.useEffect(() => {
    if (!visible) return;
    if (editAmmo) {
      setName(editAmmo.name);
      setAcMod(editAmmo.acMod);
      setDrMod(editAmmo.drMod);
      setIgnoresDT(!!editAmmo.ignoresDT);
      setNotes(editAmmo.notes ?? '');
      setPoisonEnabled(!!editAmmo.poison);
      setPoisonType(editAmmo.poison?.type ?? 'A');
      setPoisonEffect(editAmmo.poison?.effectText ?? '');
      setComponents((editAmmo.components ?? [{
        id: genId(), label: 'Damage', type: 'normal',
        dmgDieCount: editAmmo.dmgDieCount, dmgDie: editAmmo.dmgDie, dmgBonus: editAmmo.dmgBonus,
      }]).map(component => ({ ...component })));
    } else {
      setName(''); setAcMod(0); setDrMod(0); setIgnoresDT(false); setNotes('');
      setPoisonEnabled(false); setPoisonType('A'); setPoisonEffect('');
      setComponents([newComponent(0)]);
    }
  }, [visible, editAmmo]);

  const updateComponent = (id: string, patch: Partial<AmmoDamageComponent>) => {
    setComponents(current => current.map(component => component.id === id ? { ...component, ...patch } : component));
  };

  const candidate: AmmoType = {
    id: editAmmo?.id ?? '__new_custom_ammo__',
    name: name.trim(),
    value: 0,
    volume: 0,
    acMod,
    drMod,
    ignoresDT,
    dmgDieCount: components[0]?.dmgDieCount ?? 0,
    dmgDie: components[0]?.dmgDie ?? 0,
    dmgBonus: components[0]?.dmgBonus ?? 0,
    notes: notes.trim() || undefined,
    poison: poisonEnabled ? { type: poisonType, effectText: poisonEffect.trim() } : undefined,
    components,
    isCustom: true,
  };
  const validationCatalog = catalog.filter(ammo => ammo.id !== editAmmo?.id && ammo.id !== '__new_custom_ammo__');
  const errors = validateCustomAmmo(candidate, validationCatalog);
  const isValid = errors.length === 0 && (!poisonEnabled || poisonEffect.trim().length > 0);

  const save = () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave({ ...candidate, id: editAmmo?.id ?? genId() });
    onClose();
  };

  const step = (component: AmmoDamageComponent, key: 'dmgDieCount' | 'dmgDie' | 'dmgBonus', delta: number) => {
    const minimum = key === 'dmgBonus' ? -999 : 0;
    updateComponent(component.id, { [key]: Math.max(minimum, component[key] + delta) });
  };
  const componentTypes: Array<{ type: AmmoComponentType; label: string }> = [
    ...Object.values(DAMAGE_TYPES).map(type => ({ type, label: DAMAGE_TYPE_NAMES[type] })),
    { type: 'concussion', label: 'Concussion' },
    { type: 'radiation', label: 'Radiation' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ maxHeight: '94%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{editAmmo ? 'EDIT CUSTOM AMMO' : 'CREATE CUSTOM AMMO'}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}>
            <TextInput style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: name.trim() ? colors.border : colors.destructive + '88', borderRadius: colors.radius, padding: 11, color: colors.foreground }} placeholder="Ammunition name*" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[{ label: 'TARGET AC', value: acMod, set: setAcMod }, { label: 'TARGET DR %', value: drMod, set: setDrMod }].map(field => (
                <View key={field.label} style={{ flex: 1, gap: 5 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground }}>{field.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TouchableOpacity onPress={() => field.set(field.value - 5)} style={{ padding: 8 }}><Feather name="minus" size={16} color={colors.foreground} /></TouchableOpacity>
                    <Text style={{ fontFamily: 'Inter_700Bold', color: colors.primary }}>{field.value > 0 ? '+' : ''}{field.value}</Text>
                    <TouchableOpacity onPress={() => field.set(field.value + 5)} style={{ padding: 8 }}><Feather name="plus" size={16} color={colors.foreground} /></TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => setIgnoresDT(value => !value)} style={{ padding: 11, borderWidth: 1, borderColor: ignoresDT ? colors.primary : colors.border, backgroundColor: ignoresDT ? colors.primary + '22' : colors.secondary, borderRadius: colors.radius }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: ignoresDT ? colors.primary : colors.foreground }}>{ignoresDT ? '✓ ' : ''}BYPASSES DAMAGE THRESHOLD</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>DAMAGE / EXPOSURE COMPONENTS ({components.length}/3)</Text>
              {components.length < 3 && <TouchableOpacity onPress={() => setComponents(current => [...current, newComponent(current.length)])}><Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}>+ ADD</Text></TouchableOpacity>}
            </View>
            {components.map((component, index) => (
              <View key={component.id} style={{ padding: 12, gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_600SemiBold', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 5 }} value={component.label} onChangeText={label => updateComponent(component.id, { label })} placeholder={`Component ${index + 1} label`} placeholderTextColor={colors.mutedForeground} />
                  {components.length > 1 && <TouchableOpacity onPress={() => setComponents(current => current.filter(item => item.id !== component.id))}><Feather name="trash-2" size={17} color={colors.destructive} /></TouchableOpacity>}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  {componentTypes.map(option => (
                    <TouchableOpacity key={option.type} onPress={() => updateComponent(component.id, { type: option.type })} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: component.type === option.type ? colors.primary : colors.border, backgroundColor: component.type === option.type ? colors.primary : colors.secondary }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: component.type === option.type ? colors.primaryForeground : colors.foreground }}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {(['dmgDieCount', 'dmgDie', 'dmgBonus'] as const).map(key => {
                  const label = key === 'dmgDieCount' ? 'Dice count' : key === 'dmgDie' ? 'Die sides' : component.type === 'radiation' ? 'Flat exposure' : 'Flat damage';
                  return (
                    <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: colors.foreground }}>{label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity onPress={() => step(component, key, -1)}><Feather name="minus" size={16} color={colors.foreground} /></TouchableOpacity>
                        <Text style={{ minWidth: 35, textAlign: 'center', color: colors.primary, fontFamily: 'Inter_700Bold' }}>{component[key]}</Text>
                        <TouchableOpacity onPress={() => step(component, key, 1)}><Feather name="plus" size={16} color={colors.foreground} /></TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            <TextInput style={{ minHeight: 72, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 11, color: colors.foreground, textAlignVertical: 'top' }} multiline placeholder="Special notes (optional)" placeholderTextColor={colors.mutedForeground} value={notes} onChangeText={setNotes} />
            <TouchableOpacity onPress={() => setPoisonEnabled(value => !value)} style={{ padding: 11, borderWidth: 1, borderColor: poisonEnabled ? colors.primary : colors.border, borderRadius: colors.radius }}>
              <Text style={{ color: poisonEnabled ? colors.primary : colors.foreground, fontFamily: 'Inter_700Bold' }}>{poisonEnabled ? '✓ ' : ''}DELIVERS POISON</Text>
            </TouchableOpacity>
            {poisonEnabled && (
              <>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map(type => <TouchableOpacity key={type} onPress={() => setPoisonType(type)} style={{ flex: 1, paddingVertical: 7, alignItems: 'center', backgroundColor: poisonType === type ? colors.primary : colors.secondary, borderRadius: 4 }}><Text style={{ color: poisonType === type ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_700Bold' }}>{type}</Text></TouchableOpacity>)}
                </View>
                <TextInput style={{ minHeight: 60, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 10, color: colors.foreground }} multiline placeholder="Poison effect*" placeholderTextColor={colors.mutedForeground} value={poisonEffect} onChangeText={setPoisonEffect} />
              </>
            )}
            {!isValid && <Text style={{ fontSize: 11, color: colors.destructive }}>{errors[0] ?? 'Poison effect is required.'}</Text>}
          </ScrollView>
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity disabled={!isValid} onPress={save} style={{ paddingVertical: 14, alignItems: 'center', borderRadius: colors.radius, backgroundColor: isValid ? colors.primary : colors.secondary, opacity: isValid ? 1 : 0.5 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', color: isValid ? colors.primaryForeground : colors.mutedForeground }}>{editAmmo ? 'SAVE CHANGES' : 'CREATE AMMUNITION'}</Text>
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
  const modEffects = computeModEffects(weapon.mods);
  const modDefs = weapon.mods.map(id => WEAPON_MOD_DEFS.find(m => m.id === id)).filter((m): m is WeaponModDef => !!m);
  const hands = getWeaponHands(weapon);
  const ammoNames = (weapon.compatibleAmmo ?? [])
    .map(id => AMMO_TYPES.find(a => a.id === id)?.name)
    .filter((n): n is string => !!n);
  const capacityLabel = formatWeaponCapacity(weapon);
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
          {capacityLabel ? ` · ${capacityLabel}` : ''}
          {weapon.burstLimit > 1 ? ` · Burst ${weapon.burstLimit}` : ''}
          {weapon.isDoubleShot ? ' · Double' : ''}
          {` · Range ${weapon.rangeNormal}sq`}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.primary, marginTop: 2 }}>
          AP COST: {formatWeaponAP(weapon)}
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

// ─── Ammo Reference Row ───────────────────────────────────────────────────────
function AmmoRow({ ammo, onCopy, onEdit, onDelete }: { ammo: AmmoType; onCopy?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const colors = useColors();
  const effects = getAmmoReferenceEffects(ammo);
  const signed = (value: number, suffix = '') => `${value > 0 ? '+' : ''}${value}${suffix}`;
  const chips = [
    { label: `DMG ${effects.damage}`, emphasized: effects.damage !== 'No direct damage' },
    { label: `AC ${signed(effects.acModifier)}`, emphasized: effects.acModifier !== 0 },
    { label: `DR ${signed(effects.drModifier, '%')}`, emphasized: effects.drModifier !== 0 },
    { label: effects.ignoresDT ? 'IGNORES DT' : 'DT APPLIES', emphasized: effects.ignoresDT },
  ];

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: colors.radius, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{ammo.name}</Text>
          {ammo.isCustom && <View style={{ paddingHorizontal: 5, paddingVertical: 2, backgroundColor: colors.primary + '33', borderRadius: 3 }}><Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>CUSTOM</Text></View>}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {onCopy && <TouchableOpacity onPress={onCopy} style={{ padding: 6 }}><Feather name="copy" size={16} color={colors.mutedForeground} /></TouchableOpacity>}
          {onEdit && <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}><Feather name="edit-2" size={16} color={colors.primary} /></TouchableOpacity>}
          {onDelete && <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {chips.map(chip => (
          <View
            key={chip.label}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: chip.emphasized ? colors.primary : colors.border,
              backgroundColor: chip.emphasized ? colors.primary + '18' : colors.secondary,
            }}
          >
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: chip.emphasized ? colors.primary : colors.mutedForeground }}>
              {chip.label}
            </Text>
          </View>
        ))}
      </View>
      {!!ammo.components?.length && (
        <View style={{ gap: 3 }}>
          {ammo.components.map(component => (
            <Text key={component.id} style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {component.label}: {component.dmgDieCount > 0 ? `${component.dmgDieCount}d${component.dmgDie}` : ''}{component.dmgBonus !== 0 ? `${component.dmgBonus > 0 && component.dmgDieCount > 0 ? '+' : ''}${component.dmgBonus}` : ''} · {component.type === 'radiation' ? 'Radiation exposure' : component.type === 'concussion' ? 'Concussion' : DAMAGE_TYPE_NAMES[component.type]}
            </Text>
          ))}
        </View>
      )}
      {!!effects.notes && (
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
          {effects.notes}
        </Text>
      )}
      {!!effects.poisonType && (
        <View style={{ padding: 10, borderRadius: colors.radius, backgroundColor: colors.destructive + '12', borderWidth: 1, borderColor: colors.destructive + '55', gap: 2 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>
            POISON TYPE {effects.poisonType}
          </Text>
          {!!effects.poisonEffect && (
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>
              {effects.poisonEffect}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Equipment Screen ─────────────────────────────────────────────────────────
export default function EquipmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    customWeapons, customArmor, customAmmo, allAmmo,
    addCustomWeapon, updateCustomWeapon, deleteCustomWeapon,
    addCustomArmor, updateCustomArmor, deleteCustomArmor,
    addCustomAmmo, updateCustomAmmo, deleteCustomAmmo,
  } = useApp();
  const [tab, setTab] = useState<'weapons' | 'armor' | 'ammo'>('weapons');
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [showArmorForm, setShowArmorForm] = useState(false);
  const [showAmmoForm, setShowAmmoForm] = useState(false);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [editingArmor, setEditingArmor] = useState<Armor | null>(null);
  const [editingAmmo, setEditingAmmo] = useState<AmmoType | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<WeaponCategory | 'all'>('all');

  const openNewWeapon = () => { setEditingWeapon(null); setShowWeaponForm(true); };
  const openNewArmor = () => { setEditingArmor(null); setShowArmorForm(true); };
  const openNewAmmo = () => { setEditingAmmo(null); setShowAmmoForm(true); };
  const openEditWeapon = (w: Weapon) => { setEditingWeapon(w); setShowWeaponForm(true); };
  const openEditArmor = (a: Armor) => { setEditingArmor(a); setShowArmorForm(true); };
  const openEditAmmo = (ammo: AmmoType) => { setEditingAmmo(ammo); setShowAmmoForm(true); };
  // Duplicate: open the creator pre-filled from an existing weapon/armor as a NEW custom.
  const openCopyWeapon = (w: Weapon) => { setEditingWeapon({ ...w, id: genId(), name: `${w.name} (Copy)`, isCustom: true }); setShowWeaponForm(true); };
  const openCopyArmor = (a: Armor) => { setEditingArmor({ ...a, id: genId(), name: `${a.name} (Copy)`, isCustom: true }); setShowArmorForm(true); };
  const openCopyAmmo = (ammo: AmmoType) => {
    setEditingAmmo({
      ...ammo,
      id: genId(),
      name: `${ammo.name} (Copy)`,
      isCustom: true,
      components: (ammo.components ?? [{
        id: genId(), label: 'Damage', type: 'normal' as const,
        dmgDieCount: ammo.dmgDieCount, dmgDie: ammo.dmgDie, dmgBonus: ammo.dmgBonus,
      }]).map(component => ({ ...component, id: genId() })),
    });
    setShowAmmoForm(true);
  };
  const confirmDelete = (name: string, onDelete: () => void) => {
    // React Native Web does not implement Alert.alert action buttons.
    if (Platform.OS === 'web') {
      if (localizedConfirm(`Delete ${name}?`)) onDelete();
      return;
    }
    Alert.alert('Delete', `Delete ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const allWeapons = [...BUILT_IN_WEAPONS, ...customWeapons];
  const allArmor = [...BUILT_IN_ARMOR, ...customArmor];

  const filteredWeapons = allWeapons.filter(w =>
    (!search || w.name.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === 'all' || w.category === categoryFilter)
  );
  const filteredArmor = allArmor.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()));
  const filteredAmmo = allAmmo.filter(ammo => !search || ammo.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      {/* Header */}
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>EQUIPMENT</Text>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: colors.radius }}
            onPress={() => tab === 'weapons' ? openNewWeapon() : tab === 'armor' ? openNewArmor() : openNewAmmo()}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>
              {tab === 'weapons' ? 'WEAPON' : tab === 'armor' ? 'ARMOR' : 'AMMO'}
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
          {(['weapons', 'armor', 'ammo'] as const).map(t => (
            <TouchableOpacity key={t} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: tab === t ? colors.primary : colors.secondary, borderWidth: 1, borderColor: tab === t ? colors.primary : colors.border }} onPress={() => setTab(t)}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: tab === t ? colors.primaryForeground : colors.mutedForeground }}>
                {t === 'weapons'
                  ? `WEAPONS (${filteredWeapons.length})`
                  : t === 'armor'
                    ? `ARMOR (${filteredArmor.length})`
                    : `AMMO (${filteredAmmo.length})`}
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
              onCopy={() => openCopyWeapon(item)}
              onEdit={item.isCustom ? () => openEditWeapon(item) : undefined}
              onDelete={item.isCustom
                ? () => confirmDelete(item.name, () => deleteCustomWeapon(item.id))
                : undefined}
            />
          )}
        />
      ) : tab === 'armor' ? (
        <FlatList
          data={filteredArmor}
          keyExtractor={a => a.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <ArmorRow
              armor={item}
              onCopy={() => openCopyArmor(item)}
              onEdit={item.isCustom ? () => openEditArmor(item) : undefined}
              onDelete={item.isCustom
                ? () => confirmDelete(item.name, () => deleteCustomArmor(item.id))
                : undefined}
            />
          )}
        />
      ) : (
        <FlatList
          data={filteredAmmo}
          keyExtractor={ammo => ammo.id}
          contentContainerStyle={{ paddingTop: 2, paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={(
            <Text style={{ marginHorizontal: 16, marginBottom: 10, fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              Built-in and reusable custom ammunition. Custom components resolve independently in combat.
            </Text>
          )}
          renderItem={({ item }) => (
            <AmmoRow
              ammo={item}
              onCopy={() => openCopyAmmo(item)}
              onEdit={item.isCustom ? () => openEditAmmo(item) : undefined}
              onDelete={item.isCustom ? () => confirmDelete(item.name, () => deleteCustomAmmo(item.id)) : undefined}
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
      <AmmoFormModal
        visible={showAmmoForm}
        editAmmo={editingAmmo}
        catalog={allAmmo}
        onClose={() => { setShowAmmoForm(false); setEditingAmmo(null); }}
        onSave={ammo => {
          if (customAmmo.some(candidate => candidate.id === ammo.id)) updateCustomAmmo(ammo);
          else addCustomAmmo(ammo);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}
