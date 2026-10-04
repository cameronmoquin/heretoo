import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { DEV_MODE } from '../lib/dev-mode';
import { MEMBER_SIGNUP_OPEN } from '../constants/site';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const hasCompletedSetup = useAuthStore((s) => s.hasCompletedSetup);

  if (DEV_MODE) {
    return <Redirect href="/(tabs)/feed" />;
  }

  if (!session) {
    // Straight to the door. This used to land on the /about marketing
    // page, which M11 asked for back when the pitch was the product.
    // The paradigm since says the opposite — a bar with no sign — and a
    // marketing page in front of the lock was one screen of throat
    // clearing before anyone could sign in. /about still exists for
    // anyone who wants it; it is just no longer the entrance.
    return <Redirect href="/(auth)/welcome" />;
  }

  // Admin-only phase: a session belongs on the back office, not the feed,
  // whose tables are not applied yet. /admin re-checks the seat itself.
  if (!MEMBER_SIGNUP_OPEN) {
    return <Redirect href={'/admin' as any} />;
  }

  if (!hasCompletedSetup) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(tabs)/feed" />;
}
