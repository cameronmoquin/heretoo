/**
 * KioskGate — the lock, and the way out of it.
 *
 * Mounted once at the root. Two jobs:
 *
 *   1. Keep the device locked. On cold start and on every return to the
 *      foreground it re-asserts provisioning and re-enters lock task, so a
 *      crash, an OTA update, or a reboot lands back in the kiosk rather than
 *      dumping the kid onto a bare Android home screen.
 *
 *   2. Give the parent a way back in. An invisible corner target opens a
 *      PIN-gated panel with the escapes that actually matter in practice:
 *      leave lock task, reach Wi-Fi settings, read live status.
 *
 * Build this before you provision the real phone. Device owner cannot be
 * re-granted without a factory reset, so a build with no working hatch means
 * wiping the device to fix a typo.
 *
 * On web, iOS, and non-kiosk Android builds this renders nothing at all. It
 * used to render the corner target anyway on the theory that an invisible
 * Pressable is harmless; on web it covered the sidebar logo and opened the
 * PIN panel to anyone who found it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/design';
import {
  getStatus,
  provision,
  lock,
  unlock,
  openWifiSettings,
  setPackagesHidden,
  setRestrictions,
  isKioskBuild,
  type KioskStatus,
} from '../../modules/heretoo-kiosk';
import {
  KIOSK_BLOCKED_PACKAGES,
  KIOSK_UNHIDE_PACKAGES,
} from '../../constants/kioskApps';
import { loadAllowlist } from '../../lib/kiosk-allowlist';
import { KioskAppPicker } from './KioskAppPicker';

/**
 * Restrictions the install toggle lifts. Both are re-applied by the next
 * enforce(), so "allow installs" is a window, not a setting.
 */
const INSTALL_RESTRICTIONS = ['no_install_apps', 'no_install_unknown_sources'];

const PIN_KEY = 'heretoo.kiosk.parentPin';
const TAPS_REQUIRED = 6;
const TAP_WINDOW_MS = 3000;

