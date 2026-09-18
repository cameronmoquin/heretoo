/**
 * Setup mode — the kiosk held open until you say otherwise.
 *
 * Every escape in the parent panel is momentary: "Allow installs", "Restore
 * Play Store", "Leave kiosk" all get undone by the next enforce(), which runs
 * when the panel closes, when the app returns to the foreground, and on every
 * cold start. That is right for a device a nine-year-old carries and wrong for
 * the twenty minutes you spend signing into Google, installing from Play, or
 * joining a hotel network — the window shuts before you have finished.
 *
 * This is a latch. While it is on, enforce() does nothing: no lock task, no
 * restrictions, no hidden packages. The phone behaves like an ordinary Android
 * device. It survives reboots on purpose, because signing into an account
 * often involves one.
 *
 * The cost of that is real: a phone left in setup mode is not a kiosk. The
 * shelf shows a standing banner while it is on, and turning it off re-applies
 * everything immediately.
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'heretoo.kiosk.setupMode';

/**
 * Reads as false on any error. A storage failure must leave the device locked
 * down rather than open — the safe direction for this flag is off.
 */
export async function isSetupMode(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setSetupMode(on: boolean): Promise<void> {
  try {
    if (on) await SecureStore.setItemAsync(KEY, '1');
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // If the write fails while turning it ON, the device simply stays locked
    // and the parent tries again. Failing closed is correct here.
  }
}

/**
 * Restrictions setup mode lifts. Deliberately the full set that gets in the
 * way of provisioning work — installs, account sign-in, and the unknown-
 * sources flag Play itself trips over.
 */
export const SETUP_MODE_RESTRICTIONS = [
  'no_install_apps',
  'no_install_unknown_sources',
  'no_modify_accounts',
  'no_uninstall_apps',
];
