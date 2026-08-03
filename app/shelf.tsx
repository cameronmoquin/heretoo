/**
 * /shelf — the launcher home for a provisioned kiosk device.
 *
 * Reached two ways: app/index.tsx lands here instead of the feed on kiosk
 * builds, and the system Home button resolves here because HereToo is
 * registered as the launcher.
 *
 * On any non-kiosk build this route should not be reachable at all; the
 * redirect is a guard against a stray link or a typed URL on web.
 */

import React from 'react';
import { Redirect } from 'expo-router';
import { AppShelf } from '../components/shared/AppShelf';
import { isKioskBuild } from '../modules/heretoo-kiosk';

export default function ShelfScreen() {
  if (!isKioskBuild) return <Redirect href="/(tabs)/feed" />;
  return <AppShelf />;
}
