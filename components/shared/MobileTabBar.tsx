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
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRadio, useActiveStation } from '../../stores/radioStore';
import { useUnreadCount } from '../../hooks/useChat';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/colors';
import { shouldShowLeftSidebar } from './LeftSidebar';

export function MobileTabBar() {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const radioPlaying = useRadio((s) => s.playing);
  const radioLoading = useRadio((s) => s.loading);
  const station = useActiveStation();
  const { data: unread } = useUnreadCount();
  const { width } = useWindowDimensions();

  const styles = makeStyles();

  // Skip on native (the (tabs) layout still owns native nav until we
  // ship the native build).
  if (Platform.OS !== 'web') return null;

  // Skip if not signed in — auth flow has its own CTA hierarchy.
  if (!session) return null;

  // Skip when LeftSidebar is showing — desktop gets the vertical nav,
  // mobile gets this bottom bar. They're never both visible.
  if (shouldShowLeftSidebar(width)) return null;

  // Hide on auth + signup paths so they don't compete with the
  // primary CTAs on those screens. Path matching is loose because
  // Expo Router can return paths with or without the route group
  // prefix (e.g., '/welcome' OR '/(auth)/welcome' depending on how
  // the user navigated). Use `includes` not `startsWith`.
  const path = pathname ?? '';
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
  if (HIDE_ON.some((p) => path.includes(p))) return null;

  const onFeed = path.startsWith('/feed') || path === '/' || path === '/(tabs)/feed';
  const onProfile = path.startsWith('/profile') || path.startsWith('/(tabs)/profile');
  const onChat = path.startsWith('/messages');
  const onHunt = path.startsWith('/hunt');
  const onRooms = path.startsWith('/rooms');

  return (
    <View style={styles.bar}>
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

function makeStyles() { return StyleSheet.create({
  bar: ({
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    // fixed not absolute so it's pinned to the viewport regardless
    // of parent stacking. Sits above page content on every page.
    position: 'fixed',
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
