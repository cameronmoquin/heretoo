# Kiosk provisioning

Turning an Android phone into a device that runs HereToo and nothing else.

Built for a Galaxy S22, but nothing here is Samsung-specific except the Odin
recovery note at the end.

---

## What this actually is

Three Android mechanisms stacked:

| Mechanism | What it buys | Where it lives |
|---|---|---|
| **Device owner** | Unremovable admin privilege. Can block installs, factory reset, safe boot. | Granted once over ADB |
| **HOME intent filter** | HereToo *is* the launcher. Home button relaunches it. | `plugins/withKiosk.js` |
| **Lock task mode** | No notification shade, no Recents, no way out. | `modules/heretoo-kiosk` |

Note what this is **not**: a custom OS. Stock Android is still underneath. This
is airtight against a kid and porous against a determined adult with a USB
cable. That is the correct threat model here.

---

## Before you touch the real phone

**Device owner can only be granted on a device with no configured accounts.**
Once Jude's phone has a Google account on it, the only way back to a
provisionable state is a factory reset. So rehearse on an emulator first.

```bash
npx expo prebuild --platform android --clean
```

```bash
cd android && ./gradlew assembleDebug
```

Then on a **freshly wiped** AVD (Android 13+, no Google Play image — Play
images auto-add an account and block provisioning):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

```bash
adb shell dpm set-device-owner social.heretoo.app/social.heretoo.kiosk.KioskAdminReceiver
```

Success prints `Active admin set to component {...}`. Anything else — most
often `Not allowed to set the device owner because there are already some
accounts on the device` — means the device is not clean. Wipe and retry.

Launch the app. You should be unable to leave it. Then confirm the escape
hatch works: **six taps in the top-left corner within three seconds**, set a
PIN, and verify "Leave kiosk" returns you to the launcher.

Do not proceed to the real phone until that round trip works.

---

## Provisioning the real phone

### 1. Build the kiosk APK

**A verified build exists** at
`D:\Photos from Samsung s22\_apks\heretoo-kiosk\heretoo-kiosk-v1.0.0-build2.apk`
(117 MB, built 2026-08-04). Confirmed to contain the HOME intent filter, the
device admin receiver, `QUERY_ALL_PACKAGES`, and every native entry point —
`getLaunchableApps`, `setPackagesHidden`, `launchApp`, `encodeIcon`.

**Build once more before wipe day anyway.** Everything changed since build2 is
JavaScript, which normally ships over the air — but not usefully *during*
provisioning. The phone has no Wi-Fi configured until partway through setup, so
a build relying on an OTA to fetch its own shelf would show a stale UI at the
exact moment you are testing it. Bake it in instead:

```bash
npx eas build --profile kiosk --platform android --non-interactive
```

Budget ~30 minutes; the queue has run 15 minutes on top of a 17-minute build.


```bash
HERETOO_KIOSK=1 npx eas build --profile kiosk --platform android
```

The `kiosk` EAS profile sets `HERETOO_KIOSK=1`, which is the only thing that
activates `plugins/withKiosk.js`. A build without it is an ordinary HereToo
build with an inert `KioskGate` — the plugin injects nothing.

### 2. Remove accounts — *before* the reset

Do not skip this. Settings → Accounts and backup → Manage accounts. Remove
**every Google account**, then the **Samsung account**.

Plural matters. The target device had *four* Google accounts on it when checked
in August 2026, which is easy to under-count by eye. Enumerate them with the
phone plugged in rather than trusting the Settings list:

```bash
adb shell "dumpsys account | grep -oE 'name=[^,]+, type=com.google' | sort -u"
```

Re-run that after removing them; it should come back empty before you reset.

Factory Reset Protection ties the wiped phone to the last Google account signed
into it. Reset with the account still attached and the setup wizard demands
those credentials before it will continue — and satisfying it *adds an account*,
which is exactly the state that makes `dpm set-device-owner` fail with "there
are already some accounts on the device." That costs you a second wipe.

Removing the accounts first clears FRP, so the wizard comes up clean and
skippable.

If you are handing this phone down after migrating to a new one, do the
migration first and confirm everything landed — this step signs the phone out
of everything.

### 3. Wipe the phone

Settings → General management → Reset → Factory data reset.

Reset from Settings, not from recovery mode. A recovery wipe does not clear FRP
even when the accounts were removed cleanly.

Then, in the setup wizard:

- **Skip Wi-Fi if it offers to sign you in.** Connect to Wi-Fi *only* at a step
  that does not lead into a Google account prompt, or skip network entirely and
  connect after provisioning.
- **Skip the Google account.** This is the step that matters. An account here
  costs you another wipe.
- Skip Samsung account, face/fingerprint, and all the rest.

### 4. Enable ADB

Settings → About phone → Software information → tap **Build number** seven
times. Then Settings → Developer options → **USB debugging** on.

### 5. Install and provision

```bash
adb install -r heretoo-kiosk.apk
```

```bash
adb shell dpm set-device-owner social.heretoo.app/social.heretoo.kiosk.KioskAdminReceiver
```

### 6. Sideload the other allowed apps

Do this **before** first launch of HereToo. `provision()` applies
`DISALLOW_INSTALL_APPS`, and the wiped phone has no Google account to reach the
Play Store with anyway — so this is the only window.

