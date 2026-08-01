import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUpload } from '../../../hooks/useUpload';
import { showAlert } from '../../../lib/alert';
import { Button } from '../../../components/shared/Button';
import { Eyebrow } from '../../../components/shared/Eyebrow';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { Vocab } from '../../../constants/vocab';

export default function NewFamilyPost() {
  const s = makeStyles();
  const { id: familyId } = useLocalSearchParams<{ id: string }>();
  const upload = useUpload();
  const [body, setBody] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  const hasMedia = upload.selectedAssets.length > 0;
  const canPost = (body.trim().length > 0 || hasMedia)
    && upload.stage !== 'uploading' && upload.stage !== 'creating_post';

  const handlePost = async () => {
    if (!familyId) return;
    setLastError(null);
    try {
      let photoUploads: { path: string; width?: number; height?: number }[] | undefined;
      let muxPlaybackId: string | undefined;
      let muxThumbnailUrl: string | undefined;
      let videoDurationMs: number | undefined;

      if (upload.selectedAssets.length > 0) {
        const first = upload.selectedAssets[0];
        const isVideo = first.type === 'video';
        if (isVideo) {
          const v = await upload.uploadVideo(first);
          muxPlaybackId = v.playbackId;
          muxThumbnailUrl = v.thumbnailUrl;
          videoDurationMs = first.duration ?? undefined;
        } else {
          photoUploads = await upload.uploadPhotos(upload.selectedAssets);
        }
      }

      await upload.createPost.mutateAsync({
        body: body.trim(),
        visibility: 'family',
        familyId,
        photoUploads,
        muxPlaybackId,
        muxThumbnailUrl,
        videoDurationMs,
      });

      setBody('');
      upload.reset();
      router.back();
    } catch (err: any) {
      const raw = JSON.stringify(err, null, 2);
      // eslint-disable-next-line no-console
      console.error('FAMILY_POST_ERROR', raw);
      setLastError(raw);
      // Codex tone (M10): name the next move; never "Something went wrong" alone.
      showAlert(`Could not ${Vocab.postVerb}`, err?.message ?? 'Try again in a moment.');
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Eyebrow style={s.label}>Message</Eyebrow>
          <TextInput
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            autoFocus
          />

          <View style={s.mediaRow}>
            <Button
              title={upload.selectedAssets.length > 0
                ? `${upload.selectedAssets.length} selected`
                : 'Add photos'}
              variant="secondary"
              size="sm"
              icon={<Ionicons name="image-outline" size={18} color={Colors.primary} />}
              style={s.mediaBtn}
              onPress={async () => { await upload.pickPhotos(); }}
              disabled={upload.stage === 'uploading'}
            />
            {upload.selectedAssets.length > 0 && (
              <TouchableOpacity style={s.clearBtn} onPress={() => upload.reset()} activeOpacity={0.7}>
                <Text style={s.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {upload.selectedAssets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {upload.selectedAssets.map((a, i) => (
                <Image key={a.uri + i} source={{ uri: a.uri }} style={s.thumb} />
              ))}
            </ScrollView>
          )}

          {(upload.stage === 'uploading' || upload.stage === 'creating_post') && (
            <View style={s.progressBox}>
              <Text style={s.progressText}>
                {upload.stage === 'uploading'
                  ? `Uploading… ${Math.round(upload.progress * 100)}%`
                  : 'Sending…'}
              </Text>
            </View>
          )}

          {lastError && (
            <View style={s.debugBox}>
              <Text style={s.debugLabel}>Debug</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={s.debugText} selectable>{lastError}</Text>
              </ScrollView>
            </View>
          )}

          <Button
            title={Vocab.Post}
            onPress={handlePost}
            disabled={!canPost}
            size="lg"
            style={s.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.md, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  label: { marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 120 },
  mediaRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  mediaBtn: {
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  clearBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 10 },
  clearBtnText: { color: Colors.textMuted, fontSize: 13 },
  thumb: { width: 80, height: 80, borderRadius: 8, marginRight: 6 },
  progressBox: {
    marginTop: Spacing.sm, padding: 10, borderRadius: 8,
    backgroundColor: Colors.primaryFaint,
  },
  progressText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  debugBox: {
    marginTop: Spacing.sm, padding: 10, borderRadius: 8,
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.error,
  },
  debugLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1,
    color: Colors.error, textTransform: 'uppercase', marginBottom: Spacing.xxs,
  },
  debugText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: Type.eyebrow.size, color: Colors.textSecondary,
  },
  saveBtn: { marginTop: Spacing.lg },
}); }
