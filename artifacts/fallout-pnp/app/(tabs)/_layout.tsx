import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Platform } from 'react-native';

export default function TabLayout() {
  const colors = useColors();
  const tabBarStyle = {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'web' ? 60 : 80,
    paddingBottom: Platform.OS === 'web' ? 8 : 24,
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
