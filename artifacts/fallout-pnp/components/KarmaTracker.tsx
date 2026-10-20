import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity, localizedConfirm } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Character } from '@/context/types';
import {
  applyKarmaAdjustment,
  karmaGroupFor,
  karmaTitleFor,
  MAX_KARMA_REASON_LENGTH,
  parseKarmaAdjustment,
  removeKarmaLogEntry,
} from '@/data/karma';

interface KarmaTrackerProps {
  character: Character;
  onChange: (character: Character) => void;
}

function createEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export default function KarmaTracker({ character, onChange }: KarmaTrackerProps) {
  const colors = useColors();
  const [changeInput, setChangeInput] = useState('');
  const [reason, setReason] = useState('');

  const karma = character.karma ?? 0;
  const karmaLog = character.karmaLog ?? [];
  const group = karmaGroupFor(karma);
  const title = karmaTitleFor(character.level, karma);
  const parsedChange = parseKarmaAdjustment(changeInput);
  const preview = parsedChange === null ? null : applyKarmaAdjustment(karma, parsedChange);
  const trimmedReason = reason.trim();
  const canRecord = parsedChange !== null
    && parsedChange !== 0
    && preview !== null
    && trimmedReason.length > 0
    && trimmedReason.length <= MAX_KARMA_REASON_LENGTH;
  const recordDisabledReason = changeInput.trim().length === 0
    ? 'Enter a non-zero whole-number change and a required explanation to enable recording.'
    : parsedChange === null
      ? 'Enter a non-zero whole number, such as plus 25 or minus 10.'
      : parsedChange === 0
        ? 'Enter a non-zero whole number. Zero does not create a Karma history entry.'
        : preview === null
          ? 'Karma is already at its limit for that adjustment.'
          : trimmedReason.length === 0
            ? 'Add an explanation to enable recording.'
            : trimmedReason.length > MAX_KARMA_REASON_LENGTH
              ? `Keep the explanation to ${MAX_KARMA_REASON_LENGTH} characters or fewer.`
              : '';
  const groupColor = group === 'Good' || group === 'Very Good'
    ? colors.success
    : group === 'Evil' || group === 'Very Evil'
      ? colors.destructive
      : colors.primary;

  const deleteEntry = (entryId: string) => {
    const updated = removeKarmaLogEntry(karmaLog, entryId);
    if (!updated) return;
    onChange({
      ...character,
      karma: updated.karma,
      karmaLog: updated.karmaLog,
    });
  };

  const confirmDeleteEntry = (entryId: string) => {
    const title = 'Are you sure?';
    const message = 'Delete this Karma history entry? The total will be recalculated from the remaining entries. This cannot be undone.';
    if (Platform.OS === 'web') {
      if (localizedConfirm(title, message)) {
        deleteEntry(entryId);
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(entryId) },
    ]);
  };

  const recordChange = () => {
    if (!canRecord || preview === null || parsedChange === null) return;

    const createdAt = Date.now();
    onChange({
      ...character,
      karma: preview.karma,
      karmaLog: [
        ...karmaLog,
        {
          id: createEntryId(),
          change: preview.appliedChange,
          reason: trimmedReason,
          createdAt,
        },
      ],
    });
    setChangeInput('');
    setReason('');
  };

  return (
    <View style={{ gap: 14 }}>
      <View
        accessible
        accessibilityLabel={`Current Karma total: ${karma > 0 ? 'plus ' : karma < 0 ? 'minus ' : ''}${Math.abs(karma)}. Standing: ${group}. Level ${character.level} title: ${title}.`}
        testID="karma-summary"
        style={{
          alignItems: 'center',
          padding: 18,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: groupColor + '88',
          backgroundColor: groupColor + '16',
          gap: 5,
        }}
      >
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: groupColor, letterSpacing: 2 }}>
          {group.toUpperCase()} KARMA
        </Text>
        <Text style={{ fontSize: 36, lineHeight: 42, fontFamily: 'Inter_700Bold', color: groupColor }}>
          {karma > 0 ? `+${karma}` : karma}
        </Text>
        <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center' }}>
          {title}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
          Based on level {character.level} and current Karma
        </Text>
      </View>

      <View style={{ gap: 9, padding: 14, borderRadius: colors.radius, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>
          RECORD KARMA CHANGE
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
          Enter a positive or negative  number. Add an explanation. The total is Limited to −1000 to +1000.
        </Text>
        <TextInput
          accessibilityLabel="Karma change amount"
          accessibilityHint="Enter a positive or negative whole number. The amount cannot be zero."
          testID="karma-change-input"
          value={changeInput}
          onChangeText={setChangeInput}
          placeholder="Change, e.g. +25 or -10"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numbers-and-punctuation"
          returnKeyType="next"
          style={{
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            padding: 11,
            color: colors.foreground,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
          }}
        />
        {changeInput.length > 0 && parsedChange === null && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            Enter a non-zero whole number, such as +25 or −10.
          </Text>
        )}
        {parsedChange === 0 && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            Enter a non-zero whole number. Zero does not create a Karma history entry.
          </Text>
        )}
        {parsedChange !== null && preview === null && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            Karma is already at its limit for that adjustment.
          </Text>
        )}
        <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.8 }}>
          EXPLANATION (REQUIRED)
        </Text>
        <TextInput
          accessibilityLabel="Explanation for Karma change"
          accessibilityHint={`Required. Explain why the Karma total changed. Up to ${MAX_KARMA_REASON_LENGTH} characters.`}
          testID="karma-reason-input"
          value={reason}
          onChangeText={setReason}
          placeholder="Why Karma changed"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={MAX_KARMA_REASON_LENGTH}
          textAlignVertical="top"
          style={{
            minHeight: 76,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: colors.radius,
            padding: 11,
            color: colors.foreground,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
          }}
        />
        {reason.length > 0 && trimmedReason.length === 0 && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
            An explanation is required.
          </Text>
        )}
        {preview && preview.appliedChange !== parsedChange && (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
            Only {preview.appliedChange > 0 ? '+' : ''}{preview.appliedChange} will be applied to stay within the Karma limit.
          </Text>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Record Karma change"
          accessibilityHint={canRecord ? 'Adds this signed amount and explanation to Karma history.' : recordDisabledReason}
          accessibilityState={{ disabled: !canRecord }}
          testID="karma-record-change"
          disabled={!canRecord}
          onPress={recordChange}
          style={{
            alignItems: 'center',
            paddingVertical: 11,
            borderRadius: colors.radius,
            backgroundColor: canRecord ? colors.primary : colors.mutedForeground,
            opacity: canRecord ? 1 : 0.55,
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primaryForeground, letterSpacing: 1 }}>
            ADD TO KARMA LOG
          </Text>
        </TouchableOpacity>
        {!canRecord && (
          <Text
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            style={{ fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}
          >
            {recordDisabledReason}
          </Text>
        )}
      </View>

      <View style={{ gap: 9 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 2 }}>
          KARMA HISTORY ({karmaLog.length})
        </Text>
        {karmaLog.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 24, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' }}>
              No Karma changes recorded. This character starts at 0 (Neutral).
            </Text>
          </View>
        ) : (
          [...karmaLog].sort((a, b) => a.createdAt - b.createdAt).map(entry => {
            const changeColor = entry.change > 0
              ? colors.success
              : entry.change < 0
                ? colors.destructive
                : colors.mutedForeground;
            const date = new Date(entry.createdAt);
            const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
            return (
              <View
                key={entry.id}
                testID={`karma-entry-${entry.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 11,
                  padding: 12,
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                }}
              >
                <View
                  accessible
                  accessibilityLabel={`Karma change: ${entry.change > 0 ? 'plus' : entry.change < 0 ? 'minus' : 'zero'} ${Math.abs(entry.change)}. Explanation: ${entry.reason}. Date: ${dateLabel}.`}
                  style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}
                >
                  <Text style={{ flexShrink: 0, minWidth: 44, fontSize: 14, fontFamily: 'Inter_700Bold', color: changeColor }}>
                    {entry.change > 0 ? `+${entry.change}` : entry.change}
                  </Text>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={{ fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                      {entry.reason}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                      {dateLabel}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Delete Karma log entry: ${entry.reason}`}
                  accessibilityHint="Asks you to confirm before deleting this entry"
                  testID={`karma-delete-entry-${entry.id}`}
                  onPress={() => confirmDeleteEntry(entry.id)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: -6,
                    marginRight: -5,
                  }}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
