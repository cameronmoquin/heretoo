/**
 * /chat/[threadId] → /messages/[threadId]
 *
 * The thread id is carried across rather than dropped. A stale link to a
 * specific conversation should open that conversation, not the list —
 * landing one level up is the kind of "redirect" that reads as a bug.
 *
 * See app/chat/index.tsx for why these stubs exist.
 */

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId?: string | string[] }>();
  const id = Array.isArray(threadId) ? threadId[0] : threadId;
  // No id means the path did not match what it claims to be. The list is
  // the honest landing place; inventing a thread id would not be.
  if (!id) return <Redirect href="/messages" />;
  return <Redirect href={`/messages/${id}`} />;
}
