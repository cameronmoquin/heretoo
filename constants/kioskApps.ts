/**
 * The allowlist for Jude's phone.
 *
 * This is the SEED, not the live list. Once the parent panel's picker has
 * written an allowlist, lib/kiosk-allowlist.ts outranks this file — see there.
 * This is what a freshly provisioned phone starts with, and what "Reset" in
 * the picker falls back to.
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
  // Minecraft: Bedrock Edition 1.26.40.5. Ships as five splits totalling
  // ~1.1 GB, nearly all of it split_install_pack.apk — the game assets. All
  // five must go in on one `install-multiple` or the install fails.
  'com.mojang.minecraftpe',
  'com.lego.common.legoplay',
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

/**
 * Packages hidden outright via DevicePolicyManager.setApplicationHidden.
 *
 * Belt and braces. Lock task already refuses to foreground anything outside
 * KIOSK_ALLOWED_PACKAGES, and there is no app drawer to launch them from — but
 * that protection lasts exactly as long as lock task does. If it drops (a
 * crash, or a parent unlock), the phone is briefly ordinary Android with a
 * store and a browser on it. Hiding survives that window.
 *
 * Storefronts and browsers only. NOT com.google.android.gms — Play Services is
 * a dependency of half these apps, and hiding it would break Duolingo, Chess,
 * and Spotify rather than lock anything down.
 *
 * Names are the standard ones for a Samsung device; unverified against this
 * handset because it was unplugged when this was written. A name that does not
 * exist is skipped silently, so a wrong guess costs nothing but should still
 * be corrected — check with `adb shell pm list packages` on provisioning day.
 */
/** What the device calls itself on its own home screen. */
export const KIOSK_DEVICE_NAME = 'Jude-a-phone';

/**
 * Shown on the shelf, always.
 *
 * This device has no active cellular service — the SIM reports no registered
 * carrier. A SIM-less handset on a US network can often still reach 911, but
 * "often" is not a basis for a child's safety, and nothing here verifies it.
 * The label exists so nobody — Jude, a sitter, a friend's parent — mistakes
 * this for a phone you can call for help on.
 *
 * Do not soften or hide this without adding real emergency capability first.
 */
export const KIOSK_DISCLAIMER =
  'Entertainment use only. Not capable of emergency calls.';

export const KIOSK_BLOCKED_PACKAGES: string[] = [
  'com.android.vending', // Google Play Store
  'com.sec.android.app.samsungapps', // Galaxy Store
  'com.android.chrome',
  'com.sec.android.app.sbrowser', // Samsung Internet
  'com.google.android.youtube',
];
