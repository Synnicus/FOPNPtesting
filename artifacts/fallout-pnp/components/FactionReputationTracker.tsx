import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
  localizedConfirm,
} from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type {
  Character,
  FactionReputation,
  FactionReputationKind,
} from '@/context/types';
import {
  applyFactionReputationAdjustment,
  DEFAULT_FACTION_THRESHOLD_PROFILE,
  FACTION_THRESHOLD_PROFILES,
  factionReputationTitle,
  getFactionThresholdProfile,
  MAX_FACTION_COUNT,
  MAX_FACTION_LOG_ENTRIES,
  MAX_FACTION_NAME_LENGTH,
  MAX_FACTION_REASON_LENGTH,
  MAX_FACTION_TITLE_LENGTH,
  parseFactionReputationAdjustment,
  removeFactionReputationLogEntry,
} from '@/data/factionReputation';

interface FactionReputationTrackerProps {
  character: Character;
  onChange: (character: Character) => void;
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (localizedConfirm(title, message)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

function FactionCard({
  faction,
  onChange,
  onDelete,
}: {
  faction: FactionReputation;
  onChange: (next: FactionReputation) => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const [kind, setKind] = useState<FactionReputationKind>('fame');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const parsedChange = parseFactionReputationAdjustment(amountInput);
  const current = kind === 'fame' ? faction.fame : faction.infamy;
  const preview = parsedChange === null
    ? null
    : applyFactionReputationAdjustment(current, parsedChange);
  const trimmedReason = reason.trim();
  const atHistoryLimit = faction.log.length >= MAX_FACTION_LOG_ENTRIES;
  const canRecord = parsedChange !== null
    && preview !== null
    && !atHistoryLimit
    && trimmedReason.length > 0
    && trimmedReason.length <= MAX_FACTION_REASON_LENGTH;
  const currentProfile = getFactionThresholdProfile(faction.thresholdProfile);
  const automatedTitle = factionReputationTitle({ ...faction, customTitle: undefined });

  const updateCustomTitle = (value: string) => {
    onChange({ ...faction, customTitle: value || undefined });
  };

  const recordChange = () => {
    if (!canRecord || parsedChange === null || preview === null) {
      setFormError(atHistoryLimit
        ? "This faction's reputation history is full."
        : parsedChange !== null && preview === null
          ? 'No points in this category are available to remove.'
          : 'Enter a non-zero whole number and an explanation.');
      return;
    }
    onChange({
      ...faction,
      [kind]: preview.total,
      log: [
        ...faction.log,
        {
          id: createId(),
          kind,
          change: preview.appliedChange,
          reason: trimmedReason,
          createdAt: Date.now(),
        },
      ],
    });
    setAmountInput('');
    setReason('');
    setFormError('');
  };

  const deleteEntry = (entryId: string) => {
    const updated = removeFactionReputationLogEntry(faction, entryId);
    if (updated) onChange(updated);
  };

  return (
    <View
      testID={`faction-reputation-${faction.id}`}
      style={{
        gap: 12,
        padding: 14,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1.5 }}>
            FACTION
          </Text>
          <Text
            accessibilityRole="header"
            style={{ marginTop: 3, fontSize: 17, lineHeight: 22, fontFamily: 'Inter_700Bold', color: colors.foreground }}
          >
            {faction.name}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Delete faction"
          testID={`faction-delete-${faction.id}`}
          onPress={() => confirmAction(
            'Are you sure?',
            'Delete this faction and its entire reputation history? This cannot be undone.',
            onDelete,
          )}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: -7, marginRight: -6 }}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 9 }}>
        <View style={{ flex: 1, gap: 3, alignItems: 'center', padding: 10, borderRadius: colors.radius, backgroundColor: colors.primary + '16', borderWidth: 1, borderColor: colors.primary + '55' }}>
          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>FAME</Text>
          <Text testID={`faction-fame-${faction.id}`} style={{ fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold', color: colors.primary }}>{faction.fame}</Text>
        </View>
        <View style={{ flex: 1, gap: 3, alignItems: 'center', padding: 10, borderRadius: colors.radius, backgroundColor: colors.destructive + '16', borderWidth: 1, borderColor: colors.destructive + '55' }}>
          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.destructive, letterSpacing: 1 }}>INFAMY</Text>
          <Text testID={`faction-infamy-${faction.id}`} style={{ fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold', color: colors.destructive }}>{faction.infamy}</Text>
        </View>
      </View>

      <View
        testID={`faction-title-${faction.id}`}
        style={{ alignItems: 'center', gap: 4, paddingVertical: 9 }}
      >
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.2 }}>
          AUTOMATED REPUTATION TITLE
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 23, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center' }}>
          {faction.customTitle?.trim() ? `${faction.customTitle.trim()} - ` : ''}
          {automatedTitle}
        </Text>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
          {currentProfile.name} · {currentProfile.thresholds.join(' / ')}
        </Text>
      </View>

