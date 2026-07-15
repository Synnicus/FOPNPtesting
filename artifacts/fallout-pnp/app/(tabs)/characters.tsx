import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { Armor, Character, CharacterSkills, CharacterType, Weapon } from '@/context/types';
import CharacterAvatar from '@/components/CharacterAvatar';
import HPBar from '@/components/HPBar';

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function makeDefaultCharacter(type: CharacterType = 'pc'): Character {
  return {
    id: genId(),
    name: '',
    type,
    maxHp: 30,
    currentHp: 30,
    evasion: 25,
    skills: { firearms: 30, melee: 25, unarmed: 20 },
    equippedWeaponId: null,
    equippedBodyArmorId: null,
    equippedHelmetId: null,
    portrait: null,
  };
}

// ─── Selection Modal ─────────────────────────────────────────────────────────

function SelectionModal<T extends { id: string; name: string }>({
  visible,
  onClose,
  onSelect,
  title,
  items,
  renderSub,
  nullLabel,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  title: string;
  items: T[];
  renderSub?: (item: T) => string;
  nullLabel: string;
}) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <View style={{
          maxHeight: '75%',
          backgroundColor: colors.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <FlatList
            data={[{ id: '__none__', name: nullLabel } as T, ...items]}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                onPress={() => { onSelect(item.id === '__none__' ? null : item.id); onClose(); }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: item.id === '__none__' ? colors.mutedForeground : colors.foreground }}>
                  {item.name}
                </Text>
                {renderSub && item.id !== '__none__' && (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                    {renderSub(item)}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Character Form Modal ─────────────────────────────────────────────────────

function CharacterFormModal({
  visible,
  initial,
  onClose,
  onSave,
  allWeapons,
  allArmor,
}: {
  visible: boolean;
  initial: Character | null;
  onClose: () => void;
  onSave: (c: Character) => void;
  allWeapons: Weapon[];
  allArmor: Armor[];
}) {
  const colors = useColors();
  const [char, setChar] = useState<Character>(() => initial ?? makeDefaultCharacter());
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showBodyPicker, setShowBodyPicker] = useState(false);
  const [showHelmetPicker, setShowHelmetPicker] = useState(false);

  React.useEffect(() => {
    setChar(initial ?? makeDefaultCharacter());
  }, [initial, visible]);

  const pickPortrait = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setChar(c => ({ ...c, portrait: `data:image/jpeg;base64,${result.assets[0].base64}` }));
    }
  };

  const setNum = (field: keyof Character, text: string) => {
    const n = parseInt(text, 10);
    setChar(c => ({ ...c, [field]: isNaN(n) ? 0 : n }));
  };

  const setSkill = (skill: keyof CharacterSkills, text: string) => {
    const n = parseInt(text, 10);
    setChar(c => ({ ...c, skills: { ...c.skills, [skill]: isNaN(n) ? 0 : n } }));
  };

  const weaponName = char.equippedWeaponId ? allWeapons.find(w => w.id === char.equippedWeaponId)?.name ?? 'Unknown' : 'None';
  const bodyName = char.equippedBodyArmorId ? allArmor.find(a => a.id === char.equippedBodyArmorId)?.name ?? 'Unknown' : 'None';
  const helmetName = char.equippedHelmetId ? allArmor.find(a => a.id === char.equippedHelmetId)?.name ?? 'Unknown' : 'None';

  const bodyArmors = allArmor.filter(a => a.slot === 'body');
  const helmets = allArmor.filter(a => a.slot === 'helmet');

  const isValid = char.name.trim().length > 0;

  const inp = (label: string, value: string, onChange: (t: string) => void, numeric = false) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: colors.input,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: colors.radius,
          padding: 10,
          color: colors.foreground,
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
        }}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );

  const sel = (label: string, value: string, onPress: () => void) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 4 }}>{label}</Text>
      <TouchableOpacity
        style={{
          backgroundColor: colors.input,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: colors.radius,
          padding: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onPress={onPress}
      >
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }}>{value}</Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
        <View style={{ maxHeight: '92%', backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: colors.border }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>
              {initial ? 'EDIT CHARACTER' : 'NEW CHARACTER'}
            </Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* Portrait */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <CharacterAvatar portrait={char.portrait} name={char.name || '?'} size={80} />
              <TouchableOpacity
                onPress={pickPortrait}
                style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Feather name="camera" size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.primary, fontFamily: 'Inter_500Medium' }}>
                  {char.portrait ? 'Change Photo' : 'Add Photo'}
                </Text>
              </TouchableOpacity>
              {char.portrait && (
                <TouchableOpacity
                  onPress={() => setChar(c => ({ ...c, portrait: null }))}
                  style={{ marginTop: 4 }}
                >
                  <Text style={{ fontSize: 12, color: colors.destructive, fontFamily: 'Inter_400Regular' }}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Name */}
            {inp('NAME', char.name, t => setChar(c => ({ ...c, name: t })))}

            {/* Type Toggle */}
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['pc', 'npc'] as CharacterType[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: 'center',
                      borderRadius: colors.radius,
                      backgroundColor: char.type === t ? colors.primary : colors.secondary,
                      borderWidth: 1,
                      borderColor: char.type === t ? colors.primary : colors.border,
                    }}
                    onPress={() => setChar(c => ({ ...c, type: t }))}
                  >
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: char.type === t ? colors.primaryForeground : colors.mutedForeground }}>
                      {t === 'pc' ? 'PLAYER' : 'NPC/ENEMY'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Stats */}
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 8 }}>STATS</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>{inp('MAX HP', String(char.maxHp), t => setNum('maxHp', t), true)}</View>
              <View style={{ flex: 1 }}>{inp('CURR HP', String(char.currentHp), t => setNum('currentHp', t), true)}</View>
              <View style={{ flex: 1 }}>{inp('EVASION', String(char.evasion), t => setNum('evasion', t), true)}</View>
            </View>

            {/* Skills */}
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 8 }}>SKILLS</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>{inp('FIREARMS', String(char.skills.firearms), t => setSkill('firearms', t), true)}</View>
              <View style={{ flex: 1 }}>{inp('MELEE', String(char.skills.melee), t => setSkill('melee', t), true)}</View>
              <View style={{ flex: 1 }}>{inp('UNARMED', String(char.skills.unarmed), t => setSkill('unarmed', t), true)}</View>
            </View>

            {/* Equipment */}
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 8 }}>EQUIPMENT</Text>
            {sel('WEAPON', weaponName, () => setShowWeaponPicker(true))}
            {sel('BODY ARMOR', bodyName, () => setShowBodyPicker(true))}
            {sel('HELMET', helmetName, () => setShowHelmetPicker(true))}

            {/* Save */}
            <TouchableOpacity
              style={{
                backgroundColor: isValid ? colors.primary : colors.secondary,
                borderRadius: colors.radius,
                paddingVertical: 14,
                alignItems: 'center',
                marginTop: 8,
                marginBottom: 30,
              }}
              disabled={!isValid}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSave(char);
                onClose();
              }}
            >
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: isValid ? colors.primaryForeground : colors.mutedForeground, letterSpacing: 1 }}>
                SAVE CHARACTER
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <SelectionModal
        visible={showWeaponPicker}
        onClose={() => setShowWeaponPicker(false)}
        onSelect={id => setChar(c => ({ ...c, equippedWeaponId: id }))}
        title="SELECT WEAPON"
        items={allWeapons}
        renderSub={w => `${(w as Weapon).damageDieCount}d${(w as Weapon).damageDie} · ${(w as Weapon).damageType.toUpperCase()} · ${(w as Weapon).category}`}
        nullLabel="No Weapon"
      />
      <SelectionModal
        visible={showBodyPicker}
        onClose={() => setShowBodyPicker(false)}
        onSelect={id => setChar(c => ({ ...c, equippedBodyArmorId: id }))}
        title="SELECT BODY ARMOR"
        items={bodyArmors}
        renderSub={a => `DT: N${(a as Armor).dtNormal} B${(a as Armor).dtBio} E${(a as Armor).dtEnergy}`}
        nullLabel="No Body Armor"
      />
      <SelectionModal
        visible={showHelmetPicker}
        onClose={() => setShowHelmetPicker(false)}
        onSelect={id => setChar(c => ({ ...c, equippedHelmetId: id }))}
        title="SELECT HELMET"
        items={helmets}
        renderSub={a => `DT: N${(a as Armor).dtNormal} B${(a as Armor).dtBio} E${(a as Armor).dtEnergy}`}
        nullLabel="No Helmet"
      />
    </Modal>
  );
}

