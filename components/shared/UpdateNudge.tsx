/**
 * UpdateNudge — soft "your app is out of date" toast.
 *
 * Polls /_build.txt on a loose cadence and compares the live commit
 * to the bundle-baked one. If they differ for more than a couple
 * checks (to avoid flapping during a Netlify deploy), surfaces a
 * one-line bar with a Reload button.
 *
 * This recovers users who have a stale service-worker cache or stale
 * tab without forcing a hard refresh on everyone.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BuildInfo } from '../../constants/build-info';
import { Colors } from '../../constants/colors';

const POLL_MS = 60 * 1000;          // every minute
const CONFIRM_HITS = 2;             // need N consecutive mismatches before nagging

export function UpdateNudge() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return; // native bundles update via EAS / store, not this nudge
    if (typeof window === 'undefined') return;

    let mounted = true;
    let consecutive = 0;

    const check = async () => {
      try {
        const r = await fetch('/_build.txt', { cache: 'no-store' });
        if (!r.ok) return;
        const text = await r.text();
        const match = text.match(/commit=([^\s]+)/);
        if (!match) return;
        const liveShort = match[1];
        if (liveShort && liveShort !== BuildInfo.commit) {
          consecutive += 1;
          if (consecutive >= CONFIRM_HITS && mounted) setStale(true);
        } else {
          consecutive = 0;
        }
      } catch {
        // network blip — ignore, try again next tick
      }
    };

    // Run once shortly after mount, then on the cadence.
    const initial = setTimeout(check, 5_000);
    const interval = setInterval(check, POLL_MS);
    return () => {
      mounted = false;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const reload = () => {
    if (typeof window === 'undefined') return;
    // Try to unregister the SW so the next load is truly fresh, then reload.
    try {
      navigator.serviceWorker?.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .finally(() => window.location.reload());
    } catch {
      window.location.reload();
    }
  };

  if (!stale) return null;

  return (
    <View style={styles.bar}>
      <Text style={styles.text}>A newer version of HereToo is available.</Text>
      <TouchableOpacity style={styles.btn} onPress={reload} activeOpacity={0.8}>
        <Text style={styles.btnText}>Reload</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#1F1F2A',
    borderTopWidth: 1, borderTopColor: '#3A3A4A',
    zIndex: 99999,
  },
  text: { color: '#FFFFFF', fontSize: 13, flex: 1 },
  btn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
