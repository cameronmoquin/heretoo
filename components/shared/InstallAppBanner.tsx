/**
 * Persistent "Install HereToo" promo banner — shown at the top of the
 * home feed. Different from PWAInstallPrompt (the auto-popup) — this
 * is always visible until dismissed, so users who close the auto-popup
 * or never see it (desktop, etc.) still have a one-tap install path.
 *
 * Hides when:
 *   - Already running standalone (installed)
 *   - User has dismissed within the last 7 days
 *   - Not on web
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

const STORAGE_KEY = 'heretoo:install-banner-dismissed-at';

export function InstallAppBanner() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('desktop');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Already installed — never show.
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Dismissed recently — respect for 7 days.
    try {
      const ts = parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '0', 10);
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
    } catch {}

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    if (isIOS) {
      setPlatform('ios');
    } else if (/Android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Capture the install event when the browser offers it (Chromium).
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    setShow(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show || Platform.OS !== 'web') return null;

  const dismiss = () => {
    try { window.localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  const onInstall = async () => {
    if (deferred) {
      // Chromium one-tap path
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === 'accepted') dismiss();
    } else if (platform === 'ios') {
      // iOS Safari has no API — show instructions
      showAlert(
        'Install HereToo',
        'In Safari, tap the Share icon (square with up-arrow), then choose "Add to Home Screen". The app will live next to your other apps.',
      );
    } else {
      // Desktop / browser without prompt — point them to bookmarking or installing via menu
      showAlert(
        'Install HereToo',
        'In your browser menu, look for "Install HereToo" or "Install app" — usually under the three-dot menu. The app launches in its own window.',
      );
    }
  };

  return (
    <View style={s.banner}>
      <View style={s.iconWrap}>
        <Ionicons
          name={platform === 'ios' ? 'logo-apple' : platform === 'android' ? 'logo-android' : 'desktop-outline'}
          size={20}
          color={Colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Install HereToo</Text>
        <Text style={s.sub} numberOfLines={2}>
          {platform === 'ios'
            ? 'Add to your Home Screen for fullscreen, fast launch.'
            : platform === 'android'
              ? 'One-tap install for a real-app feel.'
              : 'Install for a desktop window — no browser chrome.'}
        </Text>
      </View>
      <TouchableOpacity style={s.installBtn} onPress={onInstall} activeOpacity={0.85}>
        <Text style={s.installBtnText}>Install</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    marginHorizontal: Spacing.md, marginBottom: 8,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1, lineHeight: 15 },
  installBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  installBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
