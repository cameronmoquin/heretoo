import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { DEV_MODE } from '../lib/dev-mode';
import { detectAppId } from '../constants/apps';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const hasCompletedSetup = useAuthStore((s) => s.hasCompletedSetup);
  const appId = detectAppId();

  if (DEV_MODE) {
    return <Redirect href={appId === 'candon' ? '/candon' : '/(tabs)/feed'} />;
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!hasCompletedSetup) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  // Route based on which hostname / app is active
  return <Redirect href={appId === 'candon' ? '/candon' : '/(tabs)/feed'} />;
}
