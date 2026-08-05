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
import { MobileTabBar } from '../components/shared/MobileTabBar';
import { LeftSidebar } from '../components/shared/LeftSidebar';
import { RightSidebar } from '../components/shared/RightSidebar';
import { KonamiChimes } from '../components/easter/KonamiChimes';
import { KioskGate } from '../components/shared/KioskGate';
import { KioskHomeButton } from '../components/shared/KioskHomeButton';
import { Colors, setColorMode } from '../constants/colors';
import { useThemeStore } from '../stores/themeStore';

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
    <View
      key={themeMode}
      style={{ flex: 1, backgroundColor: Colors.background }}
    >
      <GlobalWebStyles />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
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
        <Stack.Screen name="about" options={{ title: 'About HereToo' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="give/index" options={{ title: 'Give' }} />
        <Stack.Screen name="journal" options={{ title: 'Journal' }} />
        <Stack.Screen name="memoir/index" options={{ title: 'Memoir' }} />
        <Stack.Screen name="memoir/timeline" options={{ title: 'Timeline' }} />
        <Stack.Screen name="memoir/book" options={{ title: 'Make the book' }} />
        <Stack.Screen name="memoir/photos" options={{ title: 'Photographs' }} />
        <Stack.Screen name="memoir/preview" options={{ title: 'Read it through' }} />
        <Stack.Screen name="memoir/arrange" options={{ title: 'Arrange' }} />
        <Stack.Screen name="memoir/print" options={{ title: 'Where to print' }} />
        <Stack.Screen name="babybook/index" options={{ title: 'Babybook' }} />
        <Stack.Screen name="babybook/[id]" options={{ title: 'Babybook' }} />
        <Stack.Screen name="hunt" options={{ title: 'Deaddrop' }} />
        <Stack.Screen name="rooms" options={{ title: 'Rooms' }} />
        <Stack.Screen name="cipher" options={{ title: 'Cipher' }} />
        <Stack.Screen name="news/index" options={{ title: 'News' }} />
        <Stack.Screen name="version" options={{ presentation: 'modal' }} />
        {/* Launcher home on kiosk devices. Inert elsewhere — the route
            redirects to the feed on any non-kiosk build. */}
        <Stack.Screen name="shelf" options={{ headerShown: false, animation: 'none' }} />
      </Stack>
      </ThemeProvider>
      {/* Global navigation — same hide rules across all three:
          web-only, authed, off auth-flow pages. Width thresholds
          differ so the right configuration shows per viewport:
            - <1024px:  MobileTabBar at the bottom only
            - ≥1024px:  LeftSidebar visible; MobileTabBar hides
            - ≥1280px:  RightSidebar (calendar + invites) also shows */}
      <MobileTabBar />
      <LeftSidebar />
      <RightSidebar />
      {/* Kiosk-only: back to the app shelf from any screen. Lives here rather
          than in the (tabs) layout because /chat, /family and the rest sit
          outside the tabs group on native and would have no way home. */}
      <KioskHomeButton />
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
    <>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RootLayoutInner />
        </QueryClientProvider>
      </ErrorBoundary>
      {/* Deliberately outside ErrorBoundary and outside the auth/font
          loading gate. On a kiosk device this corner tap is the only way
          back in, so it has to survive a render crash and a hung sign-in —
          the two states where you most need it. Inert on web and iOS. */}
      <KioskGate />
    </>
  );
}
