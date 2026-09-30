/**
 * App config — single product surface.
 *
 * The HereToo codebase this was forked from once shipped two products on
 * different subdomains; `detectAppId()` survives from that era and
 * always returns 'nffga'.
 */

import { SITE_NAME, SITE_LONG_NAME } from './site';

export type AppId = 'nffga';

export interface AppConfig {
  id: AppId;
  name: string;
  tagline: string;
  rootHref: string;
}

const NFFGA: AppConfig = {
  id: 'nffga',
  name: SITE_NAME,
  tagline: SITE_LONG_NAME,
  rootHref: '/(tabs)/feed',
};

export const APPS: Record<AppId, AppConfig> = { nffga: NFFGA };

export function detectAppId(): AppId {
  return 'nffga';
}

export function getAppConfig(): AppConfig {
  return NFFGA;
}
