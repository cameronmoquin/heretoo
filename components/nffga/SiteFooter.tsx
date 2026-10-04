/**
 * SiteFooter — the quiet foot of public pages: the name (editable from
 * /admin → Copy as 'footer.line'), Contact us, the admin door, the
 * sister product.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { CAR56_NAME, CAR56_URL } from '../../constants/site';
import { useCopy } from '../../lib/nffga/copy';

export function SiteFooter() {
  const s = makeStyles();
  const line = useCopy('footer.line');
  const openCar56 = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(CAR56_URL, '_blank', 'noopener');
    else Linking.openURL(CAR56_URL).catch(() => {});
  };
  return (
    <View style={s.foot}>
      {line ? <Text style={s.name}>{line}</Text> : null}
      <View style={s.row}>
        <Pressable onPress={() => router.push('/contact' as any)} accessibilityRole="link"><Text style={s.link}>Contact us</Text></Pressable>
        <Text style={s.dot}>·</Text>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs },
  link: { fontSize: 13, color: Colors.textSecondary, textDecorationLine: 'underline' },
  dot: { color: Colors.textMuted },
}); }
