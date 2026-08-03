/**
 * withKiosk — Expo config plugin that turns a HereToo build into a locked-down
 * kiosk device for a single user (see docs/KIOSK_PROVISIONING.md).
 *
 * Only applies when HERETOO_KIOSK=1 is set at prebuild/build time, so normal
 * HereToo builds are byte-for-byte unaffected. The EAS `kiosk` profile sets it.
 *
 * What it injects into AndroidManifest.xml:
 *   1. A HOME + DEFAULT intent filter on MainActivity, so HereToo *is* the
 *      launcher — the Home button relaunches it instead of escaping to One UI.
 *   2. A DeviceAdminReceiver declaration, required before `dpm set-device-owner`
 *      will accept the app.
 *   3. res/xml/heretoo_device_admin.xml, the policy manifest the receiver points at.
 */

const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ADMIN_RECEIVER = 'social.heretoo.kiosk.KioskAdminReceiver';
const ADMIN_POLICY_RES = 'heretoo_device_admin';

/**
 * Device admin policies we declare. These are the *capabilities* the receiver
 * may use; actual enforcement happens at runtime via the native module.
 */
const DEVICE_ADMIN_XML = `<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <limit-password />
        <watch-login />
        <reset-password />
        <force-lock />
        <wipe-data />
        <expire-password />
        <encrypted-storage />
        <disable-camera />
        <disable-keyguard-features />
    </uses-policies>
</device-admin>
`;

const isEnabled = (props) => {
  if (props && typeof props.enabled === 'boolean') return props.enabled;
  return process.env.HERETOO_KIOSK === '1';
};

/** Make MainActivity the system launcher. */
const withHomeLauncher = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const mainActivity = app.activity?.find(
      (a) => a.$['android:name'] === '.MainActivity'
    );

    if (!mainActivity) {
      throw new Error(
        '[withKiosk] Could not find .MainActivity in AndroidManifest.xml. ' +
          'The Expo template may have changed — update plugins/withKiosk.js.'
      );
    }

    mainActivity['intent-filter'] = mainActivity['intent-filter'] ?? [];

    const alreadyHome = mainActivity['intent-filter'].some((f) =>
      f.category?.some(
        (c) => c.$['android:name'] === 'android.intent.category.HOME'
      )
    );

    if (!alreadyHome) {
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.HOME' } },
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        ],
      });
    }

    return cfg;
  });

/** Declare the DeviceAdminReceiver that `dpm set-device-owner` binds to. */
const withDeviceAdminReceiver = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.receiver = app.receiver ?? [];

    const existing = app.receiver.findIndex(
      (r) => r.$['android:name'] === ADMIN_RECEIVER
    );
    if (existing !== -1) app.receiver.splice(existing, 1);

    app.receiver.push({
      $: {
        'android:name': ADMIN_RECEIVER,
        'android:permission': 'android.permission.BIND_DEVICE_ADMIN',
        'android:exported': 'true',
        'android:directBootAware': 'true',
      },
      'meta-data': [
        {
          $: {
            'android:name': 'android.app.device_admin',
            'android:resource': `@xml/${ADMIN_POLICY_RES}`,
          },
        },
      ],
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name':
                  'android.app.action.DEVICE_ADMIN_ENABLED',
              },
            },
            {
              $: {
                'android:name':
                  'android.app.action.PROFILE_PROVISIONING_COMPLETE',
              },
            },
          ],
        },
      ],
    });

    return cfg;
  });

/** Write res/xml/heretoo_device_admin.xml. */
const withDeviceAdminPolicyXml = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(xmlDir, `${ADMIN_POLICY_RES}.xml`),
        DEVICE_ADMIN_XML,
        'utf8'
      );
      return cfg;
    },
  ]);

/**
 * Package visibility. Android 11+ hides other installed packages by default,
 * so getLaunchIntentForPackage() returns null for anything not declared —
 * which would make the app shelf silently unable to launch PBS Kids et al.
 *
 * QUERY_ALL_PACKAGES is the launcher-appropriate answer and is added ONLY in
 * the kiosk variant, which is sideloaded via internal distribution and never
 * goes through Play review. Normal HereToo builds do not get this permission.
 */
const withPackageVisibility = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];

    const alreadyDeclared = manifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.QUERY_ALL_PACKAGES'
    );
    if (!alreadyDeclared) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.QUERY_ALL_PACKAGES' },
      });
    }

    return cfg;
  });

const withKiosk = (config, props) => {
  if (!isEnabled(props)) return config;

  console.log('[withKiosk] HERETOO_KIOSK=1 — building locked kiosk variant.');

  config = withHomeLauncher(config);
  config = withDeviceAdminReceiver(config);
  config = withDeviceAdminPolicyXml(config);
  config = withPackageVisibility(config);

  return config;
};

module.exports = withKiosk;
