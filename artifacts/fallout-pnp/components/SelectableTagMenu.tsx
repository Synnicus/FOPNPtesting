import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from '@/components/LocalizedText';
import type { CampaignRuleTag } from '@/context/types';
import { useColors } from '@/hooks/useColors';

export function SelectableTagMenu({
  title,
  buttonLabel,
  customTagButtonLabel,
  testID,
  options,
  selectedTagIds,
  onToggle,
  onAddCustomTag,
}: {
  title: string;
  buttonLabel: string;
  customTagButtonLabel: string;
  testID: string;
  options: readonly CampaignRuleTag[];
  selectedTagIds: readonly string[];
  onToggle: (tagId: string) => void;
  onAddCustomTag: (label: string) => void;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [customTagLabel, setCustomTagLabel] = useState('');
  const selected = new Set(selectedTagIds);

  const addCustomTag = () => {
    onAddCustomTag(customTagLabel);
    setCustomTagLabel('');
    setShowCustomTagInput(false);
  };

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
      {selectedTagIds.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
          {selectedTagIds.map((tagId, index) => (
            <React.Fragment key={tagId}>
              {index > 0 && <Text style={{ color: colors.mutedForeground, fontSize: 10 }}> · </Text>}
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                {options.find(tag => tag.id === tagId)?.label ?? tagId}
              </Text>
            </React.Fragment>
          ))}
        </View>
      )}
      {expanded && (
        <View style={{ marginTop: 7, padding: 8, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.background }}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 190 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {options.map(tag => {
                const isSelected = selected.has(tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    testID={`${testID}-option-${tag.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onToggle(tag.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? `${colors.primary}22` : 'transparent',
                      paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6,
                      marginRight: 6, marginBottom: 6,
                    }}
                  >
                    <Text style={{ color: isSelected ? colors.primary : colors.foreground, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                testID={`${testID}-add-custom`}
                accessibilityRole="button"
                accessibilityState={{ expanded: showCustomTagInput }}
                onPress={() => setShowCustomTagInput(value => !value)}
                style={{
                  paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6,
                  borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed',
                  marginRight: 6, marginBottom: 6,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' }}>{customTagButtonLabel}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          {showCustomTagInput && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={customTagLabel}
                  onChangeText={setCustomTagLabel}
                  placeholder="TAG NAME"
                  placeholderTextColor={colors.mutedForeground}
                  style={{
                    borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius,
                    paddingHorizontal: 9, paddingVertical: 8, color: colors.foreground,
                    backgroundColor: colors.secondary, minHeight: 38,
                  }}
                />
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={addCustomTag}
                style={{ paddingHorizontal: 9, paddingVertical: 9, borderRadius: 6, backgroundColor: colors.primary }}
              >
                <Text style={{ color: colors.primaryForeground, fontSize: 10, fontFamily: 'Inter_700Bold' }}>ADD TAG</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => { setShowCustomTagInput(false); setCustomTagLabel(''); }}
                style={{ paddingHorizontal: 9, paddingVertical: 9, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_700Bold' }}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
