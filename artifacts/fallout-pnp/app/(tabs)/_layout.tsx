import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'scope', selected: 'scope' }} />
        <Label>Combat</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="characters">
        <Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <Label>Characters</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bestiary">
        <Icon sf={{ default: 'book.open', selected: 'book.open.fill' }} />
        <Label>Bestiary</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="equipment">
        <Icon sf={{ default: 'shield', selected: 'shield.fill' }} />
        <Label>Equipment</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="campaign">
        <Icon sf={{ default: 'square.and.arrow.down', selected: 'square.and.arrow.down.fill' }} />
        <Label>Campaign</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: 'Inter_700Bold', letterSpacing: 1, fontSize: 15 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'COMBAT',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="scope" tintColor={color} size={24} />
            ) : (
              <Feather name="crosshair" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="characters"
        options={{
          title: 'CHARACTERS',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.2" tintColor={color} size={24} />
            ) : (
              <Feather name="users" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="bestiary"
        options={{
          title: 'BESTIARY',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="book.open" tintColor={color} size={24} />
            ) : (
              <Feather name="book-open" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="equipment"
        options={{
          title: 'EQUIPMENT',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="shield" tintColor={color} size={24} />
            ) : (
              <Feather name="shield" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="campaign"
        options={{
          title: 'CAMPAIGN',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="square.and.arrow.down" tintColor={color} size={24} />
            ) : (
              <Feather name="save" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
