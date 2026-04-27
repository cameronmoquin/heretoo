import React from 'react';
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
import { useAuthStore } from '../stores/authStore';
import { LoadingPulse } from '../components/shared/LoadingPulse';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { SuspendedBanner } from '../components/shared/SuspendedBanner';
import { BuildBadge } from '../components/shared/BuildBadge';
import { Colors } from '../constants/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 2,
    },
  },
});

function RootLayoutInner() {
  const { isLoading } = useAuth();
  const profile = useAuthStore((s) => s.profile);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (isLoading || !fontsLoaded) {
    return <LoadingPulse />;
  }

  return (
    <>
      <StatusBar style="light" />
      {profile?.is_suspended && (
        <View style={{ backgroundColor: Colors.background }}>
          <SuspendedBanner reason={profile.suspension_reason ?? undefined} />
        </View>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="version" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
      <BuildBadge />
    </>
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