      <View style={{ gap: 7 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.8 }}>
          CUSTOM TITLE (OPTIONAL)
        </Text>
        <TextInput
          accessibilityLabel="Custom title, e.g. Paladin"
          testID={`faction-custom-title-${faction.id}`}
          value={faction.customTitle ?? ''}
          onChangeText={updateCustomTitle}
          placeholder="Custom title, e.g. Paladin"
          placeholderTextColor={colors.mutedForeground}
          maxLength={MAX_FACTION_TITLE_LENGTH}
          style={{
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            padding: 10,
            color: colors.foreground,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
          }}
        />
      </View>

      <View style={{ gap: 9, padding: 12, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>
          RECORD REPUTATION CHANGE
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
          Add Fame or Infamy points with an explanation. Negative changes reduce that total.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['fame', 'infamy'] as const).map(option => {
            const selected = kind === option;
            const color = option === 'fame' ? colors.primary : colors.destructive;
            return (
              <TouchableOpacity
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`faction-kind-${faction.id}-${option}`}
                onPress={() => { setKind(option); setFormError(''); }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 9,
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: selected ? color : colors.border,
                  backgroundColor: selected ? color + '20' : colors.background,
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: selected ? color : colors.mutedForeground }}>
                  {option.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel="Faction reputation change amount"
          testID={`faction-change-input-${faction.id}`}
          value={amountInput}
          onChangeText={value => { setAmountInput(value); setFormError(''); }}
          placeholder="Change, e.g. +5 or -2"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numbers-and-punctuation"
          returnKeyType="next"
          style={{
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            padding: 10,
            color: colors.foreground,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
          }}
        />
        {amountInput.length > 0 && parsedChange === null ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            Enter a non-zero whole number, such as +25 or −10.
          </Text>
        ) : null}
        {parsedChange !== null && preview === null ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            No points in this category are available to remove.
          </Text>
        ) : null}
        {atHistoryLimit ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            This faction's reputation history is full.
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel="Explanation for faction reputation change"
          testID={`faction-reason-input-${faction.id}`}
          value={reason}
          onChangeText={value => { setReason(value); setFormError(''); }}
          placeholder="Why did reputation change?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={MAX_FACTION_REASON_LENGTH}
          textAlignVertical="top"
          style={{
            minHeight: 64,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            padding: 10,
            color: colors.foreground,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
          }}
        />
        {reason.length > 0 && trimmedReason.length === 0 ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            An explanation is required.
          </Text>
        ) : null}
        {formError ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            {formError}
          </Text>
        ) : null}
        {preview && parsedChange !== null && preview.appliedChange !== parsedChange ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            Some points were not applied because the total cannot go below zero.
          </Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Record reputation change"
          accessibilityState={{ disabled: !canRecord }}
          testID={`faction-record-change-${faction.id}`}
          disabled={!canRecord}
          onPress={recordChange}
          style={{
            alignItems: 'center',
            paddingVertical: 10,
            borderRadius: colors.radius,
            backgroundColor: canRecord ? colors.primary : colors.mutedForeground,
            opacity: canRecord ? 1 : 0.55,
          }}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 0.8 }}>
            ADD TO REPUTATION LOG
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 1.2 }}>
          REPUTATION HISTORY <Text>({faction.log.length})</Text>
        </Text>
        {faction.log.length === 0 ? (
          <Text style={{ paddingVertical: 8, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            No reputation changes recorded yet.
          </Text>
        ) : (
          [...faction.log].sort((a, b) => a.createdAt - b.createdAt).map(entry => {
            const date = new Date(entry.createdAt);
            const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
            const entryColor = entry.kind === 'fame' ? colors.primary : colors.destructive;
            return (
              <View
                key={entry.id}
                testID={`faction-log-entry-${entry.id}`}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: entryColor, letterSpacing: 0.7 }}>
                      {entry.kind.toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: entryColor }}>
                      {entry.change > 0 ? `+${entry.change}` : entry.change}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                    {entry.reason}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{dateLabel}</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Delete reputation entry"
                  accessibilityHint="Asks you to confirm before deleting this entry"
                  testID={`faction-delete-entry-${faction.id}-${entry.id}`}
                  onPress={() => confirmAction(
                    'Are you sure?',
                    'Delete this reputation entry? The total will be recalculated from remaining entries.',
                    () => deleteEntry(entry.id),
                  )}
                  style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: -5, marginRight: -5 }}
                >
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

export default function FactionReputationTracker({ character, onChange }: FactionReputationTrackerProps) {
  const colors = useColors();
  const [newFactionName, setNewFactionName] = useState('');
  const [thresholdProfile, setThresholdProfile] = useState(DEFAULT_FACTION_THRESHOLD_PROFILE);
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [addError, setAddError] = useState('');
  const factions = character.factionReputations ?? [];

  const addFaction = () => {
    const name = newFactionName.trim();
    if (!name) {
      setAddError('Enter a faction name.');
      return;
    }
    if (factions.length >= MAX_FACTION_COUNT) {
      setAddError('The faction tracker is full.');
      return;
    }
    if (factions.some(faction => faction.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setAddError('A faction with that name is already being tracked.');
      return;
    }
    const faction: FactionReputation = {
      id: createId(),
      name: name.slice(0, MAX_FACTION_NAME_LENGTH),
      thresholdProfile,
      fame: 0,
      infamy: 0,
      log: [],
    };
    onChange({ ...character, factionReputations: [...factions, faction] });
    setNewFactionName('');
    setAddError('');
    setShowProfilePicker(false);
  };

  const updateFaction = (id: string, next: FactionReputation) => {
    onChange({
      ...character,
      factionReputations: factions.map(faction => faction.id === id ? next : faction),
    });
  };

  const deleteFaction = (id: string) => {
    onChange({
      ...character,
      factionReputations: factions.filter(faction => faction.id !== id),
    });
  };

  const selectedProfile = getFactionThresholdProfile(thresholdProfile);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1.5 }}>
          FACTION REPUTATION
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 17, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
          Track Fame and Infamy separately. The faction's threshold profile determines its New Vegas-style reputation title.
        </Text>
      </View>

      <View style={{ gap: 9, padding: 13, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }}>
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>
          ADD A FACTION
        </Text>
        <TextInput
          accessibilityLabel="Faction name"
          testID="faction-name-input"
          value={newFactionName}
          onChangeText={value => { setNewFactionName(value); setAddError(''); }}
          placeholder="Faction name"
          placeholderTextColor={colors.mutedForeground}
          maxLength={MAX_FACTION_NAME_LENGTH}
          returnKeyType="done"
          onSubmitEditing={addFaction}
          style={{
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            padding: 10,
            color: colors.foreground,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
          }}
        />
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.8 }}>
            THRESHOLD PROFILE
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Threshold profile"
            accessibilityState={{ expanded: showProfilePicker }}
            testID="faction-threshold-profile-picker"
            onPress={() => setShowProfilePicker(value => !value)}
            style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
          >
            <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
              {selectedProfile.name} · {selectedProfile.thresholds.join(' / ')}
            </Text>
            <Feather name={showProfilePicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {showProfilePicker && (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.background }}
            >
              {FACTION_THRESHOLD_PROFILES.map(profile => (
                <TouchableOpacity
                  key={profile.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: profile.id === thresholdProfile }}
                  testID={`faction-threshold-profile-${profile.id}`}
                  onPress={() => { setThresholdProfile(profile.id); setShowProfilePicker(false); }}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: profile.id === thresholdProfile ? colors.primary : colors.foreground }}>
                    {profile.name} · {profile.thresholds.join(' / ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        {addError ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.destructive }}>{addError}</Text>
        ) : null}
        {factions.length >= MAX_FACTION_COUNT ? (
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            The faction tracker is full.
          </Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add faction"
          testID="faction-add"
          disabled={newFactionName.trim().length === 0 || factions.length >= MAX_FACTION_COUNT}
          onPress={addFaction}
          style={{ alignItems: 'center', paddingVertical: 10, borderRadius: colors.radius, backgroundColor: newFactionName.trim() && factions.length < MAX_FACTION_COUNT ? colors.primary : colors.mutedForeground, opacity: newFactionName.trim() && factions.length < MAX_FACTION_COUNT ? 1 : 0.55 }}
        >
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>
            ADD FACTION
          </Text>
        </TouchableOpacity>
      </View>

      {factions.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 20, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }}>
          <Text style={{ fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
            No factions tracked yet. Add one above to begin recording Fame and Infamy.
          </Text>
        </View>
      ) : factions.map(faction => (
        <FactionCard
          key={faction.id}
          faction={faction}
          onChange={next => updateFaction(faction.id, next)}
          onDelete={() => deleteFaction(faction.id)}
        />
      ))}
    </View>
  );
}