Every allowed app was saved off the device before the wipe, into
`D:\Photos from Samsung s22\_apks\<package>\`. They ship as split APKs, so each
must go in with `install-multiple` — installing `base.apk` alone fails with
`INSTALL_FAILED_MISSING_SPLIT`.

One folder per package means this is a loop, not six commands. From PowerShell:

```powershell
Get-ChildItem "D:\Photos from Samsung s22\_apks" -Directory | ForEach-Object { $apks = (Get-ChildItem $_.FullName -Filter *.apk).FullName; Write-Host "installing $($_.Name)"; & adb install-multiple @apks }
```

Then **open each one and confirm it actually runs**. They all came from the
Play Store, and a sideloaded Play app can fail if it hard-requires Play
Services sign-in or Play licensing — `com.chess` in particular ships as a
`-googleplay` build variant. None of this can be tested before the wipe.

Note that Spotify and Kindle need account sign-ins, and Duolingo and Chess keep
per-account progress. Decide whether Jude gets his own accounts or uses yours
before you hand the phone over.

If one refuses to run, the fallback is to add a Google account *after* device
owner is established — clear `DISALLOW_MODIFY_ACCOUNTS` from the parent panel,
sign in, install from Play, then re-apply the restriction. That leaves an
account on Jude's phone, which is worth avoiding if you can.

### 7. First launch

Open HereToo. On mount it calls `provision()` then `lock()`, which:

- registers itself as the permanent launcher (no chooser dialog, survives reboot)
- whitelists itself and the dialer for lock task
- applies the default user restrictions (see below)
- disables the keyguard
- enters lock task

Do the six-tap corner gesture and **set the parent PIN now**, while you are
holding the phone. Until it is set, the first person to find the gesture owns
the hatch.

### 8. Sign Jude in, then verify

Sign into his HereToo account, then reboot and confirm the phone comes back up
into HereToo with no launcher flash. Check the status panel reads:

```
Device owner   yes
Locked         yes
Default home   yes
```

If **Locked** is yes but the panel warns about screen pinning, `provision()`
did not take — `setLockTaskPackages` failed, meaning device owner is not
actually held. Re-run step 4.

---

## Restrictions

`provision()` applies these automatically:

```
DISALLOW_FACTORY_RESET          DISALLOW_ADD_USER
DISALLOW_SAFE_BOOT              DISALLOW_INSTALL_APPS
DISALLOW_UNINSTALL_APPS         DISALLOW_INSTALL_UNKNOWN_SOURCES
DISALLOW_MODIFY_ACCOUNTS        DISALLOW_CONFIG_TETHERING
DISALLOW_OUTGOING_BEAM
```

### The one that is deliberately missing

`DISALLOW_DEBUGGING_FEATURES` is **not** applied by default, and you should
think hard before adding it. It disables ADB — the only remote you have left
for fixing a phone whose app will not start. With it off, a broken build is a
`adb install -r` away from fixed. With it on, it is a factory reset.

If you want it anyway, once everything is stable:

```ts
await setRestrictions(['no_debugging_features'], true);
```

---

## Getting back in

In rough order of how much you lose:

1. **Six taps, top-left corner, then the PIN.** Normal route. Leave kiosk, fix,
   re-lock.
2. **`adb shell am force-stop social.heretoo.app`** — if the UI is wedged but
   ADB is alive.
3. **`adb install -r` a new APK.** Fixes a bad JS bundle or a broken build.
   Device owner survives reinstall as long as the signing key matches.
4. **`releaseDeviceOwner()` from the parent panel.** Clears restrictions,
   relinquishes admin, returns the phone to normal. Irreversible — regranting
   device owner needs a factory reset.
5. **Odin + stock firmware.** The floor. `DISALLOW_FACTORY_RESET` blocks the
   settings-menu reset and recovery-mode wipe, but it cannot block download
   mode. A Samsung phone flashed with stock firmware from Frija/SamMobile is
   always recoverable. You cannot brick this device by locking it too hard.

---

## Updating the phone later

JS-only changes ship over the air on the `kiosk` channel — no cable, no
reprovisioning:

```bash
npx eas update --branch kiosk
```

Native changes (anything under `modules/heretoo-kiosk/` or `plugins/`) need a
new APK and `adb install -r`. Device owner persists across reinstalls with a
matching signature, so this does **not** require another wipe.

Keep the kiosk signing key safe. Losing it means a mismatched signature, which
means uninstall-and-reinstall, which means a factory reset, which means
reprovisioning from step 2.

---

## Known rough edges

- **Captive-portal Wi-Fi** (hotel, school, library) cannot be completed from
  inside lock task — there is no browser. Use the panel's **Open Wi-Fi
  settings**, which drops lock task first, then re-lock when done.
- **The dialer whitelist** (`ALLOWED_PACKAGES` in `KioskGate.tsx`) is verified
  against SM-S901U / Android 16: `com.samsung.android.dialer` exists,
  `com.android.dialer` does not. Re-check with
  `adb shell pm list packages | grep -i dialer` if you ever change hardware.
  Note that **911 works from the lock screen regardless** — this list is only
  about reaching a specific person.

- **Knox Guard.** Samsung ships `com.samsung.android.kgclient` as a registered
  device admin on every Galaxy; on this device it is dormant
  (`knox_guard_state` is null, `Device Owner Type: -1`), so it does not contend
  for the device-owner slot. It is the mechanism carriers use to lock financed
  handsets, though, so confirm the phone is paid off and carrier-unlocked before
  wiping — a carrier can activate it remotely, and a Knox Guard lock applied
  after provisioning would outrank everything here.
- **Notifications are suppressed** inside lock task by default. `lock()` sets
  `LOCK_TASK_FEATURE_GLOBAL_ACTIONS` only, so the power menu works and nothing
  else does. If Jude needs to see a new-message banner, add
  `LOCK_TASK_FEATURE_NOTIFICATIONS` in `HereTooKioskModule.kt` — it also brings
  back a pull-down shade, so it is a real tradeoff.
