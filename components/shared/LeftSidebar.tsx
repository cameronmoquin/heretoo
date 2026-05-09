/**
 * Global left sidebar — vertical navigation menu for desktop.
 *
 * Mounted at root layout, shows on:
 *   - Web platform
 *   - Authenticated session
 *   - Viewport ≥1024px (240px sidebar + 600px feed + gutters fits)
 *   - NOT on auth-flow pages (welcome / profile-setup / join / sow)
 *
 * Slots: Feed · Messages (with unread badge) · Network · Families ·
 * Music (with active station + play state) · Profile · Sign out.
 *
 * Collaborates with MobileTabBar — when this sidebar shows, the
 * bottom mobile tab bar hides itself (`useShouldShowMobileBar` reads
 * the same width threshold) so the user doesn't get duplicate nav.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useUnreadCount } from '../../hooks/useChat';
import { useRadio, useActiveStation } from '../../stores/radioStore';
import { useMyFamilies } from '../../hooks/useFamily';
import { HereTooLogo } from './Logo';
import { Colors } from '../../constants/colors';

const HIDE_ON_PATHS = [
  '/welcome',
  '/(auth)',
  '/profile-setup',
  '/join/',
  '/sow/',
  '/version',
];

/** Width threshold above which the left sidebar appears. Shared with
 *  MobileTabBar via shouldShowLeftSidebar() so the two never both show. */
export const LEFT_SIDEBAR_WIDTH_THRESHOLD = 1024;

/** Pure helper exposed so MobileTabBar can ask "is the left sidebar
 *  visible right now?" without re-doing the same checks. */
export function shouldShowLeftSidebar(width: number): boolean {
  return Platform.OS === 'web' && width >= LEFT_SIDEBAR_WIDTH_THRESHOLD;
}

