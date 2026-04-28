import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpload } from '../../../hooks/useUpload';
import { showAlert } from '../../../lib/alert';
import { Button } from '../../../components/shared/Button';
import { Colors } from '../../../constants/colors';

const TAG_OPTIONS = [
  'Food & Cooking', 'Fitness & Health', 'Music', 'Sports',
  'Outdoors & Nature', 'Tech & Gadgets', 'Books & Learning',
  'Art & Design', 'Travel', 'Parenting & Family', 'Pets', 'Local Community',
];

export default function UploadScreen() {
  const upload = useUpload();
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const hasMedia = upload.selectedAssets.length > 0;
  const canPost = content.trim().length > 0 || hasMedia;

  const handlePost = async () => {
    try {
      let photoUploads: { path: string; width?: number; height?: number }[] | undefined;
      let muxPlaybackId: string | undefined;
      let muxThumbnailUrl: string | undefined;
      let videoDurationMs: number | undefined;

      if (upload.selectedAssets.length > 0) {
        const firstAsset = upload.selectedAssets[0];
        const isVideo = firstAsset.type === 'video';
        if (isVideo) {
          const v = await upload.uploadVideo(firstAsset);
          muxPlaybackId = v.playbackId;
          muxThumbnailUrl = v.thumbnailUrl;
          videoDurationMs = firstAsset.duration ?? undefined;
        } else {
          photoUploads = await upload.uploadPhotos(upload.selectedAssets);
        }
      }

      await upload.createPost.mutateAsync({
        body: content.trim(),
        visibility: 'public',
        photoUploads,
        muxPlaybackId,
        muxThumbnailUrl,
        videoDurationMs,
      });

      setContent('');
      setSelectedTags([]);
      upload.reset();
      router.push('/(tabs)/feed');
    } catch (error: any) {
      const msg = error?.message ?? 'Unknown error';
      if (msg.includes('fetch') || msg.includes('network')) {
        showAlert('Connection error', 'Check your internet connection and try again.');
      } else if (msg.includes('authenticated') || msg.includes('auth')) {
        showAlert('Sign in required', 'Your session expired. Sign in again.');
      } else {
        showAlert('Error', msg);
      }
    }
  };

  const isUploading =
    upload.stage === 'uploading' || upload.stage === 'creating_post';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Post</Text>

          <TextInput
            style={styles.input}
            placeholder="Say something real."
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={handlePost}
          />

          <View style={styles.mediaRow}>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={() => upload.pickPhotos()}
              activeOpacity={0.8}
            >
              <Ionicons name="image-outline" size={18} color={Colors.primary} />
              <Text style={styles.mediaBtnText}>
                {upload.selectedAssets.length > 0
                  ? `${upload.selectedAssets.length} photo${upload.selectedAssets.length === 1 ? '' : 's'}`
                  : 'Add photos'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={() => upload.pickVideo()}
              activeOpacity={0.8}
            >
              <Ionicons name="videocam-outline" size={18} color={Colors.primary} />
              <Text style={styles.mediaBtnText}>Video</Text>
            </TouchableOpacity>
            {upload.selectedAssets.length > 0 && (
              <TouchableOpacity onPress={() => upload.reset()} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {upload.selectedAssets.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {upload.selectedAssets.map((a, i) => (
                <Image key={a.uri + i} source={{ uri: a.uri }} style={styles.thumb} />
              ))}
            </ScrollView>
          )}

          {/* Topic tags */}
          <View>
            <Text style={styles.tagLabel}>Tag it</Text>
            <View style={styles.tagGrid}>
              {TAG_OPTIONS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                    onPress={() => {
                      setSelectedTags((prev) =>
                        active ? prev.filter((t) => t !== tag) : [...prev, tag]
                      );
                    }}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Upload progress */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.round(upload.progress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {upload.stage === 'uploading'
                  ? `Uploading... ${Math.round(upload.progress * 100)}%`
                  : 'Creating post...'}
              </Text>
            </View>
          )}

          <Button
            title="Post"
            onPress={handlePost}
            loading={isUploading}
            disabled={!canPost || isUploading}
            size="lg"
            style={styles.postButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
    gap: 20,
    paddingBottom: 100,
  },
  title: {
    fontWeight: '800',
    fontSize: 20,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 140,
    lineHeight: 24,
  },
  progressContainer: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  postButton: {
    width: '100%',
  },
  tagLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tagChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mediaRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  mediaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  mediaBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  clearBtnText: { color: Colors.textMuted, fontSize: 13 },
  thumb: { width: 80, height: 80, borderRadius: 8, marginRight: 6 },
});
