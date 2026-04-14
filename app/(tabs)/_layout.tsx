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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { RightPanel } from '../../components/shared/RightPanel';

const NAV = [
  { name: 'feed', label: 'Feed', icon: 'home-outline', iconActive: 'home', href: '/(tabs)/feed' },
  { name: 'pulse', label: 'Pulse', icon: 'pulse-outline', iconActive: 'pulse', href: '/(tabs)/pulse' },
  { name: 'upload', label: 'Post', icon: 'add-circle-outline', iconActive: 'add-circle', href: '/(tabs)/upload' },
  { name: 'bridge', label: 'Bridge', icon: 'chatbubbles-outline', iconActive: 'chatbubbles', href: '/(tabs)/bridge' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person', href: '/(tabs)/profile' },
] as const;

function TabIcon({ icon, iconActive, focused }: { icon: string; iconActive: string; focused: boolean }) {
  return (
    <Ionicons name={(focused ? iconActive : icon) as any} size={22} color={focused ? Colors.primary : Colors.textMuted} />
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarLogoWrap}>
        <Text style={[styles.sidebarLogo, { color: '#FF0040', position: 'absolute', left: -1, top: -1, opacity: 0.6 }]}>HT</Text>
        <Text style={[styles.sidebarLogo, { color: '#00FF88', position: 'absolute', left: 1, top: 1, opacity: 0.6 }]}>HT</Text>
        <Text style={styles.sidebarLogo}>HT</Text>
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
        <View style={styles.rightPanel}>
          <RightPanel />
        </View>
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
            tabBarIcon: ({ focused }) => <TabIcon icon={item.icon} iconActive={item.iconActive} focused={focused} />,
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
  sidebarLogoWrap: { position: 'relative', marginBottom: 32, paddingHorizontal: 8, height: 30 },
  sidebarLogo: {
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 4,
    color: Colors.textPrimary,
  },
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
  desktopContent: {
    width: 580,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  rightPanel: { width: 320, maxWidth: 320 },

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
});
