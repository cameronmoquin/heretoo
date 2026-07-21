/**
 * /common
 *
 * The feed moved back to the home tab. This route stays so old links
 * and bookmarks still land somewhere correct.
 */

import { Redirect } from 'expo-router';

export default function CommonScreen() {
  return <Redirect href="/(tabs)/feed" />;
}
