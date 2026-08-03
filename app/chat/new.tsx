/**
 * /chat/new → /messages/new
 *
 * See app/chat/index.tsx for why these stubs exist.
 */

import { Redirect } from 'expo-router';

export default function ChatNewScreen() {
  return <Redirect href="/messages/new" />;
}
