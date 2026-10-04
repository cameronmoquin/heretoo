/**
 * /inbox — the member's conversations, most recent first.
 * Signed-out visitors see the account prompt.
 */
import React from 'react';
import { RefreshControl } from 'react-native';
import { Page, PageTitle, Muted, Loading, SignedInOnly } from '../../components/nffga/board/Page';
import { ThreadRow } from '../../components/nffga/inbox/ThreadRow';
import { Colors } from '../../constants/colors';
import { useSession } from '../../lib/nffga/useSession';
import { useThreads } from '../../lib/nffga/messages';

export default function InboxScreen() {
  return (
    <SignedInOnly title="Inbox" reason="to send and read messages">
      <Inbox />
    </SignedInOnly>
  );
}

function Inbox() {
  const { userId } = useSession();
  const threads = useThreads(userId);
  const list = threads.data ?? [];
  return (
    <Page
      title="Inbox"
      refreshControl={<RefreshControl refreshing={threads.isRefetching} onRefresh={() => threads.refetch()} tintColor={Colors.textMuted} />}
    >
      <PageTitle>Inbox</PageTitle>
      {threads.isLoading ? <Loading /> : null}
      {!threads.isLoading && list.length === 0 ? (
        <Muted>No messages yet. To start one, open a member's profile and choose Message.</Muted>
      ) : null}
      {list.map((t) => <ThreadRow key={t.id} thread={t} />)}
    </Page>
  );
}
