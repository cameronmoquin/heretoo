import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { DEV_MODE } from '../../lib/dev-mode';
import { hardSignOutAndRedirect } from '../../lib/auth-recovery';
import { HereTooLogo } from '../../components/shared/Logo';
import { SidebarArt } from '../../components/shared/SidebarArt';
import { ArtPreferences } from '../../components/shared/ArtPreferences';
import { WCRBPlayer } from '../../components/shared/WCRBPlayer';
import { useRadio, useActiveStation } from '../../stores/radioStore';
import { useUnreadCount } from '../../hooks/useChat';

/**
 * Mobile bottom nav.
 *
 * 4 slots: Feed | WCRB | Messages | Profile.
 * - WCRB is a play/pause button, NOT a route — toggling it doesn't
 *   navigate; it just starts/stops the global classical stream.
 * - Messages routes to /chat (which is at the root level, not in
 *   the tabs group). Carries an unread-count badge.
 *
 * Upload tab was dropped earlier — composer is inline at the top of
 * the feed and inside every family page.
 */
const NAV = [
  { name: 'feed', label: 'Feed', icon: 'home-outline', iconActive: 'home', href: '/(tabs)/feed' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person', href: '/(tabs)/profile' },
] as const;

function TabIcon({ icon, iconActive, focused }: { icon: string; iconActive: string; focused: boolean }) {
  return (
    <Ionicons name={(focused ? iconActive : icon) as any} size={22} color={focused ? Colors.primary : Colors.textMuted} />
  );
}

function Sidebar() {
  const styles = makeStyles();
  const pathname = usePathname();
  const user = useAuthStore((st) => st.user);
  const themeMode = useThemeStore((st) => st.mode);
  const toggleTheme = useThemeStore((st) => st.toggle);
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarLogoWrap}>
        <HereTooLogo size={36} color={Colors.textPrimary} />
      </View>
      <View style={styles.sidebarNav}>
        {NAV.map((item) => {
          const active = pathname.includes(`/${item.name}`);
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => router.push(item.href as any)}
              activeOpacity={0.7}
            >
              <View style={styles.navItemInner}>
                <Ionicons name={(active ? item.iconActive : item.icon) as any} size={20} color={active ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.navText, active && styles.navTextActive]}>
                  {item.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Divider + Family + Messages entries (out-of-tab routes) */}
        <View style={styles.sidebarDivider} />
        <TouchableOpacity
          style={[styles.navItem, pathname.startsWith('/family') && styles.navItemActive]}
          onPress={() => router.push('/family' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.navItemInner}>
            <Ionicons
              name={pathname.startsWith('/family') ? 'people' : 'people-outline'}
              size={20}
              color={pathname.startsWith('/family') ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.navText, pathname.startsWith('/family') && styles.navTextActive]}>
              Family
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, pathname.startsWith('/chat') && styles.navItemActive]}
          onPress={() => router.push('/chat' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.navItemInner}>
            <Ionicons
              name={pathname.startsWith('/chat') ? 'chatbubbles' : 'chatbubbles-outline'}
              size={20}
              color={pathname.startsWith('/chat') ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.navText, pathname.startsWith('/chat') && styles.navTextActive]}>
              Messages
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Art preferences + rotating piece + WCRB live classical stream */}
      <ArtPreferences compact />
      <WCRBPlayer />
      <SidebarArt />

      {/* Sign-out at the bottom of the sidebar */}
      {user && (
        <View style={styles.sidebarFooter}>
          <Text style={styles.sidebarEmail} numberOfLines={1}>
            {user.email}
          </Text>
          <TouchableOpacity
            onPress={toggleTheme}
            style={styles.signOutBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.signOutText}>
              {themeMode === 'dark' ? 'Light theme' : 'Dark theme'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => hardSignOutAndRedirect()}
            style={styles.signOutBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const styles = makeStyles();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // Auth gate: tabs are protected. Signed-out deep-links bounce to welcome.
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  if (!DEV_MODE && !isLoading && !session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <Sidebar />
        <View style={styles.desktopContent}>
          <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="feed" />
            <Tabs.Screen name="music" />
            <Tabs.Screen name="profile" />
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },        // hide default — using custom below
        }}
      >
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="profile" />
        {/* music route still exists for old deep-links, but hidden from nav */}
        <Tabs.Screen name="music" options={{ href: null }} />
      </Tabs>
      <CustomTabBar />
    </View>
  );
}

