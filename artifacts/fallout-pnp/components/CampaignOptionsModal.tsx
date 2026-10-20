import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Text as NativeText,
  View,
} from 'react-native';
import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput, LocalizedTouchableOpacity as TouchableOpacity, localizedConfirm } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useApp } from '@/context/AppContext';
import { useLocalization } from '@/context/LocalizationContext';
import { useColors } from '@/hooks/useColors';
import { useVaultRadioStatus } from '@/context/VaultRadioContext';
import { THEME_SWATCHES } from '@/constants/colors';
import RadioStationsModal from '@/components/RadioStationsModal';
import {
  formatHardcoreRadiationPenalties,
  HARDCORE_RADIATION_RULES,
  type GhoulRadiationHealingOption,
} from '@/data/radiation';
import type { VaultRadioTrack, VaultRadioTrackMetadata } from '@/data/vaultRadio';
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

function CollapsibleSectionButton({
  title,
  expanded,
  onPress,
  testID,
  summary,
}: {
  title: string;
  expanded: boolean;
  onPress: () => void;
  testID: string;
  summary?: string;
}) {
  const palette = useColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
      testID={testID}
      onPress={onPress}
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: expanded ? palette.primary : palette.border,
        borderRadius: palette.radius,
        backgroundColor: palette.secondary,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{
          fontSize: 12,
          fontFamily: 'Inter_700Bold',
          color: palette.primary,
          letterSpacing: 1.2,
        }}>
          {title.toUpperCase()}
        </Text>
        {!expanded && summary ? (
          <Text numberOfLines={1} style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
            {summary}
          </Text>
        ) : null}
      </View>
      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.primary} />
    </TouchableOpacity>
  );
}

function VaultRadioNowPlaying({
  track,
  hasPlaybackError,
  canSkip,
  onPrevious,
  onNext,
}: {
  track: { title: string; artist: string | null } | null;
  hasPlaybackError: boolean;
  canSkip: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const palette = useColors();
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: palette.radius,
      backgroundColor: palette.card,
    }}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{
          fontSize: 10,
          fontFamily: 'Inter_700Bold',
          color: palette.primary,
          letterSpacing: 1.1,
        }}>
          NOW PLAYING
        </Text>
        {track ? (
          <>
            <NativeText
              numberOfLines={2}
              style={{ fontSize: 13, lineHeight: 17, fontFamily: 'Inter_700Bold', color: palette.foreground }}
            >
              {track.title}
            </NativeText>
            {track.artist ? (
              <NativeText
                numberOfLines={1}
                style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}
              >
                {track.artist}
              </NativeText>
            ) : (
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                Unknown artist
              </Text>
            )}
          </>
        ) : (
          <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
            {hasPlaybackError ? 'No track playing' : 'Loading track…'}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous track"
          disabled={!canSkip}
          testID="vault-radio-previous"
          onPress={onPrevious}
          style={{
            width: 38,
            height: 38,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: palette.radius,
            opacity: canSkip ? 1 : 0.45,
          }}
        >
          <Feather name="skip-back" size={17} color={canSkip ? palette.primary : palette.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next track"
          disabled={!canSkip}
          testID="vault-radio-next"
          onPress={onNext}
          style={{
            width: 38,
            height: 38,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: palette.radius,
            opacity: canSkip ? 1 : 0.45,
          }}
        >
          <Feather name="skip-forward" size={17} color={canSkip ? palette.primary : palette.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function VaultRadioTrackLabels({
  tracks,
  isLoading,
  metadataLoading,
  loadFailed,
  saveFailed,
  onChange,
}: {
  tracks: VaultRadioTrack[];
  isLoading: boolean;
  metadataLoading: boolean;
  loadFailed: boolean;
  saveFailed: boolean;
  onChange: (file: string, field: keyof VaultRadioTrackMetadata, value: string) => void;
}) {
  const palette = useColors();
  const inputStyle = {
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: palette.radius,
    backgroundColor: palette.background,
    color: palette.foreground,
    fontSize: 13,
    fontFamily: 'Inter_400Regular' as const,
  };

  return (
    <View style={{ gap: 10 }}>
      <SectionHeading title="Added Track Labels" />
      {loadFailed ? (
        <Text accessibilityRole="alert" style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: palette.destructive }}>
          Saved Vault Radio labels could not be loaded. Restart the app before editing them.
        </Text>
      ) : isLoading || metadataLoading ? (
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
          Loading uploaded tracks…
        </Text>
      ) : tracks.length === 0 ? (
        <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
          No additional uploaded tracks are available.
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
            Set titles and artists for tracks added outside the built-in collection.
          </Text>
          {tracks.map((track, index) => (
            <View
              key={track.file}
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: palette.radius,
                backgroundColor: palette.secondary,
                gap: 9,
              }}
            >
              <NativeText
                numberOfLines={1}
                style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}
              >
                {track.file}
              </NativeText>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: palette.foreground }}>
                  Title
                </Text>
                <LocalizedTextInput
                  accessibilityLabel={`Title for ${track.file}`}
                  accessibilityHint="Saved on this device and used when the track plays."
                  testID={`vault-radio-track-title-${index}`}
                  value={track.title}
                  onChangeText={value => onChange(track.file, 'title', value)}
                  placeholder="Track title"
                  placeholderTextColor={palette.mutedForeground}
                  autoCapitalize="sentences"
                  style={inputStyle}
                />
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: palette.foreground }}>
                  Artist
                </Text>
                <LocalizedTextInput
                  accessibilityLabel={`Artist for ${track.file}`}
                  accessibilityHint="Saved on this device and used when the track plays."
                  testID={`vault-radio-track-artist-${index}`}
                  value={track.artist ?? ''}
                  onChangeText={value => onChange(track.file, 'artist', value)}
                  placeholder="Artist (optional)"
                  placeholderTextColor={palette.mutedForeground}
                  autoCapitalize="words"
                  style={inputStyle}
                />
              </View>
            </View>
          ))}
        </>
      )}
      {saveFailed && (
        <Text accessibilityRole="alert" style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: palette.destructive }}>
          Vault Radio labels could not be saved. Check available device storage and try again.
        </Text>
      )}
    </View>
  );
}