// ─── Character Card ───────────────────────────────────────────────────────────

function CharacterCard({
  character,
  allWeapons,
  allArmor,
  onEdit,
  onDelete,
  onClone,
  onHpChange,
}: {
  character: Character;
  allWeapons: Weapon[];
  allArmor: Armor[];
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  onHpChange: (newHp: number) => void;
}) {
  const colors = useColors();
  const weapon = character.equippedWeaponId ? allWeapons.find(w => w.id === character.equippedWeaponId) : null;
  const body = character.equippedBodyArmorId ? allArmor.find(a => a.id === character.equippedBodyArmorId) : null;
  const helm = character.equippedHelmetId ? allArmor.find(a => a.id === character.equippedHelmetId) : null;

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CharacterAvatar portrait={character.portrait} name={character.name} size={52} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{character.name}</Text>
            <View style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: character.type === 'pc' ? colors.primary + '33' : colors.destructive + '33',
            }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, color: character.type === 'pc' ? colors.primary : colors.destructive }}>
                {character.type.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
            EVA {character.evasion} · FS {character.skills.firearms} · ML {character.skills.melee} · UN {character.skills.unarmed}
          </Text>
        </View>
        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onClone}>
            <Feather name="copy" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit}>
            <Feather name="edit-2" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      {/* HP Bar with controls */}
      <View style={{ marginTop: 10, gap: 6 }}>
        <HPBar current={character.currentHp} max={character.maxHp} height={8} showText />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {[-10, -5, -1].map(delta => (
            <TouchableOpacity
              key={delta}
              style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.destructive + '33', borderRadius: 4 }}
              onPress={() => onHpChange(Math.max(0, character.currentHp + delta))}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{delta}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          {[1, 5, 10].map(delta => (
            <TouchableOpacity
              key={delta}
              style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#4a8c3f33', borderRadius: 4 }}
              onPress={() => onHpChange(Math.min(character.maxHp, character.currentHp + delta))}
            >
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: '#4a8c3f' }}>+{delta}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Equipment */}
      {(weapon || body || helm) && (
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {weapon && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
              <Feather name="crosshair" size={10} color={colors.primary} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{weapon.name}</Text>
            </View>
          )}
          {body && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
              <Feather name="shield" size={10} color={colors.mutedForeground} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{body.name}</Text>
            </View>
          )}
          {helm && helm.id !== 'a_none_head' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
              <Feather name="award" size={10} color={colors.mutedForeground} />
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.foreground }}>{helm.name}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Characters Screen ─────────────────────────────────────────────────────────

