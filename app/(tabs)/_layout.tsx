import React from 'react';
import { Tabs } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { usePathname, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { Spacing } from '../../constants/design';

const NAV = [
  { name: 'feed', label: 'Feed', href: '/(tabs)/feed' },
  { name: 'pulse', label: 'Pulse', href: '/(tabs)/pulse' },
  { name: 'upload', label: 'Post', href: '/(tabs)/upload' },
  { name: 'bridge', label: 'Bridge', href: '/(tabs)/bridge' },
  { name: 'profile', label: 'Profile', href: '/(tabs)/profile' },
] as const;

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
      {label}
    </Text>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarLogo}>
        <Text style={{ color: Colors.textPrimary }}>HERE</Text>
        <Text style={{ color: Colors.primary }}>Too</Text>
      </Text>
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
              <Text style={[styles.navText, active && styles.navTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <Sidebar />
        <View style={styles.desktopContent}>
          <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="feed" />
            <Tabs.Screen name="pulse" />
            <Tabs.Screen name="upload" />
            <Tabs.Screen name="bridge" />
            <Tabs.Screen name="profile" />
          </Tabs>
        </View>
        {/* Right gutter for balance */}
        <View style={styles.rightGutter} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.mobileTabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      {NAV.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            tabBarIcon: ({ focused }) => <TabIcon label={item.label} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Desktop
  desktopRoot: { flex: 1, flexDirection: 'row', backgroundColor: Colors.surfaceLight },
  sidebar: {
    width: 220,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  sidebarLogo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 24,
    letterSpacing: -0.5,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  sidebarNav: { gap: 2 },
  navItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: { backgroundColor: Colors.primaryFaint },
  navText: { fontSize: 15, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },
  navTextActive: { color: Colors.primary, fontFamily: Fonts.bodySemiBold },
  desktopContent: {
    width: 580,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  rightGutter: { flex: 1 },

  // Mobile
  mobileTabBar: {
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    height: 56,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 11, fontFamily: Fonts.bodyMedium, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontFamily: Fonts.bodySemiBold },
});
