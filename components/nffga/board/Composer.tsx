/**
 * Composer — write a Clubhouse post: text (up to 4000), up to five photos,
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
import { createPost, POST_MAX, POST_MAX_PHOTOS, useBoardRefresh } from '../../../lib/nffga/board';
import { pickImages } from './pickImage';
import { ErrorLine, inputStyle } from './Page';

export function Composer() {
  const s = makeStyles();
  const { userId } = useSession();
  const role = useRole(userId);
  const refresh = useBoardRefresh();
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [announce, setAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOfficer = !!role.data;
  const over = body.length > POST_MAX;
  const near = body.length > POST_MAX - 200;
  const canPost = !busy && !over && (body.trim().length > 0 || photos.length > 0);
  const room = POST_MAX_PHOTOS - photos.length;

  const addPhoto = async () => {
    setError(null);
    try {
      const picked = await pickImages(room);
      if (picked.length) setPhotos((cur) => [...cur, ...picked].slice(0, POST_MAX_PHOTOS));
    } catch {
      setError('Could not open your photos.');
    }
  };

  const submit = async () => {
    if (!userId || !canPost) return;
    setBusy(true);
    setError(null);
    const res = await createPost({ userId, body, photos, kind: isOfficer && announce ? 'announcement' : 'post' });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setBody('');
    setPhotos([]);
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
      {photos.length ? (
        <View style={s.photoRow}>
          {photos.map((p, i) => (
            <View key={`${p.uri}-${i}`} style={s.thumbWrap}>
              <Image source={{ uri: p.uri }} style={s.thumb} />
              <Pressable
                onPress={() => setPhotos((cur) => cur.filter((_, j) => j !== i))}
                style={s.thumbX}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                hitSlop={8}
              >
                <Text style={s.thumbXText}>×</Text>
              </Pressable>
            </View>
          ))}
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
        <Button
          title={photos.length ? `Add photos (${photos.length}/${POST_MAX_PHOTOS})` : 'Add photos'}
          onPress={addPhoto} variant="outline" size="sm" disabled={busy || room <= 0}
        />
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
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: Radius.control, backgroundColor: Colors.surfaceAlt },
  thumbX: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  thumbXText: { color: Colors.onPrimary, fontSize: 15, lineHeight: 17, fontWeight: '700' },
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
