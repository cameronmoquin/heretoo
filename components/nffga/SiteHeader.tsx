/**
 * SiteHeader — the public top bar on every NFFGA page.
 *
 * Signed out: brand, Home, Clubhouse, Tournaments, Gear, Messages, Sign in and Join.
 * Signed in: the same rooms plus Account.
 * Hidden on the sign-in, join and admin screens, which carry their own.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { BrandMark } from '../shared/Logo';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { useSession } from '../../lib/nffga/useSession';
import { signInHref, joinHref } from '../../lib/nffga/auth';

const HIDE_ON = ['/signin', '/join', '/admin', '/welcome', '/(auth)', '/reset-password'];

const ROOMS = [
  // Home is active only on '/' itself (every path starts with '/').
  { label: 'Home', href: '/' },
  { label: 'Clubhouse', href: '/clubhouse' },
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Gear', href: '/gear' },
  // Shown signed out too: the inbox page answers with the join prompt,
  // which is part of the funnel.
  { label: 'Messages', href: '/inbox' },
] as const;

export function SiteHeader() {
  const path = usePathname() || '/';
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const s = makeStyles();
  if (HIDE_ON.some((p) => path.startsWith(p))) return null;
  // Below 900px the links get their own row, sized to fit the width.
  // Nothing scrolls sideways and nothing runs off the edge (Cameron,
  // 2026-10-04: "the nav menu spill off the page").
  const narrow = width < 900;
  const back = path === '/' ? undefined : path;

  const links = (
    <>
      {ROOMS.map((r) => (
        <NavLink key={r.href} label={r.label} href={r.href} active={r.href === '/' ? path === '/' : path.startsWith(r.href)} s={s} compact={narrow} />
      ))}
    </>
  );

  return (
    <View style={s.bar}>
      <View style={s.inner}>
        <Pressable onPress={() => router.push('/' as any)} style={s.brand} accessibilityRole="link" accessibilityLabel="NFFGA home">
          <BrandMark size={28} />
          <Text style={s.word}>NFFGA</Text>
        </Pressable>
        {!narrow && <View style={s.links}>{links}</View>}
        <View style={s.right}>
          {session ? (
            <NavLink label="Account" href="/account" active={path.startsWith('/account')} s={s} />
          ) : (
            <>
              <NavLink label="Sign in" href={signInHref(back)} active={false} s={s} />
              <Pressable onPress={() => router.push(joinHref(back) as any)} style={s.join} accessibilityRole="button">
                <Text style={s.joinText}>Join</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
      {narrow && <View style={s.mobileLinks}>{links}</View>}
    </View>
  );
}

function NavLink({ label, href, active, s, compact }: {
  label: string; href: string; active: boolean; s: ReturnType<typeof makeStyles>; compact?: boolean;
}) {
  return (
    <Pressable onPress={() => router.push(href as any)} style={[s.link, compact && s.linkCompact]} accessibilityRole="link">
      <Text style={[s.linkText, compact && s.linkTextCompact, active && s.linkActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  bar: { backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  inner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    maxWidth: 1080, width: '100%', alignSelf: 'center', minHeight: 56,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 0 },
  word: { fontSize: 17, fontWeight: '800', letterSpacing: 3, color: Colors.textPrimary },
  links: { flexDirection: 'row', gap: Spacing.xxs, flex: 1, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs, marginLeft: 'auto', flexShrink: 0 },
  link: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  linkCompact: { paddingHorizontal: Spacing.xxs, paddingVertical: 6 },
  linkText: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  linkTextCompact: { fontSize: 14 },
  linkActive: { color: Colors.textPrimary, fontWeight: '700' },
  join: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginLeft: Spacing.xxs,
  },
  joinText: { color: Colors.onPrimary, fontSize: 15, fontWeight: '700' },
  // Spread across the full width; wraps to a second line on the very
  // narrowest phones instead of overflowing.
  mobileLinks: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xxs, rowGap: 2,
    // Capped so tablets get a tidy group, not five words spread edge to edge.
    maxWidth: 560, width: '100%', alignSelf: 'center',
  },
}); }
