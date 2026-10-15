import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  ScrollView,
  Switch,
  Platform,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { useLocalization } from '@/context/LocalizationContext';
import { useColors } from '@/hooks/useColors';
import { THEME_SWATCHES } from '@/constants/colors';
import {
  formatHardcoreRadiationPenalties,
  HARDCORE_RADIATION_RULES,
  type GhoulRadiationHealingOption,
} from '@/data/radiation';
import type { CampaignVisualTheme } from '@/data/campaignOptions';
import { APP_LANGUAGES } from '@/data/localization';

function SectionHeading({ title }: { title: string }) {
  const palette = useColors();
  return (
    <Text accessibilityRole="header" style={{
      marginTop: 8,
      marginBottom: 10,
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      color: palette.primary,
      letterSpacing: 1.5,
    }}>
      {title.toUpperCase()}
    </Text>
  );
}

function PreferenceSwitchRow({
  label,
  description,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID: string;
}) {
  const palette = useColors();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: palette.radius,
      backgroundColor: palette.secondary,
    }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
          {label}
        </Text>
        <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
          {description}
        </Text>
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked: value }}
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: palette.border, true: palette.primary }}
        thumbColor={palette.card}
      />
    </View>
  );
}

const GHOUL_RADIATION_RULE_OPTIONS: {
  value: GhoulRadiationHealingOption;
  label: string;
  description: string;
}[] = [
  { value: 1, label: 'Option 1 · Immune, no healing', description: 'Ghouls have 100% radiation resistance and gain no healing from radiation (Fallout 1 & 2).' },
  { value: 2, label: 'Option 2 · 1 HP per 10 rads', description: 'Ghouls heal 1 HP for every 10 radiation points they absorb (Fallout 3 and New Vegas).' },
  { value: 3, label: 'Option 3 · 1 HP per 3 rads', description: 'Ghouls heal 1 HP for every 3 radiation points they absorb (official Fallout tabletop).' },
  { value: 4, label: 'Option 4 · 1 HP per rad', description: 'Ghouls heal 1 HP for every radiation point they absorb.' },
];

