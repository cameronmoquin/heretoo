import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { ThemeProvider, DefaultTheme } from '@react-navigation/native';
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
import { GlobalWebStyles } from '../components/shared/GlobalWebStyles';
import { SiteHeader } from '../components/nffga/SiteHeader';
import { EnsureProfile } from '../components/nffga/EnsureProfile';
import { Colors, setColorMode } from '../constants/colors';
import { useThemeStore } from '../stores/themeStore';
import { Vocab } from '../constants/vocab';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 2 } },
});

// React Navigation paints each screen's scene from its theme; the
// default is opaque light (#F2F2F2), which would sit on top of the
// canvas and hide it. Transparent lets the root View's background show.
const NAV_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent' },
};

function RootLayoutInner() {
  const { isLoading } = useAuth();
  const themeMode = useThemeStore((s) => s.mode);

  // Apply the active palette before child renders happen. useEffect
  // would render once with the wrong palette; useMemo runs sync.
  React.useMemo(() => {
    setColorMode(themeMode);
  }, [themeMode]);

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

  // One family. Inter, four weights. Syne and Source Serif 4 are retired
  // with the skin engine (docs/UI_SYSTEM.md §3).
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });

  if (isLoading || !fontsLoaded) return <LoadingPulse />;

  return (
    // key={themeMode} forces a clean remount of the entire app when the user
    // toggles theme, so every component picks up new Colors values.
    //
    // This View paints the canvas. Nothing else paints it. Flat
    // Colors.background, light or dark, no image behind it.
    //
    // paddingBottom reserves the bottom bar's strip whenever the bar is
    // on screen, so no page's tail can ever sit underneath it. This is
    // the ONE place that compensation lives — screens must not add
    // their own (three used to, and every screen that didn't was
    // covered).
    <View
      key={themeMode}
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >
      <GlobalWebStyles />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SiteHeader />
      <EnsureProfile />
      <ThemeProvider value={NAV_THEME}>
      <Stack
        screenOptions={{
          headerShown: false,
          // Transparent content so the canvas painted by the outer
          // View reaches every screen. Page-level wrappers are also
          // transparent (see app/* sweep).
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
        }}
      >
        {/*
          ROUTE NAMES MUST BE REAL. A folder with no _layout.tsx is not a
          route group, so Expo Router never exposes it under the bare
          folder name — app/memoir/index.tsx is 'memoir/index', not
          'memoir'. Naming the folder logged "No route named X exists in
          nested children" on every render and, more to the point, meant
          the `title` on that line was attached to nothing and never
          reached the document. Eight screens were silently untitled:
          letter, welcome, loft, give, call, memoir, babybook, news.

          The comment on network/index below has said this since it was
          written. The other eight were never brought in line with it.

          headerShown is already false via the Stack's screenOptions, so
          a line that adds nothing but that has been dropped rather than
          corrected — including 'chat', whose redirect stubs mount from
          the filesystem without any declaration at all.
        */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="hunt" options={{ title: Vocab.Hunt }} />
        <Stack.Screen name="rooms" options={{ title: 'More' }} />
        <Stack.Screen name="version" options={{ presentation: 'modal' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
      </ThemeProvider>
      {/* Navigation is the NFFGA SiteHeader above the Stack. HereToo's
          MobileTabBar, LeftSidebar and RightSidebar are not mounted:
          they point at rooms this version does not ship. */}
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
    <>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RootLayoutInner />
        </QueryClientProvider>
      </ErrorBoundary>
    </>
  );
}
