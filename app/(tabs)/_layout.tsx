import React from 'react';
import { Tabs } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { usePathname, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';

const NAV_ITEMS = [
  { name: 'feed', label: 'Feed', href: '/(tabs)/feed' },
  { name: 'pulse', label: 'Pulse', href: '/(tabs)/pulse' },
  { name: 'upload', label: 'Post', href: '/(tabs)/upload' },
  { name: 'bridge', label: 'Bridge', href: '/(tabs)/bridge' },
  { name: 'profile', label: 'You', href: '/(tabs)/profile' },
] as const;

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
      {focused && <View style={styles.activeIndicator} />}
    </View>
  );
}

function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarLogo}>
        <Text style={{ color: Colors.textPrimary }}>HERE</Text>
        <Text style={{ color: Colors.primary }}>Too</Text>
      </Text>

      <View style={styles.sidebarNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.includes(`/${item.name}`);
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
              onPress={() => router.push(item.href as any)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sidebarItemText,
                  isActive && styles.sidebarItemTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sidebarFooter}>
        <Text style={styles.sidebarFooterText}>Be real.</Text>
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
        <DesktopSidebar />
        <View style={styles.desktopMain}>
          <View style={styles.desktopContent}>
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' },
              }}
            >
              <Tabs.Screen name="feed" />
              <Tabs.Screen name="pulse" />
              <Tabs.Screen name="upload" />
              <Tabs.Screen name="bridge" />
              <Tabs.Screen name="profile" />
            </Tabs>
          </View>
        </View>
      </View>
    );
  }

  // Mobile layout with bottom tabs
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          height: 72,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Feed" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pulse"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Pulse" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="+" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bridge"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Bridge" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="You" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // ── Desktop ──
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
  },
  sidebar: {
    width: 260,
    backgroundColor: Colors.surface,
    borderRightWidth: 0.5,
    borderRightColor: Colors.border,
    paddingTop: 32,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  sidebarLogo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 28,
    marginBottom: 40,
  },
  sidebarNav: {
    gap: 4,
  },
  sidebarItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: Colors.primaryFaint,
  },
  sidebarItemText: {
    fontSize: 16,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
  },
  sidebarItemTextActive: {
    color: Colors.primary,
    fontFamily: Fonts.bodySemiBold,
  },
  sidebarFooter: {
    marginTop: 'auto' as any,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  sidebarFooterText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
  desktopMain: {
    flex: 1,
    alignItems: 'center',
  },
  desktopContent: {
    width: 600,
    maxWidth: 600,
    flex: 1,
    backgroundColor: Colors.background,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: Colors.border,
  },

  // ── Mobile tab bar ──
  tabIcon: {
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
