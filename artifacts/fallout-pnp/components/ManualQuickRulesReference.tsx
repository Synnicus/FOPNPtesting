import React, { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text as NativeText, View } from 'react-native';
import type { TextProps } from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import { useLocalization } from '@/context/LocalizationContext';
import { translateText } from '@/data/localization';
import { useColors } from '@/hooks/useColors';
import { getManualCatalogDestinations, type ManualCatalogDestination } from '@/data/manualCatalogNavigation';
import type { QuickRule, QuickRuleTable } from '@/data/quickRules';
import {
  countQuickRuleResults,
  highlightManualSearchText,
  searchQuickRuleSections,
} from '@/data/manualRuleSections';

function HighlightedText({ value, query, style, ...textProps }: Omit<TextProps, 'children'> & {
  value: string;
  query: string;
}) {
  const colors = useColors();
  const { locale } = useLocalization();
  const displayedValue = translateText(value, locale);
  const terms = query.trim().split(/\s+/).filter(Boolean).flatMap(term => [
    term,
    translateText(term, locale),
  ]);
  const segments = highlightManualSearchText(displayedValue, terms.join(' '));

  return (
    <NativeText
      {...textProps}
      accessibilityLabel={textProps.accessibilityLabel
        ? translateText(textProps.accessibilityLabel, locale)
        : undefined}
      accessibilityHint={textProps.accessibilityHint
        ? translateText(textProps.accessibilityHint, locale)
        : undefined}
      style={style}
    >
      {segments.map((segment, index) => segment.highlighted
        ? (
          <NativeText
            key={`match-${index}`}
            style={{
              color: colors.primaryForeground,
              backgroundColor: colors.primary,
              fontFamily: 'Inter_700Bold',
            }}
          >
            {segment.text}
          </NativeText>
        )
        : segment.text)}
    </NativeText>
  );
}

