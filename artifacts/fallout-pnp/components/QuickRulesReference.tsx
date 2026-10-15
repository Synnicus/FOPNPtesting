import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { QUICK_RULES, searchQuickRules, type QuickRule, type QuickRuleTable } from '@/data/quickRules';

function RuleTable({ table }: { table: QuickRuleTable }) {
  const colors = useColors();

  return (
    <View
      testID={`quick-rule-table-${table.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
      style={{
        padding: 12,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: 7,
      }}
    >
      <Text accessibilityRole="header" style={{
        fontSize: 12,
        lineHeight: 17,
        fontFamily: 'Inter_700Bold',
        color: colors.primary,
      }}>
        {table.title}
      </Text>
      {table.rows.map((row, index) => {
        const values = row.values.map((value, columnIndex) =>
          `${table.columns[columnIndex] ?? 'Value'}: ${value}`,
        );
        const accessibleLabel = [row.label, ...values, row.description]
          .filter(Boolean)
          .join('. ');
        return (
          <View
            key={`${row.label}-${index}`}
            accessible
            accessibilityLabel={accessibleLabel}
            testID={`quick-rule-table-row-${table.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 8,
              borderRadius: colors.radius,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={{
                width: 74,
                fontSize: 11,
                lineHeight: 16,
                fontFamily: 'Inter_700Bold',
                color: colors.foreground,
              }}>
                {row.label}
              </Text>
              <View style={{ flex: 1, gap: 2 }}>
                {values.map((value, valueIndex) => (
                  <Text
                    key={`${valueIndex}-${value}`}
                    style={{
                      fontSize: 11,
                      lineHeight: 16,
                      fontFamily: 'Inter_600SemiBold',
                      color: colors.primary,
                    }}
                  >
                    {value}
                  </Text>
                ))}
              </View>
            </View>
            {row.description ? (
              <Text style={{
                marginLeft: 84,
                fontSize: 11,
                lineHeight: 16,
                fontFamily: 'Inter_400Regular',
                color: colors.mutedForeground,
              }}>
                {row.description}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function RuleDetailModal({
  rule,
  onClose,
}: {
  rule: QuickRule | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tables = rule?.tables ?? [];

  return (
    <Modal
      visible={rule !== null}
      animationType="slide"
      onRequestClose={onClose}
      testID="quick-rule-detail-modal"
    >
      <View
        accessibilityViewIsModal
        style={{
          flex: 1,
          paddingTop: insets.top,
          backgroundColor: colors.background,
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}>
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              accessibilityLabel={rule?.title ?? 'Rule details'}
              style={{
                fontSize: 16,
                lineHeight: 21,
                fontFamily: 'Inter_700Bold',
                letterSpacing: 0.8,
                color: colors.primary,
              }}
            >
              {rule?.title ?? ''}
            </Text>
            <Text style={{
              marginTop: 3,
              fontSize: 10,
              fontFamily: 'Inter_700Bold',
              letterSpacing: 1,
              color: colors.mutedForeground,
            }}>
              DETAILED RULE
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Close ${rule?.title ?? 'rule'} details`}
            accessibilityHint="Returns to Quick Rules search"
            testID="quick-rule-detail-close"
            onPress={onClose}
            style={{ padding: 7 }}
          >
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(24, insets.bottom + 24),
            gap: 14,
          }}
          showsVerticalScrollIndicator
        >
          <Text style={{
            fontSize: 14,
            lineHeight: 21,
            fontFamily: 'Inter_600SemiBold',
            color: colors.foreground,
          }}>
            {rule?.preview ?? ''}
          </Text>

          {rule?.details.map((paragraph, index) => (
            <Text
              key={`${rule.id}-paragraph-${index}`}
              testID={`quick-rule-detail-paragraph-${index + 1}`}
              style={{
                fontSize: 14,
                lineHeight: 22,
                fontFamily: 'Inter_400Regular',
                color: colors.foreground,
              }}
            >
              {paragraph}
            </Text>
          ))}

          {tables.map(table => (
            <RuleTable key={table.title} table={table} />
          ))}

          <View style={{
            padding: 12,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondary,
          }}>
            <Text style={{
              fontSize: 10,
              fontFamily: 'Inter_700Bold',
              letterSpacing: 1,
              color: colors.mutedForeground,
            }}>
              MANUAL REFERENCE
            </Text>
            <Text
              accessibilityLabel={`Fallout PnP 2.0 manual, ${rule?.manualPages ?? ''}`}
              testID="quick-rule-manual-reference"
              style={{
                marginTop: 4,
                fontSize: 13,
                fontFamily: 'Inter_700Bold',
                color: colors.primary,
              }}
            >
              Fallout PnP 2.0 · {rule?.manualPages ?? ''}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function QuickRulesReference() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [selectedRule, setSelectedRule] = useState<QuickRule | null>(null);
  const results = useMemo(() => searchQuickRules(query), [query]);
  const twoColumns = width >= 360;

  return (
    <View
      testID="quick-rules-reference"
      style={{
        marginTop: 24,
        padding: 16,
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text accessibilityRole="header" style={{
          fontSize: 11,
          fontFamily: 'Inter_700Bold',
          color: colors.mutedForeground,
          letterSpacing: 2,
        }}>
          QUICK RULES REFERENCE
        </Text>
        <Text style={{
          fontSize: 11,
          lineHeight: 16,
          fontFamily: 'Inter_400Regular',
          color: colors.mutedForeground,
        }}>
          Search a topic, then open it for the manual summary and tables.
        </Text>
      </View>

      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.input,
      }}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          accessibilityLabel="Search Quick Rules"
          accessibilityHint="Filters rule topics by name, keywords, explanations, and table entries"
          testID="quick-rules-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search rules or keywords…"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            paddingVertical: 10,
            fontSize: 13,
            fontFamily: 'Inter_400Regular',
            color: colors.foreground,
          }}
        />
        {query.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear Quick Rules search"
            testID="quick-rules-search-clear"
            onPress={() => setQuery('')}
            style={{ padding: 4 }}
          >
            <Feather name="x-circle" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text
        accessibilityLiveRegion="polite"
        testID="quick-rules-result-count"
        style={{
          fontSize: 10,
          fontFamily: 'Inter_600SemiBold',
          color: colors.mutedForeground,
        }}
      >
        {results.length} {results.length === 1 ? 'TOPIC' : 'TOPICS'}
      </Text>

      {results.length === 0 ? (
        <View
          accessibilityLiveRegion="polite"
          testID="quick-rules-empty-state"
          style={{
            padding: 16,
            alignItems: 'center',
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondary,
            gap: 5,
          }}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <Text style={{
            fontSize: 13,
            fontFamily: 'Inter_700Bold',
            color: colors.foreground,
          }}>
            No rules found
          </Text>
          <Text style={{
            fontSize: 11,
            lineHeight: 16,
            fontFamily: 'Inter_400Regular',
            color: colors.mutedForeground,
            textAlign: 'center',
          }}>
            Try another rule name or keyword.
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          {results.map(rule => (
            <TouchableOpacity
              key={rule.id}
              accessibilityRole="button"
              accessibilityLabel={`${rule.title}. ${rule.preview}. Manual ${rule.manualPages}.`}
              accessibilityHint="Opens the detailed rule explanation and any related tables"
              testID={`quick-rule-card-${rule.id}`}
              onPress={() => setSelectedRule(rule)}
              style={{
                width: twoColumns ? '48.5%' : '100%',
                minHeight: 94,
                padding: 11,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondary,
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
                <Feather name="book-open" size={14} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={{
                  flex: 1,
                  fontSize: 12,
                  lineHeight: 16,
                  fontFamily: 'Inter_700Bold',
                  color: colors.foreground,
                }}>
                  {rule.title}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 10,
                  lineHeight: 14,
                  fontFamily: 'Inter_400Regular',
                  color: colors.mutedForeground,
                }}
              >
                {rule.preview}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                <Text style={{
                  fontSize: 9,
                  fontFamily: 'Inter_700Bold',
                  color: colors.primary,
                  letterSpacing: 0.4,
                }}>
                  {rule.manualPages.toUpperCase()}
                </Text>
                <Feather name="arrow-up-right" size={13} color={colors.primary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <RuleDetailModal rule={selectedRule} onClose={() => setSelectedRule(null)} />
    </View>
  );
}
