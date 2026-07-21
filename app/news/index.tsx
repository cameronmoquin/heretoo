/**
 * /news
 *
 * News stopped being a destination. The wire is the News lens on the
 * one feed. This route stays so old links and bookmarks still land
 * somewhere correct.
 */

import { Redirect } from 'expo-router';

export default function NewsScreen() {
  return <Redirect href="/(tabs)/feed?filter=news" />;
}
