import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useUpload } from '../../../hooks/useUpload';
import { MediaPicker } from '../../../components/upload/MediaPicker';
import { Button } from '../../../components/shared/Button';
import { VerificationGate } from '../../../components/shared/VerificationGate';
import { Colors } from '../../../constants/colors';

export default function UploadScreen() {
  const upload = useUpload();
  const [content, setContent] = useState('');

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
          });
        } else {
          const photoUrls = await upload.uploadPhotos(upload.selectedAssets);
          await upload.createPost.mutateAsync({
            content: content.trim(),
            mediaType: 'photo',
            photoUrls,
          });
        }
      } else {
        await upload.createPost.mutateAsync({
          content: content.trim(),
          mediaType: 'none',
        });
      }

      setContent('');
      upload.reset();
      Alert.alert('Done', 'Live now.');
      router.push('/(tabs)/feed');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const isUploading =
    upload.stage === 'uploading' || upload.stage === 'creating_post';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <VerificationGate action="create_post">
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
      </VerificationGate>
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
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 28,
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
});
