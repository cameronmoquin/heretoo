/**
 * App config — single product surface.
 *
 * The codebase used to ship two products on different subdomains. We've
 * consolidated: family groups are a feature inside HereToo, not a separate
 * brand. `detectAppId()` is kept for backwards compatibility but always
 * returns 'heretoo' now.
 */

export type AppId = 'heretoo';

export interface AppConfig {
  id: AppId;
  name: string;
  tagline: string;
  rootHref: string;
}

const HERETOO: AppConfig = {
  id: 'heretoo',
  name: 'HERETOO',
  tagline: 'Be real.',
  rootHref: '/(tabs)/feed',
};

export const APPS: Record<AppId, AppConfig> = { heretoo: HERETOO };

export function detectAppId(): AppId {
  return 'heretoo';
}

export function getAppConfig(): AppConfig {
  return HERETOO;
}
