/**
 * Web push subscription — the browser half.
 *
 * lib/push.ts registers Expo tokens and returns null on web. This is the
 * counterpart: a Push API subscription, stored in web_push_subscriptions
 * (migration 089) and sent to by netlify/functions/push-send.ts.
 *
 * Why it exists: the only HereToo on an iPhone is the web app, so without
 * this a parent's only alert that their kid wrote is the polled email, which
 * lands one to three minutes later.
 *
 * iOS caveat worth knowing before debugging anything here: Safari only grants
 * push to a PWA the user has added to their home screen. In a normal Safari
 * tab `Notification.requestPermission()` either throws or resolves 'denied',
 * and no amount of correct code changes that. Chrome and Firefox on desktop
 * and Android have no such requirement.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * VAPID public key. Public by design — it is shipped to every browser and
 * identifies this server to the push service. The private half lives only in
 * the Netlify environment as VAPID_PRIVATE_KEY and must never reach the
 * client bundle.
 */
export const VAPID_PUBLIC_KEY =
  'BMeAhzmiHGnZ4za6iIHS3PL0SDrwn3eZAS0pZNxeCg2snIrcZ_lunNShpK2YU3UWhftN6CdlLgEQh-TjC_Td1oo';

/**
 * base64url → Uint8Array, the format PushManager.subscribe expects.
 *
 * Backed by an explicit ArrayBuffer rather than `new Uint8Array(length)`:
 * the latter is typed Uint8Array<ArrayBufferLike>, which does not satisfy
 * BufferSource because it might be a SharedArrayBuffer.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** ArrayBuffer → base64, for the two subscription keys. */
function bufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/**
 * True when this browser could plausibly deliver a push. Does not mean
 * permission has been granted — only that asking is worth doing.
 */
export function canUseWebPush(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * On iOS, `standalone` is true only for a home-screen PWA. Used to explain
 * the failure rather than let it look like a bug.
 */
export function isIosSafariTab(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const standalone = (window.navigator as any).standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true;
  return isIos && !standalone;
}

/**
 * Subscribe this browser and store it against the profile.
 *
 * Idempotent: the endpoint is unique and upserted, so re-running on every
 * sign-in refreshes a rotated subscription instead of piling up dead rows.
 * Returns null on every failure path rather than throwing — a browser that
 * cannot do push must not break sign-in.
 */
export async function registerWebPush(
  profileId: string | null | undefined
): Promise<string | null> {
  if (!profileId || !canUseWebPush()) return null;

  try {
    if (Notification.permission === 'denied') return null;

    if (Notification.permission !== 'granted') {
      const asked = await Notification.requestPermission();
      if (asked !== 'granted') return null;
    }

    const reg = await navigator.serviceWorker.ready;

    // An existing subscription is reused; re-subscribing would issue a new
    // endpoint and orphan the stored row.
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
    const endpoint = json.endpoint ?? sub.endpoint;
    const p256dh = json.keys?.p256dh ?? bufferToBase64(sub.getKey('p256dh'));
    const auth = json.keys?.auth ?? bufferToBase64(sub.getKey('auth'));
    if (!endpoint || !p256dh || !auth) return null;

    const { error } = await supabase
      .from('web_push_subscriptions')
      .upsert(
        {
          profile_id: profileId,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent?.slice(0, 300) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[web-push] could not store subscription:', error.message);
      return null;
    }

    return endpoint;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[web-push] subscribe failed:', e);
    return null;
  }
}

/** Drop this browser's subscription. Called on sign-out. */
export async function unregisterWebPush(): Promise<void> {
  if (!canUseWebPush()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await supabase.from('web_push_subscriptions').delete().eq('endpoint', endpoint);
  } catch {
    // Signing out must not fail because a push endpoint would not let go.
  }
}
