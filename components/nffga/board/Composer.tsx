/**
 * Composer — write a board post: text (up to 4000), an optional photo,
 * and for officers an "announcement" switch. Render it inside
 * <RequireAccount>; it assumes a session.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Image } from 'react-native';
import { Button } from '../../shared/Button';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { useSession } from '../../../lib/nffga/useSession';
import { useRole, type PickedImage } from '../../../lib/nffga/profile';
import { createPost, POST_MAX, useBoardRefresh } from '../../../lib/nffga/board';
import { pickImage } from './pickImage';
import { ErrorLine, inputStyle } from './Page';

export function Composer() {
  const s = makeStyles();
  const { userId } = useSession();
  const role = useRole(userId);
  const refresh = useBoardRefresh();
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [announce, setAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOfficer = !!role.data;
  const over = body.length > POST_MAX;
  const near = body.length > POST_MAX - 200;
  const canPost = !busy && !over && (body.trim().length > 0 || !!photo);

  const addPhoto = async () => {
    setError(null);
    try {
      const p = await pickImage();
      if (p) setPhoto(p);
    } catch {
      setError('Could not open your photos.');
    }
  };

  const submit = async () => {
    if (!userId || !canPost) return;
    setBusy(true);
    setError(null);
    const res = await createPost({ userId, body, photo, kind: isOfficer && announce ? 'announcement' : 'post' });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBody('');
    setPhoto(null);
    setAnnounce(false);
    refresh();
  };

  return (
    <View style={s.box}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write a post"
        placeholderTextColor={Colors.textMuted}
        multiline
        maxLength={POST_MAX + 200}
        style={[inputStyle(), s.input]}
        accessibilityLabel="Post text"
      />
      {photo ? (
        <View style={s.photoRow}>
          <Image source={{ uri: photo.uri }} style={s.thumb} />
          <Button title="Remove photo" onPress={() => setPhoto(null)} variant="ghost" size="sm" />
        </View>
      ) : null}
      {isOfficer ? (
        <Pressable
          onPress={() => setAnnounce((a) => !a)}
          style={s.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: announce }}
        >
          <View style={[s.checkBox, announce && s.checkOn]}>
            {announce ? <View style={s.checkDot} /> : null}
          </View>
          <Text style={s.checkText}>Post as an announcement</Text>
        </Pressable>
      ) : null}
      <ErrorLine>{error}</ErrorLine>
      <View style={s.bar}>
        <Button title={photo ? 'Change photo' : 'Add photo'} onPress={addPhoto} variant="outline" size="sm" disabled={busy} />
        <View style={s.right}>
          {near ? <Text style={[s.count, over && s.countOver]}>{body.length}/{POST_MAX}</Text> : null}
          <Button title="Post" onPress={submit} variant="primary" size="sm" loading={busy} disabled={!canPost} />
        </View>
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  box: { gap: Spacing.sm },
  input: { minHeight: 96, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: Radius.control, backgroundColor: Colors.surfaceAlt },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', minHeight: 32 },
  checkBox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: Colors.textSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { borderColor: Colors.primary },
  checkDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.primary },
  checkText: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textPrimary },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  count: { fontSize: Type.caption.size, color: Colors.textMuted },
  countOver: { color: Colors.error },
}); }
