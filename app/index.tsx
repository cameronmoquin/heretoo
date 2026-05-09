import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { DEV_MODE } from '../lib/dev-mode';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const hasCompletedSetup = useAuthStore((s) => s.hasCompletedSetup);

  if (DEV_MODE) {
    return <Redirect href="/(tabs)/feed" />;
  }

  if (!session) {
    // Source of Truth, M11: unauth visitors land on the marketing
    // /about page, not the auth wall. The marketing surface has its
    // own "Step inside" button that routes to the auth flow.
    return <Redirect href="/about" />;
  }

  if (!hasCompletedSetup) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(tabs)/feed" />;
}
