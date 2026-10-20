import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Image, Modal, Platform, ScrollView, View,
} from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity, localizedConfirm } from '@/components/LocalizedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import {
  BUILT_IN_RULE_TAGS,
  getSelectableWeaponTags,
  inferWeaponTags,
  normalizeRuleTag,
  parseRuleTagList,
  computeCustomWeaponModEffects,
} from '@/data/customRules';
import { ScrollableTabStrip } from '@/components/ScrollableTabStrip';
import { BUILT_IN_WEAPONS, WEAPON_CATEGORIES, WEAPON_CATEGORY_LABELS, WEAPON_CATEGORY_ORDER, DAMAGE_TYPES, formatWeaponDamage, formatWeaponAP, formatWeaponCapacity, getWeaponAttackModes, getWeaponHands, weaponCategorySupportsAmmo } from '@/data/weapons';
import { WEAPON_MOD_DEFS, computeModEffects, WeaponModDef, ModAppliesTo } from '@/data/mods';
import { AMMO_TYPES, getAmmoReferenceEffects, validateCustomAmmo, type AmmoDamageComponent, type AmmoType, type AmmoComponentType } from '@/data/ammo';
import { ALCOHOL_CONSUMABLES, CHEMS } from '@/data/chems';
import { CONSUMABLE_CATEGORIES, validateCustomConsumable } from '@/data/consumables';
import { BUILT_IN_ARMOR } from '@/data/armor';
import { AP_COSTS } from '@/data/apCosts';
import { Weapon, WeaponCategory, Armor, DamageType, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_NAMES, SPECIALStats, CharacterSkills, VehicleProfile, CustomConsumable, ConsumableCategory, CustomAreaEffect, AreaAttackKind, CustomAreaDamageType, AreaRangeUnit } from '@/context/types';
import { VehicleFormModal } from '@/components/VehicleFormModal';
import { CatalogImageEditor } from '@/components/CatalogImageEditor';
import { PortraitCardBackground } from '@/components/PortraitCardBackground';
import { MouseDraggableFlatList } from '@/components/MouseDraggableFlatList';
import { BUILT_IN_TOOLS } from '@/data/tools';
import CustomRulesPanel from '@/components/CustomRulesPanel';
import { SelectableTagMenu } from '@/components/SelectableTagMenu';
import { AREA_ATTACK_KINDS, AREA_DAMAGE_TYPES, validateCustomAreaEffects } from '@/data/customAreaEffects';
import {
  resolveVehiclePerformance,
  spawnVehicleCharacter,
  vehiclePerformanceSummary,
  vehicleUpgradePlayNotes,
  VEHICLE_CATEGORIES,
} from '@/data/vehicles';

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

