import { requireOptionalNativeModule } from 'expo';

export type KioskStatus = {
  /** App holds device owner — the privilege everything else depends on. */
  isDeviceOwner: boolean;
  /** Currently in lock task mode (no shade, no Recents, no Home escape). */
  isLocked: boolean;
  /**
   * Locked via user-initiated screen pinning rather than device-owner lock
   * task. Means provision() did not take — the kid can long-press Back+Recents
   * to get out.
   */
  isPinnedOnly: boolean;
  /** We are the system launcher. */
  isDefaultHome: boolean;
  packageName: string;
  sdkInt: number;
};

/** One installed, launchable app, resolved for the shelf. */
export type KioskAppInfo = {
  packageName: string;
  /** The app's own display name, e.g. "PBS KIDS Games". */
  label: string;
  /** base64 PNG data URI, or null if the icon could not be rendered. */
  icon: string | null;
};

/** An installed, launchable app as offered in the parent panel's picker. */
export type KioskLaunchableApp = {
  packageName: string;
  label: string;
  /** Preinstalled system app rather than something you or Play installed. */
  isSystem: boolean;
};

type KioskNative = {
  getStatus(): KioskStatus;
  provision(
    allowedPackages: string[] | null,
    blockedPackages: string[] | null
  ): Promise<{ allowedPackages: string[]; hiddenPackages: string[] }>;
  setPackagesHidden(packages: string[], hidden: boolean): Promise<string[]>;
  lock(): Promise<boolean>;
  unlock(): Promise<boolean>;
  setRestrictions(keys: string[], enabled: boolean): Promise<boolean>;
  getAppInfo(packages: string[]): KioskAppInfo[];
  getLaunchableApps(): KioskLaunchableApp[];
  launchApp(packageName: string): Promise<boolean>;
  openSettings(action: string | null): Promise<boolean>;
  releaseDeviceOwner(): Promise<boolean>;
};

/**
 * Null on web, iOS, and any Android build made without HERETOO_KIOSK=1.
 * Every export below degrades gracefully so callers never need to branch.
 */
const native = requireOptionalNativeModule<KioskNative>('HereTooKiosk');

const UNAVAILABLE: KioskStatus = {
  isDeviceOwner: false,
  isLocked: false,
  isPinnedOnly: false,
  isDefaultHome: false,
  packageName: '',
  sdkInt: 0,
};

/** True only in a kiosk-variant Android build. */
export const isKioskBuild = native != null;

export function getStatus(): KioskStatus {
  if (!native) return UNAVAILABLE;
  try {
    return native.getStatus();
  } catch {
    return UNAVAILABLE;
  }
}

/**
 * Idempotent. Call on every cold start — it re-asserts the launcher binding and
 * restrictions in case an OTA or crash left them half-applied.
 *
 * @param allowedPackages extra packages permitted inside lock task, e.g.
 *   ['com.samsung.android.dialer'] so an emergency call can foreground.
 * @param blockedPackages packages hidden outright — storefronts and browsers.
 */
export async function provision(
  allowedPackages: string[] = [],
  blockedPackages: string[] = []
): Promise<boolean> {
  if (!native) return false;
  try {
    await native.provision(allowedPackages, blockedPackages);
    return true;
  } catch {
    // Not device owner yet — expected before the adb step. Caller reads
    // getStatus() to decide what to show.
    return false;
  }
}

/**
 * Hide or restore packages. Returns the packages that actually changed, which
 * may be shorter than what was asked for: names that are not installed, and
 * system packages Android refuses to hide, are skipped.
 */
export async function setPackagesHidden(
  packages: string[],
  hidden: boolean
): Promise<string[]> {
  if (!native) return [];
  try {
    return await native.setPackagesHidden(packages, hidden);
  } catch {
    return [];
  }
}

export async function lock(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.lock();
  } catch {
    return false;
  }
}

export async function unlock(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.unlock();
  } catch {
    return false;
  }
}

export async function setRestrictions(
  keys: string[],
  enabled: boolean
): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.setRestrictions(keys, enabled);
  } catch {
    return false;
  }
}

/**
 * Resolve label + icon for shelf tiles. Anything not installed is omitted, so
 * an app that failed to sideload just doesn't get a tile rather than showing a
 * dead one.
 */
export function getAppInfo(packages: string[]): KioskAppInfo[] {
  if (!native) return [];
  try {
    return native.getAppInfo(packages);
  } catch {
    return [];
  }
}

/**
 * Every launchable app on the device, for the parent panel's picker. Excludes
 * HereToo itself and carries no icons — see the native side for why.
 */
export function getLaunchableApps(): KioskLaunchableApp[] {
  if (!native) return [];
  try {
    return native.getLaunchableApps();
  } catch {
    return [];
  }
}

/**
 * Launch a whitelisted app. Only ever call this with a package that was passed
 * to provision() — launching anything else drops out of lock task.
 */
export async function launchApp(packageName: string): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.launchApp(packageName);
  } catch {
    return false;
  }
}

/** Leaves lock task and opens system Wi-Fi settings. Re-lock when done. */
export const SETTINGS_WIFI = 'android.settings.WIFI_SETTINGS';
/** Where you sign into Google, which Minecraft's licence check requires. */
export const SETTINGS_ADD_ACCOUNT = 'android.settings.ADD_ACCOUNT_SETTINGS';

/**
 * Leave lock task and open a system settings screen.
 *
 * Returns false — and logs the reason — rather than pretending. The previous
 * version always reported success even when lock task refused to release and
 * the settings screen never appeared.
 */
export async function openSettings(
  action: string = SETTINGS_WIFI
): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.openSettings(action);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[kiosk] openSettings failed:', e);
    return false;
  }
}

/**
 * Irreversible without a factory reset. Only reachable from the parent panel.
 */
export async function releaseDeviceOwner(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.releaseDeviceOwner();
  } catch {
    return false;
  }
}
