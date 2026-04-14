import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
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
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `${userId}/${Date.now()}_${i}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { data, error } = await supabase.storage
        .from('post-photos')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${ext}`,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('post-photos')
        .getPublicUrl(data.path);

      urls.push(urlData.publicUrl);
      setState((s) => ({ ...s, progress: (i + 1) / assets.length }));
    }

    return urls;
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
    }) => {
      if (!userId) throw new Error('Not authenticated');
      setState((s) => ({ ...s, stage: 'creating_post' }));

      if (DEV_MODE) {
        setState({ stage: 'done', progress: 1, error: null, selectedAssets: [] });
        return { id: `post-dev-${Date.now()}`, content: params.content };
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: userId,
          content: params.content,
          media_type: params.mediaType,
          photo_urls: params.photoUrls ?? null,
          mux_asset_id: params.muxAssetId ?? null,
          mux_playback_id: params.muxPlaybackId ?? null,
          mux_thumbnail_url: params.muxThumbnailUrl ?? null,
          video_duration_seconds: params.videoDuration ?? null,
          topic_tags: params.topicTags ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      setState({ stage: 'done', progress: 1, error: null, selectedAssets: [] });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
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
