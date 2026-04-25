import { Stack, Redirect, usePathname } from 'expo-router';
import { CandonColors } from '../../constants/candon-theme';
import { useAuthStore } from '../../stores/authStore';
import { DEV_MODE } from '../../lib/dev-mode';

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
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Candon' }} />
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
