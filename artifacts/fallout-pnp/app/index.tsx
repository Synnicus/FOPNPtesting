import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LocalizedAlert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import CampaignLibraryModal from '@/components/CampaignLibraryModal';
import CampaignOptionsModal from '@/components/CampaignOptionsModal';
import { useApp } from '@/context/AppContext';
import { useLocalization } from '@/context/LocalizationContext';
import { APP_LANGUAGES, translateText, type AppLocale } from '@/data/localization';
import { useColors } from '@/hooks/useColors';

const LANGUAGE_FLAGS: Record<AppLocale, string> = {
  en: '🇺🇸',
  fr: '🇫🇷',
  it: '🇮🇹',
  de: '🇩🇪',
  'es-ES': '🇪🇸',
  'es-MX': '🇲🇽',
  ja: '🇯🇵',
  pl: '🇵🇱',
  'pt-BR': '🇧🇷',
  ru: '🇷🇺',
  'zh-Hant': '🇹🇼',
  'zh-Hans': '🇨🇳',
};

function MenuButton({
  label,
  icon,
  onPress,
  primary = false,
  disabled = false,
  testID,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  testID: string;
}) {
  const colors = useColors();
  const color = primary ? colors.primaryForeground : colors.primary;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={{
        minHeight: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 18,
        borderWidth: primary ? 0 : 1,
        borderColor: colors.primary,
        borderRadius: colors.radius,
        backgroundColor: primary ? colors.primary : colors.card,
        opacity: disabled ? 0.45 : 1,
        shadowColor: primary ? colors.primary : 'transparent',
        shadowOpacity: primary ? 0.25 : 0,
        shadowRadius: primary ? 12 : 0,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Feather name={icon} size={17} color={color} />
      <Text style={{
        fontSize: 13,
        fontFamily: 'Inter_700Bold',
        color,
        letterSpacing: 1.35,
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LanguagePicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { locale, setLocale } = useLocalization();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} testID="language-picker">
      <View style={{
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: insets.top + 64,
        paddingHorizontal: 14,
        backgroundColor: `${colors.foreground}88`,
      }}>
        <View style={{
          width: '100%',
          maxWidth: 340,
          maxHeight: '78%',
          padding: 14,
          gap: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: colors.radius + 4,
          backgroundColor: colors.card,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text accessibilityRole="header" style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1 }}>
              CHOOSE A LANGUAGE
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close language selector" onPress={onClose} style={{ padding: 6 }}>
              <Feather name="x" size={19} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
            {APP_LANGUAGES.map(language => {
              const selected = locale === language.locale;
              return (
                <TouchableOpacity
                  key={language.locale}
                  accessibilityRole="radio"
                  accessibilityLabel={`${language.label} language`}
                  accessibilityState={{ checked: selected }}
                  testID={`menu-language-${language.locale}`}
                  onPress={() => {
                    setLocale(language.locale);
                    onClose();
                  }}
                  style={{
                    minHeight: 43,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingHorizontal: 10,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.secondary,
                  }}
                >
                  <Text style={{ fontSize: 19 }}>{LANGUAGE_FLAGS[language.locale]}</Text>
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                    {language.label}
                  </Text>
                  {selected && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MainMenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loaded, importCampaign } = useApp();
  const { locale } = useLocalization();
  const [showOptions, setShowOptions] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const flicker = useSharedValue(1);

  useEffect(() => {
    flicker.value = withRepeat(
      withSequence(
        withTiming(0.73, { duration: 90 }),
        withTiming(1, { duration: 120 }),
        withTiming(0.9, { duration: 65 }),
        withTiming(1, { duration: 280 }),
        withTiming(0.96, { duration: 55 }),
        withTiming(1, { duration: 2500 }),
      ),
      -1,
      false,
    );
  }, [flicker]);

  const neonStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));

  const continueCampaign = () => {
    if (loaded) router.replace('/(tabs)');
  };

  const startNewCampaign = () => {
    const start = () => {
      const ok = importCampaign(JSON.stringify({
        characters: [],
        customWeapons: [],
        customArmor: [],
      }));
      if (ok) router.replace('/(tabs)');
    };
    const title = translateText('Start a new campaign?', locale);
    const message = translateText(
      'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.',
      locale,
    );
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) start();
    } else {
      LocalizedAlert.alert('Start a new campaign?', 'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start New Campaign', style: 'destructive', onPress: start },
      ]);
    }
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Language: ${APP_LANGUAGES.find(item => item.locale === locale)?.label ?? locale}`}
        accessibilityHint="Opens language options"
        testID="menu-language-selector"
        onPress={() => setShowLanguages(true)}
        style={{
          position: 'absolute',
          zIndex: 2,
          top: Math.max(insets.top, webTopInset) + 10,
          right: 18,
          minWidth: 58,
          height: 42,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: colors.radius,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ fontSize: 20 }}>{LANGUAGE_FLAGS[locale]}</Text>
        <Feather name="chevron-down" size={12} color={colors.primary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: Math.max(insets.top, webTopInset) + 54,
          paddingBottom: Math.max(insets.bottom, webBottomInset) + 22,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 20 }}>
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 212,
            paddingHorizontal: 18,
            paddingVertical: 23,
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: colors.radius + 4,
            backgroundColor: colors.card,
            shadowColor: colors.primary,
            shadowOpacity: 0.18,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 0 },
          }}>
            <View style={{ position: 'absolute', left: 16, right: 16, top: 12, height: 1, backgroundColor: colors.primary, opacity: 0.2 }} />
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12, height: 1, backgroundColor: colors.primary, opacity: 0.2 }} />
            <Animated.View style={[{ alignItems: 'center', gap: 1 }, neonStyle]}>
              <Text style={{
                fontSize: 32,
                lineHeight: 37,
                fontFamily: 'Inter_700Bold',
                color: colors.primary,
                letterSpacing: 8,
                textShadowColor: colors.primary,
                textShadowRadius: 11,
                textShadowOffset: { width: 0, height: 0 },
              }}>
                PNP
              </Text>
              <Text style={{
                fontSize: 19,
                lineHeight: 27,
                fontFamily: 'Inter_700Bold',
                color: colors.primary,
                letterSpacing: 2,
                textAlign: 'center',
                textShadowColor: colors.primary,
                textShadowRadius: 8,
                textShadowOffset: { width: 0, height: 0 },
              }}>
                COMBAT
              </Text>
              <Text style={{
                fontSize: 19,
                lineHeight: 27,
                fontFamily: 'Inter_700Bold',
                color: colors.primary,
                letterSpacing: 2,
                textAlign: 'center',
                textShadowColor: colors.primary,
                textShadowRadius: 8,
                textShadowOffset: { width: 0, height: 0 },
              }}>
                CALCULATOR
              </Text>
            </Animated.View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <View style={{ width: 20, height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 8, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, letterSpacing: 2 }}>
                WASTELAND FIELD SYSTEM
              </Text>
              <View style={{ width: 20, height: 1, backgroundColor: colors.border }} />
            </View>
            <View style={{ position: 'absolute', top: 32, left: 26, width: 3, height: 3, borderRadius: 2, backgroundColor: colors.primary, opacity: 0.42 }} />
            <View style={{ position: 'absolute', bottom: 38, right: 28, width: 2, height: 2, borderRadius: 2, backgroundColor: colors.primary, opacity: 0.28 }} />
          </View>

          <View style={{ gap: 10 }}>
            <MenuButton label="CONTINUE" icon="play" primary onPress={continueCampaign} disabled={!loaded} testID="continue-campaign" />
            <MenuButton label="NEW CAMPAIGN" icon="file-plus" onPress={startNewCampaign} disabled={!loaded} testID="new-campaign" />
            <MenuButton label="LOAD CAMPAIGN" icon="folder" onPress={() => setShowLibrary(true)} disabled={!loaded} testID="open-campaign-library" />
            <MenuButton label="OPTIONS" icon="settings" onPress={() => setShowOptions(true)} disabled={!loaded} testID="open-menu-options" />
          </View>
        </View>
      </ScrollView>

      <CampaignOptionsModal visible={showOptions} onClose={() => setShowOptions(false)} />
      <CampaignLibraryModal
        visible={showLibrary}
        onClose={() => setShowLibrary(false)}
        onCampaignLoaded={() => {
          setShowLibrary(false);
          router.replace('/(tabs)');
        }}
      />
      <LanguagePicker visible={showLanguages} onClose={() => setShowLanguages(false)} />
    </View>
  );
}
