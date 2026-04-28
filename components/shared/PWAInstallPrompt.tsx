/**
 * PWA install prompt — web only, dismissible, persistent across reloads.
 *
 * Android Chrome: captures the `beforeinstallprompt` event and exposes a
 * one-tap install button.
 *
 * iOS Safari: no API for triggering install; we render the manual
 * Share → Add to Home Screen instructions when we detect iOS + Safari.
 *
 * Hidden after the user dismisses or installs (state stored in localStorage).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

const STORAGE_KEY = 'heretoo:pwa-prompt-dismissed-at';

type Mode = 'hidden' | 'android' | 'ios';

export function PWAInstallPrompt() {
  const styles = makeStyles();
  const [mode, setMode] = useState<Mode>('hidden');
  // We hold a reference to the deferred prompt event for Chrome's flow.
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Skip if running already-installed (Add-to-Home-Screen sets standalone).
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Skip if user dismissed within the last 14 days.
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (dismissed) {
        const ts = parseInt(dismissed, 10);
        if (!Number.isNaN(ts) && Date.now() - ts < 14 * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch {}

    // Android Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setMode('android');
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari detection (no API, must instruct manually)
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isIOS && isSafari) {
      // Show after a short delay so it doesn't slap them on first paint.
      const t = setTimeout(() => setMode('ios'), 1200);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    try { window.localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setMode('hidden');
  };

  const installAndroid = async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice?.outcome === 'accepted') {
      try { window.localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    }
    setMode('hidden');
  };

  if (mode === 'hidden') return null;

  return (
    <View style={styles.root}>
      <Ionicons
        name={mode === 'ios' ? 'logo-apple' : 'logo-android'}
        size={20}
        color={Colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Install HereToo</Text>
        <Text style={styles.body}>
          {mode === 'android'
            ? 'One-tap install for fullscreen, faster launch.'
            : 'Tap the Share icon, then "Add to Home Screen".'}
        </Text>
      </View>
      {mode === 'android' && (
        <TouchableOpacity style={styles.installBtn} onPress={installAndroid}>
          <Text style={styles.installBtnText}>Install</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: {
    position: 'absolute' as const,
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 9999,
    maxWidth: 560,
    alignSelf: 'center',
    width: 'auto' as any,
  },
  title: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  body: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 17 },
  installBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  installBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
}); }
