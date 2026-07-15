import React, { useState } from 'react';
import {
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
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { BestiaryTemplate, Character } from '@/context/types';
import { BESTIARY_TEMPLATES, BESTIARY_CATEGORIES } from '@/data/bestiary';

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const CATEGORY_ICONS: Record<string, string> = {
  Raiders: 'user-x',
  Ghouls: 'moon',
  'Super Mutants': 'zap',
  Deathclaws: 'alert-triangle',
};

function SpawnModal({
  template,
  onClose,
  onSpawn,
}: {
  template: BestiaryTemplate | null;
  onClose: () => void;
  onSpawn: (name: string) => void;
}) {
  const colors = useColors();
  const [customName, setCustomName] = useState('');

  React.useEffect(() => {
    setCustomName(template?.name ?? '');
  }, [template]);

  if (!template) return null;

  const finalName = customName.trim() || template.name;

  return (
    <Modal visible={!!template} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primary,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <View style={{ backgroundColor: colors.primary + '22', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.primary + '44' }}>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2 }}>SPAWN ENEMY</Text>
            <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginTop: 4 }}>{template.name}</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{template.category} · {template.variant}</Text>
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            {/* Stats preview */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'HP', value: template.maxHp },
                { label: 'EVA', value: template.evasion },
                { label: 'FS', value: template.skills.firearms },
                { label: 'ML', value: template.skills.melee },
                { label: 'UN', value: template.skills.unarmed },
              ].map(stat => (
                <View key={stat.label} style={{ flex: 1, alignItems: 'center', backgroundColor: colors.secondary, borderRadius: 6, padding: 8 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.primary }}>{stat.value}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1 }}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Custom name */}
            <View>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 6 }}>CUSTOM NAME (optional)</Text>
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
                value={customName}
                onChangeText={setCustomName}
                placeholder={template.name}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Buttons */}
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onSpawn(finalName);
                onClose();
              }}
            >
              <Feather name="plus-circle" size={18} color={colors.primaryForeground} />
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>
                SPAWN {finalName.toUpperCase()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 10, alignItems: 'center' }}
              onPress={onClose}
            >
              <Text style={{ fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BestiaryCard({ template, onPress }: { template: BestiaryTemplate; onPress: () => void }) {
  const colors = useColors();
  const icon = CATEGORY_ICONS[template.category] ?? 'alert-circle';
  return (
    <TouchableOpacity
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 8,
      }}
      onPress={onPress}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon as any} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }} numberOfLines={1}>{template.name}</Text>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{template.variant}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <StatChip label="HP" value={template.maxHp} color="#4a8c3f" />
        <StatChip label="EVA" value={template.evasion} color={colors.primary} />
        {template.skills.firearms > 0 && <StatChip label="FS" value={template.skills.firearms} color={colors.mutedForeground} />}
        {template.skills.melee > 0 && <StatChip label="ML" value={template.skills.melee} color={colors.mutedForeground} />}
        {template.skills.unarmed > 0 && <StatChip label="UN" value={template.skills.unarmed} color={colors.mutedForeground} />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <Feather name="plus" size={12} color={colors.primary} />
        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>SPAWN</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useColors();
  return (
    <View style={{ backgroundColor: colors.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', gap: 3 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color }}>{value}</Text>
    </View>
  );
}

export default function BestiaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addCharacter, allWeapons, allArmor } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [spawnTarget, setSpawnTarget] = useState<BestiaryTemplate | null>(null);

  const categories = ['All', ...BESTIARY_CATEGORIES];
  const filtered = selectedCategory === 'All'
    ? BESTIARY_TEMPLATES
    : BESTIARY_TEMPLATES.filter(t => t.category === selectedCategory);

  const handleSpawn = (template: BestiaryTemplate, name: string) => {
    const char: Character = {
      id: genId(),
      name,
      type: 'npc',
      maxHp: template.maxHp,
      currentHp: template.maxHp,
      evasion: template.evasion,
      skills: { ...template.skills },
      equippedWeaponId: template.equippedWeaponId,
      equippedBodyArmorId: template.equippedBodyArmorId,
      equippedHelmetId: template.equippedHelmetId,
      portrait: null,
    };
    addCharacter(char);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : 0 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 2, marginBottom: 4 }}>BESTIARY</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, letterSpacing: 1, marginBottom: 14 }}>
          {BESTIARY_TEMPLATES.length} templates — tap to spawn into combat
        </Text>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: selectedCategory === cat ? colors.primary : colors.secondary,
                borderWidth: 1,
                borderColor: selectedCategory === cat ? colors.primary : colors.border,
              }}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: selectedCategory === cat ? colors.primaryForeground : colors.mutedForeground }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Grid */}
        {filtered.map((_, i) => {
          if (i % 2 !== 0) return null;
          const left = filtered[i];
          const right = filtered[i + 1];
          return (
            <View key={left.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <BestiaryCard template={left} onPress={() => setSpawnTarget(left)} />
              {right
                ? <BestiaryCard template={right} onPress={() => setSpawnTarget(right)} />
                : <View style={{ flex: 1 }} />
              }
            </View>
          );
        })}
      </ScrollView>

      <SpawnModal
        template={spawnTarget}
        onClose={() => setSpawnTarget(null)}
        onSpawn={name => spawnTarget && handleSpawn(spawnTarget, name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
