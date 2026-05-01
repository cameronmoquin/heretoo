/**
 * Robust navigation helpers.
 *
 * `router.replace('/(tabs)/feed')` had been failing intermittently on
 * Android Chrome — sometimes it'd land on the feed, sometimes it'd
 * leave the user on a blank /family/[id] view, sometimes the layout
 * would crash and bounce them to the welcome screen. We can't easily
 * reproduce it from desktop, so this helper tries every reasonable
 * path before falling back to a hard URL load.
 *
 * Order:
 *   1. router.back() — works when the user got here by pushing onto
 *      the existing stack (most common case)
 *   2. router.replace('/(tabs)/feed') — group syntax expo-router
 *      resolves
 *   3. router.replace('/feed') — bare URL form expo-router also
 *      accepts
 *   4. window.location.assign('/feed') — escape hatch on web only
 */

import { router } from 'expo-router';
import { Platform } from 'react-native';

export function goBackToFeed() {
  // 1. Try popping the stack first — fastest on mobile, no remount.
  try {
    if (router.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }
  } catch {}

  // 2. Group-syntax replace.
  try {
    router.replace('/(tabs)/feed' as any);
    return;
  } catch {}

  // 3. Bare URL replace — expo-router accepts both.
  try {
    router.replace('/feed' as any);
    return;
  } catch {}

  // 4. Web escape hatch — full reload to the feed.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign('/feed');
  }
}

/** Same idea for any cross-group "go home" navigation. */
export function goHome() {
  goBackToFeed();
}
