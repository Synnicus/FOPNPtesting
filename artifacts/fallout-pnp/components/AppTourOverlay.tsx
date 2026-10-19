import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TOUR_TOPICS } from '@/data/appTour';
import { useAppTour } from '@/context/AppTourContext';
import { useColors } from '@/hooks/useColors';
import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';

export default function AppTourOverlay() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    active, minimized, screen, topicId, stepIndex, selectTopic, showTopics,
    previousStep, nextStep, minimizeTour, resumeTour, endTour,
  } = useAppTour();
  const topic = APP_TOUR_TOPICS.find(item => item.id === topicId);
  const currentStep = topic?.steps[stepIndex];
  const hasNext = !!topic && stepIndex < topic.steps.length - 1;

  const openRoute = (path: (typeof APP_TOUR_TOPICS)[number]['routes'][number]['path']) => {
    minimizeTour();
    router.push(path);
  };

  return (
    <>
      <Modal
        visible={active && !minimized}
        transparent
        animationType="fade"
        onRequestClose={minimizeTour}
      >
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, backgroundColor: 'rgba(0,0,0,0.84)' }}>
          <View style={{ width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border }}>
              <Feather name="book-open" size={17} color={colors.primary} />
              <Text style={{ flex: 1, color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1.1 }}>
                {screen === 'topics' ? 'CHOOSE A TOUR' : topic?.title ?? 'CHOOSE A TOUR'}
              </Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="MINIMIZE" onPress={minimizeTour} style={{ padding: 5 }}>
                <Feather name="minus" size={19} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="END TOUR" onPress={endTour} style={{ padding: 5 }}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {screen === 'topics' ? (
              <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>
                  Select a topic to see its guide. Use Open Section to visit that screen; your place in the guide is saved while you try it.
                </Text>
                {APP_TOUR_TOPICS.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => selectTopic(item.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.background, paddingHorizontal: 13 }}
                  >
                    <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>{String(index + 1).padStart(2, '0')}</Text>
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 0.35 }}>{item.title}</Text>
                    <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 11 }} showsVerticalScrollIndicator>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 }}>
                      {`STEP ${stepIndex + 1} / ${topic?.steps.length ?? 1}`}
                    </Text>
                    <TouchableOpacity accessibilityRole="button" onPress={showTopics} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                      <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 }}>ALL TOPICS</Text>
                    </TouchableOpacity>
                  </View>
                  {currentStep && (
                    <View style={{ flexDirection: 'row', gap: 11, padding: 13, backgroundColor: colors.background, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
                      <Feather name="check-circle" size={17} color={colors.primary} style={{ marginTop: 2 }} />
                      <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 }}>{currentStep.body}</Text>
                    </View>
                  )}
                  <View style={{ gap: 8, marginTop: 3 }}>
                    {topic?.routes.map(route => (
                      <TouchableOpacity
                        key={route.label}
                        accessibilityRole="button"
                        onPress={() => openRoute(route.path)}
                        style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.primary, borderRadius: colors.radius, paddingHorizontal: 12 }}
                      >
                        <Feather name="external-link" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.9 }}>{route.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderColor: colors.border }}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={previousStep}
                    style={{ minHeight: 40, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius }}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.6 }}>
                      {stepIndex === 0 ? 'ALL TOPICS' : 'PREVIOUS'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={hasNext ? nextStep : () => { showTopics(); }}
                    style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, backgroundColor: colors.primary }}
                  >
                    <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 }}>
                      {hasNext ? 'NEXT' : 'FINISH TOPIC'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {active && minimized && (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom + 66, 82), alignItems: 'center', zIndex: 1000, pointerEvents: 'box-none' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 440, paddingLeft: 12, paddingRight: 6, paddingVertical: 6, backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.primary, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
            <Feather name="book-open" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 10 }} numberOfLines={1}>
                {topic?.title ?? 'TOUR PAUSED'}
              </Text>
              {topic && (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 9 }}>
                  {`STEP ${stepIndex + 1} / ${topic.steps.length}`}
                </Text>
              )}
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={resumeTour} style={{ minHeight: 34, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', borderRadius: colors.radius, backgroundColor: colors.primary }}>
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.65 }}>RESUME TOUR</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="END TOUR" onPress={endTour} style={{ padding: 5 }}>
              <Feather name="x" size={17} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}
