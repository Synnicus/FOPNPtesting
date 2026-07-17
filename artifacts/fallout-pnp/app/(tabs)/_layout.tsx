import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Respect the device's bottom safe area (home indicator / nav bar) so the
  // labels never get cut off, with a sensible minimum padding.
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 20) + 6;
  const tabBarStyle = {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 58 + bottomPad,
    paddingBottom: bottomPad,
    paddingTop: 8,
  };
  const activeTint = colors.primary;
  const inactiveTint = colors.mutedForeground;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle, tabBarActiveTintColor: activeTint, tabBarInactiveTintColor: inactiveTint, tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.5 } }}>
      <Tabs.Screen name="index" options={{ title: 'Combat', tabBarIcon: ({ color, size }) => <Feather name="crosshair" size={size} color={color} /> }} />
      <Tabs.Screen name="characters" options={{ title: 'Characters', tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} /> }} />
      <Tabs.Screen name="bestiary" options={{ title: 'Bestiary', tabBarIcon: ({ color, size }) => <Feather name="book-open" size={size} color={color} /> }} />
      <Tabs.Screen name="equipment" options={{ title: 'Equipment', tabBarIcon: ({ color, size }) => <Feather name="tool" size={size} color={color} /> }} />
      <Tabs.Screen name="campaign" options={{ title: 'Campaign', tabBarIcon: ({ color, size }) => <Feather name="archive" size={size} color={color} /> }} />
    </Tabs>
  );
}
