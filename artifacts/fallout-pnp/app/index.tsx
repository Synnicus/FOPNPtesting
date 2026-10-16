import React, { useCallback, useState } from 'react';
import { Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlagIcon } from '@/components/FlagIcon';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
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
const CONTINUE_SOUND_DURATION_MS = 5225;

export default function MainMenuScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { loaded, importCampaign, systemSoundsEnabled } = useApp();
  const { locale } = useLocalization();
  const neonBuzzPlayer = useAudioPlayer(require('../assets/neon-flicker-buzz.mp3'));
  const menuButtonPlayer = useAudioPlayer(require('../assets/main-menu-button-press.mp3'));
  const continueButtonPlayer = useAudioPlayer(require('../assets/main-menu-continue.mp3'));
  const [showOptions, setShowOptions] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [isContinueTransitioning, setIsContinueTransitioning] = useState(false);
  const logoLineSize = Math.min(50, Math.max(32, (windowWidth - 80) / 7));
  const logoPnpSize = logoLineSize * 1.35;
  const flicker = useSharedValue(1);
  const shutterProgress = useSharedValue(0);
  const transitionFlicker = useSharedValue(0);

  useFocusEffect(useCallback(() => {
    setIsContinueTransitioning(false);
    shutterProgress.value = 0;
    transitionFlicker.value = 0;
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
      cancelAnimation(shutterProgress);
      cancelAnimation(transitionFlicker);
    };
  }, [flicker, neonBuzzPlayer, shutterProgress, systemSoundsEnabled, transitionFlicker]));

  const neonStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));
  const shutterCoverStyle = useAnimatedStyle(() => ({
    height: shutterProgress.value * windowHeight,
  }));
  const shutterEdgeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shutterProgress.value * windowHeight }],
  }));
  const shutterGlowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shutterProgress.value * windowHeight }],
  }));
  const transitionFlickerStyle = useAnimatedStyle(() => ({
    opacity: transitionFlicker.value,
  }));

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
    if (!loaded || isContinueTransitioning) return;

    const soundDurationMs = CONTINUE_SOUND_DURATION_MS;
    if (systemSoundsEnabled) {
      continueButtonPlayer.volume = 0.35;
      void continueButtonPlayer.seekTo(0).catch(() => {});
      continueButtonPlayer.play();
    }

    const sweepIn = Math.round(soundDurationMs * 0.18);
    const shutterRecoil = Math.round(soundDurationMs * 0.06);
    const sweepAcross = Math.round(soundDurationMs * 0.21);
    const sweepRecoil = Math.round(soundDurationMs * 0.06);
    const lastSweep = Math.round(soundDurationMs * 0.21);
    const lastRecoil = Math.round(soundDurationMs * 0.06);
    const finalClose = Math.max(
      1,
      soundDurationMs - sweepIn - shutterRecoil - sweepAcross - sweepRecoil - lastSweep - lastRecoil,
    );

    setIsContinueTransitioning(true);
    shutterProgress.value = 0;
    transitionFlicker.value = 0;
    transitionFlicker.value = withSequence(
      withTiming(0.3, { duration: 80 }),
      withTiming(0, { duration: 65 }),
      withTiming(0.24, { duration: 70 }),
      withTiming(0, { duration: 110 }),
      withTiming(0.16, { duration: 80 }),
      withTiming(0, { duration: Math.max(1, soundDurationMs - 405) }),
    );
    shutterProgress.value = withSequence(
      withTiming(0.3, { duration: sweepIn, easing: Easing.linear }),
      withTiming(0.17, { duration: shutterRecoil, easing: Easing.linear }),
      withTiming(0.58, { duration: sweepAcross, easing: Easing.linear }),
      withTiming(0.45, { duration: sweepRecoil, easing: Easing.linear }),
      withTiming(0.82, { duration: lastSweep, easing: Easing.linear }),
      withTiming(0.68, { duration: lastRecoil, easing: Easing.linear }),
      withTiming(1, { duration: finalClose, easing: Easing.linear }, finished => {
        if (finished) runOnJS(continueCampaign)();
      }),
    );
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
            <MenuButton label="Continue" icon="play" primary onPress={handleContinue} disabled={!loaded || isContinueTransitioning} testID="continue-campaign" />
            <MenuButton label="New Campaign" icon="file-plus" onPress={() => handleMainMenuAction(startNewCampaign)} disabled={!loaded || isContinueTransitioning} testID="new-campaign" />
            <MenuButton label="Load Campaign" icon="folder" onPress={() => handleMainMenuAction(() => setShowLibrary(true))} disabled={!loaded || isContinueTransitioning} testID="open-campaign-library" />
            <MenuButton label="Options" icon="settings" onPress={() => handleMainMenuAction(() => setShowOptions(true))} disabled={!loaded || isContinueTransitioning} testID="open-menu-options" />
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
      <LanguagePicker visible={showLanguages} onClose={() => setShowLanguages(false)} />
      {isContinueTransitioning && (
        <View
          pointerEvents="auto"
          testID="continue-shutter-transition"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 20,
            elevation: 20,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.foreground },
              shutterCoverStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: -2,
                left: 0,
                right: 0,
                height: 4,
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOpacity: 0.7,
                shadowRadius: 12,
              },
              shutterEdgeStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: -8,
                left: 0,
                right: 0,
                height: 14,
                backgroundColor: colors.primary,
                opacity: 0.18,
              },
              shutterGlowStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.foreground },
              transitionFlickerStyle,
            ]}
          />
        </View>
      )}
    </View>
  );
}
