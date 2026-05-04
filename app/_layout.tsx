import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuth } from '../hooks/useAuth';
import { LoadingPulse } from '../components/shared/LoadingPulse';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { BuildBadge } from '../components/shared/BuildBadge';
import { PWAInstallPrompt } from '../components/shared/PWAInstallPrompt';
import { UpdateNudge } from '../components/shared/UpdateNudge';
import { ToastHost } from '../components/shared/Toast';
import { ConfirmHost } from '../components/shared/ConfirmSheet';
import { WallpaperBackground } from '../components/shared/WallpaperBackground';
import { Colors, setColorMode } from '../constants/colors';
import { useThemeStore } from '../stores/themeStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 2 } },
});

function RootLayoutInner() {
  const { isLoading } = useAuth();
  const themeMode = useThemeStore((s) => s.mode);

  // Apply the active theme palette before child renders happen.
  // useEffect would render once with the wrong palette; useMemo runs sync.
  React.useMemo(() => { setColorMode(themeMode); }, [themeMode]);

  // Update the document theme-color so mobile browser chrome matches.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', Colors.background);
  }, [themeMode]);

  // Register the service worker for offline read mode (web only).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return;
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('SW register failed:', err);
      });
  }, []);

  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  if (isLoading || !fontsLoaded) return <LoadingPulse />;

  return (
    // key={themeMode} forces a clean remount of the entire app when the user
    // toggles theme, so every component picks up new Colors values.
    <View key={themeMode} style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Wallpaper sits behind everything — solid background first,
          then the pattern overlay, then the actual app on top. */}
      <WallpaperBackground />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          // Transparent content so the WallpaperBackground sibling
          // above renders behind every screen. The base color is
          // painted by the outer View. Page-level wrappers are also
          // transparent (see app/* sweep).
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="family" options={{ headerShown: false }} />
        <Stack.Screen name="join" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="network" options={{ headerShown: false }} />
        <Stack.Screen name="u" options={{ headerShown: false }} />
        <Stack.Screen name="sow" options={{ headerShown: false }} />
        <Stack.Screen name="version" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      <ToastHost />
      <ConfirmHost />
      <UpdateNudge />
      <PWAInstallPrompt />
      <BuildBadge />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RootLayoutInner />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
