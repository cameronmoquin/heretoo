import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { uploadVideoToMux } from '../lib/mux';
import { useAuthStore } from '../stores/authStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type UploadStage = 'idle' | 'picking' | 'uploading' | 'creating_post' | 'done' | 'error';

interface UploadState {
  stage: UploadStage;
  progress: number;
  error: string | null;
  selectedAssets: ImagePicker.ImagePickerAsset[];
}

export function useUpload() {
  const [state, setState] = useState<UploadState>({
    stage: 'idle',
    progress: 0,
    error: null,
    selectedAssets: [],
  });

  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  async function pickPhotos() {
    setState((s) => ({ ...s, stage: 'picking', error: null }));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });

    if (result.canceled) {
      setState((s) => ({ ...s, stage: 'idle' }));
      return null;
    }

    setState((s) => ({ ...s, stage: 'idle', selectedAssets: result.assets }));
    return result.assets;
  }

  async function pickVideo() {
    setState((s) => ({ ...s, stage: 'picking', error: null }));
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled) {
      setState((s) => ({ ...s, stage: 'idle' }));
      return null;
    }

    setState((s) => ({ ...s, stage: 'idle', selectedAssets: result.assets }));
    return result.assets[0];
  }

  async function uploadPhotos(assets: ImagePicker.ImagePickerAsset[]): Promise<string[]> {
    if (!userId) throw new Error('Not authenticated');
    setState((s) => ({ ...s, stage: 'uploading', progress: 0 }));

    if (DEV_MODE) {
      // In dev mode, use the local URIs as-is (they work for preview)
      const urls = assets.map((a, i) => {
        setState((s) => ({ ...s, progress: (i + 1) / assets.length }));
        return a.uri;
      });
      return urls;
    }

    const urls: string[] = [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      try {
        // 1. Always convert to JPEG. iPhones save HEIC by default which most
        //    browsers can't render and which storage proxies often reject.
        //    Resize down to 2048px max width to keep payloads small.
        const normalized = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2048 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );

        // 2. Build a typed Blob. supabase-js storage upload is unreliable
        //    when given a raw ArrayBuffer in React Native — wrapping in a
        //    Blob with explicit MIME type works on web AND native.
        const fileName = `${userId}/${Date.now()}_${i}.jpg`;
        const buffer = await readAsArrayBuffer(normalized.uri);
        const blob = new Blob([buffer], { type: 'image/jpeg' });

        const { data, error } = await supabase.storage
          .from('post-photos')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) {
          // eslint-disable-next-line no-console
          console.error('STORAGE_UPLOAD_ERROR', JSON.stringify(error, null, 2));
          throw new Error(`Photo upload failed: ${error.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('post-photos')
          .getPublicUrl(data.path);

        urls.push(urlData.publicUrl);
        setState((s) => ({ ...s, progress: (i + 1) / assets.length }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PHOTO_UPLOAD_FAILED', err);
        throw err;
      }
    }

    return urls;
  }

  // ── helper ──────────────────────────────────────────────────────────
  // Reads a local file URI as an ArrayBuffer, cross-platform.
  async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
    if (Platform.OS === 'web') {
      const r = await fetch(uri);
      return r.arrayBuffer();
    }
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  async function uploadVideo(
    asset: ImagePicker.ImagePickerAsset
  ): Promise<{ assetId: string; playbackId: string; thumbnailUrl: string }> {
    setState((s) => ({ ...s, stage: 'uploading', progress: 0 }));

    if (DEV_MODE) {
      setState((s) => ({ ...s, progress: 1 }));
      return { assetId: 'dev', playbackId: 'dev', thumbnailUrl: asset.uri };
    }

    const result = await uploadVideoToMux(asset.uri, (progress) => {
      setState((s) => ({ ...s, progress }));
    });
    return result;
  }

  const createPost = useMutation({
    mutationFn: async (params: {
      content: string;
      mediaType: 'none' | 'photo' | 'video';
      photoUrls?: string[];
      muxAssetId?: string;
      muxPlaybackId?: string;
      muxThumbnailUrl?: string;
      videoDuration?: number;
      topicTags?: string[];
      // Optional family scope. When set, the post is private to that family
      // group; RLS on `posts` enforces membership-only access.
      familyGroupId?: string;
      familyCategory?: 'general' | 'medical' | 'holiday' | 'party' | 'event';
    }) => {
      if (!userId) throw new Error('Not authenticated');
      setState((s) => ({ ...s, stage: 'creating_post' }));

      if (DEV_MODE) {
        setState({ stage: 'done', progress: 1, error: null, selectedAssets: [] });
        return { id: `post-dev-${Date.now()}`, content: params.content };
      }

      const row: Record<string, unknown> = {
        author_id: userId,
        content: params.content,
        media_type: params.mediaType,
        photo_urls: params.photoUrls ?? null,
        mux_asset_id: params.muxAssetId ?? null,
        mux_playback_id: params.muxPlaybackId ?? null,
        mux_thumbnail_url: params.muxThumbnailUrl ?? null,
        video_duration_seconds: params.videoDuration ?? null,
        topic_tags: params.topicTags ?? null,
      };
      if (params.familyGroupId) {
        row.family_group_id = params.familyGroupId;
        row.family_category = params.familyCategory ?? 'general';
      }

      const { data, error } = await supabase
        .from('posts')
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      setState({ stage: 'done', progress: 1, error: null, selectedAssets: [] });
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (vars.familyGroupId) {
        queryClient.invalidateQueries({ queryKey: ['family-feed', vars.familyGroupId] });
      }
    },
    onError: (error) => {
      setState((s) => ({ ...s, stage: 'error', error: error.message }));
    },
  });

  function reset() {
    setState({ stage: 'idle', progress: 0, error: null, selectedAssets: [] });
  }

  return {
    ...state,
    pickPhotos,
    pickVideo,
    uploadPhotos,
    uploadVideo,
    createPost,
    reset,
  };
}