function CustomAreaEffectsEditor({
  effects,
  onChange,
  rangeUnit,
  onRangeUnitChange,
}: {
  effects: CustomAreaEffect[];
  onChange: (effects: CustomAreaEffect[]) => void;
  rangeUnit: AreaRangeUnit;
  onRangeUnitChange: (unit: AreaRangeUnit) => void;
}) {
  const colors = useColors();
  const update = (id: string, patch: Partial<CustomAreaEffect>) =>
    onChange(effects.map(effect => effect.id === id ? { ...effect, ...patch } : effect));
  const addEffect = () => onChange([...effects, {
    id: genId(),
    label: `Effect ${effects.length + 1}`,
    kind: 'explosion',
    damageType: 'normal',
    damageDieCount: 1,
    damageDie: 6,
    damageBonus: 0,
  }]);
  const numberInput = (value: number | undefined, placeholder: string, onValue: (value: number | undefined) => void) => (
    <TextInput
      value={value === undefined ? '' : String(value)}
      onChangeText={text => {
        const cleaned = text.replace(/[^0-9]/g, '');
        onValue(cleaned === '' ? undefined : Number.parseInt(cleaned, 10));
      }}
      keyboardType="numeric"
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      style={{ width: 75, padding: 7, color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 5, textAlign: 'center' }}
    />
  );
  const chipStyle = (selected: boolean) => ({
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: selected ? colors.primary : colors.border,
    borderRadius: 5,
    backgroundColor: selected ? colors.primary + '22' : colors.secondary,
  });
  const validationMessage = validateCustomAreaEffects(effects, rangeUnit)[0]
    ?? (effects.some(effect => effect.radius === undefined)
      ? 'Set a maximum range for every effect before using this profile in combat.'
      : undefined);

  return (
    <View style={{ gap: 10, padding: 11, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>AREA BLAST ZONES</Text>
          <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Set a maximum range for every effect. Use printed distances where available.</Text>
        </View>
        {effects.length < 8 && (
          <TouchableOpacity onPress={addEffect} style={{ paddingHorizontal: 9, paddingVertical: 7, borderRadius: 5, borderWidth: 1, borderColor: colors.primary }}>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary }}>+ EFFECT</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['hex', 'm'] as const).map(unit => (
          <TouchableOpacity key={unit} onPress={() => onRangeUnitChange(unit)} style={{ ...chipStyle(rangeUnit === unit), flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: rangeUnit === unit ? colors.primary : colors.foreground }}>{unit === 'hex' ? 'HEXES' : 'METERS'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {effects.map((effect, index) => (
        <View key={effect.id} style={{ gap: 8, padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <TextInput
              value={effect.label}
              onChangeText={label => update(effect.id, { label })}
              placeholder={`Effect ${index + 1}`}
              placeholderTextColor={colors.mutedForeground}
              style={{ flex: 1, padding: 6, color: colors.foreground, borderBottomWidth: 1, borderBottomColor: colors.border }}
            />
            <TouchableOpacity onPress={() => onChange(effects.filter(item => item.id !== effect.id))} accessibilityLabel={`Remove ${effect.label}`}>
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 9, color: colors.mutedForeground }}>EFFECT KIND</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {AREA_ATTACK_KINDS.map((kind: AreaAttackKind) => (
              <TouchableOpacity key={kind} onPress={() => update(effect.id, { kind })} style={chipStyle(effect.kind === kind)}>
                <Text style={{ fontSize: 9, color: effect.kind === kind ? colors.primary : colors.foreground }}>{kind.replace(/([A-Z])/g, ' $1')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 9, color: colors.mutedForeground }}>DAMAGE / EXPOSURE TYPE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {AREA_DAMAGE_TYPES.map((type: CustomAreaDamageType) => (
              <TouchableOpacity key={type} onPress={() => update(effect.id, { damageType: type })} style={chipStyle(effect.damageType === type)}>
                <Text style={{ fontSize: 9, color: effect.damageType === type ? colors.primary : colors.foreground }}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {[
              { label: 'DICE', value: effect.damageDieCount, key: 'damageDieCount' as const },
              { label: 'DIE', value: effect.damageDie, key: 'damageDie' as const },
              { label: effect.damageType === 'radiation' ? 'EXPOSURE' : 'BONUS', value: effect.damageBonus, key: 'damageBonus' as const },
            ].map(field => (
              <View key={field.key} style={{ gap: 3, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, color: colors.mutedForeground }}>{field.label}</Text>
                <TextInput
                  value={String(field.value)}
                  onChangeText={text => {
                    const parsed = Number.parseInt(text.replace(/[^0-9-]/g, ''), 10);
                    update(effect.id, { [field.key]: Number.isFinite(parsed) ? parsed : 0 });
                  }}
                  keyboardType="numeric"
                  style={{ width: 54, padding: 6, color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 5, textAlign: 'center' }}
                />
              </View>
            ))}
            <View style={{ gap: 3, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: colors.mutedForeground }}>MIN DIST.</Text>
              {numberInput(effect.minDistance, '0', value => update(effect.id, { minDistance: value }))}
            </View>
            <View style={{ gap: 3, alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: colors.mutedForeground }}>MAX RANGE</Text>
              {numberInput(effect.radius, 'Required', value => update(effect.id, { radius: value }))}
            </View>
          </View>
        </View>
      ))}
      {effects.length === 0 && <Text style={{ fontSize: 10, color: colors.mutedForeground }}>No area effects configured.</Text>}
      {validationMessage && <Text style={{ fontSize: 10, color: colors.destructive }}>{validationMessage}</Text>}
    </View>
  );
}

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
function WeaponFormModal({ visible, onClose, onSave, editWeapon, initialCategory }: {
  visible: boolean; onClose: () => void; onSave: (w: Weapon) => void;
  editWeapon?: Weapon | null;
  initialCategory?: WeaponCategory;
}) {
  const colors = useColors();
  const {
    allAmmo, customWeaponMods, customPerks, campaignRuleTags, saveCustomRules,
  } = useApp();
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
  const [canSingle, setCanSingle] = useState(true);
  const [apTargeted, setApTargeted] = useState<number>(AP_COSTS.ATTACK_AIMED);
  const [canTarget, setCanTarget] = useState(true);
  const [apBurst, setApBurst] = useState<number>(AP_COSTS.ATTACK_BURST);
  const [canBurst, setCanBurst] = useState(false);
  const [hands, setHands] = useState<1 | 2>(1);
  const [compatibleAmmo, setCompatibleAmmo] = useState<string[]>([]);
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [tagText, setTagText] = useState('');
  const [showCustomModsManager, setShowCustomModsManager] = useState(false);
  const [tab, setTab] = useState<'basic' | 'advanced' | 'mods'>('basic');
  const [showPresets, setShowPresets] = useState(false);
  const [areaAttackProfileId, setAreaAttackProfileId] = useState<string | undefined>();
  const [customAreaEffects, setCustomAreaEffects] = useState<CustomAreaEffect[]>([]);
  const [areaRangeUnit, setAreaRangeUnit] = useState<AreaRangeUnit>('hex');
  const [blastRadiusEnabled, setBlastRadiusEnabled] = useState(false);
  const [empEnabled, setEmpEnabled] = useState(false);

  const isEditing = !!editWeapon;
  const isCreatingTrap = !isEditing && initialCategory === 'minesTraps';

  const applyWeaponFields = (w: Weapon, nameOverride?: string) => {
    setName(nameOverride ?? w.name);
    setCategory(w.category);
    setAreaAttackProfileId(w.areaAttackProfileId);
    setCustomAreaEffects((w.customAreaEffects ?? []).map(effect => ({ ...effect })));
    setAreaRangeUnit(w.areaRangeUnit ?? 'hex');
    setBlastRadiusEnabled(w.hasBlastRadius
      ?? (!!w.customAreaEffects?.length || w.areaAttackProfileId === 't13_antipersonnel_mine' || w.areaAttackProfileId === 't45_se_antivehicle_mine'));
    setEmpEnabled(!!w.emp);
    setDamageType(w.damageType);
    setDieCount(w.damageDieCount);
    setDieSides(w.damageDie);
    setDamageBonus(w.damageBonus);
    setBurstLimit(w.burstLimit);
    setIsDoubleShot(w.isDoubleShot);
    setMagazineSize(w.magazineSize);
    setMinStr(w.minStr);
    setRangeNormal(w.rangeNormal);
    const attackModes = getWeaponAttackModes(w);
    setCanSingle(attackModes.single);
    setApSingle(w.apSingle ?? AP_COSTS.ATTACK_SINGLE);
    setCanTarget(attackModes.targeted);
    setApTargeted(w.apTargeted ?? AP_COSTS.ATTACK_AIMED);
    setCanBurst(attackModes.burst);
    setApBurst(w.apBurst ?? AP_COSTS.ATTACK_BURST);
    setHands(getWeaponHands(w));
    setCompatibleAmmo([...(w.compatibleAmmo ?? [])]);
    setSelectedMods([...w.mods]);
    setTagText((w.tags ?? []).join(', '));
  };

  React.useEffect(() => {
    if (!visible) return;
    setTab('basic');
    setShowPresets(false);
    setShowCustomModsManager(false);
    if (editWeapon) {
      applyWeaponFields(editWeapon);
    } else {
      setName(''); setCategory(initialCategory ?? 'smallGuns'); setDamageType('normal');
      setDieCount(1); setDieSides(6); setDamageBonus(0); setBurstLimit(1);
      setIsDoubleShot(false); setMagazineSize(0); setMinStr(3); setRangeNormal(15);
      setApSingle(AP_COSTS.ATTACK_SINGLE); setCanSingle(true); setCanTarget(true); setApTargeted(AP_COSTS.ATTACK_AIMED);
      setCanBurst(false); setApBurst(AP_COSTS.ATTACK_BURST);
      setHands(1); setCompatibleAmmo([]);
      setSelectedMods([]);
      setTagText('');
      setAreaAttackProfileId(undefined);
      setCustomAreaEffects([]);
      setAreaRangeUnit('hex');
      setBlastRadiusEnabled(false);
      setEmpEnabled(false);
    }
  }, [visible, editWeapon, initialCategory]);

  const areaEffectErrors = validateCustomAreaEffects(customAreaEffects, areaRangeUnit);
  const hasPresetBlastProfile = areaAttackProfileId === 't13_antipersonnel_mine'
    || areaAttackProfileId === 't45_se_antivehicle_mine';
  const blastProfileConfigured = !blastRadiusEnabled
    || (hasPresetBlastProfile
      || (!areaAttackProfileId && customAreaEffects.length > 0
        && customAreaEffects.every(effect => effect.radius !== undefined)));
  const updateBurstLimit = (value: number) => {
    setBurstLimit(value);
    if (value < 3) setCanBurst(false);
  };
  const isValid = name.trim().length > 0
    && (canSingle || canTarget || (canBurst && burstLimit >= 3) || isDoubleShot)
    && ((dieCount > 0 && dieSides > 0) || !!areaAttackProfileId || customAreaEffects.length > 0)
    && areaEffectErrors.length === 0
    && (category !== 'minesTraps' || blastProfileConfigured);

  const modEffects = computeModEffects(selectedMods);
  const ammoCompatibleCategory = weaponCategorySupportsAmmo(category);

  // Mods offered for the current category, plus any already-selected mods
  // (so editing an existing weapon never silently drops a mod).
  const availableMods = WEAPON_MOD_DEFS.filter(
    m => modAppliesToCategory(m.appliesTo, category) || selectedMods.includes(m.id)
  );
  const categoryTag: Record<WeaponCategory, string> = {
    smallGuns: 'small-guns',
    bigGuns: 'big-guns',
    energyWeapons: 'energy-weapons',
    meleeWeapons: 'melee-weapons',
    unarmed: 'unarmed',
    throwing: 'throwing',
    minesTraps: 'explosive',
    natural: 'unarmed',
  };
  const inferredDraftTags = [
    ...new Set([
      ...parseRuleTagList(tagText),
      categoryTag[category],
      ...(editWeapon ? inferWeaponTags({ ...editWeapon, category, name, burstLimit, tags: parseRuleTagList(tagText) }) : []),
    ]),
  ];
  const availableCustomMods = customWeaponMods.filter(mod =>
    selectedMods.includes(mod.id)
    || !(mod.appliesToTags?.length)
    || mod.appliesToTags.some(tag => inferredDraftTags.includes(tag))
  );
  const previewWeapon = {
    ...(editWeapon ?? {}),
    id: editWeapon?.id ?? 'custom-weapon-preview',
    name,
    category,
    skill: editWeapon?.skill ?? category,
    burstLimit,
    tags: parseRuleTagList(tagText),
  } as Weapon;
  const customModEffects = computeCustomWeaponModEffects(selectedMods, customWeaponMods, previewWeapon);
  const visibleWeaponTags = getSelectableWeaponTags(campaignRuleTags, parseRuleTagList(tagText));

  const toggleWeaponTag = (tagId: string) => {
    setTagText(current => {
      const selected = parseRuleTagList(current);
      return (selected.includes(tagId)
        ? selected.filter(item => item !== tagId)
        : [...selected, tagId]).join(', ');
    });
  };

  const addCustomWeaponTag = (value: string) => {
    const label = value.trim();
    const tagId = normalizeRuleTag(label);
    if (!tagId) return;
    const builtIn = BUILT_IN_RULE_TAGS.find(tag => tag.id === tagId);
    if (builtIn) {
      if (builtIn.appliesTo === 'weapon' || builtIn.appliesTo === 'both') {
        setTagText(current => {
          const selected = parseRuleTagList(current);
          return selected.includes(tagId) ? current : [...selected, tagId].join(', ');
        });
      }
      return;
    }
    const existing = campaignRuleTags.find(tag => tag.id === tagId);
    const nextTags = existing
      ? campaignRuleTags.map(tag => tag.id === tagId && tag.appliesTo === 'armor'
        ? { ...tag, appliesTo: 'both' as const }
        : tag)
      : [...campaignRuleTags, { id: tagId, label, appliesTo: 'weapon' as const }];
    saveCustomRules({ customWeaponMods, customPerks, campaignRuleTags: nextTags });
    setTagText(current => {
      const selected = parseRuleTagList(current);
      return selected.includes(tagId) ? current : [...selected, tagId].join(', ');
    });
  };

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
      customAreaEffects: category === 'minesTraps' && customAreaEffects.length ? customAreaEffects : undefined,
      areaRangeUnit: category === 'minesTraps' ? areaRangeUnit : undefined,
      hasBlastRadius: category === 'minesTraps' ? blastRadiusEnabled : undefined,
      emp: category === 'minesTraps' && empEnabled ? true : undefined,
      damageType, damageDieCount: dieCount, damageDie: dieSides,
      damageBonus, skill: (category === 'minesTraps' ? 'traps' : category === 'meleeWeapons' ? 'meleeWeapons' : category === 'unarmed' || category === 'natural' ? 'unarmed' : category === 'throwing' ? 'throwing' : category) as Weapon['skill'],
      burstLimit, isDoubleShot: isDoubleShot && canSingle, magazineSize,
      weight: 0, minStr, rangeNormal, knockdownChance: 0,
      apSingle: canSingle ? apSingle : null,
      apTargeted: canTarget ? apTargeted : null,
      apBurst: canBurst && burstLimit >= 3 ? apBurst : null,
      attackModes: { single: canSingle, targeted: canTarget, burst: canBurst && burstLimit >= 3 },
      hands,
      compatibleAmmo: ammoCompatibleCategory && compatibleAmmo.length > 0 ? compatibleAmmo : undefined,
      mods: selectedMods, isCustom: true, tags: parseRuleTagList(tagText),
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
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>
              {isEditing
                ? category === 'minesTraps' ? 'EDIT CUSTOM TRAP' : 'EDIT CUSTOM WEAPON'
                : isCreatingTrap ? 'CREATE CUSTOM TRAP' : 'CREATE CUSTOM WEAPON'}
            </Text>
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
                  {BUILT_IN_WEAPONS.filter(w => !isCreatingTrap || w.category === 'minesTraps').map(w => (
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
                  placeholder={category === 'minesTraps' ? 'Trap name*' : 'Weapon name*'} placeholderTextColor={colors.mutedForeground}
                  value={name} onChangeText={setName}
                />
                <SelectableTagMenu
                  title="WEAPON TAGS"
                  buttonLabel="SELECT WEAPON TAGS"
                  customTagButtonLabel="+ CUSTOM WEAPON TAG"
                  testID="custom-weapon-tag-menu"
                  options={visibleWeaponTags}
                  selectedTagIds={parseRuleTagList(tagText)}
                  onToggle={toggleWeaponTag}
                  onAddCustomTag={addCustomWeaponTag}
                />
                {/* Category */}
                {!isCreatingTrap && (
                  <>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CATEGORY</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {Object.entries(WEAPON_CATEGORIES).map(([label, val]) => (
                        <TouchableOpacity key={val} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: colors.radius, backgroundColor: category === val ? colors.primary : colors.secondary, borderWidth: 1, borderColor: category === val ? colors.primary : colors.border }} onPress={() => setCategory(val)}>
                          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: category === val ? colors.primaryForeground : colors.foreground }}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {/* Damage type */}
                {category === 'minesTraps' && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Optional preset trap behavior. Choose Custom profile to define a new blast.</Text>
                    {[undefined, 't13_antipersonnel_mine', 't45_se_antivehicle_mine'].map(id => (
                      <TouchableOpacity key={id ?? 'custom'} onPress={() => {
                        setAreaAttackProfileId(id);
                        if (id) setCustomAreaEffects([]);
                        setBlastRadiusEnabled(id === undefined
                          || id === 't13_antipersonnel_mine'
                          || id === 't45_se_antivehicle_mine');
                      }} style={{ padding: 8, borderWidth: 1, borderColor: areaAttackProfileId === id ? colors.primary : colors.border }}>
                        <Text style={{ color: colors.foreground }}>{id ? (BUILT_IN_WEAPONS.find(w => w.areaAttackProfileId === id)?.name ?? id) : 'Custom profile'}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      testID="custom-weapon-blast-radius-toggle"
                      accessibilityRole="switch"
                      accessibilityState={{ checked: blastRadiusEnabled }}
                      onPress={() => {
                        const enabled = !blastRadiusEnabled;
                        setBlastRadiusEnabled(enabled);
                      }}
                      style={{ padding: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: blastRadiusEnabled ? colors.primary : colors.border, backgroundColor: blastRadiusEnabled ? colors.primary + '22' : colors.secondary }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', color: blastRadiusEnabled ? colors.primary : colors.foreground }}>
                        BLAST RADIUS: {blastRadiusEnabled ? 'ON' : 'OFF'} {blastRadiusEnabled ? '⌃' : '⌄'}
                      </Text>
                    </TouchableOpacity>
                    {blastRadiusEnabled && !areaAttackProfileId && (
                      <CustomAreaEffectsEditor
                        effects={customAreaEffects}
                        onChange={effects => {
                          setCustomAreaEffects(effects);
                          if (effects.length) setAreaAttackProfileId(undefined);
                        }}
                        rangeUnit={areaRangeUnit}
                        onRangeUnitChange={setAreaRangeUnit}
                      />
                    )}
                    {blastRadiusEnabled && !blastProfileConfigured && (
                      <Text style={{ fontSize: 10, color: colors.destructive }}>
                        Select a preset blast or define a maximum range for every custom effect.
                      </Text>
                    )}
                    <TouchableOpacity
                      testID="custom-mine-emp-toggle"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: empEnabled }}
                      onPress={() => setEmpEnabled(enabled => !enabled)}
                      style={{ padding: 11, borderWidth: 1, borderColor: empEnabled ? colors.primary : colors.border, backgroundColor: empEnabled ? colors.primary + '22' : colors.secondary, borderRadius: colors.radius }}
                    >
                      <Text style={{ fontFamily: 'Inter_700Bold', color: empEnabled ? colors.primary : colors.foreground }}>
                        {empEnabled ? '✓ ' : ''}EMP ATTACK
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                      EMP affects electronic vehicle systems only; Structure, tires, and treads are unaffected.
                    </Text>
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
                <NumStepper label="Burst limit (maximum shots; minimum 3)" val={burstLimit} min={1} max={20} set={updateBurstLimit} />
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

                {/* Available attack modes and their manual AP costs */}
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1, marginTop: 6 }}>AVAILABLE ATTACKS & AP COSTS</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>Single attack (S)</Text>
                    <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Turn off for weapons that can only fire in another mode.</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="switch"
                    accessibilityState={{ checked: canSingle }}
                    style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, backgroundColor: canSingle ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => {
                      const next = !canSingle;
                      setCanSingle(next);
                      if (!next) setIsDoubleShot(false);
                    }}
                  >
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: canSingle ? colors.primaryForeground : colors.mutedForeground }}>{canSingle ? 'YES' : 'NO'}</Text>
                  </TouchableOpacity>
                </View>
                {canSingle && <NumStepper label="AP — Single attack (S)" val={apSingle} min={1} max={20} set={setApSingle} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>Targeted attack (T)</Text>
                  <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: canTarget }} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, backgroundColor: canTarget ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => setCanTarget(v => !v)}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: canTarget ? colors.primaryForeground : colors.mutedForeground }}>{canTarget ? 'YES' : 'NO'}</Text>
                  </TouchableOpacity>
                </View>
                {canTarget && <NumStepper label="AP — Targeted attack (T)" val={apTargeted} min={1} max={20} set={setApTargeted} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground }}>Burst attack (B)</Text>
                    <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Manual bursts require at least 3 shots.</Text>
                  </View>
                  <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: canBurst }} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4, backgroundColor: canBurst ? colors.primary : colors.secondary, borderWidth: 1, borderColor: colors.border }} onPress={() => {
                    if (!canBurst) {
                      if (burstLimit < 3) setBurstLimit(3);
                      setCanBurst(true);
                    } else {
                      setCanBurst(false);
                    }
                  }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: canBurst ? colors.primaryForeground : colors.mutedForeground }}>{canBurst ? 'YES' : 'NO'}</Text>
                  </TouchableOpacity>
                </View>
                {canBurst && <NumStepper label="AP — Burst attack (B)" val={apBurst} min={1} max={20} set={setApBurst} />}
              </>
            )}

            {tab === 'mods' && (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showCustomModsManager }}
                  onPress={() => setShowCustomModsManager(value => !value)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 11, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primary + '16' }}
                >
                  <Feather name={showCustomModsManager ? 'minus-circle' : 'plus-circle'} size={15} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6 }}>
                    {showCustomModsManager ? 'HIDE CUSTOM MODS' : '+ CUSTOM MOD'}
                  </Text>
                </TouchableOpacity>
                {showCustomModsManager && <CustomRulesPanel section="mods" />}
                {(() => {
                  const summaryParts: string[] = [];
                  if (modEffects.toHit !== 0) summaryParts.push(`${modEffects.toHit > 0 ? '+' : ''}${modEffects.toHit}% to-hit`);
                  if (modEffects.damage !== 0) summaryParts.push(`${modEffects.damage > 0 ? '+' : ''}${modEffects.damage} damage`);
                  if (modEffects.range !== 0) summaryParts.push(`+${modEffects.range}m range`);
                  if (customModEffects.toHit !== 0) summaryParts.push(`${customModEffects.toHit > 0 ? '+' : ''}${customModEffects.toHit}% custom to-hit`);
                  if (customModEffects.range !== 0) summaryParts.push(`${customModEffects.range > 0 ? '+' : ''}${customModEffects.range} sq custom range`);
                  if (customModEffects.damageComponents.length) summaryParts.push(`${customModEffects.damageComponents.length} typed damage/radiation component(s)`);
                  if (customModEffects.apDiscount) summaryParts.push(`−${customModEffects.apDiscount} AP per attack`);
                  if (customModEffects.ignoreDT) summaryParts.push(`ignores ${customModEffects.ignoreDT} DT`);
                  if (customModEffects.reloadApOverride !== undefined) summaryParts.push(`reload ${customModEffects.reloadApOverride} AP`);
                  if (customModEffects.magazineMult !== 1) summaryParts.push(`×${customModEffects.magazineMult} custom magazine`);
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
                    <View style={{ backgroundColor: colors.success + '22', borderRadius: colors.radius, padding: 10, gap: 2, borderWidth: 1, borderColor: colors.success + '66' }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.success, letterSpacing: 1 }}>ACTIVE MOD EFFECTS</Text>
                      {summaryParts.map((p, i) => (
                        <Text key={i} style={{ fontSize: 12, color: colors.success }}>{p}</Text>
                      ))}
                    </View>
                  ) : null;
                })()}
                {availableMods.length === 0 && availableCustomMods.length === 0 && (
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
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.success, marginTop: 1 }}>{behavior}</Text>
                        ) : null}
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 }}>{mod.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {availableCustomMods.map(mod => {
                  const active = selectedMods.includes(mod.id);
                  const summary = mod.effects.map(effect =>
                    `${effect.kind}${effect.damageType ? ` ${effect.damageType}` : ''} ${effect.value >= 0 ? '+' : ''}${effect.value}`,
                  ).join(' · ');
                  return (
                    <TouchableOpacity key={mod.id} style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '22' : colors.secondary, gap: 10 }} onPress={() => toggleMod(mod.id)}>
                      <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: active ? colors.primary : colors.mutedForeground, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : 'transparent', marginTop: 1 }}>
                        {active && <Feather name="check" size={12} color={colors.primaryForeground} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: active ? colors.primary : colors.foreground }}>{mod.name} · CUSTOM</Text>
                        {mod.programmatic && !!summary && <Text style={{ fontSize: 10, color: colors.success, marginTop: 1 }}>{summary}</Text>}
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>{mod.description || 'No description provided.'}</Text>
                        {!mod.programmatic && <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2 }}>Contextual description only; no automatic combat effects.</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity style={{ paddingVertical: 14, borderRadius: colors.radius, alignItems: 'center', backgroundColor: isValid ? colors.primary : colors.secondary, opacity: isValid ? 1 : 0.5 }} onPress={handleSave} disabled={!isValid}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: isValid ? colors.primaryForeground : colors.mutedForeground }}>
                {isEditing ? 'SAVE CHANGES' : category === 'minesTraps' ? 'CREATE TRAP' : 'CREATE WEAPON'}
              </Text>
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
  const [tagText, setTagText] = useState('');
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
    setTagText((a.tags ?? []).join(', '));
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
      setTagText('');
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
      acBonus, weight: 0, isCustom: true, tags: parseRuleTagList(tagText),
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
                <TextInput
                  style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 12 }}
                  placeholder="Armor tags (e.g. power-armor, radiation-suit)"
                  placeholderTextColor={colors.mutedForeground}
                  value={tagText}
                  onChangeText={setTagText}
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

