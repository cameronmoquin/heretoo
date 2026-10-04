/**
 * RequireAccount — wraps anything that needs an account (posting,
 * offering, registering, messaging). Signed in: renders children.
 * Signed out: a short prompt with Sign in / Create account that return
 * to the current page afterwards.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Button } from '../shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { useSession } from '../../lib/nffga/useSession';
import { signInHref, joinHref } from '../../lib/nffga/auth';

export function RequireAccount({ reason, children }: { reason?: string; children: React.ReactNode }) {
  const { session } = useSession();
  const path = usePathname() || '/';
  if (session) return <>{children}</>;
  const s = makeStyles();
  return (
    <View style={s.box}>
      <Text style={s.text}>{reason ? `Create a free account ${reason}.` : 'Create a free account to take part.'}</Text>
      <View style={s.row}>
        <Button title="Create account" onPress={() => router.push(joinHref(path) as any)} variant="primary" size="md" />
        <Button title="Sign in" onPress={() => router.push(signInHref(path) as any)} variant="outline" size="md" />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  box: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm, backgroundColor: Colors.surfaceAlt,
  },
  text: { fontSize: 15, color: Colors.textPrimary, lineHeight: 21 },
  row: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
}); }
