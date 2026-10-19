import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_ABOUT_COPY } from '@/data/appTour';
import { useColors } from '@/hooks/useColors';
import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/LocalizedText';

interface AboutThisAppModalProps {
  visible: boolean;
  onClose: () => void;
  onTakeTour: () => void;
}

export default function AboutThisAppModal({ visible, onClose, onTakeTour }: AboutThisAppModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, backgroundColor: 'rgba(0,0,0,0.82)' }}>
        <View style={{ width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', overflow: 'hidden', backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Feather name="info" size={17} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 1.2 }}>ABOUT THIS APP</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ padding: 5 }}>
              <Feather name="x" size={21} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 13 }} showsVerticalScrollIndicator>
            {APP_ABOUT_COPY.descriptions.map(description => (
              <Text key={description} style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 }}>
                {description}
              </Text>
            ))}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.4 }}>CREDITS</Text>
            {APP_ABOUT_COPY.credits.map(credit => (
              <Text key={credit} style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>
                {credit}
              </Text>
            ))}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onTakeTour}
              style={{ minHeight: 48, marginTop: 6, borderRadius: colors.radius, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 14 }}
            >
              <Feather name="map" size={17} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1 }}>
                TAKE A TOUR OF THE APP
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
