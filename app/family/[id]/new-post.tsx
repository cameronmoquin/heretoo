import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUpload } from '../../../hooks/useUpload';
import type { FamilyCategory } from '../../../hooks/useFamily';
import { showAlert } from '../../../lib/alert';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

const CATEGORIES: { id: FamilyCategory; label: string; icon: any }[] = [
  { id: 'general', label: 'General',  icon: 'list-outline' },
  { id: 'medical', label: 'Medical',  icon: 'medkit-outline' },
  { id: 'holiday', label: 'Holiday',  icon: 'gift-outline' },
  { id: 'party',   label: 'Party',    icon: 'wine-outline' },
  { id: 'event',   label: 'Event',    icon: 'calendar-outline' },
];

export default function NewFamilyPost() {
  const { id: groupId, category: initialCategory } =
    useLocalSearchParams<{ id: string; category?: string }>();
  const upload = useUpload();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<FamilyCategory>(
    (initialCategory as FamilyCategory) ?? 'general',
  );
  const [lastError, setLastError] = useState<string | null>(null);

  const hasMedia = upload.selectedAssets.length > 0;
  const canPost = (content.trim().length > 0 || hasMedia) && upload.stage !== 'uploading' && upload.stage !== 'creating_post';

  const handlePost = async () => {
    if (!groupId) return;
    setLastError(null);
    try {
      if (upload.selectedAssets.length > 0) {
        const firstAsset = upload.selectedAssets[0];
        const isVideo = firstAsset.type === 'video';

        if (isVideo) {
          const { assetId, playbackId, thumbnailUrl } =
            await upload.uploadVideo(firstAsset);
          await upload.createPost.mutateAsync({
            content: content.trim(),
            mediaType: 'video',
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            muxThumbnailUrl: thumbnailUrl,
            videoDuration: firstAsset.duration ? Math.round(firstAsset.duration / 1000) : undefined,
            familyGroupId: groupId,
            familyCategory: category,
          });
        } else {
          const photoUrls = await upload.uploadPhotos(upload.selectedAssets);
          await upload.createPost.mutateAsync({
            content: content.trim(),
            mediaType: 'photo',
            photoUrls,
            familyGroupId: groupId,
            familyCategory: category,
          });
        }
      } else {
        await upload.createPost.mutateAsync({
          content: content.trim(),
          mediaType: 'none',
          familyGroupId: groupId,
          familyCategory: category,
        });
      }
      setContent('');
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

          <Text style={s.label}>Where this goes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catChip, active && s.catChipActive]}
                  onPress={() => setCategory(c.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={c.icon}
                    size={13}
                    color={active ? '#FFF' : Colors.textSecondary}
                  />
                  <Text style={[s.catChipText, active && s.catChipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={s.label}>Message</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={content}
            onChangeText={setContent}
            placeholder={
              category === 'medical' ? 'Update on the patient — status, what help is needed.'
              : category === 'holiday' ? 'Holiday plan — date, who, what to bring.'
              : category === 'party'   ? 'Party plan — date, time, RSVP.'
              : category === 'event'   ? 'Event details — date, time, location.'
              : 'Write something for the family.'
            }
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            autoFocus
          />

          {/* Media picker — uses the same flow as the public composer */}
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
              <TouchableOpacity
                style={s.clearBtn}
                onPress={() => upload.reset()}
                activeOpacity={0.7}
              >
                <Text style={s.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {upload.selectedAssets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {upload.selectedAssets.map((a, i) => (
                <Image
                  key={a.uri + i}
                  source={{ uri: a.uri }}
                  style={s.thumb}
                />
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 120 },

  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceLight,
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  catChipTextActive: { color: '#FFF', fontWeight: '600' },

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
});
