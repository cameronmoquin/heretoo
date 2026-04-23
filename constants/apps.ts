/**
 * Hostname-aware app config.
 *
 * One codebase, two products:
 *   - heretoo.social         → HereToo social platform
 *   - candon.heretoo.social  → Candon relationship assistant + family bulletin
 *
 * Native/mobile reads the appId from env or defaults to HereToo.
 */

import { Platform } from 'react-native';

export type AppId = 'heretoo' | 'candon';

export interface AppConfig {
  id: AppId;
  name: string;
  tagline: string;
  rootHref: string;
  featureFlags: {
    heretoo_social: boolean;
    candon_relationship: boolean;
    candon_family: boolean;
    candon_admin_outreach: boolean;
  };
}

const HERETOO: AppConfig = {
  id: 'heretoo',
  name: 'HERETOO',
  tagline: 'Be real.',
  rootHref: '/(tabs)/feed',
  featureFlags: {
    heretoo_social: true,
    candon_relationship: false,
    candon_family: false,
    candon_admin_outreach: false,
  },
};

const CANDON: AppConfig = {
  id: 'candon',
  name: 'Candon',
  tagline: 'Stay in touch.',
  rootHref: '/candon',
  featureFlags: {
    heretoo_social: false,
    candon_relationship: true,
    candon_family: true,
    candon_admin_outreach: false, // only enabled for admin users server-side
  },
};

export const APPS: Record<AppId, AppConfig> = { heretoo: HERETOO, candon: CANDON };

/**
 * Detect which app to render based on hostname.
 * Falls back to HereToo for native, or if hostname doesn't match.
 */
export function detectAppId(): AppId {
  if (Platform.OS !== 'web') {
    // Native: read from env, default HereToo.
    const envApp = (process.env.EXPO_PUBLIC_APP_ID as AppId) ?? 'heretoo';
    return APPS[envApp] ? envApp : 'heretoo';
  }

  if (typeof window === 'undefined') return 'heretoo';

  const host = window.location.hostname.toLowerCase();
  if (host.startsWith('candon.')) return 'candon';
  return 'heretoo';
}

export function getAppConfig(): AppConfig {
  return APPS[detectAppId()];
}
