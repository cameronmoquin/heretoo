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

  // Camera, last on the shelf by request. Also the IMAGE_CAPTURE handler, so
  // it must stay permitted regardless — expo-image-picker's
  // launchCameraAsync fires an intent at this package, and without it in the
  // lock-task list, taking a photo from inside HereToo fails.
  //
  // Surfacing it as a tile does hand Jude the full Samsung camera app, with
  // its own settings and share sheet, rather than only the composer's capture
  // flow. That is the tradeoff; it was tile-less before for that reason.
  'com.sec.android.app.camera',
];

/**
 * Packages that are permitted inside lock task but deliberately get no tile.
 *
 * Telephony only. The dialer is reachable through HereToo's own calling UI,
 * and on a device with no cellular service it cannot place a call anyway —
 * an icon for it would be a button that does nothing.
 *
 * The camera used to live here for the same reason, and was surfaced by
 * request: being able to take a photo is worth more than keeping the stock
 * app's settings out of reach.
 */
export const KIOSK_HIDDEN_PACKAGES: string[] = [
  'com.samsung.android.dialer',
  'com.android.server.telecom',
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
  'com.sec.android.app.samsungapps', // Galaxy Store
  'com.android.chrome',
  'com.sec.android.app.sbrowser', // Samsung Internet
  'com.google.android.youtube',
];

/**
 * Packages provisioning explicitly un-hides.
 *
 * The Play Store used to be in KIOSK_BLOCKED_PACKAGES. Minecraft is wrapped in
 * Google's PairIP licence check, which queries `com.android.vending` on every
 * launch; with the Store hidden the query fails and the game dies on
 * "Check that Google Play is enabled on your device."
 *
 * Dropping it from the blocked list is not enough on its own — hidePackages
 * only ever sets the flag on packages it is given, so a package already hidden
 * stays hidden forever once it leaves that list. This list is what actively
 * clears the flag.
 *
 * Visible is not reachable. The Store is absent from KIOSK_ALLOWED_PACKAGES,
 * so lock task still refuses to foreground it, and it has no tile. Hiding was
 * belt-and-braces on top of the lock-task whitelist; the whitelist is the part
 * that actually protects the device.
 */
export const KIOSK_UNHIDE_PACKAGES: string[] = [
  'com.android.vending',
];