// ─── Consumable Form Modal ────────────────────────────────────────────────────
function ConsumableFormModal({ visible, onClose, onSave, editConsumable, catalog }: {
  visible: boolean;
  onClose: () => void;
  onSave: (consumable: CustomConsumable) => void;
  editConsumable?: CustomConsumable | null;
  catalog: readonly CustomConsumable[];
}) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ConsumableCategory>('other');
  const [value, setValue] = useState(0);
  const [description, setDescription] = useState('');
  const [effectText, setEffectText] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    setName(editConsumable?.name ?? '');
    setCategory(editConsumable?.category ?? 'other');
    setValue(editConsumable?.value ?? 0);
    setDescription(editConsumable?.description ?? '');
    setEffectText(editConsumable?.effectText ?? '');
  }, [visible, editConsumable]);

  const candidate: CustomConsumable = {
    id: editConsumable?.id ?? '__new_custom_consumable__',
    name: name.trim(),
    category,
    value,
    description: description.trim(),
    effectText: effectText.trim(),
    isCustom: true,
  };
  const validationCatalog = catalog.filter(item => item.id !== editConsumable?.id);
  const errors = validateCustomConsumable(candidate, validationCatalog);
  const isValid = name.trim().length > 0 && errors.length === 0;
  const categoryLabels: Record<ConsumableCategory, string> = {
    chem: 'CHEM',
    medical: 'MEDICAL',
    food: 'FOOD',
    drink: 'DRINK',
    other: 'OTHER',
  };

  const save = () => {
    if (!isValid) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave({ ...candidate, id: editConsumable?.id ?? genId() });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ maxHeight: '94%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>
              {editConsumable ? 'EDIT CUSTOM CONSUMABLE' : 'CREATE CUSTOM CONSUMABLE'}
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close consumable editor">
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 13, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <TextInput
              testID="custom-consumable-name"
              style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: name.trim() ? colors.border : colors.destructive + '88', borderRadius: colors.radius, padding: 12, color: colors.foreground }}
              placeholder="Consumable name*"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              maxLength={120}
            />
            <View style={{ gap: 7 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>CATEGORY</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {CONSUMABLE_CATEGORIES.map(item => (
                  <TouchableOpacity
                    key={item}
                    testID={`custom-consumable-category-${item}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === item }}
                    onPress={() => setCategory(item)}
                    style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: colors.radius, backgroundColor: category === item ? colors.primary : colors.secondary, borderWidth: 1, borderColor: category === item ? colors.primary : colors.border }}
                  >
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: category === item ? colors.primaryForeground : colors.mutedForeground }}>
                      {categoryLabels[item]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1 }}>VALUE (CAPS)</Text>
              <TextInput
                testID="custom-consumable-value"
                style={{ backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 11, color: colors.foreground }}
                keyboardType="number-pad"
                value={String(value)}
                onChangeText={text => {
                  const parsed = Number.parseInt(text, 10);
                  setValue(Number.isFinite(parsed) ? Math.max(0, Math.min(1_000_000, parsed)) : 0);
                }}
              />
            </View>
            <TextInput
              testID="custom-consumable-description"
              style={{ minHeight: 82, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 11, color: colors.foreground, textAlignVertical: 'top' }}
              multiline
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              maxLength={4000}
            />
            <TextInput
              testID="custom-consumable-effect-notes"
              style={{ minHeight: 82, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 11, color: colors.foreground, textAlignVertical: 'top' }}
              multiline
              placeholder="Effects / use notes (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={effectText}
              onChangeText={setEffectText}
              maxLength={4000}
            />
            <Text style={{ fontSize: 11, lineHeight: 16, color: colors.mutedForeground }}>
              Custom effect notes are descriptive for now; they do not automatically change character stats or combat.
            </Text>
            {!isValid && errors[0] && <Text style={{ fontSize: 11, color: colors.destructive }}>{errors[0]}</Text>}
          </ScrollView>
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <TouchableOpacity
              testID="custom-consumable-save"
              disabled={!isValid}
              onPress={save}
              style={{ paddingVertical: 14, alignItems: 'center', borderRadius: colors.radius, backgroundColor: isValid ? colors.primary : colors.secondary, opacity: isValid ? 1 : 0.5 }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: isValid ? colors.primaryForeground : colors.mutedForeground }}>
                {editConsumable ? 'SAVE CHANGES' : 'CREATE CONSUMABLE'}
              </Text>
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
  const [areaEffects, setAreaEffects] = useState<CustomAreaEffect[]>([]);
  const [areaRangeUnit, setAreaRangeUnit] = useState<AreaRangeUnit>('hex');
  const [blastRadiusEnabled, setBlastRadiusEnabled] = useState(false);
  const [empEnabled, setEmpEnabled] = useState(false);

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
      setAreaEffects((editAmmo.areaEffects ?? []).map(effect => ({ ...effect })));
      setAreaRangeUnit(editAmmo.areaRangeUnit ?? 'hex');
      setBlastRadiusEnabled(editAmmo.hasBlastRadius ?? !!editAmmo.areaEffects?.length);
      setEmpEnabled(!!editAmmo.emp);
      setComponents((editAmmo.components ?? [{
        id: genId(), label: 'Damage', type: 'normal',
        dmgDieCount: editAmmo.dmgDieCount, dmgDie: editAmmo.dmgDie, dmgBonus: editAmmo.dmgBonus,
      }]).map(component => ({ ...component })));
    } else {
      setName(''); setAcMod(0); setDrMod(0); setIgnoresDT(false); setNotes('');
      setPoisonEnabled(false); setPoisonType('A'); setPoisonEffect('');
      setAreaEffects([]); setAreaRangeUnit('hex');
      setBlastRadiusEnabled(false);
      setEmpEnabled(false);
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
    areaEffects: areaEffects.length ? areaEffects : undefined,
    areaRangeUnit: areaEffects.length ? areaRangeUnit : undefined,
    hasBlastRadius: blastRadiusEnabled,
    emp: empEnabled ? true : undefined,
    isCustom: true,
  };
  const validationCatalog = catalog.filter(ammo => ammo.id !== editAmmo?.id && ammo.id !== '__new_custom_ammo__');
  const errors = validateCustomAmmo(candidate, validationCatalog);
  const blastRadiusConfigured = !blastRadiusEnabled
    || (areaEffects.length > 0
      && areaEffects.every(effect => effect.radius !== undefined)
      && validateCustomAreaEffects(areaEffects, areaRangeUnit).length === 0);
  const isValid = errors.length === 0
    && validateCustomAreaEffects(areaEffects, areaRangeUnit).length === 0
    && (!poisonEnabled || poisonEffect.trim().length > 0)
    && blastRadiusConfigured;

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

            <TouchableOpacity
              testID="custom-ammo-emp-toggle"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: empEnabled }}
              onPress={() => setEmpEnabled(enabled => !enabled)}
              style={{ padding: 11, borderWidth: 1, borderColor: empEnabled ? colors.primary : colors.border, backgroundColor: empEnabled ? colors.primary + '22' : colors.secondary, borderRadius: colors.radius }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: empEnabled ? colors.primary : colors.foreground }}>
                {empEnabled ? '✓ ' : ''}EMP ATTACK
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
              EMP affects electronic vehicle systems only; Structure, tires, and treads are unaffected.
            </Text>

            <TouchableOpacity
              testID="custom-ammo-blast-radius-toggle"
              accessibilityRole="switch"
              accessibilityState={{ checked: blastRadiusEnabled }}
              onPress={() => setBlastRadiusEnabled(value => !value)}
              style={{ padding: 11, borderWidth: 1, borderColor: blastRadiusEnabled ? colors.primary : colors.border, backgroundColor: blastRadiusEnabled ? colors.primary + '22' : colors.secondary, borderRadius: colors.radius }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: blastRadiusEnabled ? colors.primary : colors.foreground }}>
                BLAST RADIUS: {blastRadiusEnabled ? 'ON' : 'OFF'} {blastRadiusEnabled ? '⌃' : '⌄'}
              </Text>
            </TouchableOpacity>
            {blastRadiusEnabled && (
              <CustomAreaEffectsEditor
                effects={areaEffects}
                onChange={setAreaEffects}
                rangeUnit={areaRangeUnit}
                onRangeUnitChange={setAreaRangeUnit}
              />
            )}
            {blastRadiusEnabled && !blastRadiusConfigured && (
              <Text style={{ fontSize: 10, color: colors.destructive }}>
                Add at least one valid area effect and set a maximum range for each effect.
              </Text>
            )}

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
  const { customWeaponMods } = useApp();
  const modEffects = computeModEffects(weapon.mods);
  const modDefs = weapon.mods.map(id => WEAPON_MOD_DEFS.find(m => m.id === id)).filter((m): m is WeaponModDef => !!m);
  const customModDefs = weapon.mods.map(id => customWeaponMods.find(mod => mod.id === id)).filter((mod): mod is NonNullable<typeof mod> => !!mod);
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
                <View key={mod.id} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.success + '22', borderRadius: 3, borderWidth: 1, borderColor: colors.success + '66' }}>
                  <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.success }}>
                    {mod.name}{behavior ? ` · ${behavior}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        {customModDefs.length > 0 && (
          <View style={{ marginTop: 4, gap: 3 }}>
            {customModDefs.map(mod => (
              <View key={mod.id} style={{ paddingHorizontal: 7, paddingVertical: 4, backgroundColor: colors.primary + '16', borderRadius: 4, borderWidth: 1, borderColor: colors.primary + '55' }}>
                <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary }}>{mod.name} · CUSTOM</Text>
                {!!mod.description && <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>{mod.description}</Text>}
                {!mod.programmatic && <Text style={{ fontSize: 9, color: colors.mutedForeground }}>Contextual only · no automatic combat math</Text>}
              </View>
            ))}
          </View>
        )}
        {!!weapon.tags?.length && (
          <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 3 }}>Tags: {weapon.tags.join(', ')}</Text>
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
              {dr > 0 && <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.success }}>DR {dr}%</Text>}
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
    ...(ammo.emp ? [{ label: 'EMP · ELECTRONIC SYSTEMS', emphasized: true }] : []),
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

interface EquipmentConsumableRow {
  id: string;
  name: string;
  category: ConsumableCategory;
  value: number | null;
  description: string;
  effectText: string;
  isCustom: boolean;
}

function ConsumableRow({ consumable, onCopy, onEdit, onDelete }: {
  consumable: EquipmentConsumableRow;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: colors.radius, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{consumable.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.5 }}>{consumable.category.toUpperCase()}</Text>
            </View>
            {consumable.isCustom && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary }}>
                <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 0.5 }}>CUSTOM</Text>
              </View>
            )}
            <Text style={{ alignSelf: 'center', fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>
              {consumable.value === null ? 'NO LISTED VALUE' : `${consumable.value.toLocaleString()} CAPS`}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {onCopy && <TouchableOpacity onPress={onCopy} style={{ padding: 6 }} accessibilityLabel={`Copy ${consumable.name} as a custom consumable`}><Feather name="copy" size={16} color={colors.mutedForeground} /></TouchableOpacity>}
          {onEdit && <TouchableOpacity onPress={onEdit} style={{ padding: 6 }} accessibilityLabel={`Edit ${consumable.name}`}><Feather name="edit-2" size={16} color={colors.primary} /></TouchableOpacity>}
          {onDelete && <TouchableOpacity onPress={onDelete} style={{ padding: 6 }} accessibilityLabel={`Delete ${consumable.name}`}><Feather name="trash-2" size={16} color={colors.destructive} /></TouchableOpacity>}
        </View>
      </View>
      {consumable.description ? (
        <Text style={{ fontSize: 12, lineHeight: 17, color: colors.mutedForeground }}>{consumable.description}</Text>
      ) : null}
      {consumable.effectText ? (
        <View style={{ padding: 9, borderRadius: 5, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 11, lineHeight: 16, color: colors.foreground }}>{consumable.effectText}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Vehicle catalog row ──────────────────────────────────────────────────────
function VehicleRow({ vehicle, onView, onCopy, onEdit, onDelete }: {
  vehicle: VehicleProfile;
  onView: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ position: 'relative', overflow: 'hidden', marginHorizontal: 16, marginBottom: 10, padding: 12, gap: 8, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: vehicle.portrait ? 'transparent' : colors.card }}>
      <PortraitCardBackground
        uri={vehicle.portrait}
        fit={vehicle.portraitFit ?? 'cover'}
        offset={vehicle.portraitOffset}
        scrimColor={colors.card}
      />
      <TouchableOpacity
        onPress={onView}
        accessibilityRole="button"
        accessibilityLabel={`View ${vehicle.name} stats and spawn`}
        style={{ gap: 8 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {!vehicle.portrait && <View style={{ width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}><Feather name="truck" size={19} color={colors.mutedForeground} /></View>}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' }}>{vehicle.name}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
              {VEHICLE_CATEGORIES[vehicle.category].toUpperCase()} · AC {vehicle.armorClass} · {vehicle.fuelCharges === null ? 'NO FUEL' : `${vehicle.fuelCharges} CHARGES`}
            </Text>
          </View>
          {vehicle.isCustom && <Text style={{ fontSize: 9, color: colors.primary, fontFamily: 'Inter_700Bold' }}>CUSTOM</Text>}
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </View>
        {vehicle.description ? <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{vehicle.description}</Text> : null}
        <Text style={{ color: colors.primary, fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>VIEW FULL STATS · SPAWN</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <TouchableOpacity onPress={onCopy} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 7 }} accessibilityLabel={`Copy ${vehicle.name} as a custom vehicle`}>
          <Feather name="copy" size={14} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' }}>CUSTOMIZE COPY</Text>
        </TouchableOpacity>
        {onEdit && <TouchableOpacity onPress={onEdit} style={{ padding: 7 }} accessibilityLabel={`Edit ${vehicle.name}`}><Feather name="edit-2" size={15} color={colors.primary} /></TouchableOpacity>}
        {onDelete && <TouchableOpacity onPress={onDelete} style={{ padding: 7 }} accessibilityLabel={`Delete ${vehicle.name}`}><Feather name="trash-2" size={15} color={colors.destructive} /></TouchableOpacity>}
      </View>
    </View>
  );
}

function VehicleDetailsModal({ vehicle, onClose, onSpawn, onCopy, onEdit, onSetPortrait }: {
  vehicle: VehicleProfile | null;
  onClose: () => void;
  onSpawn: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onSetPortrait: (selection: import('@/context/types').CatalogPortraitSelection) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [cropDragging, setCropDragging] = useState(false);
  if (!vehicle) return null;
  const performance = resolveVehiclePerformance(vehicle);
  const structure = performance.systems.find(system => system.kind === 'structure') ?? performance.systems[0];
  const detailRows: [string, string][] = [
    ['Top speed', performance.topSpeedKph === null ? '—' : `${performance.topSpeedKph} km/h`],
    ['Acceleration', performance.accelerationKphPerRound === null ? '—' : `${performance.accelerationKphPerRound} km/h per round`],
    ['Braking', performance.brakingKphPerRound === null ? '—' : `${performance.brakingKphPerRound} km/h per round`],
    ['Turning radius', performance.turningRadiusMeters === null ? '—' : `${performance.turningRadiusMeters} m`],
    ['Range', performance.rangeKm === null ? '—' : `${performance.rangeKm} km`],
    ['Passengers', performance.passengers || '—'],
    ['Cargo capacity', performance.carryingWeightLb ? `${performance.carryingWeightLb} lb` : '—'],
    ['Fuel charges', performance.fuelCharges === null ? 'No fuel use' : `${performance.fuelCharges}`],
    ['Terrain pilot modifier', `${performance.terrainPilotModifier >= 0 ? '+' : ''}${performance.terrainPilotModifier}%`],
  ];
  const resistanceRows: [string, number][] = [
    ['Normal DR', performance.damageResistance.normal],
    ['Laser DR', performance.damageResistance.laser],
    ['Fire DR', performance.damageResistance.fire],
    ['Plasma DR', performance.damageResistance.plasma],
    ['Explosive DR', performance.damageResistance.explosion],
  ];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' }}>
        <View style={{ maxHeight: '92%', paddingTop: Math.max(insets.top, 12), paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: 1.2 }}>{vehicle.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 10 }}>
                {VEHICLE_CATEGORIES[vehicle.category]} · AC {vehicle.armorClass} · Structure {structure?.maxHp ?? 0} HP
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close vehicle details" style={{ padding: 8 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView
            scrollEnabled={!cropDragging}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <CatalogImageEditor
              uri={vehicle.portrait}
              name={vehicle.name}
              portraitFit={vehicle.portraitFit}
              portraitOffset={vehicle.portraitOffset}
              onChange={onSetPortrait}
              onDragStateChange={setCropDragging}
              testID={`vehicle-photo-${vehicle.id}`}
            />
            {vehicle.description ? <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}>{vehicle.description}</Text> : null}
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, overflow: 'hidden' }}>
              {detailRows.map(([label, value]) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 11, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
                  <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 11 }}>{label}</Text>
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 11, textAlign: 'right', fontFamily: 'Inter_600SemiBold' }}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>DAMAGE RESISTANCES</Text>
              {resistanceRows.map(([label, value]) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontSize: 11 }}>{label}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 11, fontFamily: 'Inter_700Bold' }}>{value}%</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>SYSTEMS</Text>
              {performance.systems.map(system => (
                <View key={system.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 11 }}>{system.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{system.maxHp} HP</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>MOUNTED WEAPONS</Text>
              {vehicle.mountedWeapons.length
                ? vehicle.mountedWeapons.map((weapon, index) => (
                  <Text key={`${index}-${weapon}`} style={{ color: colors.foreground, fontSize: 11, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}>{weapon}</Text>
                ))
                : <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>No mounted weapons</Text>}
            </View>
            {vehicle.enhancements.length > 0 && (
              <View style={{ gap: 5 }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>ENHANCEMENTS</Text>
                {vehicle.enhancements.map((value, index) => <Text key={`${index}-${value}`} style={{ color: colors.foreground, fontSize: 11 }}>• {value}</Text>)}
                {vehicleUpgradePlayNotes(vehicle).map((value, index) => <Text key={`upgrade-effect-${index}`} style={{ color: colors.primary, fontSize: 10 }}>EFFECT: {value}</Text>)}
                <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{vehiclePerformanceSummary(vehicle)}</Text>
              </View>
            )}
            {vehicle.notes.length > 0 && (
              <View style={{ gap: 5 }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>NOTES</Text>
                {vehicle.notes.map((value, index) => <Text key={`${index}-${value}`} style={{ color: colors.mutedForeground, fontSize: 11 }}>• {value}</Text>)}
              </View>
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
            {onEdit && <TouchableOpacity onPress={onEdit} style={{ paddingHorizontal: 12, justifyContent: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' }}>EDIT</Text>
            </TouchableOpacity>}
            <TouchableOpacity onPress={onCopy} style={{ paddingHorizontal: 12, justifyContent: 'center', borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' }}>CUSTOMIZE COPY</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSpawn} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: colors.radius, backgroundColor: colors.primary }}>
              <Feather name="plus" size={15} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.8 }}>SPAWN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Equipment Screen ─────────────────────────────────────────────────────────
export default function EquipmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    customWeapons, customArmor, customAmmo, allAmmo, customConsumables, customVehicles, allVehicles,
    vehicleCatalogPortraits, vehicleCatalogPortraitSettings, setVehicleCatalogPortrait,
    addCharacter,
    addCustomWeapon, updateCustomWeapon, deleteCustomWeapon,
    addCustomArmor, updateCustomArmor, deleteCustomArmor,
    addCustomAmmo, updateCustomAmmo, deleteCustomAmmo,
    addCustomConsumable, updateCustomConsumable, deleteCustomConsumable,
    addCustomVehicle, updateCustomVehicle, deleteCustomVehicle,
  } = useApp();
  const [tab, setTab] = useState<'weapons' | 'traps' | 'armor' | 'ammo' | 'consumables' | 'tools' | 'vehicles'>('weapons');
  const [showWeaponForm, setShowWeaponForm] = useState(false);
  const [initialWeaponCategory, setInitialWeaponCategory] = useState<WeaponCategory | undefined>();
  const [showArmorForm, setShowArmorForm] = useState(false);
  const [showAmmoForm, setShowAmmoForm] = useState(false);
  const [showConsumableForm, setShowConsumableForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState<VehicleProfile | null>(null);
  const [editingWeapon, setEditingWeapon] = useState<Weapon | null>(null);
  const [editingArmor, setEditingArmor] = useState<Armor | null>(null);
  const [editingAmmo, setEditingAmmo] = useState<AmmoType | null>(null);
  const [editingConsumable, setEditingConsumable] = useState<CustomConsumable | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<VehicleProfile | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<WeaponCategory | 'all' | 'custom'>('all');
  const [armorFilter, setArmorFilter] = useState<'all' | 'custom'>('all');
  const [consumableFilter, setConsumableFilter] = useState<'all' | 'custom'>('all');
  const consumableRows: EquipmentConsumableRow[] = [
    ...CHEMS.map(chem => ({
      id: chem.id,
      name: chem.name,
      category: 'chem' as const,
      value: chem.value ?? null,
      description: chem.description,
      effectText: chem.stages.map(stage =>
        `${stage.label}: ${stage.notes ?? 'See stage details'} (${stage.durationText})`,
      ).join('\n'),
      isCustom: false,
    })),
    ...ALCOHOL_CONSUMABLES.map(alcohol => ({
      id: alcohol.id,
      name: alcohol.name,
      category: 'drink' as const,
      value: null,
      description: alcohol.description,
      effectText: 'Activates the Drunk condition only. The manual gives no universal duration or stat modifiers.',
      isCustom: false,
    })),
    ...customConsumables.map(consumable => ({
      ...consumable,
      value: consumable.value,
      isCustom: true,
    })),
  ];
  const catalogVehicles = allVehicles.map(vehicle => ({
    ...vehicle,
    portrait: vehicle.isCustom
      ? vehicle.portrait
      : vehicleCatalogPortraits[vehicle.id] ?? vehicle.portrait,
    portraitFit: vehicle.isCustom
      ? vehicle.portraitFit
      : vehicleCatalogPortraitSettings[vehicle.id]?.portraitFit ?? vehicle.portraitFit,
    portraitOffset: vehicle.isCustom
      ? vehicle.portraitOffset
      : vehicleCatalogPortraitSettings[vehicle.id]?.portraitOffset ?? vehicle.portraitOffset,
  }));
  const selectedVehicle = vehicleDetails
    ? catalogVehicles.find(vehicle => vehicle.id === vehicleDetails.id) ?? vehicleDetails
    : null;
  const { manualTab, manualCategory, manualSearch } = useLocalSearchParams<{
    manualTab?: string;
    manualCategory?: string;
    manualSearch?: string;
  }>();

  useEffect(() => {
    if (!manualTab) return;

    if (manualTab === 'weapons' || manualTab === 'traps' || manualTab === 'armor' || manualTab === 'ammo' || manualTab === 'consumables' || manualTab === 'tools') {
      const weaponTrapsLink = manualTab === 'weapons' && manualCategory === 'minesTraps';
      setTab(weaponTrapsLink ? 'traps' : manualTab);
      setSearch(typeof manualSearch === 'string' ? manualSearch : '');
      if (weaponTrapsLink) setCategoryFilter('all');
      if (
        manualTab === 'weapons'
        && manualCategory !== 'minesTraps'
        && (manualCategory === 'all' || WEAPON_CATEGORY_ORDER.includes(manualCategory as WeaponCategory))
      ) {
        setCategoryFilter(manualCategory as WeaponCategory | 'all');
      }
    }

    router.setParams({ manualTab: '', manualCategory: '', manualSearch: '' });
  }, [manualCategory, manualSearch, manualTab]);

  const openNewWeapon = () => { setEditingWeapon(null); setInitialWeaponCategory(undefined); setShowWeaponForm(true); };
  const openNewTrap = () => { setEditingWeapon(null); setInitialWeaponCategory('minesTraps'); setShowWeaponForm(true); };
  const openNewArmor = () => { setEditingArmor(null); setShowArmorForm(true); };
  const openNewAmmo = () => { setEditingAmmo(null); setShowAmmoForm(true); };
  const openNewConsumable = () => { setEditingConsumable(null); setShowConsumableForm(true); };
  const openNewVehicle = () => {
    setEditingVehicle({
      id: genId(), name: '', category: 'car', description: '', isCustom: true,
      topSpeedKph: null, accelerationKphPerRound: null, brakingKphPerRound: null,
      turningRadiusMeters: null, rangeKm: null, passengers: '', carryingWeightLb: '',
      fuelCharges: null, armorClass: 0,
      damageResistance: { normal: 0, laser: 0, fire: 0, plasma: 0, explosion: 0 },
      systems: [{ id: 'structure', name: 'Structure', kind: 'structure', currentHp: 100, maxHp: 100 }],
      mountedWeapons: [], enhancements: [], notes: [], terrainPilotModifier: 0, inMotion: true,
    });
    setShowVehicleForm(true);
  };
  const openEditWeapon = (w: Weapon) => { setEditingWeapon(w); setInitialWeaponCategory(undefined); setShowWeaponForm(true); };
  const openEditArmor = (a: Armor) => { setEditingArmor(a); setShowArmorForm(true); };
  const openEditAmmo = (ammo: AmmoType) => { setEditingAmmo(ammo); setShowAmmoForm(true); };
  const openEditConsumable = (consumable: CustomConsumable) => { setEditingConsumable(consumable); setShowConsumableForm(true); };
  const openEditVehicle = (vehicle: VehicleProfile) => { setEditingVehicle(vehicle); setShowVehicleForm(true); };
  const spawnSelectedVehicle = () => {
    if (!selectedVehicle) return;
    addCharacter(spawnVehicleCharacter(selectedVehicle, genId()));
    setVehicleDetails(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  // Duplicate: open the creator pre-filled from an existing weapon/armor as a NEW custom.
  const openCopyWeapon = (w: Weapon) => { setEditingWeapon({ ...w, id: genId(), name: `${w.name} (Copy)`, isCustom: true }); setInitialWeaponCategory(undefined); setShowWeaponForm(true); };
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
  const openCopyConsumable = (consumable: EquipmentConsumableRow) => {
    setEditingConsumable({
      id: genId(),
      name: `${consumable.name} (Copy)`,
      category: consumable.category,
      value: consumable.value ?? 0,
      description: consumable.description,
      effectText: consumable.effectText,
      isCustom: true,
    });
    setShowConsumableForm(true);
  };
  const openCopyVehicle = (vehicle: VehicleProfile) => {
    setEditingVehicle({
      ...vehicle,
      id: genId(),
      name: `${vehicle.name} (Copy)`,
      isCustom: true,
      systems: vehicle.systems.map(system => ({ ...system, id: genId(), currentHp: system.maxHp })),
    });
    setShowVehicleForm(true);
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
    w.category !== 'minesTraps' &&
    (!search || w.name.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === 'all' || (categoryFilter === 'custom' ? !!w.isCustom : w.category === categoryFilter))
  );
  const filteredTraps = allWeapons.filter(w =>
    w.category === 'minesTraps'
    && (!search || w.name.toLowerCase().includes(search.toLowerCase())));
  const filteredArmor = allArmor.filter(a =>
    (!search || a.name.toLowerCase().includes(search.toLowerCase()))
    && (armorFilter === 'all' || !!a.isCustom)
  );
  const filteredAmmo = allAmmo.filter(ammo => !search || ammo.name.toLowerCase().includes(search.toLowerCase()));
  const filteredConsumables = consumableRows.filter(consumable =>
    (consumableFilter === 'all' || consumable.isCustom)
    && (!search || `${consumable.name} ${consumable.category} ${consumable.description} ${consumable.effectText}`
      .toLowerCase().includes(search.toLowerCase())));
  const filteredVehicles = catalogVehicles.filter(vehicle =>
    !search || `${vehicle.name} ${vehicle.description} ${vehicle.category} ${vehicle.mountedWeapons.join(' ')}`
      .toLowerCase().includes(search.toLowerCase()));
  const filteredTools = BUILT_IN_TOOLS.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase()));
  const equipmentTabs = [
    { key: 'weapons', label: `WEAPONS (${filteredWeapons.length})` },
    { key: 'traps', label: `TRAPS (${filteredTraps.length})` },
    { key: 'armor', label: `ARMOR (${filteredArmor.length})` },
    { key: 'ammo', label: `AMMO (${filteredAmmo.length})` },
    { key: 'consumables', label: `CONSUMABLES (${filteredConsumables.length})` },
    { key: 'tools', label: `TOOLS (${filteredTools.length})` },
    { key: 'vehicles', label: `VEHICLES (${filteredVehicles.length})` },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      {/* Header */}
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>EQUIPMENT</Text>
          {tab !== 'tools' && <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary, borderRadius: colors.radius }}
            onPress={() => {
              if (tab === 'weapons') openNewWeapon();
              else if (tab === 'traps') openNewTrap();
              else if (tab === 'armor') openNewArmor();
              else if (tab === 'ammo') openNewAmmo();
              else if (tab === 'consumables') openNewConsumable();
              else openNewVehicle();
            }}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>
              {tab === 'weapons' ? 'CUSTOM WEAPON' : tab === 'traps' ? 'CUSTOM TRAP' : tab === 'armor' ? 'CUSTOM ARMOR' : tab === 'ammo' ? 'CUSTOM AMMO' : tab === 'consumables' ? 'CUSTOM CONSUMABLE' : 'CUSTOM VEHICLE'}
            </Text>
          </TouchableOpacity>}
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
        <ScrollableTabStrip accessibilityLabel="Equipment categories" colors={colors} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {equipmentTabs.map(item => (
            <TouchableOpacity
              key={item.key}
              testID={`equipment-tab-${item.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === item.key }}
              style={{ flexShrink: 0, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', borderRadius: colors.radius, backgroundColor: tab === item.key ? colors.primary : colors.secondary, borderWidth: 1, borderColor: tab === item.key ? colors.primary : colors.border }}
              onPress={() => setTab(item.key)}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: tab === item.key ? colors.primaryForeground : colors.mutedForeground }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollableTabStrip>

        {/* Category filter chips (weapons only) */}
        {tab === 'weapons' && (
          <ScrollableTabStrip
            accessibilityLabel="Weapon types"
            colors={colors}
            contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}
          >
            {(['all', ...WEAPON_CATEGORY_ORDER.filter(category => category !== 'minesTraps'), 'custom'] as const).map(cat => {
              const active = categoryFilter === cat;
              const label = cat === 'all' ? 'All' : cat === 'custom' ? 'Custom' : WEAPON_CATEGORY_LABELS[cat];
              return (
                <TouchableOpacity key={cat} testID={`equipment-weapon-filter-${cat}`} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: colors.radius, backgroundColor: active ? colors.primary : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border }} onPress={() => setCategoryFilter(cat)}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: active ? colors.primaryForeground : colors.mutedForeground }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollableTabStrip>
        )}
        {tab === 'armor' && (
          <ScrollableTabStrip
            accessibilityLabel="Armor filters"
            colors={colors}
            contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}
          >
            {(['all', 'custom'] as const).map(filter => {
              const active = armorFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  testID={`equipment-armor-filter-${filter}`}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: colors.radius, backgroundColor: active ? colors.primary : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}
                  onPress={() => setArmorFilter(filter)}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: active ? colors.primaryForeground : colors.mutedForeground }}>
                    {filter === 'all' ? 'All' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollableTabStrip>
        )}
        {tab === 'consumables' && (
          <ScrollableTabStrip
            accessibilityLabel="Consumable filters"
            colors={colors}
            contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}
          >
            {(['all', 'custom'] as const).map(filter => {
              const active = consumableFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  testID={`equipment-consumable-filter-${filter}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: colors.radius, backgroundColor: active ? colors.primary : colors.secondary, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}
                  onPress={() => setConsumableFilter(filter)}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, color: active ? colors.primaryForeground : colors.mutedForeground }}>
                    {filter === 'all' ? 'All' : 'Custom'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollableTabStrip>
        )}
      </View>

      {/* List */}
      {tab === 'weapons' ? (
        <MouseDraggableFlatList
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
      ) : tab === 'traps' ? (
        <MouseDraggableFlatList
          data={filteredTraps}
          keyExtractor={weapon => weapon.id}
          contentContainerStyle={{ paddingTop: 2, paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={(
            <Text style={{ marginHorizontal: 16, marginBottom: 10, fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              Browse built-in mines and traps or create a custom trap. Configure custom blast zones and damage in its profile.
            </Text>
          )}
          renderItem={({ item }) => (
            <WeaponRow
              weapon={item}
              onCopy={() => openCopyWeapon(item)}
              onEdit={item.isCustom ? () => openEditWeapon(item) : undefined}
              onDelete={item.isCustom ? () => confirmDelete(item.name, () => deleteCustomWeapon(item.id)) : undefined}
            />
          )}
        />
      ) : tab === 'armor' ? (
        <MouseDraggableFlatList
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
      ) : tab === 'ammo' ? (
        <MouseDraggableFlatList
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
      ) : tab === 'consumables' ? (
        <MouseDraggableFlatList
          data={filteredConsumables}
          keyExtractor={consumable => consumable.id}
          contentContainerStyle={{ paddingTop: 2, paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={(
            <Text style={{ marginHorizontal: 16, marginBottom: 10, fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              Built-in chems and alcohol, plus campaign-specific consumables. Custom effect notes are reference-only.
            </Text>
          )}
          renderItem={({ item }) => (
            <ConsumableRow
              consumable={item}
              onCopy={() => openCopyConsumable(item)}
              onEdit={item.isCustom ? () => openEditConsumable(item as CustomConsumable) : undefined}
              onDelete={item.isCustom
                ? () => confirmDelete(item.name, () => deleteCustomConsumable(item.id))
                : undefined}
            />
          )}
        />
      ) : tab === 'tools' ? (
        <MouseDraggableFlatList
          data={filteredTools}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: 2, paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={(
            <Text style={{ marginHorizontal: 16, marginBottom: 10, fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              Manual equipment for inventory reference and weight tracking. These entries do not automate their printed use effects.
            </Text>
          )}
          renderItem={({ item }) => (
            <View style={{ marginHorizontal: 12, marginBottom: 7, padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{item.name}</Text>
              </View>
                <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                  Manual weight: {item.weight === undefined ? 'not listed' : `${item.weight} lb`}
                </Text>
            </View>
          )}
        />
      ) : (
        <MouseDraggableFlatList
          data={filteredVehicles}
          keyExtractor={vehicle => vehicle.id}
          contentContainerStyle={{ paddingTop: 2, paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={(
            <Text style={{ marginHorizontal: 16, marginBottom: 10, fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              Manual vehicle profiles track separate system HP, including each tire or tread. Built-in AC is 0 because the manual does not list model-specific values.
            </Text>
          )}
          renderItem={({ item }) => (
            <VehicleRow
              vehicle={item}
              onView={() => setVehicleDetails(item)}
              onCopy={() => openCopyVehicle(item)}
              onEdit={item.isCustom ? () => openEditVehicle(item) : undefined}
              onDelete={item.isCustom ? () => confirmDelete(item.name, () => deleteCustomVehicle(item.id)) : undefined}
            />
          )}
        />
      )}

      <WeaponFormModal
        visible={showWeaponForm}
        editWeapon={editingWeapon}
        initialCategory={initialWeaponCategory}
        onClose={() => { setShowWeaponForm(false); setEditingWeapon(null); setInitialWeaponCategory(undefined); }}
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
      <ConsumableFormModal
        visible={showConsumableForm}
        editConsumable={editingConsumable}
        catalog={customConsumables}
        onClose={() => { setShowConsumableForm(false); setEditingConsumable(null); }}
        onSave={consumable => {
          if (customConsumables.some(existing => existing.id === consumable.id)) updateCustomConsumable(consumable);
          else addCustomConsumable(consumable);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
      <VehicleDetailsModal
        vehicle={selectedVehicle}
        onClose={() => setVehicleDetails(null)}
        onSpawn={spawnSelectedVehicle}
        onCopy={() => {
          if (!selectedVehicle) return;
          const copy = selectedVehicle;
          setVehicleDetails(null);
          openCopyVehicle(copy);
        }}
        onSetPortrait={selection => {
          if (!selectedVehicle) return;
          if (selectedVehicle.isCustom) {
            updateCustomVehicle({
              ...selectedVehicle,
              ...selection,
              portraitFit: selection.portrait ? selection.portraitFit : undefined,
              portraitOffset: selection.portrait ? selection.portraitOffset : undefined,
            });
          } else {
            setVehicleCatalogPortrait(selectedVehicle.id, selection);
          }
        }}
        onEdit={selectedVehicle?.isCustom ? () => {
          const vehicleToEdit = selectedVehicle;
          setVehicleDetails(null);
          openEditVehicle(vehicleToEdit);
        } : undefined}
      />
      <VehicleFormModal
        visible={showVehicleForm}
        initial={editingVehicle}
        title={editingVehicle?.isCustom ? 'CUSTOM VEHICLE' : 'VEHICLE DETAILS'}
        weaponOptions={allWeapons}
        onClose={() => { setShowVehicleForm(false); setEditingVehicle(null); }}
        onSave={vehicle => {
          if (customVehicles.some(existing => existing.id === vehicle.id)) updateCustomVehicle(vehicle);
          else addCustomVehicle(vehicle);
          setShowVehicleForm(false);
          setEditingVehicle(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}
