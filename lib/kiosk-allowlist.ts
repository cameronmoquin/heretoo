/**
 * The runtime app allowlist for Jude's phone.
 *
 * KIOSK_ALLOWED_PACKAGES in constants/kioskApps.ts is the *seed*, not the
 * source of truth. Once the parent panel has written a list, that list wins —
 * otherwise adding a game would mean editing source and shipping an OTA, which
 * is a laptop trip for something that should take ten seconds on the phone.
 *
 * Stored in SecureStore rather than AsyncStorage. Not because a list of package
 * names is secret, but because it is the thing that decides what the device
 * will run, and it sits next to the parent PIN under the same hardware-backed
 * protection.
 */

import * as SecureStore from 'expo-secure-store';
import { KIOSK_ALLOWED_PACKAGES, KIOSK_HIDDEN_PACKAGES } from '../constants/kioskApps';

const KEY = 'heretoo.kiosk.allowedPackages';

/**
 * Packages that must survive any edit the parent makes in the picker.
 *
 * Telephony and the camera are permitted but tile-less, so they never appear
 * in the picker and could otherwise be dropped silently the first time the
 * panel writes a list — taking the emergency-call path and the composer's
 * camera intent with them.
 */
const ALWAYS: string[] = KIOSK_HIDDEN_PACKAGES;

const dedupe = (xs: string[]) => Array.from(new Set(xs));

/**
 * The effective allowlist. Falls back to the compiled seed on a fresh device
 * or if the stored value is unreadable or corrupt — never to an empty list,
 * which would strand the phone with a shelf full of nothing.
 */
export async function loadAllowlist(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return dedupe(KIOSK_ALLOWED_PACKAGES);

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((p) => typeof p !== 'string')) {
      return dedupe(KIOSK_ALLOWED_PACKAGES);
    }
    if (parsed.length === 0) return dedupe(KIOSK_ALLOWED_PACKAGES);

    return dedupe([...ALWAYS, ...parsed]);
  } catch {
    return dedupe(KIOSK_ALLOWED_PACKAGES);
  }
}

/** Persist an edited list. ALWAYS entries are re-added regardless. */
export async function saveAllowlist(packages: string[]): Promise<string[]> {
  const next = dedupe([...ALWAYS, ...packages]);
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  return next;
}

/** Drop the stored list and fall back to the compiled seed. */
export async function resetAllowlist(): Promise<string[]> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Already absent is the desired end state.
  }
  return dedupe(KIOSK_ALLOWED_PACKAGES);
}
