/**
 * Native push registration.
 *
 * Asks once, stores the device's Expo token against the signed-in
 * profile, and gets out of the way. The send side lives in
 * netlify/functions/push-send.ts; this file only ever registers.
 *
 * WEB IS A NO-OP. expo-notifications' push token needs a native
 * projectId and a real device; on web it throws rather than returning
 * null. There is a service worker registered for the PWA and web push
 * could be built on it later, but it is a different transport with its
 * own keys and subscription shape, so it is not pretended at here.
 *
 * Everything is best-effort and swallowed. A person who declines
 * permission, or an Expo outage, must never block sign-in — the app
 * works without notifications, it just does not buzz.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

/** Simulators and web return nothing; only real installs get a token. */
export async function registerPushToken(profileId: string | null | undefined): Promise<string | null> {
  if (!profileId) return null;
  if (Platform.OS === 'web') return null;

  try {
    // Required lazily. Importing expo-notifications at module scope
    // pulls native code into the web bundle, and this module is reached
    // from shared hooks that web renders too.
    const Notifications = require('expo-notifications');
    const Device = (() => {
      try { return require('expo-device'); } catch { return null; }
    })();

    if (Device && Device.isDevice === false) return null;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return null;

    // Android needs a channel or notifications arrive silently and
    // without a heads-up banner, which defeats the point.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const projectId =
      (require('expo-constants')?.default?.expoConfig?.extra?.eas?.projectId) ?? undefined;
    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token: string | undefined = res?.data;
    if (!token) return null;

    // Upsert on the token, so reinstalling or handing the device to
    // someone else re-points the row instead of leaving a stale one
    // ringing the wrong person's phone.
    // The upsert alone could not perform the handover it was written
    // for: push_tokens' own-row policy fails the UPDATE half when the
    // row still belongs to the previous person, so a shared phone
    // silently delivered nothing to its new owner. Clear any row for
    // this device first (own-row DELETE is permitted), then insert.
    await supabase.from('push_tokens').delete().eq('token', token);
    await supabase
      .from('push_tokens')
      .upsert(
        { token, profile_id: profileId, platform: Platform.OS, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      );

    return token;
  } catch {
    // Permission denied, no native module, Expo down, offline — all the
    // same answer: no token, no notifications, app unaffected.
    return null;
  }
}

/** Called on sign-out so a shared device stops ringing for someone who left. */
export async function unregisterPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = require('expo-notifications');
    const res = await Notifications.getExpoPushTokenAsync();
    const token: string | undefined = res?.data;
    if (!token) return;
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {}
}
