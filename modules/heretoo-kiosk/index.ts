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

type KioskNative = {
  getStatus(): KioskStatus;
  provision(allowedPackages: string[] | null): Promise<{ allowedPackages: string[] }>;
  lock(): Promise<boolean>;
  unlock(): Promise<boolean>;
  setRestrictions(keys: string[], enabled: boolean): Promise<boolean>;
  getAppInfo(packages: string[]): KioskAppInfo[];
  launchApp(packageName: string): Promise<boolean>;
  openWifiSettings(): Promise<boolean>;
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
 */
export async function provision(allowedPackages: string[] = []): Promise<boolean> {
  if (!native) return false;
  try {
    await native.provision(allowedPackages);
    return true;
  } catch {
    // Not device owner yet — expected before the adb step. Caller reads
    // getStatus() to decide what to show.
    return false;
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
export async function openWifiSettings(): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.openWifiSettings();
  } catch {
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
