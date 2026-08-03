/**
 * /chat
 *
 * Messages moved to /messages, so the URL says what the room is called.
 * This route stays so old links, bookmarks and any push that still names
 * the old path land somewhere correct.
 *
 * Netlify redirects the cold hit at the edge (see netlify.toml). This
 * covers the warm one: client-side routing never reaches the server, so
 * an in-app push to /chat would otherwise find nothing here.
 */

import { Redirect } from 'expo-router';

export default function ChatScreen() {
  return <Redirect href="/messages" />;
}
