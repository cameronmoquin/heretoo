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
import { useUpload } from '../../../hooks/useUpload';
import { showAlert } from '../../../lib/alert';
import { MediaPicker } from '../../../components/upload/MediaPicker';
import { MentionInput } from '../../../components/shared/MentionInput';
import { MENTION_USERS } from '../../../lib/mention-users';
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
            videoDuration: firstAsset.duration
              ? Math.round(firstAsset.duration / 1000)
              : undefined,
            topicTags: selectedTags.length > 0 ? selectedTags : undefined,
          });
        } else {
          const photoUrls = await upload.uploadPhotos(upload.selectedAssets);
          await upload.createPost.mutateAsync({
            content: content.trim(),
            mediaType: 'photo',
            photoUrls,
            topicTags: selectedTags.length > 0 ? selectedTags : undefined,
          });
        }
      } else {
        await upload.createPost.mutateAsync({
          content: content.trim(),
          mediaType: 'none',
          topicTags: selectedTags.length > 0 ? selectedTags : undefined,
        });
      }

      setContent('');
      setSelectedTags([]);
      upload.reset();
      // Post success is implicit — the new post appears in the feed.
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

          <MentionInput
            style={styles.input}
            placeholder="Say something real. Type @ to tag."
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            users={MENTION_USERS}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={handlePost}
          />

          <MediaPicker
            selectedAssets={upload.selectedAssets}
            onPickPhotos={async () => {
              await upload.pickPhotos();
            }}
            onPickVideo={async () => {
              await upload.pickVideo();
            }}
            onClear={upload.reset}
          />

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
});
