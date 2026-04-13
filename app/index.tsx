import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { DEV_MODE } from '../lib/dev-mode';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const hasCompletedSetup = useAuthStore((s) => s.hasCompletedSetup);

  // In dev mode, go straight to the feed
  if (DEV_MODE) {
    return <Redirect href="/(tabs)/feed" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!hasCompletedSetup) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(tabs)/feed" />;
}
