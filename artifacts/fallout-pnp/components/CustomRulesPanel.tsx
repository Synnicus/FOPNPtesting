import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import { useApp } from '@/context/AppContext';
import { SelectableTagMenu } from '@/components/SelectableTagMenu';
import type {
  CampaignRuleTag,
  CustomPerkCategory,
  CustomPerkDefinition,
  CustomRuleEffect,
  CustomRuleEffectKind,
  CustomWeaponMod,
  DamageType,
  RuleAttackMode,
  SkillType,
} from '@/context/types';
import { getBuiltInRaceTagId, getSelectableRaceTags } from '@/data/races';
import { TRAITS } from '@/data/traits';
import {
  BUILT_IN_RULE_TAGS,
  getSelectableArmorTags,
  getSelectablePerkStatuses,
  getSelectableWeaponTags,
  normalizeRuleTag,
} from '@/data/customRules';
import { useColors } from '@/hooks/useColors';

type Section = 'mods' | 'perks';

const MOD_EFFECTS: { kind: CustomRuleEffectKind; label: string }[] = [
  { kind: 'toHit', label: 'To-hit' },
  { kind: 'damage', label: 'Typed damage' },
  { kind: 'radiationExposure', label: 'Radiation damage' },
  { kind: 'range', label: 'Range (squares)' },
  { kind: 'attackApDiscount', label: 'Attack AP discount' },
  { kind: 'reloadAp', label: 'Reload AP cost' },
  { kind: 'magazineMultiplier', label: 'Magazine multiplier' },
  { kind: 'ignoreDT', label: 'Ignore DT' },
];
const PERK_EFFECTS: { kind: CustomRuleEffectKind; label: string }[] = [
  ...MOD_EFFECTS.slice(0, 5),
  { kind: 'skillBonus', label: 'Skill bonus' },
  { kind: 'armorClass', label: 'Armor class' },
  { kind: 'damageResistance', label: 'Damage resistance' },
  { kind: 'radiationResistance', label: 'Radiation resistance' },
  { kind: 'poisonResistance', label: 'Poison resistance' },
  { kind: 'ignoreDT', label: 'Ignore DT' },
];
const DAMAGE_TYPES: DamageType[] = ['normal', 'laser', 'fire', 'plasma', 'explosion'];
const ATTACK_MODES: RuleAttackMode[] = ['single', 'targeted', 'burst'];
const SKILLS: SkillType[] = [
  'smallGuns', 'bigGuns', 'energyWeapons', 'meleeWeapons', 'unarmed', 'throwing',
  'firstAid', 'doctor', 'sneak', 'lockpick', 'steal', 'traps', 'science', 'repair',
  'speech', 'barter', 'gambling', 'outdoorsman', 'pilot',
];
const SPECIALS = ['strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck'] as const;
const PERK_CATEGORIES: CustomPerkCategory[] = ['combat', 'defense', 'utility', 'social', 'survival', 'racial'];
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const csv = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

