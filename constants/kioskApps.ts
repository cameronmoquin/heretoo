/**
 * The allowlist for Jude's phone.
 *
 * One source of truth, read by two consumers that must never disagree:
 *   - KioskGate passes it to provision() → setLockTaskPackages, deciding what
 *     is *permitted* to run inside lock task.
 *   - AppShelf passes it to getAppInfo() → the tiles, deciding what is
 *     *reachable*.
 *
 * If these two lists ever drift, you get either a tile that drops the device
 * out of lock task when tapped, or a permitted app with no way to open it.
 *
 * Every entry below was verified against the target device (SM-S901U,
 * Android 16) with `adb shell pm list packages`. Do not add a package you have
 * not confirmed — setLockTaskPackages accepts unknown names silently, and
 * getAppInfo drops them, so a typo shows up as a missing tile with no error.
 */
export const KIOSK_ALLOWED_PACKAGES: string[] = [
  // Telephony. 911 works from the lock screen regardless of this list; these
  // are for reaching a specific person.
  'com.samsung.android.dialer',
  'com.android.server.telecom', // in-call UI for an active call

  // Camera. Confirmed as the IMAGE_CAPTURE handler, so this is also what
  // expo-image-picker's launchCameraAsync fires an intent at — without it,
  // taking a photo from inside HereToo fails while locked.
  'com.sec.android.app.camera',

  // The curated set.
  'org.pbskids.gamesapp',
  'com.Peasoup.Outtatown', // capital P is load-bearing
  'com.spotify.music',
  'com.amazon.kindle',
  'com.duolingo',
  'com.chess',
];

/**
 * Packages that are permitted inside lock task but deliberately get no tile.
 *
 * The dialer is reachable through HereToo's own calling UI, and the camera is
 * launched by the composer via intent — surfacing either as its own icon would
 * invite Jude to wander into a stock Samsung app with its own settings,
 * account prompts, and share sheet.
 */
export const KIOSK_HIDDEN_PACKAGES: string[] = [
  'com.samsung.android.dialer',
  'com.android.server.telecom',
  'com.sec.android.app.camera',
];

/** Packages that should appear as tiles on the shelf. */
export const KIOSK_SHELF_PACKAGES: string[] = KIOSK_ALLOWED_PACKAGES.filter(
  (p) => !KIOSK_HIDDEN_PACKAGES.includes(p)
);
