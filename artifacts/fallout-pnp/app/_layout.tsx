import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/context/AppContext';
import { LocalizationProvider } from '@/context/LocalizationContext';
import { SystemSoundsProvider } from '@/context/SystemSoundsContext';
import { VaultRadioProvider } from '@/context/VaultRadioContext';
import { AppTourProvider } from '@/context/AppTourContext';
import AppTourOverlay from '@/components/AppTourOverlay';

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
if (Platform.OS !== 'web') SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="main-menu" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <AppTourOverlay />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Overseer: require('../assets/Overseer.otf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Keep the browser preview visible while local fonts resolve; native builds
  // continue to wait for the configured font set before hiding their splash.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <VaultRadioProvider>
            <SystemSoundsProvider>
              <LocalizationProvider>
                <AppTourProvider>
                  <ErrorBoundary>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <KeyboardProvider>
                        <RootLayoutNav />
                      </KeyboardProvider>
                    </GestureHandlerRootView>
                  </ErrorBoundary>
                </AppTourProvider>
              </LocalizationProvider>
            </SystemSoundsProvider>
          </VaultRadioProvider>
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
