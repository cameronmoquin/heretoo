import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';

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

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <View style={[styles.root, isDesktop && styles.rootDesktop]}>
      {isDesktop && (
        <View style={styles.sidebar}>
          <Text style={styles.sidebarLogo}>
            <Text style={{ color: Colors.brandDark }}>HERE</Text>
            <Text style={{ color: Colors.primary }}>Too</Text>
          </Text>
        </View>
      )}
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
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
              ...(isDesktop ? { maxWidth: 600, alignSelf: 'center' as const, width: '100%' } : {}),
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootDesktop: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
  },
  sidebar: {
    width: 240,
    backgroundColor: Colors.surface,
    borderRightWidth: 0.5,
    borderRightColor: Colors.border,
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  sidebarLogo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 28,
  },
  content: {
    flex: 1,
  },
  contentDesktop: {
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: Colors.background,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: Colors.border,
  },
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
