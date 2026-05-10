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
import { Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import {
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4';
import { useAuth } from '../hooks/useAuth';
import { LoadingPulse } from '../components/shared/LoadingPulse';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { BuildBadge } from '../components/shared/BuildBadge';
import { PWAInstallPrompt } from '../components/shared/PWAInstallPrompt';
import { UpdateNudge } from '../components/shared/UpdateNudge';
import { ToastHost } from '../components/shared/Toast';
import { ConfirmHost } from '../components/shared/ConfirmSheet';
import { WallpaperBackground } from '../components/shared/WallpaperBackground';
import { MobileTabBar } from '../components/shared/MobileTabBar';
import { LeftSidebar } from '../components/shared/LeftSidebar';
import { RightSidebar } from '../components/shared/RightSidebar';
import { KonamiChimes } from '../components/easter/KonamiChimes';
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
    // Display face — Syne. Used for masthead, postcard pulled phrases,
    // brand mark, section titles. Per the codex (Source of Truth, M10).
    Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold,
    // Long-form body — Source Serif 4. Used for the Letter composer,
    // letter reader, parlor essays, Reframer drawer.
    SourceSerif4_400Regular, SourceSerif4_400Regular_Italic, SourceSerif4_600SemiBold,
  });

  if (isLoading || !fontsLoaded) return <LoadingPulse />;

  return (
    // key={themeMode} forces a clean remount of the entire app when the user
    // toggles theme, so every component picks up new Colors values.
    //
    // CRITICAL: this View MUST be transparent. The wallpaper paints on
    // document.body (see WallpaperBackground); any opaque backgroundColor
    // here covers it completely. The base canvas color is set on body
    // via the baseline stylesheet WallpaperBackground injects. The
    // previous opaque value (Colors.background) is the entire reason
    // wallpapers haven't been showing.
    <View key={themeMode} style={{ flex: 1, backgroundColor: 'transparent' }}>
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
        {/* Single-file route — Expo Router exposes it as 'network/index'
            (the folder name + filename) since there's no _layout.tsx
            in app/network/ to make it a route group. */}
        <Stack.Screen name="network/index" options={{ headerShown: false }} />
        <Stack.Screen name="common/index" options={{ headerShown: false }} />
        <Stack.Screen name="letter" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ headerShown: false, title: 'About HereToo' }} />
        <Stack.Screen name="for-grandparents" options={{ headerShown: false, title: 'HereToo for grandparents' }} />
        <Stack.Screen name="the-parlor" options={{ headerShown: false }} />
        <Stack.Screen name="loft" options={{ headerShown: false }} />
        <Stack.Screen name="give" options={{ headerShown: false, title: 'Give' }} />
        <Stack.Screen name="call" options={{ headerShown: false }} />
        <Stack.Screen name="memoir" options={{ headerShown: false, title: 'Memoir' }} />
        <Stack.Screen name="u" options={{ headerShown: false }} />
        <Stack.Screen name="sow" options={{ headerShown: false }} />
        <Stack.Screen name="version" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      {/* Global navigation — same hide rules across all three:
          web-only, authed, off auth-flow pages. Width thresholds
          differ so the right configuration shows per viewport:
            - <1024px:  MobileTabBar at the bottom only
            - ≥1024px:  LeftSidebar visible; MobileTabBar hides
            - ≥1280px:  RightSidebar (calendar + invites) also shows */}
      <MobileTabBar />
      <LeftSidebar />
      <RightSidebar />
      <ToastHost />
      <ConfirmHost />
      <UpdateNudge />
      <PWAInstallPrompt />
      <BuildBadge />
      <KonamiChimes />
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
