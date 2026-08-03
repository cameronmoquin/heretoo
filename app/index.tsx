import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { DEV_MODE } from '../lib/dev-mode';
import { isKioskBuild } from '../modules/heretoo-kiosk';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const hasCompletedSetup = useAuthStore((s) => s.hasCompletedSetup);

  if (DEV_MODE) {
    return <Redirect href="/(tabs)/feed" />;
  }

  // Kiosk builds land on the launcher shelf, not the feed. Checked after
  // DEV_MODE but before the auth branches: an unauthenticated kiosk device
  // still needs to sign in, and /about is the wrong surface for a phone with
  // no browser and no way out.
  if (isKioskBuild && session && hasCompletedSetup) {
    return <Redirect href="/shelf" />;
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

  if (!hasCompletedSetup) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(tabs)/feed" />;
}