export function LeftSidebar() {
  const pathname = usePathname() ?? '';
  const session = useAuthStore((s) => s.session);
  const { width } = useWindowDimensions();
  const { data: unread } = useUnreadCount();
  const { data: families } = useMyFamilies();
  const radioPlaying = useRadio((s) => s.playing);
  const radioToggle = useRadio((s) => s.toggle);
  const station = useActiveStation();

  const visible =
    shouldShowLeftSidebar(width)
    && !!session
    && !HIDE_ON_PATHS.some((p) => pathname.includes(p));

  // Toggle a body data-attr so the wallpaper CSS knows whether to
  // reserve 240px on the left. Without this the auth/welcome pages
  // (no sidebar) inherited the padding and pushed the centered
  // login box rightward.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (visible) document.body.setAttribute('data-left-sidebar', 'on');
    else document.body.removeAttribute('data-left-sidebar');
    return () => {
      if (typeof document !== 'undefined') document.body.removeAttribute('data-left-sidebar');
    };
  }, [visible]);

  if (!visible) return null;

  const onFeed = pathname === '/' || pathname.startsWith('/feed') || pathname.startsWith('/(tabs)/feed');
  const onChat = pathname.startsWith('/chat');
  const onNetwork = pathname.startsWith('/network');
  const onFamily = pathname.startsWith('/family');
  const onProfile = pathname.startsWith('/profile') || pathname.startsWith('/(tabs)/profile');
  const onMusic = pathname.startsWith('/music') || pathname.startsWith('/(tabs)/music');

  return (
    <View style={s.sidebar}>
      {/* Brand mark — tap to go home. Using '/feed' (not the
          route-group form '/(tabs)/feed') because Expo Router's
          route-group resolution can choke on the paren form when
          chained through router.replace mid-session. */}
      <TouchableOpacity
        style={s.brand}
        onPress={() => router.push('/feed' as any)}
        activeOpacity={0.7}
      >
        <HereTooLogo size={32} color={Colors.textPrimary} />
        <Text style={s.brandText}>HereToo</Text>
      </TouchableOpacity>

      <View style={s.divider} />

      <NavRow
        icon={onFeed ? 'home' : 'home-outline'}
        label="The Room"
        active={onFeed}
        onPress={() => router.replace('/(tabs)/feed' as any)}
      />
      <NavRow
        icon={pathname.startsWith('/common') ? 'reader' : 'reader-outline'}
        label="Common"
        active={pathname.startsWith('/common')}
        onPress={() => router.push('/common' as any)}
      />
      <NavRow
        icon={pathname.startsWith('/letter') ? 'mail' : 'mail-outline'}
        label="Letters"
        active={pathname.startsWith('/letter')}
        onPress={() => router.push('/letter' as any)}
      />
      <NavRow
        icon={onChat ? 'chatbubbles' : 'chatbubbles-outline'}
        label="Messages"
        active={onChat}
        badge={unread && unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined}
        onPress={() => router.push('/chat' as any)}
      />
      <NavRow
        icon={onNetwork ? 'people' : 'people-outline'}
        label="Network"
        active={onNetwork}
        onPress={() => router.push('/network' as any)}
      />
      <NavRow
        icon={onFamily ? 'leaf' : 'leaf-outline'}
        label="Families"
        active={onFamily}
        onPress={() => router.push('/family' as any)}
      />
      <NavRow
        icon={onProfile ? 'person' : 'person-outline'}
        label="Profile"
        active={onProfile}
        onPress={() => router.replace('/(tabs)/profile' as any)}
      />

      {/* Family quick-list — small swatches under "Families" so users
          can jump straight to a family page without going through the
          list. Caps at 5 to keep the sidebar compact. */}
      {(families ?? []).slice(0, 5).length > 0 && (
        <>
          <Text style={s.sectionLabel}>YOUR FAMILIES</Text>
          {(families ?? []).slice(0, 5).map((f: any) => (
            <TouchableOpacity
              key={f.id}
              style={s.familyRow}
              onPress={() => router.push(`/family/${f.id}` as any)}
              activeOpacity={0.7}
            >
              <View style={s.familyDot} />
              <Text style={s.familyName} numberOfLines={1}>{f.name}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={s.divider} />

      {/* Active station — same toggle behavior as bottom tab bar */}
      <NavRow
        icon={radioPlaying ? 'pause' : 'musical-notes-outline'}
        label={station.name}
        sub={radioPlaying ? 'Now playing' : station.genre}
        active={onMusic || radioPlaying}
        onPress={() => { radioToggle().catch(() => {}); }}
        onLongPress={() => router.push('/(tabs)/music' as any)}
        accent={radioPlaying}
      />
    </View>
  );
}

interface NavRowProps {
  icon: any;
  label: string;
  sub?: string;
  active?: boolean;
  badge?: string;
  accent?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

function NavRow({ icon, label, sub, active, badge, accent, onPress, onLongPress }: NavRowProps) {
  return (
    <TouchableOpacity
      style={[s.navRow, active && s.navRowActive]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
    >
      <View style={[s.navIcon, accent && { backgroundColor: Colors.primaryFaint }]}>
        <Ionicons
          name={icon}
          size={20}
          color={active || accent ? Colors.primary : Colors.textSecondary}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[s.navLabel, active && { color: Colors.primary, fontWeight: '700' }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sub && <Text style={s.navSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {!!badge && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  sidebar: ({
    // position: fixed pins to the viewport, completely independent of
    // any parent's padding / transform / stacking context. Avoids the
    // "sidebar overlaps content" bug that absolute had when parents
    // used flex layouts that ignored absolute children's left edge.
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
    zIndex: 5,
    // backdrop-filter for a soft frosted look over the wallpaper.
    backdropFilter: 'blur(8px)',
  } as any),
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, paddingHorizontal: 6 },
  brandText: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 10 },

  navRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
  },
  navRowActive: { backgroundColor: Colors.primaryFaint },
  navIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  navSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.error,
    paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 14, marginBottom: 4, paddingHorizontal: 8,
  },
  familyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingHorizontal: 8,
    borderRadius: 8,
  },
  familyDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary, opacity: 0.75,
  },
  familyName: { flex: 1, fontSize: 13, color: Colors.textSecondary },
});
