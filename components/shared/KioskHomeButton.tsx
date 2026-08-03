/**
 * KioskHomeButton — the way back to the shelf from anywhere in HereToo.
 *
 * Mounted at the root, not in a tab bar, on purpose. On native the (tabs)
 * layout only wraps tab routes; /chat, /family, /loft and friends live outside
 * it and would otherwise strand Jude with no way home. Rendering here means
 * every screen gets it.
 *
 * Deliberately NOT the system Home button. That one relaunches MainActivity,
 * which is singleTask, so it brings the existing task forward exactly as it was
 * — correct behaviour when returning from Spotify, useless for getting out of a
 * chat. This is a plain in-app control and it always goes to the shelf.
 *
 * Renders nothing outside a kiosk build.
 */

import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/colors';
import { Shadow, Heights, Spacing, Radius } from '../../constants/design';
import { isKioskBuild } from '../../modules/heretoo-kiosk';

/** Routes where a jump to the shelf would interrupt something. */
const HIDDEN_PREFIXES = ['/shelf', '/welcome', '/profile-setup', '/join', '/reset-password'];

export function KioskHomeButton() {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const styles = makeStyles();

  if (!isKioskBuild) return null;
  // No shelf to go back to until he is signed in and set up.
  if (!session) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={() => router.replace('/shelf')}
      accessibilityRole="button"
      accessibilityLabel="Back to home screen"
      // Generous target. This is the one control on the device that always
      // works, and it is being used by a kid.
      hitSlop={12}
    >
      {/* Outline variant: docs/aesthetic.md wants Lucide single-weight, and
          until that migration happens Ionicons' outline set is the nearest
          thing already in the bundle. */}
      <Ionicons name="grid-outline" size={22} color={Colors.onPrimary} />
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  button: {
    position: 'absolute',
    right: Spacing.lg,
    // Clears the native tab bar, which the (tabs) layout draws at the bottom
    // of tab routes. Sits over ordinary content elsewhere, which is fine —
    // it is the most important control on the screen.
    bottom: Platform.OS === 'web' ? Spacing.lg : Heights.bottomNav + Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Keep it above the feed but below the parent panel's modal.
    zIndex: 900,
    // The system's one sanctioned shadow, defined for exactly this shape —
    // a floating circular button. docs/UI_SYSTEM.md §4 forbids elevation
    // everywhere else, so use the token rather than hand-rolled values.
    ...Shadow.float,
  },
  pressed: { opacity: 0.7 },
}); }
