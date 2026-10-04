/**
 * HomeSection — the frame every home-page section sits in: a title, a
 * "See all" link, and either children or an empty line.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';

export function HomeSection({ title, href, empty, children }: {
  title: string; href: string; empty?: string; children?: React.ReactNode;
}) {
  const s = makeStyles();
  const hasChildren = React.Children.toArray(children).length > 0;
  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text style={s.title}>{title}</Text>
        <Pressable onPress={() => router.push(href as any)} accessibilityRole="link">
          <Text style={s.all}>See all</Text>
        </Pressable>
      </View>
      {hasChildren ? children : <Text style={s.empty}>{empty ?? 'Nothing here yet.'}</Text>}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  section: { gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: Type.title.weight, color: Colors.textPrimary },
  all: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  empty: { fontSize: 15, color: Colors.textMuted },
}); }
