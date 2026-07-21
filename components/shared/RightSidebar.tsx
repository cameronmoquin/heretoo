/**
 * Global right sidebar — calendar embed + crew event invite widget.
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

import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { CalendarEmbed } from './CalendarEmbed';
import { FamilyEventInvite } from './FamilyEventInvite';

export function RightSidebar() {
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const { width } = useWindowDimensions();

  const path = pathname ?? '';
  const HIDE_ON = [
    '/welcome',
    '/(auth)',
    '/profile-setup',
    '/reset-password',
    '/join/',
    '/sow/',
    '/version',
  ];
  const visible =
    Platform.OS === 'web'
    && !!session
    && width >= 1280
    && !HIDE_ON.some((p) => path.includes(p));

  // Mirror visibility into a body data-attr so the wallpaper CSS knows
  // whether to reserve 352px on the right. Auth pages and narrow
  // viewports don't reserve, so the centered content stays centered.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (visible) document.body.setAttribute('data-right-sidebar', 'on');
    else document.body.removeAttribute('data-right-sidebar');
    return () => {
      if (typeof document !== 'undefined') document.body.removeAttribute('data-right-sidebar');
    };
  }, [visible]);

  if (!visible) return null;

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
  sidebar: ({
    // fixed not absolute so it's pinned to the viewport regardless
    // of parent stacking / padding. Avoids the LeftSidebar's
    // overlap bug pattern.
    position: 'fixed',
    top: 80,                   // below the page header
    right: 16,
    width: 320,
    paddingBottom: 80,         // clears the bottom tab bar
    zIndex: 5,                 // above page content, below modals
  } as any),
});