function HardcoreRadiationPreviewModal({
  visible,
  enabled,
  onClose,
}: {
  visible: boolean;
  enabled: boolean;
  onClose: () => void;
}) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const headingRef = useRef<View>(null);
  const thresholds = HARDCORE_RADIATION_RULES.filter(rule => rule.threshold > 0).reverse();

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    const focusTimeout = setTimeout(() => {
      const headingNode = findNodeHandle(headingRef.current);
      if (headingNode !== null) AccessibilityInfo.setAccessibilityFocus(headingNode);
    }, 350);
    return () => clearTimeout(focusTimeout);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="hardcore-radiation-preview-modal"
    >
      <View
        accessibilityViewIsModal
        accessibilityLabel="Hardcore radiation rules preview"
        style={{ flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', padding: 20 }}
      >
        <View style={{
          maxHeight: '88%',
          backgroundColor: palette.card,
          borderRadius: palette.radius,
          borderWidth: 1,
          borderColor: palette.destructive + '88',
          overflow: 'hidden',
        }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: palette.border, gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View
                ref={headingRef}
                accessible
                accessibilityRole="header"
                accessibilityLabel="Hardcore radiation rules preview"
              >
                <Text accessible={false} style={{
                flex: 1,
                fontSize: 16,
                fontFamily: 'Inter_700Bold',
                color: palette.destructive,
                letterSpacing: 1,
              }}>
                HARDCORE RADIATION
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close Hardcore radiation rules preview"
                accessibilityHint="Returns to campaign options without changing the setting"
                testID="hardcore-radiation-preview-close"
                onPress={onClose}
                style={{ padding: 4 }}
              >
                <Feather name="x" size={20} color={palette.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text
              accessibilityLabel={`Optional campaign-wide SPECIAL penalties. Currently ${enabled ? 'enabled' : 'disabled'}.`}
              style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}
            >
              Optional campaign-wide SPECIAL penalties · {enabled ? 'Currently enabled' : 'Currently disabled'}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(16, insets.bottom), gap: 12 }}>
            <View
              accessible
              accessibilityLabel="Core Fallout PnP 2.0 radiation sickness. Sickness labels remain narrative-only at 200, 400, 600, 800, and 1000 radiation."
              testID="hardcore-radiation-core-sickness"
              style={{
                padding: 12,
                borderRadius: palette.radius,
                backgroundColor: palette.secondary,
                borderWidth: 1,
                borderColor: palette.border,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: palette.foreground, letterSpacing: 0.7 }}>
                SEPARATE FROM CORE SICKNESS
              </Text>
              <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                Fallout PnP 2.0 sickness labels remain narrative-only at 200, 400, 600, 800, and 1000 radiation. The optional penalties below use their own thresholds.
              </Text>
            </View>
            <View style={{ gap: 7 }}>
              {thresholds.map(rule => (
                <View
                  accessible
                  accessibilityLabel={`${rule.threshold} rads. ${formatHardcoreRadiationPenalties(rule.threshold)}${rule.fatal ? '. Fatal, instant death' : ''}`}
                  key={rule.threshold}
                  testID={`hardcore-radiation-threshold-${rule.threshold}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    borderRadius: palette.radius,
                    backgroundColor: palette.destructive + '0d',
                    borderWidth: 1,
                    borderColor: palette.destructive + '44',
                    gap: 12,
                  }}
                >
                  <View style={{ width: 58 }}>
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.destructive }}>{rule.threshold}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: palette.mutedForeground, letterSpacing: 0.7 }}>RADS</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
                    {formatHardcoreRadiationPenalties(rule.threshold)}{rule.fatal ? ' · FATAL / INSTANT DEATH' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CampaignOptionsModal({
  visible,
  onClose,
  hideLanguageOptions = false,
}: {
  visible: boolean;
  onClose: () => void;
  hideLanguageOptions?: boolean;
}) {
  const palette = useColors();
  const insets = useSafeAreaInsets();
  const {
    hardcoreRadiationRules,
    setHardcoreRadiationRules,
    mutantGhoulRadiationRules,
    setMutantGhoulRadiationRules,
    ghoulRadiationHealingOption,
    setGhoulRadiationHealingOption,
    visualTheme,
    setVisualTheme,
    systemSoundsEnabled,
    setSystemSoundsEnabled,
    combatSoundsEnabled,
    setCombatSoundsEnabled,
    musicEnabled,
    setMusicEnabled,
  } = useApp();
  const { locale, setLocale } = useLocalization();
  const [showHardcoreWarning, setShowHardcoreWarning] = useState(false);
  const [showHardcorePreview, setShowHardcorePreview] = useState(false);
  const previewTriggerRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const previewCloseFocusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeHardcorePreview = () => {
    setShowHardcorePreview(false);
    if (Platform.OS === 'web') return;
    if (previewCloseFocusTimeout.current !== null) clearTimeout(previewCloseFocusTimeout.current);
    previewCloseFocusTimeout.current = setTimeout(() => {
      const triggerNode = findNodeHandle(previewTriggerRef.current);
      if (triggerNode !== null) AccessibilityInfo.setAccessibilityFocus(triggerNode);
      previewCloseFocusTimeout.current = null;
    }, 350);
  };

  useEffect(() => () => {
    if (previewCloseFocusTimeout.current !== null) clearTimeout(previewCloseFocusTimeout.current);
  }, []);

  const closeOptions = () => {
    setShowHardcoreWarning(false);
    setShowHardcorePreview(false);
    if (previewCloseFocusTimeout.current !== null) {
      clearTimeout(previewCloseFocusTimeout.current);
      previewCloseFocusTimeout.current = null;
    }
    onClose();
  };

  const handleHardcoreToggle = (enabled: boolean) => {
    if (enabled) setShowHardcoreWarning(true);
    else setHardcoreRadiationRules(false);
  };

  const chooseTheme = (theme: CampaignVisualTheme) => setVisualTheme(theme);

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={closeOptions} testID="campaign-options-modal">
        <View
          style={{ flex: 1, paddingTop: insets.top, backgroundColor: palette.background }}
          accessibilityElementsHidden={showHardcorePreview}
          importantForAccessibility={showHardcorePreview ? 'no-hide-descendants' : 'auto'}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            backgroundColor: palette.card,
          }}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ fontSize: 17, fontFamily: 'Inter_700Bold', color: palette.primary, letterSpacing: 1.5 }}>
                CAMPAIGN OPTIONS
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: palette.mutedForeground, marginTop: 3 }}>
                Changes are saved automatically
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close campaign options"
              onPress={closeOptions}
              style={{ padding: 6 }}
            >
              <Feather name="x" size={22} color={palette.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 10 }}
            keyboardShouldPersistTaps="handled"
          >
            <SectionHeading title="Gameplay Options" />
            <View style={{
              padding: 14,
              borderWidth: 1,
              borderColor: hardcoreRadiationRules ? palette.destructive : palette.border,
              borderRadius: palette.radius,
              backgroundColor: palette.secondary,
              gap: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
                    Hardcore radiation penalties
                  </Text>
                  <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                    Optional campaign-wide SPECIAL penalties. Separate from core radiation sickness.
                  </Text>
                </View>
                <Switch
                  accessibilityRole="switch"
                  accessibilityLabel="Enable Hardcore radiation penalties"
                  accessibilityHint="Applies optional campaign-wide SPECIAL penalties"
                  accessibilityState={{ checked: hardcoreRadiationRules }}
                  testID="hardcore-radiation-toggle"
                  value={hardcoreRadiationRules}
                  onValueChange={handleHardcoreToggle}
                  trackColor={{ false: palette.border, true: palette.destructive }}
                  thumbColor={palette.card}
                />
              </View>
              <TouchableOpacity
                ref={previewTriggerRef}
                accessibilityRole="button"
                accessibilityLabel={`Review Hardcore radiation thresholds. Currently ${hardcoreRadiationRules ? 'enabled' : 'disabled'}`}
                accessibilityHint="Opens an explanation without changing the campaign setting"
                accessibilityState={{ expanded: showHardcorePreview }}
                testID="hardcore-radiation-preview"
                onPress={() => setShowHardcorePreview(true)}
                style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 3 }}
              >
                <Feather name="info" size={14} color={palette.primary} />
                <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: palette.primary, letterSpacing: 0.5 }}>
                  REVIEW PENALTIES
                </Text>
              </TouchableOpacity>
            </View>

            <PreferenceSwitchRow
              label="Mutant/Ghoul Radiation Immunity/Healing"
              description="Optional lore-friendly rule: Super Mutants, Ghouls, and Deathclaws do not suffer radiation sickness. Choose how radiation affects Ghoul healing below."
              value={mutantGhoulRadiationRules}
              onValueChange={setMutantGhoulRadiationRules}
              testID="mutant-ghoul-radiation-toggle"
            />
            {mutantGhoulRadiationRules && (
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Ghoul radiation healing rules"
                style={{ gap: 7, marginTop: 2 }}
              >
                {GHOUL_RADIATION_RULE_OPTIONS.map(option => {
                  const selected = ghoulRadiationHealingOption === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityHint={option.description}
                      accessibilityState={{ checked: selected }}
                      testID={`ghoul-radiation-option-${option.value}`}
                      onPress={() => setGhoulRadiationHealingOption(option.value)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 11,
                        padding: 12,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? palette.primary : palette.border,
                        borderRadius: palette.radius,
                        backgroundColor: palette.secondary,
                      }}
                    >
                      <Feather
                        name={selected ? 'check-circle' : 'circle'}
                        size={17}
                        color={selected ? palette.primary : palette.mutedForeground}
                        style={{ marginTop: 1 }}
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
                          {option.label}
                        </Text>
                        <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                          {option.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <Text style={{ fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                  Super Mutants, Deathclaws, and Option 1 Ghouls are locked at 100% resistance. Options 2–4 set Ghouls' natural resistance to 0% so they can absorb radiation; worn armor and other protection still reduce it. Healing uses radiation that actually accumulates, up to the meter's 1000-rad cap.
                </Text>
              </View>
            )}

            {!hideLanguageOptions && (
              <>
                <SectionHeading title="Language" />
                <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground, marginBottom: 2 }}>
                  Choose the language used for the app interface, built-in rules, and catalogs.
                </Text>
                <View accessibilityRole="radiogroup" accessibilityLabel="Language" style={{ gap: 7 }}>
                  {APP_LANGUAGES.map(language => {
                    const selected = locale === language.locale;
                    return (
                      <TouchableOpacity
                        key={language.locale}
                        accessibilityRole="radio"
                        accessibilityLabel={language.label}
                        accessibilityState={{ checked: selected }}
                        testID={`language-option-${language.locale}`}
                        onPress={() => setLocale(language.locale)}
                        style={{
                          minHeight: 46,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingHorizontal: 13,
                          paddingVertical: 9,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? palette.primary : palette.border,
                          borderRadius: palette.radius,
                          backgroundColor: palette.secondary,
                        }}
                      >
                        <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.foreground }}>
                          {language.label}
                        </Text>
                        <Feather
                          name={selected ? 'check-circle' : 'circle'}
                          size={18}
                          color={selected ? palette.primary : palette.mutedForeground}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                  Names and notes you enter stay in the language you wrote them.
                </Text>
              </>
            )}

            <SectionHeading title="Theme Options" />
            <View accessibilityRole="radiogroup" accessibilityLabel="Color theme" style={{ gap: 9 }}>
              {([
                { id: 'western', title: 'Western Amber' },
                { id: 'eastern', title: 'Eastern Green' },
              ] as const).map(theme => {
                const selected = visualTheme === theme.id;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    accessibilityRole="radio"
                    accessibilityLabel={theme.title}
                    accessibilityState={{ checked: selected }}
                    testID={`theme-option-${theme.id}`}
                    onPress={() => chooseTheme(theme.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? palette.primary : palette.border,
                      borderRadius: palette.radius,
                      backgroundColor: palette.secondary,
                    }}
                  >
                    <View style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: THEME_SWATCHES[theme.id],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
                        {theme.title}
                      </Text>
                    </View>
                    <Feather
                      name={selected ? 'check-circle' : 'circle'}
                      size={18}
                      color={selected ? palette.primary : palette.mutedForeground}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <SectionHeading title="Audio Options" />
            <PreferenceSwitchRow
              label="System sounds"
              description="Includes the main menu neon buzz."
              value={systemSoundsEnabled}
              onValueChange={setSystemSoundsEnabled}
              testID="system-sounds-toggle"
            />
            <PreferenceSwitchRow
              label="Combat Sounds"
              description="Reserved for future combat sound effects. No combat sounds play yet."
              value={combatSoundsEnabled}
              onValueChange={setCombatSoundsEnabled}
              testID="combat-sounds-toggle"
            />
            <PreferenceSwitchRow
              label="Music"
              description="Saved for future audio support. Music playback is not available yet."
              value={musicEnabled}
              onValueChange={setMusicEnabled}
              testID="music-toggle"
            />
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showHardcoreWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHardcoreWarning(false)}
        testID="hardcore-radiation-warning"
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000cc', padding: 24 }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: palette.card,
            borderRadius: palette.radius,
            borderWidth: 1,
            borderColor: palette.border,
            overflow: 'hidden',
          }}>
            <View style={{ padding: 20, gap: 8 }}>
              <Text accessibilityRole="header" style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.primary, letterSpacing: 1 }}>
                OPTIONAL HARDCORE RULES
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.foreground, lineHeight: 20 }}>
                Hardcore radiation penalties are optional house rules separate from Fallout PnP 2.0. Enabling them applies campaign-wide SPECIAL penalties based on current radiation; 1000 radiation is displayed as fatal/instant death.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border }}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setShowHardcoreWarning(false)}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRightWidth: 1, borderRightColor: palette.border }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.mutedForeground, letterSpacing: 1 }}>
                  CANCEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                testID="hardcore-radiation-confirm-enable"
                onPress={() => {
                  setHardcoreRadiationRules(true);
                  setShowHardcoreWarning(false);
                }}
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.destructive, letterSpacing: 1 }}>
                  ENABLE
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <HardcoreRadiationPreviewModal
        visible={showHardcorePreview}
        enabled={hardcoreRadiationRules}
        onClose={closeHardcorePreview}
      />
    </>
  );
}
