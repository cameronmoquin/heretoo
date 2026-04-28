/**
 * Post composer hook.
 *
 * New schema model:
 *   - INSERT a row into `posts` with body + visibility (+ family_id when family)
 *   - For each media file, INSERT a row into `post_media` referencing the post
 *   - Storage bucket: 'posts' (public read, authenticated write own folder)
 *
 * Photo upload uses HEIC->JPEG normalization + a typed Blob body. Both are
 * required for reliable uploads through supabase-js storage on web + native.
 */

import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { uploadVideoToMux, VIDEO_MAX_SECONDS } from '../lib/mux';
import { useAuthStore } from '../stores/authStore';
import type { PostVisibility } from './useFamily';

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
      quality: 0.85,
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
      quality: 0.85,
      videoMaxDuration: VIDEO_MAX_SECONDS,
    });
    if (result.canceled) {
      setState((s) => ({ ...s, stage: 'idle' }));
      return null;
    }
    const asset = result.assets[0];
    // duration is in milliseconds (ImagePicker convention)
    const durSec = asset?.duration ? asset.duration / 1000 : 0;
    if (durSec > VIDEO_MAX_SECONDS + 0.5) {
      setState((s) => ({
        ...s,
        stage: 'error',
        error: `Video must be ${VIDEO_MAX_SECONDS}s or shorter (your clip is ${Math.round(durSec)}s).`,
        selectedAssets: [],
      }));
      return null;
    }
    setState((s) => ({ ...s, stage: 'idle', selectedAssets: result.assets }));
    return asset;
  }

  /**
   * Uploads photos to the `posts` bucket and returns storage paths
   * suitable for the post_media.storage_path column.
   */
  async function uploadPhotos(assets: ImagePicker.ImagePickerAsset[]): Promise<{ path: string; width?: number; height?: number }[]> {
    if (!userId) throw new Error('Not authenticated');
    if (assets.length === 0) return [];
    setState((s) => ({ ...s, stage: 'uploading', progress: 0 }));

    if (DEV_MODE) {
      return assets.map((a) => ({ path: a.uri, width: a.width, height: a.height }));
    }

    const out: { path: string; width?: number; height?: number }[] = [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      try {
        const normalized = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2048 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );

        const filename = `${userId}/${Date.now()}_${i}.jpg`;
        const buffer = await readAsArrayBuffer(normalized.uri);
        const blob = new Blob([buffer], { type: 'image/jpeg' });

        const { data, error } = await supabase.storage
          .from('posts')
          .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });

        if (error) {
          // eslint-disable-next-line no-console
          console.error('STORAGE_UPLOAD_ERROR', JSON.stringify(error, null, 2));
          throw new Error(`Photo upload failed: ${error.message}`);
        }

        out.push({ path: data.path, width: normalized.width, height: normalized.height });
        setState((s) => ({ ...s, progress: (i + 1) / assets.length }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PHOTO_UPLOAD_FAILED', err);
        throw err;
      }
    }
    return out;
  }

  async function uploadVideo(asset: ImagePicker.ImagePickerAsset) {
    setState((s) => ({ ...s, stage: 'uploading', progress: 0 }));
    if (DEV_MODE) {
      setState((s) => ({ ...s, progress: 1 }));
      return { assetId: 'dev', playbackId: 'dev', thumbnailUrl: asset.uri };
    }
    return uploadVideoToMux(asset.uri, (progress) => {
      setState((s) => ({ ...s, progress }));
    });
  }

  /**
   * Create a post and (optionally) attach uploaded media rows.
   *
   * For images: pass `photoUploads` from `uploadPhotos()` — each becomes a
   * row in `post_media` with media_type='image'.
   *
   * For video: the Mux playback id is stored directly on a single
   * post_media row (media_type='video', storage_path = mux:<playback_id>).
   */
  const createPost = useMutation({
    mutationFn: async (params: {
      body: string;
      visibility: PostVisibility;
      familyId?: string;
      photoUploads?: { path: string; width?: number; height?: number }[];
      muxPlaybackId?: string;
      muxThumbnailUrl?: string;
      videoDurationMs?: number;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      setState((s) => ({ ...s, stage: 'creating_post' }));

      if (DEV_MODE) {
        setState({ stage: 'done', progress: 1, error: null, selectedAssets: [] });
        return { id: `post-dev-${Date.now()}`, body: params.body };
      }

      // 1. Insert the post
      const row: Record<string, unknown> = {
        author_id: userId,
        body: params.body || null,
        visibility: params.visibility,
      };
      if (params.familyId) row.family_id = params.familyId;

      const { data: post, error } = await supabase
        .from('posts')
        .insert(row)
        .select()
        .single();
      if (error) {
        // eslint-disable-next-line no-console
        console.error('POST_INSERT_ERROR', JSON.stringify(error, null, 2));
        throw error;
      }

      // 2. Attach media rows (one per file)
      const mediaRows: Record<string, unknown>[] = [];
      if (params.photoUploads && params.photoUploads.length > 0) {
        params.photoUploads.forEach((pu, i) => {
          mediaRows.push({
            post_id: post.id,
            storage_path: pu.path,
            media_type: 'image',
            width: pu.width ?? null,
            height: pu.height ?? null,
            position: i,
          });
        });
      }
      if (params.muxPlaybackId) {
        mediaRows.push({
          post_id: post.id,
          storage_path: `mux:${params.muxPlaybackId}`,
          media_type: 'video',
          duration_ms: params.videoDurationMs ?? null,
          position: 0,
        });
      }
      if (mediaRows.length > 0) {
        const { error: mErr } = await supabase.from('post_media').insert(mediaRows);
        if (mErr) {
          // eslint-disable-next-line no-console
          console.error('POST_MEDIA_INSERT_ERROR', JSON.stringify(mErr, null, 2));
          throw mErr;
        }
      }

      setState({ stage: 'done', progress: 1, error: null, selectedAssets: [] });
      return post;
    },
    onSuccess: (_post, vars) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (vars.familyId) {
        queryClient.invalidateQueries({ queryKey: ['family-feed', vars.familyId] });
      }
    },
    onError: (error: any) => {
      setState((s) => ({ ...s, stage: 'error', error: error?.message ?? 'Post failed' }));
    },
  });

  function reset() {
    setState({ stage: 'idle', progress: 0, error: null, selectedAssets: [] });
  }

  /** Inject a synthetic asset (e.g. from Two-Way capture) as if the picker returned it. */
  function setAssets(assets: ImagePicker.ImagePickerAsset[]) {
    setState((s) => ({ ...s, selectedAssets: assets }));
  }

  return { ...state, pickPhotos, pickVideo, uploadPhotos, uploadVideo, createPost, reset, setAssets };
}

// ── helpers ──────────────────────────────────────────────────────────
async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const r = await fetch(uri);
    return r.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Resolve a post_media.storage_path to a renderable URL.
 *
 * Storage path conventions:
 *   - "mux:{playback_id}"      → Mux video. Returns MP4 rendition (works in
 *                                every modern browser; Mux's mp4_support:
 *                                'standard' guarantees it).
 *   - starts with "http"       → already a URL
 *   - otherwise                → Supabase Storage path under bucket 'posts'
 */
export function mediaPathToUrl(storagePath: string): string {
  if (storagePath.startsWith('mux:')) {
    const playbackId = storagePath.slice(4);
    return `https://stream.mux.com/${playbackId}/medium.mp4`;
  }
  if (storagePath.startsWith('http')) return storagePath;
  const { data } = supabase.storage.from('posts').getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Mux thumbnail (poster) URL for a post_media row. Returns null for non-Mux. */
export function mediaPathToThumb(storagePath: string): string | null {
  if (storagePath.startsWith('mux:')) {
    const playbackId = storagePath.slice(4);
    return `https://image.mux.com/${playbackId}/thumbnail.jpg`;
  }
  return null;
}
