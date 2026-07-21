/**
 * /loft
 *
 * The Loft stopped being a destination. Its posts are the Public lens
 * on the one feed. This route stays so old links and bookmarks still
 * land somewhere correct.
 */

import { Redirect } from 'expo-router';

export default function LoftScreen() {
  return <Redirect href="/(tabs)/feed?filter=public" />;
}
