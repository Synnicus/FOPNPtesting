import React, { useCallback, useState } from 'react';
import { Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlagIcon } from '@/components/FlagIcon';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LocalizedAlert, LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';
import CampaignLibraryModal from '@/components/CampaignLibraryModal';
import CampaignOptionsModal from '@/components/CampaignOptionsModal';
import AboutThisAppModal from '@/components/AboutThisAppModal';
import { useApp } from '@/context/AppContext';
import { useLocalization } from '@/context/LocalizationContext';
import { useAppTour } from '@/context/AppTourContext';
import { APP_LANGUAGES, translateText } from '@/data/localization';
import { useColors } from '@/hooks/useColors';

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
        textTransform: 'uppercase',
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
            <Text accessibilityRole="header" style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, letterSpacing: 1, textTransform: 'uppercase' }}>
              Choose a language
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} style={{ padding: 6 }}>
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
                  <FlagIcon locale={language.locale} size={24} outline={colors.border} />
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

const NEON_FLICKER_FADE_MS = 460;
const NEON_FLICKER_CYCLE_MS = 4100;

export default function MainMenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { loaded, importCampaign, systemSoundsEnabled } = useApp();
  const { locale } = useLocalization();
  const { startTour } = useAppTour();
  const neonBuzzPlayer = useAudioPlayer(require('../assets/neon-flicker-buzz.mp3'));
  const menuButtonPlayer = useAudioPlayer(require('../assets/main-menu-button-press.mp3'));
  const continueButtonPlayer = useAudioPlayer(require('../assets/main-menu-continue.mp3'));
  const [showOptions, setShowOptions] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [isContinuePending, setIsContinuePending] = useState(false);
  const logoLineSize = Math.min(50, Math.max(32, (windowWidth - 80) / 7));
  const logoPnpSize = logoLineSize * 1.35;
  const flicker = useSharedValue(1);

  useFocusEffect(useCallback(() => {
    setIsContinuePending(false);
    flicker.value = withRepeat(
      withSequence(
        withTiming(0.12, { duration: 60 }),
        withTiming(0.92, { duration: 55 }),
        withTiming(0.02, { duration: 30 }),
        withTiming(1, { duration: 40 }),
        withTiming(0.32, { duration: 55 }),
        withTiming(1, { duration: 220 }),
        withTiming(1, { duration: 3640 }),
      ),
      -1,
      false,
    );

    let cycleTimer: ReturnType<typeof setInterval> | undefined;
    let fadeTimer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const stopBuzz = () => {
      if (fadeTimer) clearInterval(fadeTimer);
      fadeTimer = undefined;
      neonBuzzPlayer.pause();
      neonBuzzPlayer.volume = 0;
      void neonBuzzPlayer.seekTo(0).catch(() => {});
    };
    const playBuzz = () => {
      if (cancelled || !systemSoundsEnabled) return;
      if (fadeTimer) clearInterval(fadeTimer);
      void (async () => {
        try {
          await neonBuzzPlayer.seekTo(0);
        } catch {
          return;
        }
        if (cancelled) return;
        neonBuzzPlayer.volume = 0.2;
        neonBuzzPlayer.play();
        const startedAt = Date.now();
        fadeTimer = setInterval(() => {
          const progress = Math.min(1, (Date.now() - startedAt) / NEON_FLICKER_FADE_MS);
          neonBuzzPlayer.volume = 0.2 * (1 - progress);
          if (progress >= 1) {
            if (fadeTimer) clearInterval(fadeTimer);
            fadeTimer = undefined;
            neonBuzzPlayer.pause();
            void neonBuzzPlayer.seekTo(0).catch(() => {});
          }
        }, 40);
      })();
    };

    if (systemSoundsEnabled) {
      playBuzz();
      cycleTimer = setInterval(playBuzz, NEON_FLICKER_CYCLE_MS);
    } else {
      stopBuzz();
    }

    return () => {
      cancelled = true;
      if (cycleTimer) clearInterval(cycleTimer);
      stopBuzz();
      cancelAnimation(flicker);
    };
  }, [flicker, neonBuzzPlayer, systemSoundsEnabled]));

  const neonStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));

  const continueCampaign = () => {
    if (loaded) router.push('/(tabs)');
  };

  const handleMainMenuAction = (action: () => void, soundPlayer = menuButtonPlayer) => {
    if (systemSoundsEnabled) {
      soundPlayer.volume = 0.35;
      void soundPlayer.seekTo(0).catch(() => {});
      soundPlayer.play();
    }
    action();
  };

  const handleContinue = () => {
    if (!loaded || isContinuePending) return;
    setIsContinuePending(true);

    if (systemSoundsEnabled) {
      continueButtonPlayer.volume = 0.35;
      void continueButtonPlayer.seekTo(0).catch(() => {});
      continueButtonPlayer.play();
    }
    continueCampaign();
  };

  const startNewCampaign = () => {
    const start = () => {
      const ok = importCampaign(JSON.stringify({
        characters: [],
        customWeapons: [],
        customArmor: [],
      }));
      if (ok) router.push('/(tabs)');
    };
    const title = translateText('Are you sure?', locale);
    const message = translateText(
      'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.',
      locale,
    );
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) start();
    } else {
      LocalizedAlert.alert('Are you sure?', 'This replaces the currently loaded campaign. Save it first if you want to keep it; you can load saved campaigns later.', [
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
        accessibilityLabel="Choose a language"
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
        <FlagIcon locale={locale} size={26} outline={colors.border} />
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
              paddingVertical: 10,
          }}>
            <Animated.View style={[{ alignItems: 'center', gap: 0 }, neonStyle]}>
              <Text style={{
                fontSize: logoPnpSize,
                lineHeight: logoPnpSize * 1.15,
                fontFamily: 'Overseer',
                color: colors.primary,
                letterSpacing: 4,
                textShadowColor: colors.primary,
                textShadowRadius: 16,
                textShadowOffset: { width: 0, height: 0 },
                transform: [{ scaleX: 1.45 }],
              }}>
                PNP
              </Text>
              <Text style={{
                fontSize: logoLineSize * 0.88,
                lineHeight: logoLineSize * 1.05,
                fontFamily: 'Overseer',
                color: colors.primary,
                letterSpacing: 2,
                textAlign: 'center',
                textShadowColor: colors.primary,
                textShadowRadius: 12,
                textShadowOffset: { width: 0, height: 0 },
                transform: [{ scaleX: 1.5 }],
              }}>
                COMBAT
              </Text>
              <Text style={{
                fontSize: logoLineSize,
                lineHeight: logoLineSize * 1.05,
                fontFamily: 'Overseer',
                color: colors.primary,
                letterSpacing: 0.25,
                textAlign: 'center',
                textShadowColor: colors.primary,
                textShadowRadius: 12,
                textShadowOffset: { width: 0, height: 0 },
                transform: [{ scaleX: 1.7 }],
              }}>
                CALCULATOR
              </Text>
            </Animated.View>
          </View>

          <View style={{ gap: 10 }}>
            <MenuButton label="Continue" icon="play" primary onPress={handleContinue} disabled={!loaded || isContinuePending} testID="continue-campaign" />
            <MenuButton label="New Campaign" icon="file-plus" onPress={() => handleMainMenuAction(startNewCampaign)} disabled={!loaded || isContinuePending} testID="new-campaign" />
            <MenuButton label="Load Campaign" icon="folder" onPress={() => handleMainMenuAction(() => setShowLibrary(true))} disabled={!loaded || isContinuePending} testID="open-campaign-library" />
            <MenuButton label="Options" icon="settings" onPress={() => handleMainMenuAction(() => setShowOptions(true))} disabled={!loaded || isContinuePending} testID="open-menu-options" />
            <MenuButton label="About This App" icon="info" onPress={() => handleMainMenuAction(() => setShowAbout(true))} testID="open-about-this-app" />
          </View>
        </View>
      </ScrollView>

      <CampaignOptionsModal
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        hideLanguageOptions
      />
      <CampaignLibraryModal
        visible={showLibrary}
        onClose={() => setShowLibrary(false)}
        onCampaignLoaded={() => {
          setShowLibrary(false);
          router.push('/(tabs)');
        }}
      />
      <AboutThisAppModal
        visible={showAbout}
        onClose={() => setShowAbout(false)}
        onTakeTour={() => {
          setShowAbout(false);
          startTour();
        }}
      />
      <LanguagePicker visible={showLanguages} onClose={() => setShowLanguages(false)} />
    </View>
  );
}