function ThemeSwitch({
  value,
  onValueChange,
  label,
  hint,
  testID,
  activeColor,
  inactiveColor,
  thumbColor,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  hint: string;
  testID: string;
  activeColor: string;
  inactiveColor: string;
  thumbColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      testID={testID}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={{
        width: 48,
        height: 28,
        padding: 3,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: value ? activeColor : inactiveColor,
        backgroundColor: value ? activeColor : inactiveColor,
        alignItems: value ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: thumbColor,
        }}
      />
    </Pressable>
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
      <ThemeSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        label={label}
        hint={description}
        activeColor={palette.primary}
        inactiveColor={palette.border}
        thumbColor={palette.card}
      />
    </View>
  );
}

function PreferenceSliderRow({
  label,
  description,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  description: string;
  value: number;
  onValueChange: (value: number) => void;
  testID: string;
}) {
  const palette = useColors();
  const sliderWidth = useRef(1);
  const percent = Math.round(value * 100);
  const updateFromPosition = (x: number) => {
    const next = Math.max(0, Math.min(1, x / sliderWidth.current));
    onValueChange(Math.round(next * 100) / 100);
  };

  return (
    <View style={{
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: palette.radius,
      backgroundColor: palette.secondary,
      gap: 8,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.foreground }}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.primary, minWidth: 38, textAlign: 'right' }}>
          {percent}%
        </Text>
      </View>
      <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
        {description}
      </Text>
      <View
        testID={testID}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityHint="Swipe up or down to adjust the music volume."
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => {
          const delta = event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05;
          onValueChange(Math.max(0, Math.min(1, Math.round((value + delta) * 100) / 100)));
        }}
        onLayout={event => { sliderWidth.current = Math.max(1, event.nativeEvent.layout.width); }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={event => updateFromPosition(event.nativeEvent.locationX)}
        onResponderMove={event => updateFromPosition(event.nativeEvent.locationX)}
        style={{ height: 36, justifyContent: 'center', marginHorizontal: 7 }}
      >
        <View pointerEvents="none" style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: palette.border,
          overflow: 'hidden',
        }}>
          <View style={{ width: `${percent}%`, height: '100%', backgroundColor: palette.primary }} />
        </View>
        <View pointerEvents="none" style={{
          position: 'absolute',
          left: `${percent}%`,
          marginLeft: -9,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: palette.primary,
          borderWidth: 2,
          borderColor: palette.card,
        }} />
      </View>
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
  const modalTopInset = Math.max(insets.top, Platform.OS === 'web' ? 67 : 56);
  const {
    hardcoreRadiationRules,
    setHardcoreRadiationRules,
    missingExplosiveBlastZoneHouseRule,
    setMissingExplosiveBlastZoneHouseRule,
    automaticInventoryTrackingEnabled,
    setAutomaticInventoryTrackingEnabled,
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
    musicVolume,
    setMusicVolume,
    restoreBuiltInBestiaryDefaults,
  } = useApp();
  const { locale, setLocale } = useLocalization();
  const {
    hasPlaybackError,
    currentTrack,
    canSkip,
    skipPrevious,
    skipNext,
  } = useVaultRadioStatus();
  const [showRadioStations, setShowRadioStations] = useState(false);
  const [showGameplayOptions, setShowGameplayOptions] = useState(false);
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);
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
  const selectedLanguageLabel = APP_LANGUAGES.find(language => language.locale === locale)?.label ?? locale;
  const restoreBestiary = () => {
    const message = 'This restores the current built-in NPC roster and removes its edits and removals. Custom NPCs and catalog photos are kept.';
    if (Platform.OS === 'web') {
      if (localizedConfirm('Restore default Bestiary?', message)) restoreBuiltInBestiaryDefaults();
      return;
    }
    Alert.alert('Restore default Bestiary?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore defaults', style: 'destructive', onPress: restoreBuiltInBestiaryDefaults },
    ]);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={closeOptions} testID="campaign-options-modal">
        <View
          style={{ flex: 1, paddingTop: modalTopInset, backgroundColor: palette.background }}
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

          <KeyboardAwareScrollViewCompat
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={20}
          >
            <CollapsibleSectionButton
              title="Gameplay Options"
              expanded={showGameplayOptions}
              onPress={() => setShowGameplayOptions(open => !open)}
              testID="campaign-gameplay-options-toggle"
            />
            {showGameplayOptions && (
              <View style={{ gap: 10 }}>
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
                        Hardcore Radiation Penalties
                      </Text>
                      <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
                        Optional campaign-wide SPECIAL penalties. Separate from core radiation sickness.
                      </Text>
                    </View>
                    <ThemeSwitch
                      testID="hardcore-radiation-toggle"
                      value={hardcoreRadiationRules}
                      onValueChange={handleHardcoreToggle}
                      label="Enable Hardcore radiation penalties"
                      hint="Applies optional campaign-wide SPECIAL penalties"
                      activeColor={palette.primary}
                      inactiveColor={palette.border}
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
                  label="5m Blast Radius for Explosive Ammo"
                  description="House rule: built-in explosive ammo without a manual blast range gets one 5-meter zone, matching a standard mine. Turn this off to restore the original profiles; printed blast zones are unchanged."
                  value={missingExplosiveBlastZoneHouseRule}
                  onValueChange={setMissingExplosiveBlastZoneHouseRule}
                  testID="explosive-ammo-mine-radius-toggle"
                />

                <PreferenceSwitchRow
                  label="Automatic Inventory Tracking"
                  description="Track reserve ammo and subtract one carried chem, medical kit, or other consumable each time it is used. Existing magazines stay loaded; player characters start with 0 reserve rounds, while NPCs receive about 10 turns of ammo per ranged weapon."
                  value={automaticInventoryTrackingEnabled}
                  onValueChange={setAutomaticInventoryTrackingEnabled}
                  testID="automatic-inventory-tracking-toggle"
                />

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
              </View>
            )}

            {!hideLanguageOptions && (
              <>
                <CollapsibleSectionButton
                  title="Language"
                  summary={selectedLanguageLabel}
                  expanded={showLanguageOptions}
                  onPress={() => setShowLanguageOptions(open => !open)}
                  testID="campaign-language-options-toggle"
                />
                {showLanguageOptions && (
                  <View style={{ gap: 9 }}>
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
                  </View>
                )}
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
              description="Includes the main menu neon buzz and button sound."
              value={systemSoundsEnabled}
              onValueChange={setSystemSoundsEnabled}
              testID="system-sounds-toggle"
            />
            <PreferenceSwitchRow
              label="Combat Sounds"
              description="Plays a brief impact when attack damage is applied."
              value={combatSoundsEnabled}
              onValueChange={setCombatSoundsEnabled}
              testID="combat-sounds-toggle"
            />
            <PreferenceSwitchRow
              label="Enable Radio"
              description="Turn radio playback on or off."
              value={musicEnabled}
              onValueChange={setMusicEnabled}
              testID="radio-toggle"
            />
            {musicEnabled && (
              <>
                <VaultRadioNowPlaying
                  track={currentTrack}
                  hasPlaybackError={hasPlaybackError}
                  canSkip={canSkip}
                  onPrevious={skipPrevious}
                  onNext={skipNext}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Change Radio Station"
                  testID="radio-station-change"
                  onPress={() => setShowRadioStations(true)}
                  style={{
                    minHeight: 46,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: palette.border,
                    borderRadius: palette.radius,
                    backgroundColor: palette.secondary,
                  }}
                >
                  <Feather name="radio" size={15} color={palette.primary} />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.primary, letterSpacing: 0.5 }}>
                    Change Radio Station
                  </Text>
                </TouchableOpacity>
                <PreferenceSliderRow
                  label="Radio volume"
                  description="Set the radio volume."
                  value={musicVolume}
                  onValueChange={setMusicVolume}
                  testID="radio-volume"
                />
              </>
            )}
            {musicEnabled && hasPlaybackError && (
              <Text accessibilityRole="alert" style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: palette.destructive }}>
                Unable to load this station. Check the connection and audio files.
              </Text>
            )}

            <Text style={{ fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', color: palette.mutedForeground }}>
              Restore built-in NPCs hidden or edited in the Bestiary. Custom NPCs and catalog photos are kept.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              testID="restore-default-bestiary"
              onPress={restoreBestiary}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderWidth: 1, borderColor: palette.destructive, borderRadius: palette.radius, backgroundColor: palette.destructive + '12' }}
            >
              <Feather name="rotate-ccw" size={15} color={palette.destructive} />
              <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.destructive, letterSpacing: 0.7 }}>
                RESTORE DEFAULT BESTIARY
              </Text>
            </TouchableOpacity>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>

      <RadioStationsModal
        visible={showRadioStations}
        onClose={() => setShowRadioStations(false)}
      />

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
