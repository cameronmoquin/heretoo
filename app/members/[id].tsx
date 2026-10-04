/**
 * /members/[id] — a member's public profile and their recent board
 * posts. Messaging them needs an account.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Muted, Loading, ErrorLine, inputStyle } from '../../components/nffga/board/Page';
import { PostCard } from '../../components/nffga/board/PostCard';
import { MemberAvatar } from '../../components/nffga/board/MemberAvatar';
import { RequireAccount } from '../../components/nffga/RequireAccount';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { useSession } from '../../lib/nffga/useSession';
import { formatHandicap, useProfile } from '../../lib/nffga/profile';
import { useMemberPosts } from '../../lib/nffga/board';
import { MESSAGE_MAX, startThread } from '../../lib/nffga/messages';
import type { NffgaProfile } from '../../lib/nffga/types';

function place(p: Pick<NffgaProfile, 'city' | 'state'>): string | null {
  return [p.city, p.state].filter(Boolean).join(', ') || null;
}

export default function MemberScreen() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Array.isArray(id) ? id[0] : id;
  const { userId } = useSession();
  const profile = useProfile(memberId);
  const posts = useMemberPosts(memberId);
  const [composing, setComposing] = useState(false);

  if (profile.isLoading) return <Page title="Member"><Loading /></Page>;
  const p = profile.data;
  if (!p) {
    return (
      <Page title="Member">
        <Muted>This member could not be found.</Muted>
      </Page>
    );
  }

  const isMe = userId === p.user_id;
  const hcp = formatHandicap(p.handicap);
  const where = place(p);
  const facts: [string, string | null][] = [
    ['Rank', p.rank_title],
    ['Department', p.department],
    ['Location', where],
    ['Handicap', hcp],
  ];

  return (
    <Page title={p.display_name || 'Member'}>
      <View style={s.head}>
        <MemberAvatar name={p.display_name} path={p.avatar_path} size={80} />
        <View style={s.headText}>
          <Text style={s.name} accessibilityRole="header">{p.display_name || 'Member'}</Text>
          {p.rank_title || p.department ? (
            <Text style={s.sub}>{[p.rank_title, p.department].filter(Boolean).join(', ')}</Text>
          ) : null}
        </View>
      </View>

      <View style={s.facts}>
        {facts.filter(([, v]) => !!v).map(([k, v]) => (
          <View key={k} style={s.fact}>
            <Text style={s.factKey}>{k}</Text>
            <Text style={s.factVal}>{v}</Text>
          </View>
        ))}
      </View>

      {p.bio ? <Text style={s.bio}>{p.bio}</Text> : null}

      {isMe ? (
        <View style={s.row}>
          <Button title="Edit profile" onPress={() => router.push('/account' as any)} variant="outline" size="md" />
        </View>
      ) : composing ? (
        <RequireAccount reason="to send a message">
          <MessageForm otherId={p.user_id} onCancel={() => setComposing(false)} />
        </RequireAccount>
      ) : (
        <View style={s.row}>
          <Button title="Message" onPress={() => setComposing(true)} variant="primary" size="md" />
        </View>
      )}

      <Text style={s.heading}>Board posts</Text>
      {posts.isLoading ? <Loading /> : null}
      {!posts.isLoading && (posts.data ?? []).length === 0 ? <Muted>No posts yet.</Muted> : null}
      {(posts.data ?? []).map((post) => <PostCard key={post.id} post={post} />)}
    </Page>
  );
}

function MessageForm({ otherId, onCancel }: { otherId: string; onCancel: () => void }) {
  const s = makeStyles();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await startThread(otherId, body);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    router.push(`/inbox/${res.threadId}` as any);
  };

  return (
    <View style={s.form}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write a message"
        placeholderTextColor={Colors.textMuted}
        multiline
        maxLength={MESSAGE_MAX}
        autoFocus
        style={[inputStyle(), s.input]}
        accessibilityLabel="Message text"
      />
      <ErrorLine>{error}</ErrorLine>
      <View style={s.row}>
        <Button title="Send" onPress={send} variant="primary" size="md" loading={busy} disabled={!body.trim()} />
        <Button title="Cancel" onPress={onCancel} variant="ghost" size="md" disabled={busy} />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headText: { flex: 1, gap: Spacing.xxs },
  name: {
    fontSize: Type.display.size, lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight, color: Colors.textPrimary,
  },
  sub: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textSecondary },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  fact: { gap: 2 },
  factKey: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },
  factVal: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary, fontWeight: '500' },
  bio: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  row: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  form: { gap: Spacing.sm },
  input: { minHeight: 96, textAlignVertical: 'top' },
  heading: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight, color: Colors.textPrimary, marginTop: Spacing.md,
  },
}); }
