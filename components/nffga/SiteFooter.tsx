/**
 * SiteFooter — the quiet foot of public pages: the admin door, the
 * sister product, the name.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { SITE_LONG_NAME, CAR56_NAME, CAR56_URL } from '../../constants/site';

export function SiteFooter() {
  const s = makeStyles();
  const openCar56 = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(CAR56_URL, '_blank', 'noopener');
    else Linking.openURL(CAR56_URL).catch(() => {});
  };
  return (
    <View style={s.foot}>
      <Text style={s.name}>{SITE_LONG_NAME}</Text>
      <View style={s.row}>
        <Pressable onPress={() => router.push('/admin' as any)} accessibilityRole="link"><Text style={s.link}>Admin</Text></Pressable>
        <Text style={s.dot}>·</Text>
        <Pressable onPress={openCar56} accessibilityRole="link"><Text style={s.link}>{CAR56_NAME}</Text></Pressable>
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  foot: {
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xl,
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.xs,
  },
  name: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  link: { fontSize: 13, color: Colors.textSecondary, textDecorationLine: 'underline' },
  dot: { color: Colors.textMuted },
}); }