function Field({ label, value, onChangeText, placeholder, multiline = false }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius,
          paddingHorizontal: 10, paddingVertical: 9, color: colors.foreground,
          backgroundColor: colors.background, minHeight: multiline ? 62 : 38,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderWidth: 1, borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? `${colors.primary}22` : 'transparent',
        paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, marginRight: 6, marginBottom: 6,
      }}
    >
      <Text style={{ color: selected ? colors.primary : colors.foreground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SelectableConditionMenu({
  title, buttonLabel, testID, options, selectedIds, onToggle,
}: {
  title: string;
  buttonLabel: string;
  testID: string;
  options: readonly { id: string; label: string }[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const selected = new Set(selectedIds);
  const visibleOptions = [
    ...options,
    ...selectedIds
      .filter(id => !options.some(option => option.id === id))
      .map(id => ({ id, label: id })),
  ];

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>{title}</Text>
      <TouchableOpacity
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderWidth: 1, borderColor: expanded ? colors.primary : colors.border,
          borderRadius: colors.radius, paddingHorizontal: 10, paddingVertical: 9,
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 }}>{buttonLabel}</Text>
        <Text style={{ color: colors.primary, marginLeft: 8 }}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>
      {selectedIds.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          {selectedIds.map((selectedId, index) => (
            <React.Fragment key={selectedId}>
              {index > 0 && <Text style={{ color: colors.mutedForeground, fontSize: 10 }}> · </Text>}
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {visibleOptions.find(option => option.id === selectedId)?.label ?? selectedId}
              </Text>
            </React.Fragment>
          ))}
        </View>
      )}
      {expanded && (
        <View style={{ marginTop: 7, padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.background }}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 190 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {visibleOptions.map(option => {
                const isSelected = selected.has(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    testID={`${testID}-option-${option.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onToggle(option.id)}
                    style={{
                      borderWidth: 1, borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? `${colors.primary}22` : 'transparent',
                      paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6,
                      marginRight: 6, marginBottom: 6,
                    }}
                  >
                    <Text style={{ color: isSelected ? colors.primary : colors.foreground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function PanelButton({ label, onPress, destructive = false }: { label: string; onPress: () => void; destructive?: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 11, paddingVertical: 8, borderRadius: 6,
        borderWidth: 1, borderColor: destructive ? colors.destructive : colors.primary,
        backgroundColor: destructive ? `${colors.destructive}18` : `${colors.primary}16`,
        marginRight: 8, marginBottom: 8, alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: destructive ? colors.destructive : colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function EffectEditor({ available, effects, setEffects, scaleByRank = false }: {
  available: { kind: CustomRuleEffectKind; label: string }[];
  effects: CustomRuleEffect[];
  setEffects: (effects: CustomRuleEffect[]) => void;
  scaleByRank?: boolean;
}) {
  const colors = useColors();
  const [kind, setKind] = useState<CustomRuleEffectKind>(available[0]?.kind ?? 'damage');
  const [value, setValue] = useState('1');
  const [diceCount, setDiceCount] = useState('0');
  const [dieSides, setDieSides] = useState('6');
  const [damageType, setDamageType] = useState<DamageType>('normal');
  const [skill, setSkill] = useState<SkillType>('smallGuns');
  const [special, setSpecial] = useState<(typeof SPECIALS)[number]>('strength');
  const [perRank, setPerRank] = useState(true);
  const [application, setApplication] = useState<'ongoing' | 'oneTime'>('ongoing');
  const supportsOneTime = kind === 'skillBonus' || kind === 'specialBonus';
  const needsDamageType = kind === 'damage' || kind === 'damageResistance';
  const needsDice = kind === 'damage' || kind === 'radiationExposure';

  const addEffect = () => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    setEffects([...effects, {
      id: id('effect'),
      kind,
      value: numericValue,
      ...(needsDamageType ? { damageType } : {}),
      ...(needsDice ? {
        diceCount: Math.max(0, Number(diceCount) || 0),
        dieSides: Math.max(0, Number(dieSides) || 0),
      } : {}),
      ...(kind === 'skillBonus' ? { skill } : {}),
      ...(kind === 'specialBonus' ? { special } : {}),
      ...(scaleByRank ? { perRank } : {}),
      ...(scaleByRank && supportsOneTime ? { application } : {}),
    }]);
    setValue('1');
    setDiceCount('0');
    setApplication('ongoing');
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4 }}>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, marginBottom: 7 }}>AUTOMATIC EFFECTS</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, marginBottom: 8 }}>
        {scaleByRank ? 'Effects are multiplied by rank unless you turn rank scaling off.' : 'These are direct adjustments; leave this empty for a description-only mod.'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {available.map(option => <Choice key={option.kind} label={option.label} selected={kind === option.kind} onPress={() => setKind(option.kind)} />)}
      </View>
      {needsDamageType && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {DAMAGE_TYPES.map(type => <Choice key={type} label={type.toUpperCase()} selected={damageType === type} onPress={() => setDamageType(type)} />)}
        </View>
      )}
      {kind === 'skillBonus' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SKILLS.map(item => <Choice key={item} label={item} selected={skill === item} onPress={() => setSkill(item)} />)}
        </View>
      )}
      {kind === 'specialBonus' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SPECIALS.map(item => <Choice key={item} label={item.toUpperCase()} selected={special === item} onPress={() => setSpecial(item)} />)}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label={kind === 'attackApDiscount' ? 'AP DISCOUNT' : kind === 'reloadAp' ? 'RELOAD AP COST' : kind === 'magazineMultiplier' ? 'CAPACITY MULTIPLIER (E.G. 1.5)' : 'VALUE'} value={value} onChangeText={setValue} placeholder="0" /></View>
        {needsDice && <>
          <View style={{ flex: 1 }}><Field label="BONUS DICE" value={diceCount} onChangeText={setDiceCount} placeholder="0" /></View>
          <View style={{ flex: 1 }}><Field label="DIE SIDES" value={dieSides} onChangeText={setDieSides} placeholder="6" /></View>
        </>}
      </View>
      {scaleByRank && <Choice label={`SCALE BY RANK: ${perRank ? 'ON' : 'OFF'}`} selected={perRank} onPress={() => setPerRank(!perRank)} />}
      {scaleByRank && supportsOneTime && (
        <>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, marginBottom: 5 }}>
            Ongoing modifiers apply while owned. One-time grants are added to the character and undone when the perk is removed.
          </Text>
          <Choice
            label={`APPLICATION: ${application === 'oneTime' ? 'ONE-TIME GRANT' : 'ONGOING MODIFIER'}`}
            selected={application === 'oneTime'}
            onPress={() => setApplication(application === 'oneTime' ? 'ongoing' : 'oneTime')}
          />
        </>
      )}
      <PanelButton label="ADD EFFECT" onPress={addEffect} />
      {effects.map(effect => (
        <View key={effect.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 10, flex: 1 }}>
            {available.find(option => option.kind === effect.kind)?.label ?? effect.kind}: {effect.value}
            {effect.damageType ? ` ${effect.damageType}` : ''}
            {effect.diceCount ? ` + ${effect.diceCount}d${effect.dieSides}` : ''}
            {effect.skill ? ` · ${effect.skill}` : ''}
            {effect.special ? ` · ${effect.special}` : ''}
            {effect.perRank === false ? ' · fixed' : ''}
            {(effect.kind === 'skillBonus' || effect.kind === 'specialBonus')
              ? effect.application === 'oneTime' ? ' · one-time grant' : ' · ongoing modifier'
              : ''}
          </Text>
          <TouchableOpacity onPress={() => setEffects(effects.filter(item => item.id !== effect.id))}>
            <Text style={{ color: colors.destructive, paddingHorizontal: 8, fontSize: 16 }}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function CustomRulesPanel({ section }: { section: Section }) {
  const colors = useColors();
  const {
    customWeaponMods, customPerks, campaignRuleTags, saveCustomRules,
    customRaces, campaignRaceTags, characters, saveCampaignRaceTags,
  } = useApp();
  const tab = section;
  const [editingModId, setEditingModId] = useState<string | null>(null);
  const [modName, setModName] = useState('');
  const [modDescription, setModDescription] = useState('');
  const [modAppliesToTags, setModAppliesToTags] = useState<string[]>([]);
  const [modProgrammatic, setModProgrammatic] = useState(false);
  const [modEffects, setModEffects] = useState<CustomRuleEffect[]>([]);
  const [editingPerkId, setEditingPerkId] = useState<string | null>(null);
  const [perkName, setPerkName] = useState('');
  const [perkDescription, setPerkDescription] = useState('');
  const [perkCategory, setPerkCategory] = useState<CustomPerkCategory>('combat');
  const [perkLevel, setPerkLevel] = useState('1');
  const [perkMaxRanks, setPerkMaxRanks] = useState('1');
  const [perkProgrammatic, setPerkProgrammatic] = useState(true);
  const [perkWeaponTags, setPerkWeaponTags] = useState<string[]>([]);
  const [perkArmorTags, setPerkArmorTags] = useState<string[]>([]);
  const [perkRaceTags, setPerkRaceTags] = useState<string[]>([]);
  const [perkRequiredRaceTags, setPerkRequiredRaceTags] = useState<string[]>([]);
  const [perkExcludedRaceTags, setPerkExcludedRaceTags] = useState<string[]>([]);
  const [perkTraits, setPerkTraits] = useState<string[]>([]);
  const [perkStatuses, setPerkStatuses] = useState<string[]>([]);
  const [perkModes, setPerkModes] = useState<RuleAttackMode[]>([]);
  const [perkEffects, setPerkEffects] = useState<CustomRuleEffect[]>([]);
  const changeRules = (changes: Partial<{
    customWeaponMods: CustomWeaponMod[];
    customPerks: CustomPerkDefinition[];
    campaignRuleTags: CampaignRuleTag[];
  }>) => saveCustomRules({
    customWeaponMods: changes.customWeaponMods ?? customWeaponMods,
    customPerks: changes.customPerks ?? customPerks,
    campaignRuleTags: changes.campaignRuleTags ?? campaignRuleTags,
  });

  const visibleModWeaponTags = getSelectableWeaponTags(campaignRuleTags, modAppliesToTags);
  const visiblePerkWeaponTags = getSelectableWeaponTags(campaignRuleTags, perkWeaponTags);
  const visiblePerkArmorTags = getSelectableArmorTags(campaignRuleTags, perkArmorTags);
  const visiblePerkStatuses = getSelectablePerkStatuses(perkStatuses);
  const visibleRaceTags = getSelectableRaceTags(
    customRaces, campaignRaceTags, characters,
    [...perkRaceTags, ...perkRequiredRaceTags, ...perkExcludedRaceTags],
  ).map(tag => ({ ...tag, appliesTo: 'both' as const }));

  const toggleModWeaponTag = (tagId: string) => {
    setModAppliesToTags(current => current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId]);
  };

  const registerCampaignTag = (
    value: string,
    appliesTo: 'weapon' | 'armor',
    setSelected: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const label = value.trim();
    const tagId = normalizeRuleTag(label);
    if (!tagId) return;

    const builtIn = BUILT_IN_RULE_TAGS.find(tag => tag.id === tagId);
    if (builtIn) {
      if (builtIn.appliesTo === appliesTo || builtIn.appliesTo === 'both')
        setSelected(current => current.includes(tagId) ? current : [...current, tagId]);
      return;
    }

    const existing = campaignRuleTags.find(tag => tag.id === tagId);
    const nextTags = existing
      ? campaignRuleTags.map(tag => tag.id === tagId && tag.appliesTo === 'armor'
        ? { ...tag, appliesTo: appliesTo === 'weapon' ? 'both' as const : appliesTo }
        : tag.id === tagId && tag.appliesTo === 'weapon' && appliesTo === 'armor'
          ? { ...tag, appliesTo: 'both' as const }
        : tag)
      : [...campaignRuleTags, { id: tagId, label, appliesTo }];
    changeRules({ campaignRuleTags: nextTags });
    setSelected(current => current.includes(tagId) ? current : [...current, tagId]);
  };

  const addCustomModWeaponTag = (label: string) => registerCampaignTag(label, 'weapon', setModAppliesToTags);
  const addCustomPerkWeaponTag = (label: string) => registerCampaignTag(label, 'weapon', setPerkWeaponTags);
  const addCustomPerkArmorTag = (label: string) => registerCampaignTag(label, 'armor', setPerkArmorTags);
  const addCustomRaceTag = (label: string, setSelected: React.Dispatch<React.SetStateAction<string[]>>) => {
    const cleanLabel = label.trim().slice(0, 80);
    const slug = normalizeRuleTag(cleanLabel);
    if (!slug) return;
    const tagId = `race-custom-${slug}`;
    if (!campaignRaceTags.some(tag => tag.id === tagId)) {
      saveCampaignRaceTags([...campaignRaceTags, { id: tagId, label: cleanLabel }]);
    }
    setSelected(current => current.includes(tagId) ? current : [...current, tagId]);
  };

  const resetMod = () => {
    setEditingModId(null); setModName(''); setModDescription(''); setModAppliesToTags([]);
    setModProgrammatic(false); setModEffects([]);
  };
  const editMod = (mod: CustomWeaponMod) => {
    setEditingModId(mod.id); setModName(mod.name); setModDescription(mod.description);
    setModAppliesToTags([...(mod.appliesToTags ?? [])]);
    setModProgrammatic(mod.programmatic);
    setModEffects(mod.effects);
  };
  const saveMod = () => {
    if (!modName.trim()) return;
    const next: CustomWeaponMod = {
      id: editingModId ?? id('custom-mod'),
      name: modName.trim(),
      description: modDescription.trim(),
      programmatic: modProgrammatic,
      appliesToTags: modAppliesToTags,
      effects: modProgrammatic ? modEffects : [],
    };
    changeRules({ customWeaponMods: editingModId
      ? customWeaponMods.map(mod => mod.id === editingModId ? next : mod)
      : [...customWeaponMods, next] });
    resetMod();
  };
  const resetPerk = () => {
    setEditingPerkId(null); setPerkName(''); setPerkDescription(''); setPerkCategory('combat');
    setPerkLevel('1'); setPerkMaxRanks('1'); setPerkProgrammatic(true);
    setPerkWeaponTags([]); setPerkArmorTags([]); setPerkRaceTags([]);
    setPerkRequiredRaceTags([]); setPerkExcludedRaceTags([]); setPerkTraits([]);
    setPerkStatuses([]); setPerkModes([]); setPerkEffects([]);
  };
  const editPerk = (perk: CustomPerkDefinition) => {
    setEditingPerkId(perk.id); setPerkName(perk.name); setPerkDescription(perk.description);
    setPerkCategory(perk.category); setPerkLevel(String(perk.minLevel)); setPerkMaxRanks(String(perk.maxRanks));
    setPerkProgrammatic(perk.programmatic);
    setPerkWeaponTags([...(perk.conditions?.weaponTags ?? [])]);
    setPerkArmorTags([...(perk.conditions?.armorTags ?? [])]);
    const legacyConditionRaceTags = (perk.conditions?.attackerRaces ?? [])
      .map(getBuiltInRaceTagId).filter((tagId): tagId is string => !!tagId);
    const legacyRequiredRaceTags = (perk.requiresRace ?? [])
      .map(getBuiltInRaceTagId).filter((tagId): tagId is string => !!tagId);
    const legacyExcludedRaceTags = (perk.excludedRaces ?? [])
      .map(getBuiltInRaceTagId).filter((tagId): tagId is string => !!tagId);
    setPerkRaceTags([...new Set([...(perk.conditions?.attackerRaceTags ?? []), ...legacyConditionRaceTags])]);
    setPerkRequiredRaceTags([...new Set([...(perk.requiresRaceTags ?? []), ...legacyRequiredRaceTags])]);
    setPerkExcludedRaceTags([...new Set([...(perk.excludedRaceTags ?? []), ...legacyExcludedRaceTags])]);
    setPerkTraits([...(perk.conditions?.attackerTraits ?? [])]);
    setPerkStatuses([...(perk.conditions?.statuses ?? [])]);
    setPerkModes(perk.conditions?.attackModes ?? []);
    setPerkEffects(perk.effects);
  };
  const savePerk = () => {
    if (!perkName.trim()) return;
    const weaponTags = perkWeaponTags;
    const armorTags = perkArmorTags;
    const statuses = perkStatuses;
    const conditions = weaponTags.length || armorTags.length || perkRaceTags.length || perkTraits.length || statuses.length || perkModes.length
      ? {
        weaponTags, armorTags, attackerRaceTags: perkRaceTags, attackerTraits: perkTraits,
        statuses, attackModes: perkModes,
      }
      : undefined;
    const next: CustomPerkDefinition = {
      id: editingPerkId ?? id('custom-perk'),
      name: perkName.trim(),
      description: perkDescription.trim(),
      category: perkCategory,
      minLevel: Math.max(1, Number(perkLevel) || 1),
      maxRanks: Math.max(1, Math.floor(Number(perkMaxRanks) || 1)),
      requiresRaceTags: perkRequiredRaceTags,
      excludedRaceTags: perkExcludedRaceTags,
      programmatic: perkProgrammatic,
      effects: perkProgrammatic ? perkEffects : [],
      ...(conditions ? { conditions } : {}),
    };
    changeRules({ customPerks: editingPerkId
      ? customPerks.map(perk => perk.id === editingPerkId ? next : perk)
      : [...customPerks, next] });
    resetPerk();
  };

  const sectionStyle = {
    backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1,
    borderColor: colors.border, padding: 14, marginBottom: 14,
  } as const;

  return (
    <View style={sectionStyle}>
      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2, marginBottom: 4 }}>
        {section === 'mods' ? 'CUSTOM WEAPON MODS' : 'CUSTOM PERKS'}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, marginBottom: 12 }}>
        {section === 'mods'
          ? 'Create direct weapon adjustments or description-only modifications.'
          : 'Create perks with automatic effects or roleplay-only descriptions. Conditions are checked when the perk applies.'}
      </Text>
      {tab === 'mods' && (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 620 }} keyboardShouldPersistTaps="handled">
          <Field label="MOD NAME" value={modName} onChangeText={setModName} placeholder="Muzzle flash" />
          <Field label="DESCRIPTION / TACTICAL NOTE" value={modDescription} onChangeText={setModDescription} placeholder="Bright flash may reveal the shooter's position in a dark room." multiline />
          <SelectableTagMenu
            title="ELIGIBLE WEAPON TAGS"
            buttonLabel="SELECT WEAPON TAGS"
            customTagButtonLabel="+ CUSTOM WEAPON TAG"
            testID="custom-mod-weapon-tag-menu-toggle"
            options={visibleModWeaponTags}
            selectedTagIds={modAppliesToTags}
            onToggle={toggleModWeaponTag}
            onAddCustomTag={addCustomModWeaponTag}
          />
          <Choice label={`AUTOMATE EFFECTS: ${modProgrammatic ? 'ON' : 'OFF (DESCRIPTION ONLY)'}`} selected={modProgrammatic} onPress={() => setModProgrammatic(!modProgrammatic)} />
          {modProgrammatic && <EffectEditor available={MOD_EFFECTS} effects={modEffects} setEffects={setModEffects} />}
          <PanelButton label={editingModId ? 'SAVE MOD' : 'CREATE MOD'} onPress={saveMod} />
          {editingModId && <PanelButton label="CANCEL EDIT" onPress={resetMod} />}
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11, marginVertical: 8 }}>SAVED MODS</Text>
          {customWeaponMods.map(mod => (
            <View key={mod.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', flex: 1 }}>{mod.name}</Text>
                <TouchableOpacity onPress={() => editMod(mod)}><Text style={{ color: colors.primary, paddingHorizontal: 8 }}>EDIT</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => changeRules({ customWeaponMods: customWeaponMods.filter(item => item.id !== mod.id) })}><Text style={{ color: colors.destructive, paddingHorizontal: 5 }}>DELETE</Text></TouchableOpacity>
              </View>
              {!!mod.description && <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 3 }}>{mod.description}</Text>}
              <Text style={{ color: colors.mutedForeground, fontSize: 9, marginTop: 3 }}>
                {mod.programmatic && mod.effects.length ? 'AUTOMATIC EFFECTS' : 'Contextual description only'}
                {(mod.appliesToTags?.length ?? 0) ? ` · Fits: ${mod.appliesToTags?.join(', ')}` : ' · Compatible with any weapon'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {tab === 'perks' && (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 720 }} keyboardShouldPersistTaps="handled">
          <Field label="PERK NAME" value={perkName} onChangeText={setPerkName} placeholder="Marksman" />
          <Field label="DESCRIPTION" value={perkDescription} onChangeText={setPerkDescription} placeholder="Describe the perk and its rules." multiline />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {PERK_CATEGORIES.map(category => <Choice key={category} label={category.toUpperCase()} selected={perkCategory === category} onPress={() => setPerkCategory(category)} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="MINIMUM LEVEL" value={perkLevel} onChangeText={setPerkLevel} placeholder="1" /></View>
            <View style={{ flex: 1 }}><Field label="MAX RANKS" value={perkMaxRanks} onChangeText={setPerkMaxRanks} placeholder="1" /></View>
          </View>
          <Choice label={`AUTOMATE EFFECTS: ${perkProgrammatic ? 'ON' : 'OFF (ROLEPLAY ONLY)'}`} selected={perkProgrammatic} onPress={() => setPerkProgrammatic(!perkProgrammatic)} />
          <Text style={{ color: colors.mutedForeground, fontSize: 10, marginVertical: 6 }}>
            A perk activates when every selected condition group matches. Within each group, any selected value is enough. Built-in races and custom race profiles have stable, exact tags.
          </Text>
          <SelectableTagMenu
            title="REQUIRES RACE TAG (ANY MATCH)"
            buttonLabel="SELECT RACE TAGS"
            customTagButtonLabel="+ CUSTOM RACE TAG"
            testID="custom-perk-required-race-tags"
            options={visibleRaceTags}
            selectedTagIds={perkRequiredRaceTags}
            onToggle={tagId => setPerkRequiredRaceTags(current => current.includes(tagId)
              ? current.filter(id => id !== tagId)
              : [...current, tagId])}
            onAddCustomTag={label => addCustomRaceTag(label, setPerkRequiredRaceTags)}
          />
          <SelectableTagMenu
            title="EXCLUDES RACE TAG (ANY MATCH)"
            buttonLabel="SELECT EXCLUDED RACE TAGS"
            customTagButtonLabel="+ CUSTOM RACE TAG"
            testID="custom-perk-excluded-race-tags"
            options={visibleRaceTags}
            selectedTagIds={perkExcludedRaceTags}
            onToggle={tagId => setPerkExcludedRaceTags(current => current.includes(tagId)
              ? current.filter(id => id !== tagId)
              : [...current, tagId])}
            onAddCustomTag={label => addCustomRaceTag(label, setPerkExcludedRaceTags)}
          />
          <SelectableTagMenu
            title="ATTACKER RACE TAG (ANY MATCH)"
            buttonLabel="SELECT ATTACKER RACE TAGS"
            customTagButtonLabel="+ CUSTOM RACE TAG"
            testID="custom-perk-attacker-race-tags"
            options={visibleRaceTags}
            selectedTagIds={perkRaceTags}
            onToggle={tagId => setPerkRaceTags(current => current.includes(tagId)
              ? current.filter(id => id !== tagId)
              : [...current, tagId])}
            onAddCustomTag={label => addCustomRaceTag(label, setPerkRaceTags)}
          />
          <SelectableConditionMenu
            title="REQUIRES SELECTED TRAIT (ANY MATCH)"
            buttonLabel="SELECT TRAITS"
            testID="custom-perk-trait-menu"
            options={TRAITS.map(trait => ({ id: trait.id, label: trait.name }))}
            selectedIds={perkTraits}
            onToggle={traitId => setPerkTraits(current => current.includes(traitId)
              ? current.filter(id => id !== traitId)
              : [...current, traitId])}
          />
          <SelectableTagMenu
            title="REQUIRES WIELDED WEAPON TAG (ANY MATCH)"
            buttonLabel="SELECT WEAPON TAGS"
            customTagButtonLabel="+ CUSTOM WEAPON TAG"
            testID="custom-perk-weapon-tag-menu"
            options={visiblePerkWeaponTags}
            selectedTagIds={perkWeaponTags}
            onToggle={tagId => setPerkWeaponTags(current => current.includes(tagId)
              ? current.filter(id => id !== tagId)
              : [...current, tagId])}
            onAddCustomTag={addCustomPerkWeaponTag}
          />
          <SelectableTagMenu
            title="REQUIRES WORN ARMOR TAG (ANY MATCH)"
            buttonLabel="SELECT ARMOR TAGS"
            customTagButtonLabel="+ CUSTOM ARMOR TAG"
            testID="custom-perk-armor-tag-menu"
            options={visiblePerkArmorTags}
            selectedTagIds={perkArmorTags}
            onToggle={tagId => setPerkArmorTags(current => current.includes(tagId)
              ? current.filter(id => id !== tagId)
              : [...current, tagId])}
            onAddCustomTag={addCustomPerkArmorTag}
          />
          <SelectableConditionMenu
            title="REQUIRES STATUS (ANY MATCH)"
            buttonLabel="SELECT STATUSES"
            testID="custom-perk-status-menu"
            options={visiblePerkStatuses}
            selectedIds={perkStatuses}
            onToggle={statusId => setPerkStatuses(current => current.includes(statusId)
              ? current.filter(id => id !== statusId)
              : [...current, statusId])}
          />
          <Text style={{ color: colors.mutedForeground, fontSize: 10, marginBottom: 5 }}>When selected, every condition group above must be satisfied.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {ATTACK_MODES.map(mode => <Choice key={mode} label={mode.toUpperCase()} selected={perkModes.includes(mode)} onPress={() => setPerkModes(perkModes.includes(mode) ? perkModes.filter(item => item !== mode) : [...perkModes, mode])} />)}
          </View>
          {perkProgrammatic && <EffectEditor available={PERK_EFFECTS} effects={perkEffects} setEffects={setPerkEffects} scaleByRank />}
          <PanelButton label={editingPerkId ? 'SAVE PERK' : 'CREATE PERK'} onPress={savePerk} />
          {editingPerkId && <PanelButton label="CANCEL EDIT" onPress={resetPerk} />}
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11, marginVertical: 8 }}>SAVED CUSTOM PERKS</Text>
          {customPerks.map(perk => (
            <View key={perk.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', flex: 1 }}>{perk.name} · {perk.category}</Text>
                <TouchableOpacity onPress={() => editPerk(perk)}><Text style={{ color: colors.primary, paddingHorizontal: 8 }}>EDIT</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => changeRules({ customPerks: customPerks.filter(item => item.id !== perk.id) })}><Text style={{ color: colors.destructive, paddingHorizontal: 5 }}>DELETE</Text></TouchableOpacity>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 3 }}>{perk.description}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9, marginTop: 3 }}>
                Level {perk.minLevel} · {perk.maxRanks} rank(s) · {perk.programmatic ? `${perk.effects.length} effect(s)` : 'roleplay only'}
                {perk.requiresRaceTags?.length ? ` · for ${perk.requiresRaceTags.join('/')}` : ''}
                {perk.excludedRaceTags?.length ? ` · excludes ${perk.excludedRaceTags.join('/')}` : ''}
                {perk.conditions?.weaponTags?.length ? ` · wield ${perk.conditions.weaponTags.join('/')}` : ''}
                {perk.conditions?.armorTags?.length ? ` · wear ${perk.conditions.armorTags.join('/')}` : ''}
                {perk.conditions?.attackerRaceTags?.length ? ` · race ${perk.conditions.attackerRaceTags.join('/')}` : ''}
                {perk.conditions?.attackerTraits?.length ? ` · trait ${perk.conditions.attackerTraits.join('/')}` : ''}
                {perk.conditions?.statuses?.length ? ` · status ${perk.conditions.statuses.join('/')}` : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
