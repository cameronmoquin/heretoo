/**
 * Global mobile bottom tab bar — Feed · Radio · Messages · Profile.
 *
 * Lifted out of the (tabs) layout so it can ALSO appear on sub-pages
 * outside the tabs group (family/[id], chat/*, network, u/<handle>,
 * etc.). The user's mental model is "the menu is always there"; the
 * Expo Router (tabs) group originally only rendered it within (tabs).
 *
 * Renders:
 *   - Web: a 4-slot bar pinned at the bottom of the viewport
 *   - Native: nothing (native uses its own tab bar from the
 *     (tabs) layout — gets enabled when we ship the native build)
 *
 * Hides on auth pages (/welcome, /profile-setup, /join/*) so they
 * don't compete with the auth flow's primary CTAs.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRadio, useActiveStation } from '../../stores/radioStore';
import { useUnreadCount } from '../../hooks/useChat';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/colors';
import { shouldShowLeftSidebar } from './LeftSidebar';

// Hide on auth + signup paths so they don't compete with the
// primary CTAs on those screens. Path matching is loose because
// Expo Router can return paths with or without the route group
// prefix (e.g., '/welcome' OR '/(auth)/welcome' depending on how
// the user navigated). Use `includes` not `startsWith`.
const HIDE_ON = [
  '/welcome',
  '/(auth)',
  '/profile-setup',
  // A recovery link leaves the user genuinely signed in, so the bar
  // would otherwise render over the password form.
  '/reset-password',
  '/join/',
  '/sow/',
  '/version',
];

/**
 * One rule for whether the bottom bar is on screen. The bar renders by
 * it and the root layout reserves the bar's height by it, so content
 * can never sit underneath — the two must never drift apart.
 */
export function useMobileTabBarVisible(): boolean {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const { width } = useWindowDimensions();
  // Native used to be excluded here on the grounds that "the (tabs) layout
  // still owns native nav". It does not: that layout sets
  // tabBarStyle: { display: 'none' } and its NAV array is never rendered, so
  // excluding this bar left native builds with NO navigation at all — Feed and
  // Profile reachable only by landing on them, and Messages, Music and the
  // whole /rooms hub unreachable. Found on the provisioned phone, where it
  // looked like HereToo had shipped a cut-down build.
  // Not signed in: the auth flow has its own CTA hierarchy.
  if (!session) return false;
  // Desktop gets the vertical nav; never both.
  if (shouldShowLeftSidebar(width)) return false;
  const path = pathname ?? '';
  return !HIDE_ON.some((p) => path.includes(p));
}

export function MobileTabBar() {
  const visible = useMobileTabBarVisible();
  const pathname = usePathname();
  const radioPlaying = useRadio((s) => s.playing);
  const radioLoading = useRadio((s) => s.loading);
  const station = useActiveStation();
  const { data: unread } = useUnreadCount();
  const insets = useSafeAreaInsets();

  const styles = makeStyles();

  if (!visible) return null;

  const path = pathname ?? '';

  const onFeed = path.startsWith('/feed') || path === '/' || path === '/(tabs)/feed';
  const onProfile = path.startsWith('/profile') || path.startsWith('/(tabs)/profile');
  const onChat = path.startsWith('/messages');
  const onHunt = path.startsWith('/hunt');
  const onRooms = path.startsWith('/rooms');

  return (
    <View style={[styles.bar, { paddingBottom: 6 + insets.bottom }]}>
      <TouchableOpacity
        style={styles.slot}
        onPress={() => router.push('/hunt' as any)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={onHunt ? 'navigate' : 'navigate-outline'}
          size={22}
          color={onHunt ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.label, onHunt && styles.labelActive]}>Deaddrop</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.slot}
        onPress={() => router.replace('/(tabs)/feed' as any)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={onFeed ? 'home' : 'home-outline'}
          size={22}
          color={onFeed ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.label, onFeed && styles.labelActive]}>Feed</Text>
      </TouchableOpacity>

      {/* Center slot: the hallway. Every other room lives one tap in.
          The radio moved inside — a live control on the Rooms screen
          (its pulse shows here when playing). */}
      <TouchableOpacity
        style={styles.slot}
        onPress={() => router.push('/rooms' as any)}
        activeOpacity={0.7}
        accessibilityLabel="More"
      >
        <View style={[
          styles.iconRing,
          (onRooms || radioPlaying) && { backgroundColor: Colors.primaryFaint },
        ]}>
          <Ionicons
            name={onRooms ? 'grid' : 'grid-outline'}
            size={18}
            color={onRooms || radioPlaying ? Colors.primary : Colors.textSecondary}
          />
        </View>
        <Text style={[styles.label, (onRooms || radioPlaying) && styles.labelActive]} numberOfLines={1}>
          {radioPlaying ? (radioLoading ? '…' : station.name) : 'More'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.slot}
        onPress={() => router.push('/messages')}
        activeOpacity={0.7}
      >
        <View>
          <Ionicons
            name={onChat ? 'chatbubbles' : 'chatbubbles-outline'}
            size={22}
            color={onChat ? Colors.primary : Colors.textMuted}
          />
          {!!unread && unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, onChat && styles.labelActive]}>Messages</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.slot}
        onPress={() => router.replace('/(tabs)/profile' as any)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={onProfile ? 'person' : 'person-outline'}
          size={22}
          color={onProfile ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.label, onProfile && styles.labelActive]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Approximate height of the bar (paddingVertical 6 + slot paddingVertical
 *  4 + icon 28 + label 11 + small gap). Pages whose content goes all the
 *  way to the bottom (chat composer, full-screen forms) reserve this much
 *  space at their bottom so the bar doesn't cover the tail content. */
export const MOBILE_TAB_BAR_HEIGHT = 64;

/**
 * The bar's real height, including the gesture-bar inset it has to clear on
 * Android. The bar pads itself by this and the root layout reserves by it, so
 * the two cannot drift — which is the invariant the docstring above asks for.
 */
export function useMobileTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return MOBILE_TAB_BAR_HEIGHT + insets.bottom;
}

function makeStyles() { return StyleSheet.create({
  bar: ({
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    // Web wants `fixed` so the bar is pinned to the viewport regardless of
    // parent stacking. React Native has no `fixed` — it silently does nothing
    // — so native gets `absolute`, which against the root layout's full-height
    // View lands in the same place.
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 10,
  } as any),
  slot: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 2 },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  labelActive: { color: Colors.primary, fontWeight: '700' },
  iconRing: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute' as const,
    top: -4, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.surface,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
}); }