/**
 * Custom 4-slot mobile tab bar:
 *   Feed (route)  ·  WCRB toggle (no route)  ·  Messages (deep-link)  ·  Profile (route)
 *
 * WCRB toggling is route-less — tapping starts/stops the global stream
 * via the wcrbStore singleton. Messages tap routes to /chat (root) and
 * shows an unread-count badge.
 */
function CustomTabBar() {
  const styles = makeStyles();
  const pathname = usePathname();
  const radioPlaying = useRadio((s) => s.playing);
  const radioLoading = useRadio((s) => s.loading);
  const radioToggle = useRadio((s) => s.toggle);
  const station = useActiveStation();
  const { data: unread } = useUnreadCount();

  const onFeed = pathname.startsWith('/feed') || pathname === '/' || pathname === '/(tabs)/feed';
  const onProfile = pathname.startsWith('/profile') || pathname.startsWith('/(tabs)/profile');
  const onChat = pathname.startsWith('/chat');

  return (
    <View style={styles.customBar}>
      <TouchableOpacity
        style={styles.barSlot}
        onPress={() => router.replace('/(tabs)/feed' as any)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={onFeed ? 'home' : 'home-outline'}
          size={22}
          color={onFeed ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.barLabel, onFeed && { color: Colors.primary, fontWeight: '700' }]}>Feed</Text>
      </TouchableOpacity>

      {/* Radio toggle — plays/pauses the user's chosen station from
          the radioStore singleton. Station label updates as they pick
          different stations on /music. Long-press takes them to the
          station picker for variety. */}
      <TouchableOpacity
        style={styles.barSlot}
        onPress={() => { radioToggle().catch(() => {}); }}
        onLongPress={() => router.push('/(tabs)/music' as any)}
        activeOpacity={0.7}
        accessibilityLabel={
          radioPlaying ? `Pause ${station.name}` : `Play ${station.name}`
        }
      >
        <View style={[
          styles.wcrbIconWrap,
          radioPlaying && { backgroundColor: Colors.primaryFaint },
        ]}>
          <Ionicons
            name={radioPlaying ? 'pause' : 'musical-notes'}
            size={18}
            color={radioPlaying ? Colors.primary : Colors.textSecondary}
          />
        </View>
        <Text
          style={[
            styles.barLabel,
            radioPlaying && { color: Colors.primary, fontWeight: '700' },
          ]}
          numberOfLines={1}
        >
          {radioLoading ? '…' : station.name}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.barSlot}
        onPress={() => router.push('/chat' as any)}
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
        <Text style={[styles.barLabel, onChat && { color: Colors.primary, fontWeight: '700' }]}>Messages</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.barSlot}
        onPress={() => router.replace('/(tabs)/profile' as any)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={onProfile ? 'person' : 'person-outline'}
          size={22}
          color={onProfile ? Colors.primary : Colors.textMuted}
        />
        <Text style={[styles.barLabel, onProfile && { color: Colors.primary, fontWeight: '700' }]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  // Desktop
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: Colors.surfaceLight },
  sidebar: {
    width: 220,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
    paddingTop: 28,
    paddingHorizontal: 16,
    flexDirection: 'column',
  },
  sidebarLogoWrap: { marginBottom: 32, paddingHorizontal: 4, height: 44 },
  sidebarNav: { gap: 2 },
  navItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: { backgroundColor: Colors.primaryFaint },
  navItemInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navText: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  navTextActive: { color: Colors.primary, fontWeight: '600' },
  sidebarDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.border,
    marginVertical: 12, marginHorizontal: 12,
  },
  sidebarFooter: {
    marginTop: 'auto', paddingTop: 16, paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    gap: 8,
  },
  sidebarEmail: {
    fontSize: 11, color: Colors.textMuted,
    paddingHorizontal: 12,
  },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8,
  },
  signOutText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  desktopContent: {
    width: 580,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },

  // Mobile
  mobileTabBar: {
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    height: 56,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: '600' },

  // Custom 4-slot mobile tab bar
  customBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: 6, paddingBottom: 8,
  },
  barSlot: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 4, gap: 3,
  },
  barLabel: { fontSize: 10, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.2 },
  wcrbIconWrap: {
    width: 30, height: 22,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 11,
  },
  badge: {
    position: 'absolute', top: -4, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.background,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
}); }
