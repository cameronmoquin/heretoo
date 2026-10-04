/**
 * CommentBox — reply to a post. Render inside <RequireAccount>.
 */
import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Button } from '../../shared/Button';
import { Colors } from '../../../constants/colors';
import { Spacing } from '../../../constants/design';
import { useSession } from '../../../lib/nffga/useSession';
import { COMMENT_MAX, createComment, useBoardRefresh } from '../../../lib/nffga/board';
import { ErrorLine, inputStyle } from './Page';

export function CommentBox({ postId }: { postId: string }) {
  const s = makeStyles();
  const { userId } = useSession();
  const refresh = useBoardRefresh();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!userId || !body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await createComment({ userId, postId, body });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBody('');
    refresh();
  };

  return (
    <View style={s.box}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write a comment"
        placeholderTextColor={Colors.textMuted}
        multiline
        maxLength={COMMENT_MAX}
        style={[inputStyle(), s.input]}
        accessibilityLabel="Comment text"
      />
      <ErrorLine>{error}</ErrorLine>
      <View style={s.bar}>
        <Button title="Comment" onPress={submit} variant="primary" size="sm" loading={busy} disabled={!body.trim()} />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  box: { gap: Spacing.sm },
  input: { minHeight: 72, textAlignVertical: 'top' },
  bar: { flexDirection: 'row', justifyContent: 'flex-end' },
}); }
