import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { DEV_MODE } from '../../lib/dev-mode';
import { Colors } from '../../constants/colors';
import { Vocab } from '../../constants/vocab';

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
      <Stack.Screen name="index" options={{ title: Vocab.GroupPlural }} />
      <Stack.Screen name="new" options={{ title: `New ${Vocab.Group}` }} />
      <Stack.Screen name="join" options={{ title: 'Join with Code' }} />
      <Stack.Screen name="[id]/index" options={{ title: Vocab.Group }} />
      <Stack.Screen name="[id]/new-post" options={{ title: `New ${Vocab.Post}` }} />
      <Stack.Screen name="[id]/subject/[slug]" options={{ title: 'Subject', headerShown: false }} />
      <Stack.Screen name="[id]/invite-card" options={{ title: 'Welcome card', headerShown: false }} />
    </Stack>
  );
}
