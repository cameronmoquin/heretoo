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
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

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
      showAlert('Could not post', err?.message ?? 'Something went wrong.');
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Text style={s.label}>Message</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Write something for the family."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            autoFocus
          />

          <View style={s.mediaRow}>
            <TouchableOpacity
              style={s.mediaBtn}
              onPress={async () => { await upload.pickPhotos(); }}
              disabled={upload.stage === 'uploading'}
              activeOpacity={0.8}
            >
              <Ionicons name="image-outline" size={18} color={Colors.primary} />
              <Text style={s.mediaBtnText}>
                {upload.selectedAssets.length > 0
                  ? `${upload.selectedAssets.length} selected`
                  : 'Add photos'}
              </Text>
            </TouchableOpacity>
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
                  : 'Posting…'}
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

          <TouchableOpacity
            style={[s.saveBtn, !canPost && { opacity: 0.5 }]}
            onPress={handlePost}
            disabled={!canPost}
          >
            <Text style={s.saveBtnText}>Post</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.md, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 120 },
  mediaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mediaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceLight,
  },
  mediaBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  clearBtnText: { color: Colors.textMuted, fontSize: 13 },
  thumb: { width: 80, height: 80, borderRadius: 8, marginRight: 6 },
  progressBox: {
    marginTop: 12, padding: 10, borderRadius: 8,
    backgroundColor: Colors.primaryFaint,
  },
  progressText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  debugBox: {
    marginTop: 12, padding: 10, borderRadius: 8,
    backgroundColor: '#3a1410', borderWidth: 1, borderColor: '#5a2a20',
  },
  debugLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#FFA899', textTransform: 'uppercase', marginBottom: 4 },
  debugText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: '#FFD0C9' },
  saveBtn: {
    marginTop: 24, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
}); }