export function KioskGate() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState<KioskStatus>(getStatus);
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  /** How many blocked packages the parent has temporarily restored. */
  const [restored, setRestored] = useState<number | null>(null);
  const [installsOpen, setInstallsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const taps = useRef<number[]>([]);
  const styles = makeStyles();

  const refresh = useCallback(() => setStatus(getStatus()), []);

  /**
   * Re-assert the lock. Safe to call repeatedly.
   *
   * Reads the allowlist from storage rather than the compiled constant, so an
   * app ticked in the picker takes effect on the next enforce() — which is
   * every cold start, every foreground, and the Done button.
   */
  const enforce = useCallback(async () => {
    if (!isKioskBuild) return;
    const allowed = await loadAllowlist();
    await provision(allowed, KIOSK_BLOCKED_PACKAGES);
    // Actively clear the hidden flag on anything that has left the blocked
    // list. provision() only ever *sets* it, so a package dropped from
    // KIOSK_BLOCKED_PACKAGES would otherwise stay hidden forever.
    await setPackagesHidden(KIOSK_UNHIDE_PACKAGES, false);
    await lock();
    refresh();
  }, [refresh]);

  useEffect(() => {
    SecureStore.getItemAsync(PIN_KEY)
      .then(setStoredPin)
      .catch(() => setStoredPin(null));
    enforce();
  }, [enforce]);

  // Re-lock whenever we come back to the foreground. Covers reboots, crashes,
  // and the brief unlock the Wi-Fi escape hatch has to perform.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && !panelOpen) enforce();
    });
    return () => sub.remove();
  }, [enforce, panelOpen]);

  const onCornerTap = () => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < TAP_WINDOW_MS);
    if (taps.current.length >= TAPS_REQUIRED) {
      taps.current = [];
      refresh();
      setEntry('');
      setError(null);
      setAuthed(false);
      setPanelOpen(true);
    }
  };

  const closePanel = () => {
    setPanelOpen(false);
    setAuthed(false);
    setEntry('');
    setError(null);
    setRestored(null);
    setInstallsOpen(false);
    // Whatever the parent did, end back in the kiosk. enforce() re-hides the
    // stores and re-applies the install restrictions, so every temporary
    // loosening above closes here whether or not the parent tidied up.
    enforce();
  };

  const submitPin = async () => {
    if (storedPin === null) {
      // First run: whoever is holding the phone during setup sets the PIN.
      if (entry.length < 4) {
        setError('Choose at least 4 digits.');
        return;
      }
      await SecureStore.setItemAsync(PIN_KEY, entry);
      setStoredPin(entry);
      setEntry('');
      setError(null);
      setAuthed(true);
      return;
    }

    if (entry === storedPin) {
      setEntry('');
      setError(null);
      setAuthed(true);
    } else {
      setEntry('');
      setError('Wrong PIN.');
    }
  };

  /**
   * Nothing renders outside a kiosk build.
   *
   * The native calls already no-op off isKioskBuild, but the corner
   * target did not: an invisible 56x56 Pressable at the viewport origin
   * with zIndex 9999 sat over the top-left of the sidebar brand mark on
   * web, ate clicks meant for the logo, and opened the parent-PIN panel
   * to anyone who hit that corner six times. A hit target is not inert
   * just because it is invisible.
   *
   * Below every hook on purpose. isKioskBuild is fixed per platform so
   * an earlier return would not actually reorder anything, but putting
   * it here means nobody has to reason about that to add a hook.
   */
  if (!isKioskBuild) return null;

  return (
    <>
      {/* Invisible, unlabeled, and out of the way of real UI. */}
      <Pressable
        style={styles.corner}
        onPress={onCornerTap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <Modal
        visible={panelOpen}
        transparent
        animationType="fade"
        onRequestClose={closePanel}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {!authed ? (
              <>
                <Text style={styles.title}>
                  {storedPin === null ? 'Set a parent PIN' : 'Parent PIN'}
                </Text>
                <Text style={styles.message}>
                  {storedPin === null
                    ? 'This is the only way back into the device. Pick something you will not forget.'
                    : 'Enter your PIN to reach device controls.'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={entry}
                  onChangeText={setEntry}
                  keyboardType="number-pad"
                  secureTextEntry
                  autoFocus
                  maxLength={12}
                  placeholder="••••"
                  placeholderTextColor={Colors.textMuted}
                  onSubmitEditing={submitPin}
                />
                {!!error && <Text style={styles.error}>{error}</Text>}
                <View style={styles.row}>
                  <TouchableOpacity
                    onPress={closePanel}
                    style={[styles.btn, styles.ghostBtn]}
                  >
                    <Text style={styles.ghostBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={submitPin}
                    style={[styles.btn, styles.primaryBtn]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {storedPin === null ? 'Save' : 'Unlock'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Device controls</Text>

                <View style={styles.statusBlock}>
                  <StatusLine
                    label="Device owner"
                    ok={status.isDeviceOwner}
                    styles={styles}
                  />
                  <StatusLine
                    label="Locked"
                    ok={status.isLocked && !status.isPinnedOnly}
                    styles={styles}
                  />
                  <StatusLine
                    label="Default home"
                    ok={status.isDefaultHome}
                    styles={styles}
                  />
                  {status.isPinnedOnly && (
                    <Text style={styles.error}>
                      Screen pinning only — not device-owner lock task. Re-run
                      provisioning.
                    </Text>
                  )}
                  {!isKioskBuild && (
                    <Text style={styles.message}>
                      Not a kiosk build. Controls are inert here.
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    await unlock();
                    refresh();
                  }}
                  style={[styles.btn, styles.ghostBtn, styles.fullBtn]}
                >
                  <Text style={styles.ghostBtnText}>
                    Leave kiosk (until next launch)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    setPanelOpen(false);
                    await openWifiSettings();
                  }}
                  style={[styles.btn, styles.ghostBtn, styles.fullBtn]}
                >
                  <Text style={styles.ghostBtnText}>Open Wi-Fi settings</Text>
                </TouchableOpacity>

                {/* Storefronts and browsers are hidden at provision time.
                    This brings them back for as long as the panel says so —
                    needed to install something, or if a sideloaded Play app
                    turns out to check for the Store. "Re-apply lock now" and
                    the next cold start both hide them again. */}
                <TouchableOpacity
                  onPress={async () => {
                    const changed = await setPackagesHidden(
                      KIOSK_BLOCKED_PACKAGES,
                      false
                    );
                    setRestored(changed.length);
                  }}
                  style={[styles.btn, styles.ghostBtn, styles.fullBtn]}
                >
                  <Text style={styles.ghostBtnText}>
                    {restored === null
                      ? 'Restore Play Store & browsers'
                      : `Restored ${restored} — hidden again on re-lock`}
                  </Text>
                </TouchableOpacity>

                {/* Sideloading needs these lifted; adb install is subject to
                    the same user restrictions the UI installer is. */}
                <TouchableOpacity
                  onPress={async () => {
                    await setRestrictions(INSTALL_RESTRICTIONS, false);
                    setInstallsOpen(true);
                  }}
                  style={[styles.btn, styles.ghostBtn, styles.fullBtn]}
                >
                  <Text style={styles.ghostBtnText}>
                    {installsOpen
                      ? 'Installs open — blocked again on re-lock'
                      : 'Allow installs (for ADB sideloading)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPickerOpen(true)}
                  style={[styles.btn, styles.ghostBtn, styles.fullBtn]}
                >
                  <Text style={styles.ghostBtnText}>Choose apps…</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={async () => {
                    await enforce();
                    setRestored(null);
                    setInstallsOpen(false);
                    refresh();
                  }}
                  style={[styles.btn, styles.ghostBtn, styles.fullBtn]}
                >
                  <Text style={styles.ghostBtnText}>Re-apply lock now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closePanel}
                  style={[styles.btn, styles.primaryBtn, styles.fullBtn]}
                >
                  <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <KioskAppPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSaved={() => {
          // Push the new allowlist into setLockTaskPackages immediately —
          // otherwise a freshly ticked app gets a tile it cannot launch.
          enforce();
        }}
      />
    </>
  );
}

function StatusLine({
  label,
  ok,
  styles,
}: {
  label: string;
  ok: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.statusLine}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, !ok && styles.statusValueBad]}>
        {ok ? 'yes' : 'no'}
      </Text>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  corner: {
    position: 'absolute',
    top: 0, left: 0,
    width: 56, height: 56,
    zIndex: 9999,
  },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    width: '100%', maxWidth: 420,
    padding: 22, gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  message: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  error: { fontSize: 13, color: Colors.error, marginTop: 6 },
  input: {
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.control,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 20, letterSpacing: 4,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: Radius.pill, alignItems: 'center' },
  fullBtn: { flex: 0, alignSelf: 'stretch', marginTop: 8 },
  ghostBtn: { borderWidth: 1, borderColor: Colors.border },
  ghostBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  primaryBtn: { backgroundColor: Colors.primary },
  primaryBtnText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 14 },
  statusBlock: {
    marginTop: 12, marginBottom: 4,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.control,
    gap: 4,
  },
  statusLine: { flexDirection: 'row', justifyContent: 'space-between' },
  statusLabel: { fontSize: 13, color: Colors.textSecondary },
  statusValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  statusValueBad: { color: Colors.error },
}); }
