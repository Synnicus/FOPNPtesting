import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Character } from '@/context/types';
import {
  applyKarmaAdjustment,
  karmaGroupFor,
  karmaTitleFor,
  MAX_KARMA_REASON_LENGTH,
  parseKarmaAdjustment,
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
  const canRecord = preview !== null && trimmedReason.length > 0 && trimmedReason.length <= MAX_KARMA_REASON_LENGTH;
  const groupColor = group === 'Good' || group === 'Very Good'
    ? '#4a8c3f'
    : group === 'Evil' || group === 'Very Evil'
      ? colors.destructive
      : colors.primary;

  const recordChange = () => {
    if (!canRecord || !preview || parsedChange === null) return;

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
        accessibilityLabel={`Karma ${karma}, ${group}. Title: ${title}.`}
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
          Enter a positive or negative whole number and why Karma changed. The total is limited to −1000 to +1000.
        </Text>
        <TextInput
          accessibilityLabel="Karma change amount"
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
          karmaLog.map(entry => {
            const changeColor = entry.change > 0 ? '#4a8c3f' : colors.destructive;
            const date = new Date(entry.createdAt);
            const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
            return (
              <View
                key={entry.id}
                accessible
                accessibilityLabel={`${dateLabel}. ${entry.change > 0 ? 'Karma increased' : 'Karma decreased'} by ${Math.abs(entry.change)}. ${entry.reason}`}
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
                <Text style={{ minWidth: 44, fontSize: 14, fontFamily: 'Inter_700Bold', color: changeColor }}>
                  {entry.change > 0 ? `+${entry.change}` : entry.change}
                </Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                    {entry.reason}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                    {dateLabel}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