function ManualTable({ table, query }: { table: QuickRuleTable; query: string }) {
  const colors = useColors();
  const slug = table.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <View
      testID={`quick-rule-table-${slug}`}
      style={{
        padding: 11,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: 7,
      }}
    >
      <HighlightedText value={table.title} query={query} accessibilityRole="header" style={{
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        color: colors.primary,
      }} />
      {table.rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          accessible
          accessibilityLabel={[
            row.label,
            ...row.values.map((value, columnIndex) => `${table.columns[columnIndex] ?? 'Value'}: ${value}`),
            row.description,
          ].filter(Boolean).join('. ')}
          testID={`quick-rule-table-row-${slug}-${index + 1}`}
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
          <View style={{ gap: 4 }}>
            <HighlightedText value={row.label} query={query} style={{
              fontSize: 11,
              fontFamily: 'Inter_700Bold',
              color: colors.foreground,
            }} />
            <View style={{ gap: 2 }}>
              {row.values.map((value, valueIndex) => (
                <HighlightedText
                  key={`${valueIndex}-${value}`}
                  value={`${table.columns[valueIndex] ? `${table.columns[valueIndex]}: ` : ''}${value}`}
                  query={query}
                  style={{
                  fontSize: 11,
                  fontFamily: 'Inter_600SemiBold',
                  color: colors.primary,
                  }}
                />
              ))}
            </View>
          </View>
          {row.description ? (
            <HighlightedText value={row.description} query={query} style={{
              fontSize: 11,
              fontFamily: 'Inter_400Regular',
              color: colors.mutedForeground,
            }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function openCatalog(destination: ManualCatalogDestination) {
  if (destination.screen === 'equipment') {
    router.navigate({
      pathname: '/(tabs)/equipment',
      params: {
        manualTab: destination.tab,
        manualCategory: destination.category,
      },
    });
    return;
  }

  router.navigate({
    pathname: '/(tabs)/bestiary',
    params: {
      manualSearch: destination.search,
      manualAll: destination.allEntries ? 'true' : undefined,
    },
  });
}

function RuleEntry({ rule, query }: { rule: QuickRule; query: string }) {
  const colors = useColors();
  const catalogDestinations = getManualCatalogDestinations(rule.id);
  return (
    <View
      testID={`quick-rule-entry-${rule.id}`}
      style={{
        padding: 12,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 10,
      }}
    >
      <View style={{ gap: 3 }}>
        <HighlightedText value={rule.title} query={query} accessibilityRole="header" style={{
          fontSize: 13,
          fontFamily: 'Inter_700Bold',
          color: colors.foreground,
        }} />
        <HighlightedText value={rule.preview} query={query} style={{
          fontSize: 11,
          fontFamily: 'Inter_600SemiBold',
          color: colors.mutedForeground,
        }} />
      </View>
      {rule.details.map((paragraph, index) => (
        <HighlightedText
          key={`${rule.id}-${index}`}
          value={paragraph}
          query={query}
          testID={`quick-rule-detail-paragraph-${rule.id}-${index + 1}`}
          style={{
            fontSize: 12,
            fontFamily: 'Inter_400Regular',
            color: colors.foreground,
          }}
        />
      ))}
      {catalogDestinations.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {catalogDestinations.map((destination, index) => (
            <TouchableOpacity
              key={`${destination.screen}-${destination.label}`}
              accessibilityRole="button"
              accessibilityLabel={`Open ${destination.label} in the ${destination.screen === 'equipment' ? 'Equipment' : 'Bestiary'} tab`}
              testID={`quick-rule-catalog-link-${rule.id}-${index + 1}`}
              onPress={() => openCatalog(destination)}
              style={{
                minHeight: 40,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 11,
                paddingVertical: 8,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.primary + '66',
                backgroundColor: colors.secondary,
              }}
            >
              <Feather name="arrow-up-right" size={13} color={colors.primary} />
              <Text style={{
                fontSize: 11,
                fontFamily: 'Inter_700Bold',
                color: colors.primary,
              }}>
                {destination.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {rule.tables?.map(item => <ManualTable key={item.title} table={item} query={query} />)}
      <HighlightedText
        value={`FALLOUT PNP 2.0 · ${rule.manualPages.toUpperCase()}`}
        query={query}
        accessibilityLabel={`Fallout PnP 2.0 manual, ${rule.manualPages}`}
        testID={`quick-rule-manual-reference-${rule.id}`}
        style={{
          fontSize: 10,
          fontFamily: 'Inter_700Bold',
          letterSpacing: 0.5,
          color: colors.primary,
        }}
      />
    </View>
  );
}

export default function ManualQuickRulesReference() {
  const colors = useColors();
  const { locale } = useLocalization();
  const [query, setQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedSubsections, setExpandedSubsections] = useState<Record<string, boolean>>({});
  const results = useMemo(
    () => searchQuickRuleSections(query, undefined, value => translateText(value, locale)),
    [query, locale],
  );
  const topicCount = countQuickRuleResults(results);
  const searching = query.trim().length > 0;

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
      <View style={{ gap: 4 }}>
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
          fontFamily: 'Inter_400Regular',
          color: colors.mutedForeground,
        }}>
          Browse the manual by part and chapter, or search for a rule, term, or table value.
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
          accessibilityLabel="Search the Fallout PnP manual"
          accessibilityHint="Searches rule names, explanations, manual sections, index terms, and table entries"
          testID="quick-rules-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: 10,
            fontSize: 13,
            fontFamily: 'Inter_400Regular',
            color: colors.foreground,
          }}
        />
        {query.length > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear manual search"
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
        {topicCount} {topicCount === 1 ? 'MATCHING TOPIC' : 'MATCHING TOPICS'} · {results.length} {results.length === 1 ? 'PART' : 'PARTS'}
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
            fontFamily: 'Inter_400Regular',
            color: colors.mutedForeground,
            textAlign: 'center',
          }}>
            Try a manual term, topic, skill, or table value.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {results.map(({ section, subsections }) => {
            const sectionOpen = searching || expandedSections[section.id] === true;
            return (
              <View
                key={section.id}
                testID={`quick-rule-section-${section.id}`}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  overflow: 'hidden',
                  backgroundColor: colors.secondary,
                }}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${section.title}. ${section.description}`}
                  accessibilityState={{ expanded: sectionOpen }}
                  testID={`quick-rule-section-toggle-${section.id}`}
                  onPress={() => setExpandedSections(current => ({
                    ...current,
                    [section.id]: !current[section.id],
                  }))}
                  style={{
                    minHeight: 52,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 9,
                    backgroundColor: colors.background,
                  }}
                >
                  <Feather name="book-open" size={15} color={colors.primary} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <HighlightedText value={section.title} query={query} style={{
                      fontSize: 12,
                      fontFamily: 'Inter_700Bold',
                      color: colors.foreground,
                    }} />
                    <HighlightedText value={section.manualPages.toUpperCase()} query={query} style={{
                      fontSize: 9,
                      fontFamily: 'Inter_600SemiBold',
                      color: colors.mutedForeground,
                    }} />
                  </View>
                  <Feather name={sectionOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
                {sectionOpen ? (
                  <View style={{ padding: 8, gap: 7 }}>
                    <HighlightedText value={section.description} query={query} style={{
                      paddingHorizontal: 4,
                      fontSize: 11,
                      fontFamily: 'Inter_400Regular',
                      color: colors.mutedForeground,
                    }} />
                    {subsections.map(child => {
                      const subsectionKey = `${section.id}:${child.id}`;
                      const childOpen = searching || expandedSubsections[subsectionKey] === true;
                      return (
                        <View
                          key={child.id}
                          testID={`quick-rule-subsection-${child.id}`}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: colors.radius,
                            overflow: 'hidden',
                            backgroundColor: colors.background,
                          }}
                        >
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`${child.title}, manual ${child.manualPages}`}
                            accessibilityState={{ expanded: childOpen }}
                            testID={`quick-rule-subsection-toggle-${child.id}`}
                            onPress={() => setExpandedSubsections(current => ({
                              ...current,
                              [subsectionKey]: !current[subsectionKey],
                            }))}
                            style={{
                              minHeight: 43,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <HighlightedText value={child.title} query={query} style={{
                              flex: 1,
                              minWidth: 0,
                              flexShrink: 1,
                              fontSize: 11,
                              fontFamily: 'Inter_700Bold',
                              color: colors.foreground,
                            }} />
                            <HighlightedText value={child.manualPages} query={query} style={{
                              flexShrink: 1,
                              maxWidth: '30%',
                              textAlign: 'right',
                              fontSize: 9,
                              fontFamily: 'Inter_600SemiBold',
                              color: colors.mutedForeground,
                            }} />
                            <Feather name={childOpen ? 'minus' : 'plus'} size={15} color={colors.primary} />
                          </TouchableOpacity>
                          {childOpen ? (
                            <View style={{
                              padding: 8,
                              paddingTop: 0,
                              gap: 8,
                            }}>
                              {child.rules.map(item => <RuleEntry key={item.id} rule={item} query={query} />)}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
