import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import { useApp } from '@/context/AppContext';
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
import { BUILT_IN_RULE_TAGS, normalizeRuleTag, parseRuleTagList } from '@/data/customRules';
import { useColors } from '@/hooks/useColors';

type Tab = 'tags' | 'mods' | 'perks';

const MOD_EFFECTS: { kind: CustomRuleEffectKind; label: string }[] = [
  { kind: 'toHit', label: 'To-hit' },
  { kind: 'damage', label: 'Typed damage' },
  { kind: 'radiationExposure', label: 'Radiation exposure' },
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
    }]);
    setValue('1');
    setDiceCount('0');
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
          </Text>
          <TouchableOpacity onPress={() => setEffects(effects.filter(item => item.id !== effect.id))}>
            <Text style={{ color: colors.destructive, paddingHorizontal: 8, fontSize: 16 }}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function CustomRulesPanel() {
  const colors = useColors();
  const {
    customWeaponMods, customPerks, campaignRuleTags, saveCustomRules,
  } = useApp();
  const [tab, setTab] = useState<Tab>('tags');
  const [tagLabel, setTagLabel] = useState('');
  const [tagScope, setTagScope] = useState<CampaignRuleTag['appliesTo']>('weapon');
  const [editingModId, setEditingModId] = useState<string | null>(null);
  const [modName, setModName] = useState('');
  const [modDescription, setModDescription] = useState('');
  const [modAppliesToTags, setModAppliesToTags] = useState('');
  const [modProgrammatic, setModProgrammatic] = useState(false);
  const [modEffects, setModEffects] = useState<CustomRuleEffect[]>([]);
  const [editingPerkId, setEditingPerkId] = useState<string | null>(null);
  const [perkName, setPerkName] = useState('');
  const [perkDescription, setPerkDescription] = useState('');
  const [perkCategory, setPerkCategory] = useState<CustomPerkCategory>('combat');
  const [perkLevel, setPerkLevel] = useState('1');
  const [perkMaxRanks, setPerkMaxRanks] = useState('1');
  const [perkProgrammatic, setPerkProgrammatic] = useState(true);
  const [perkWeaponTags, setPerkWeaponTags] = useState('');
  const [perkArmorTags, setPerkArmorTags] = useState('');
  const [perkStatuses, setPerkStatuses] = useState('');
  const [perkModes, setPerkModes] = useState<RuleAttackMode[]>([]);
  const [perkEffects, setPerkEffects] = useState<CustomRuleEffect[]>([]);
  const tagOptions = useMemo(() => [...BUILT_IN_RULE_TAGS, ...campaignRuleTags], [campaignRuleTags]);

  const changeRules = (changes: Partial<{
    customWeaponMods: CustomWeaponMod[];
    customPerks: CustomPerkDefinition[];
    campaignRuleTags: CampaignRuleTag[];
  }>) => saveCustomRules({
    customWeaponMods: changes.customWeaponMods ?? customWeaponMods,
    customPerks: changes.customPerks ?? customPerks,
    campaignRuleTags: changes.campaignRuleTags ?? campaignRuleTags,
  });

  const addTag = () => {
    const label = tagLabel.trim();
    const tagId = normalizeRuleTag(label);
    if (!tagId || tagOptions.some(tag => tag.id === tagId)) return;
    changeRules({ campaignRuleTags: [...campaignRuleTags, { id: tagId, label, appliesTo: tagScope }] });
    setTagLabel('');
  };
  const resetMod = () => {
    setEditingModId(null); setModName(''); setModDescription(''); setModAppliesToTags('');
    setModProgrammatic(false); setModEffects([]);
  };
  const editMod = (mod: CustomWeaponMod) => {
    setTab('mods'); setEditingModId(mod.id); setModName(mod.name); setModDescription(mod.description);
    setModAppliesToTags((mod.appliesToTags ?? []).join(', ')); setModProgrammatic(mod.programmatic);
    setModEffects(mod.effects);
  };
  const saveMod = () => {
    if (!modName.trim()) return;
    const next: CustomWeaponMod = {
      id: editingModId ?? id('custom-mod'),
      name: modName.trim(),
      description: modDescription.trim(),
      programmatic: modProgrammatic,
      appliesToTags: parseRuleTagList(modAppliesToTags),
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
    setPerkWeaponTags(''); setPerkArmorTags(''); setPerkStatuses(''); setPerkModes([]); setPerkEffects([]);
  };
  const editPerk = (perk: CustomPerkDefinition) => {
    setTab('perks'); setEditingPerkId(perk.id); setPerkName(perk.name); setPerkDescription(perk.description);
    setPerkCategory(perk.category); setPerkLevel(String(perk.minLevel)); setPerkMaxRanks(String(perk.maxRanks));
    setPerkProgrammatic(perk.programmatic);
    setPerkWeaponTags((perk.conditions?.weaponTags ?? []).join(', '));
    setPerkArmorTags((perk.conditions?.armorTags ?? []).join(', '));
    setPerkStatuses((perk.conditions?.statuses ?? []).join(', '));
    setPerkModes(perk.conditions?.attackModes ?? []);
    setPerkEffects(perk.effects);
  };
  const savePerk = () => {
    if (!perkName.trim()) return;
    const weaponTags = parseRuleTagList(perkWeaponTags);
    const armorTags = parseRuleTagList(perkArmorTags);
    const statuses = parseRuleTagList(perkStatuses);
    const conditions = weaponTags.length || armorTags.length || statuses.length || perkModes.length
      ? { weaponTags, armorTags, statuses, attackModes: perkModes }
      : undefined;
    const next: CustomPerkDefinition = {
      id: editingPerkId ?? id('custom-perk'),
      name: perkName.trim(),
      description: perkDescription.trim(),
      category: perkCategory,
      minLevel: Math.max(1, Number(perkLevel) || 1),
      maxRanks: Math.max(1, Math.floor(Number(perkMaxRanks) || 1)),
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
      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2, marginBottom: 4 }}>CUSTOM RULES</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 10, marginBottom: 12 }}>
        Mods apply direct weapon adjustments. Perks can be unconditional or require matching tags, action modes, or statuses. Each filled condition group is required; any listed value within a group can match.
      </Text>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12 }}>
        {([
          ['tags', 'TAGS'],
          ['mods', 'WEAPON MODS'],
          ['perks', 'CUSTOM PERKS'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity key={value} onPress={() => setTab(value)} style={{ paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: tab === value ? 2 : 0, borderBottomColor: colors.primary }}>
            <Text style={{ color: tab === value ? colors.primary : colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_700Bold' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'tags' && (
        <View>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11, marginBottom: 7 }}>BUILT-IN TAGS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
            {BUILT_IN_RULE_TAGS.map(tag => (
              <View key={tag.id} style={{ borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, marginRight: 6, marginBottom: 6 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{tag.label} · {tag.appliesTo}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 11, marginBottom: 7 }}>CAMPAIGN TAGS</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="TAG NAME" value={tagLabel} onChangeText={setTagLabel} placeholder="e.g. vault-tech" /></View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', maxWidth: 130, paddingTop: 14 }}>
              {(['weapon', 'armor', 'both'] as const).map(scope => <Choice key={scope} label={scope.toUpperCase()} selected={tagScope === scope} onPress={() => setTagScope(scope)} />)}
            </View>
          </View>
          <PanelButton label="ADD CAMPAIGN TAG" onPress={addTag} />
          {campaignRuleTags.map(tag => (
            <View key={tag.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 7 }}>
              <Text style={{ color: colors.foreground, flex: 1, fontSize: 11 }}>{tag.label} <Text style={{ color: colors.mutedForeground }}>({tag.id} · {tag.appliesTo})</Text></Text>
              <TouchableOpacity onPress={() => changeRules({ campaignRuleTags: campaignRuleTags.filter(item => item.id !== tag.id) })}>
                <Text style={{ color: colors.destructive, paddingHorizontal: 8, fontSize: 15 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {tab === 'mods' && (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 620 }} keyboardShouldPersistTaps="handled">
          <Field label="MOD NAME" value={modName} onChangeText={setModName} placeholder="Muzzle flash" />
          <Field label="DESCRIPTION / TACTICAL NOTE" value={modDescription} onChangeText={setModDescription} placeholder="Bright flash may reveal the shooter's position in a dark room." multiline />
          <Field label="ELIGIBLE WEAPON TAGS (COMMA-SEPARATED; BLANK = ANY)" value={modAppliesToTags} onChangeText={setModAppliesToTags} placeholder="rifle, assault-rifle" />
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
          <Text style={{ color: colors.mutedForeground, fontSize: 10, marginVertical: 6 }}>Conditional requirements: a matching weapon tag, worn armor tag, action mode, or status can activate the perk.</Text>
          <Field label="REQUIRES WIELDED WEAPON TAG (ANY MATCH)" value={perkWeaponTags} onChangeText={setPerkWeaponTags} placeholder="assault-rifle, small-guns" />
          <Field label="REQUIRES WORN ARMOR TAG (ANY MATCH)" value={perkArmorTags} onChangeText={setPerkArmorTags} placeholder="power-armor" />
          <Field label="REQUIRES STATUS (ANY MATCH)" value={perkStatuses} onChangeText={setPerkStatuses} placeholder="aiming, hidden" />
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
                {perk.conditions?.weaponTags?.length ? ` · wield ${perk.conditions.weaponTags.join('/')}` : ''}
                {perk.conditions?.armorTags?.length ? ` · wear ${perk.conditions.armorTags.join('/')}` : ''}
                {perk.conditions?.statuses?.length ? ` · status ${perk.conditions.statuses.join('/')}` : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
