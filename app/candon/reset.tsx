import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CandonColors } from '../../constants/candon-theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

/**
 * /candon/reset — fully purge any cached auth on this device.
 * Used to escape stale-JWT loops where RLS rejects an otherwise valid user.
 */
export default function CandonReset() {
  const reset = useAuthStore((s) => s.reset);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut({ scope: 'global' as any });
      } catch {}

      try {
        if (typeof window !== 'undefined') {
          // Wipe everything Supabase put in storage (and a few neighbors that depend on it)
          const wipe = (storage: Storage) => {
            const toRemove: string[] = [];
            for (let i = 0; i < storage.length; i++) {
              const k = storage.key(i);
              if (!k) continue;
              if (
                k.includes('supabase')
                || k.startsWith('sb-')
                || k.includes('auth')
                || k.includes('candon')
                || k.includes('heretoo')
              ) toRemove.push(k);
            }
            toRemove.forEach((k) => storage.removeItem(k));
          };
          wipe(window.localStorage);
          wipe(window.sessionStorage);

          // Clear any cookies set on this origin
          document.cookie.split(';').forEach((c) => {
            const eq = c.indexOf('=');
            const name = (eq > -1 ? c.substr(0, eq) : c).trim();
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          });

          // Best-effort: drop IndexedDB databases Supabase / Expo may use
          if ('indexedDB' in window && (indexedDB as any).databases) {
            try {
              const dbs = await (indexedDB as any).databases();
              await Promise.all(
                (dbs ?? []).map((db: any) =>
                  db?.name ? new Promise((res) => {
                    const req = indexedDB.deleteDatabase(db.name);
                    req.onsuccess = () => res(null);
                    req.onerror = () => res(null);
                    req.onblocked = () => res(null);
                  }) : null,
                ),
              );
            } catch {}
          }
        }
      } catch {}

      reset();
      setDone(true);
    })();
  }, [reset]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.card}>
        {!done ? (
          <>
            <ActivityIndicator color={CandonColors.primary} size="large" />
            <Text style={s.title}>Clearing your session…</Text>
            <Text style={s.sub}>Wiping cached tokens and storage.</Text>
          </>
        ) : (
          <>
            <View style={s.checkBox}>
              <Ionicons name="checkmark" size={28} color={CandonColors.primary} />
            </View>
            <Text style={s.title}>All clear</Text>
            <Text style={s.sub}>
              Your device has been signed out and local storage wiped.
              Sign in again to continue.
            </Text>
            <TouchableOpacity
              style={s.btn}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/candon';
                } else {
                  router.replace('/candon');
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={s.btnText}>Go to sign in</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: CandonColors.bg,
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: CandonColors.surface,
    borderRadius: 16, padding: 32, alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: CandonColors.border,
    maxWidth: 420, width: '100%',
  },
  checkBox: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 22, fontWeight: '400', color: CandonColors.textPrimary,
    fontFamily: SERIF, marginTop: 4,
  },
  sub: {
    fontSize: 14, color: CandonColors.textSecondary,
    textAlign: 'center', lineHeight: 21, maxWidth: 320,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CandonColors.primary,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999,
    marginTop: 8,
  },
  btnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
