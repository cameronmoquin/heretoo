/**
 * AppShelf — the home screen of Jude's phone.
 *
 * HereToo is registered as the system launcher, so this is what the Home
 * button resolves to. Not a section inside HereToo; the surface the device
 * boots into and returns to.
 *
 * Built to docs/UI_SYSTEM.md, which governs here exactly as it does the feed:
 * monochrome, hairline separation, no shadows, the seven-step type scale, no
 * emoji in chrome. A launcher for a kid is not a licence to decorate — the
 * restraint is what makes it feel like a real device rather than a toy.
 *
 * HereToo gets a primary-filled block rather than a tile in the grid.
 * Messaging is the reason the phone exists; the rest is what he is allowed to
 * do with it, which is not the same weight.
 *
 * Tiles come from the device itself — real labels, real icons via
 * PackageManager — so an app that failed to sideload has no tile rather than a
 * dead one. See constants/kioskApps.ts.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Radius, Spacing, Type, Heights, Motion } from '../../constants/design';
import { KIOSK_HIDDEN_PACKAGES } from '../../constants/kioskApps';
import { loadAllowlist } from '../../lib/kiosk-allowlist';
import { getAppInfo, launchApp, type KioskAppInfo } from '../../modules/heretoo-kiosk';

/**
 * Plain observation, never an exclamation — the tone rules in
 * docs/aesthetic.md apply to chrome as much as to empty states.
 */
function greeting(hour: number): string {
  if (hour < 5) return 'Late.';
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

type Props = {
  /**
   * Override the device lookup. Only for design review on web, where
   * PackageManager does not exist and getAppInfo() returns []. Production
   * never passes this.
   */
  previewApps?: KioskAppInfo[];
};

export function AppShelf({ previewApps }: Props = {}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [apps, setApps] = useState<KioskAppInfo[]>(previewApps ?? []);
  const [launching, setLaunching] = useState<string | null>(null);

  const styles = makeStyles();

  // Codex easing. Never bouncy, never spring.
  const fade = useRef(new Animated.Value(0)).current;

  // Re-read on mount rather than caching to module scope: apps get sideloaded
  // during provisioning and ticked in the parent picker afterwards, and both
  // should show up on next launch without a rebuild.
  useEffect(() => {
    if (!previewApps) {
      loadAllowlist().then((allowed) => {
        // Telephony and camera are permitted but tile-less — they are reached
        // through HereToo's own calling UI and composer.
        const shelf = allowed.filter((p) => !KIOSK_HIDDEN_PACKAGES.includes(p));
        setApps(getAppInfo(shelf));
      });
    }
    Animated.timing(fade, {
      toValue: 1,
      duration: Motion.base,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [fade, previewApps]);

  const onLaunch = useCallback(async (pkg: string) => {
    setLaunching(pkg);
    await launchApp(pkg);
    // Hold the pressed state briefly — the app takes a beat to foreground, and
    // an instantly-reset tile reads as a tap that did nothing.
    setTimeout(() => setLaunching(null), 1200);
  }, []);

  // Three across on a phone, four if this ever runs on a tablet.
  const columns = width >= 600 ? 4 : 3;
  const gutter = Spacing.md;
  const available = Math.min(width, 640) - Spacing.lg * 2;
  const tileWidth = (available - gutter * (columns - 1)) / columns;
  const iconSize = Math.min(tileWidth * 0.68, 72);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: fade, gap: Spacing.lg }}>
        <Text style={styles.greeting}>{greeting(new Date().getHours())}</Text>

        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={() => router.push('/(tabs)/feed')}
          accessibilityRole="button"
          accessibilityLabel="Open HereToo"
        >
          <Text style={styles.primaryTitle}>HereToo</Text>
          <Text style={styles.primarySubtitle}>Messages and family</Text>
        </Pressable>

        <View style={styles.rule} />

        <View style={[styles.grid, { gap: gutter }]}>
          {apps.map((app) => (
            <Pressable
              key={app.packageName}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth },
                (pressed || launching === app.packageName) && styles.pressed,
              ]}
              onPress={() => onLaunch(app.packageName)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${app.label}`}
            >
              <View
                style={[styles.iconWell, { width: iconSize, height: iconSize }]}
              >
                {app.icon ? (
                  <Image
                    source={{ uri: app.icon }}
                    style={styles.icon}
                    resizeMode="contain"
                  />
                ) : (
                  // Icon failed to render — the initial beats an empty square.
                  <Text style={styles.iconFallback}>
                    {app.label.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {app.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {apps.length === 0 && <Text style={styles.empty}>No apps yet.</Text>}
      </Animated.View>
    </ScrollView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  // Type tokens are { size, lineHeight, weight }, not RN style keys — they
  // must be mapped explicitly. Spreading them silently yields default 14/400,
  // because React Native ignores `size` and `weight`.
  greeting: {
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: Type.caption.weight,
    color: Colors.textMuted,
  },
  primary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.control,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    minHeight: Heights.buttonLg,
    gap: Spacing.xxs,
  },
  primaryTitle: {
    fontSize: Type.display.size,
    lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight,
    color: Colors.onPrimary,
  },
  primarySubtitle: {
    fontSize: Type.ui.size,
    lineHeight: Type.ui.lineHeight,
    fontWeight: Type.ui.weight,
    color: Colors.onPrimary,
    // The one place opacity stands in for a token: there is no
    // "secondary ink on a primary fill" in the palette, and inventing
    // one would add an eighth grey.
    opacity: 0.7,
  },
  // Hairline, not a shadow. Separation rule, docs/UI_SYSTEM.md §4.
  rule: { height: 1, backgroundColor: Colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: {
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: Heights.touchTarget,
  },
  iconWell: {
    borderRadius: Radius.media,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: { width: '76%', height: '76%' },
  iconFallback: {
    fontSize: Type.title.size,
    lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight,
    color: Colors.textSecondary,
  },
  tileLabel: {
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: Type.caption.weight,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pressed: { opacity: 0.6 },
  empty: {
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    fontWeight: Type.body.weight,
    color: Colors.textMuted,
    textAlign: 'center',
  },
}); }
