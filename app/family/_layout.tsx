import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { DEV_MODE } from '../../lib/dev-mode';
import { Colors } from '../../constants/colors';

export default function FamilyLayout() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  if (!DEV_MODE && !isLoading && !session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Stack
      screenOptions={{
        // Transparent content so root-layout wallpaper shows through.
        // Header keeps a solid bg so titles don't sit on a busy pattern.
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Family' }} />
      <Stack.Screen name="new" options={{ title: 'New Family' }} />
      <Stack.Screen name="join" options={{ title: 'Join with Code' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Family' }} />
      <Stack.Screen name="[id]/new-post" options={{ title: 'New Post' }} />
    </Stack>
  );
}
