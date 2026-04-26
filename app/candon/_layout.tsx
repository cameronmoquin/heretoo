import { Stack, Redirect, usePathname, router } from 'expo-router';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CandonColors } from '../../constants/candon-theme';
import { useAuthStore } from '../../stores/authStore';
import { DEV_MODE } from '../../lib/dev-mode';

/**
 * Header-left "← HereToo" button. Returns to the main social feed
 * regardless of how deep in the Candon stack you are.
 */
function BackToHereToo() {
  return (
    <TouchableOpacity
      onPress={() => router.replace('/(tabs)/feed')}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 6 }}
      accessibilityLabel="Back to HereToo feed"
    >
      <Ionicons name="chevron-back" size={20} color={CandonColors.textPrimary} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ color: '#FF0040', fontSize: 13, fontWeight: '800', opacity: 0.7, position: 'absolute', left: -1, top: -1 }}>HT</Text>
        <Text style={{ color: '#00FF88', fontSize: 13, fontWeight: '800', opacity: 0.7, position: 'absolute', left: 1, top: 1 }}>HT</Text>
        <Text style={{ color: CandonColors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>HT</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CandonLayout() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pathname = usePathname();

  // Allow the reset page to render even when signed out — that's its whole job.
  const isResetPage = pathname?.endsWith('/candon/reset');

  if (!DEV_MODE && !isLoading && !session && !isResetPage) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: CandonColors.surface },
        headerTintColor: CandonColors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: CandonColors.bg },
        // The HereToo back button shows on every Candon screen so the user
        // can always escape back to the main feed in one tap.
        headerLeft: () => <BackToHereToo />,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="reset" options={{ title: 'Reset Session', headerShown: false }} />
      <Stack.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Stack.Screen name="contacts/new" options={{ title: 'New Contact' }} />
      <Stack.Screen name="contacts/[id]" options={{ title: 'Contact' }} />
      <Stack.Screen name="family/index" options={{ title: 'Family' }} />
      <Stack.Screen name="family/new" options={{ title: 'New Family Group' }} />
      <Stack.Screen name="family/join" options={{ title: 'Join Family' }} />
      <Stack.Screen name="family/[id]/index" options={{ title: 'Family Group' }} />
      <Stack.Screen name="family/[id]/new-post" options={{ title: 'New Post' }} />
      <Stack.Screen name="family/[id]/post/[postId]" options={{ title: 'Post' }} />
    </Stack>
  );
}