export default function CharactersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { characters, allWeapons, allArmor, addCharacter, updateCharacter, deleteCharacter, cloneCharacter } = useApp();
  const [editTarget, setEditTarget] = useState<Character | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const pcs = characters.filter(c => c.type === 'pc');
  const npcs = characters.filter(c => c.type === 'npc');

  const handleSave = (c: Character) => {
    const existing = characters.find(x => x.id === c.id);
    if (existing) {
      updateCharacter(c);
    } else {
      addCharacter(c);
    }
  };

  const confirmDelete = (c: Character) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete ${c.name}?`)) deleteCharacter(c.id);
    } else {
      Alert.alert('Delete Character', `Remove ${c.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteCharacter(c.id) },
      ]);
    }
  };

  const handleHpChange = (c: Character, newHp: number) => {
    updateCharacter({ ...c, currentHp: newHp });
  };

  const renderSection = (title: string, items: Character[]) => (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2, marginBottom: 10 }}>{title}</Text>
      {items.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }}>No {title.toLowerCase()} yet</Text>
        </View>
      ) : (
        items.map(c => (
          <CharacterCard
            key={c.id}
            character={c}
            allWeapons={allWeapons}
            allArmor={allArmor}
            onEdit={() => { setEditTarget(c); setShowForm(true); }}
            onDelete={() => confirmDelete(c)}
            onClone={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); cloneCharacter(c.id); }}
            onHpChange={newHp => handleHpChange(c, newHp)}
          />
        ))
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2, marginBottom: 4 }}>CHARACTERS</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 16 }}>
          {characters.length} active · {pcs.length} PCs · {npcs.length} NPCs/Enemies
        </Text>

        {renderSection('PLAYER CHARACTERS', pcs)}
        <View style={{ height: 16 }} />
        {renderSection('NPCs & ENEMIES', npcs)}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: insets.bottom + 80,
          right: 20,
          backgroundColor: colors.primary,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
        onPress={() => {
          setEditTarget(null);
          setShowForm(true);
        }}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </TouchableOpacity>

      <CharacterFormModal
        visible={showForm}
        initial={editTarget}
        onClose={() => { setShowForm(false); setEditTarget(null); }}
        onSave={handleSave}
        allWeapons={allWeapons}
        allArmor={allArmor}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
