/**
 * Global right sidebar — calendar embed + family event invite widget.
 *
 * Mounted at the root layout so it appears on EVERY page when:
 *   - Web platform
 *   - Viewport ≥1280px (real empty space outside the centered feed)
 *   - User is signed in
 *   - Not on an auth-flow page (welcome / profile-setup / join / sow)
 *
 * Pinned absolutely to the viewport's right edge so it doesn't affect
 * the layout / width of any page underneath. Each page's centered
 * content keeps the same width on every screen; the sidebar floats in
 * the otherwise-unused outer right third.
 *
 * Native: returns null (no sidebar in mobile native builds).
 */

import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { CalendarEmbed } from './CalendarEmbed';
import { FamilyEventInvite } from './FamilyEventInvite';

export function RightSidebar() {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') return null;
  if (!session) return null;

  // Need real empty space outside the centered feed column to put the
  // sidebar in. Below 1280px the sidebar would just hover ON the feed
  // which is worse than not showing.
  if (width < 1280) return null;

  // Hide on auth pages so the sidebar doesn't compete with primary
  // CTAs there. Same hide list as MobileTabBar.
  const path = pathname ?? '';
  const HIDE_ON = [
    '/welcome',
    '/(auth)',
    '/profile-setup',
    '/join/',
    '/sow/',
    '/version',
  ];
  if (HIDE_ON.some((p) => path.includes(p))) return null;

  return (
    <View style={s.sidebar} pointerEvents="box-none">
      <View pointerEvents="auto" style={{ gap: 12 }}>
        <CalendarEmbed />
        <FamilyEventInvite />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    top: 80,                   // below the page header
    right: 16,
    width: 320,
    paddingBottom: 80,         // clears the bottom tab bar
    zIndex: 5,                 // above page content, below modals
  },
});
