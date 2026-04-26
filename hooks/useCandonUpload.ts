/**
 * Candon media upload helpers.
 *
 * Photos go to Supabase Storage bucket `candon-photos` under `{userId}/...`.
 * Video goes through Mux via the Netlify function.
 */

import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { uploadCandonVideo, type MuxUploadResult } from '../lib/candon-mux';

export type PickedPhoto = ImagePicker.ImagePickerAsset;
export type PickedVideo = ImagePicker.ImagePickerAsset;

const MAX_PHOTOS = 6;

export interface UploadProgress {
  stage: 'idle' | 'photos' | 'video' | 'done' | 'error';
  message: string;
  ratio: number; // 0..1
}

export function useCandonUpload() {
  const userId = useAuthStore((s) => s.user?.id);
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'idle',
    message: '',
    ratio: 0,
  });

  async function pickPhotos(existingCount = 0): Promise<PickedPhoto[]> {
    const remaining = Math.max(0, MAX_PHOTOS - existingCount);
    if (remaining <= 0) return [];

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Photo library permission denied');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled) return [];
    return result.assets.slice(0, remaining);
  }

  async function pickVideo(): Promise<PickedVideo | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Photo library permission denied');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 0.85,
      videoMaxDuration: 180, // 3 min cap on selection
    });
    if (result.canceled) return null;
    return result.assets[0] ?? null;
  }

  async function uploadPhotos(assets: PickedPhoto[]): Promise<string[]> {
    if (!userId) throw new Error('Not authenticated');
    if (assets.length === 0) return [];

    setProgress({
      stage: 'photos',
      message: `Uploading ${assets.length} photo${assets.length > 1 ? 's' : ''}…`,
      ratio: 0,
    });

    const urls: string[] = [];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const ext = inferExt(asset.uri, asset.mimeType, 'jpg');
      const filename = `${userId}/${Date.now()}_${i}.${ext}`;
      const blob = await assetToBlob(asset);
      const { error } = await supabase.storage
        .from('candon-photos')
        .upload(filename, blob, {
          contentType: blob.type || `image/${ext}`,
          upsert: false,
        });
      if (error) throw new Error(`Photo upload failed: ${error.message}`);

      const { data } = supabase.storage.from('candon-photos').getPublicUrl(filename);
      urls.push(data.publicUrl);
      setProgress((p) => ({ ...p, ratio: (i + 1) / assets.length }));
    }
    return urls;
  }

  async function uploadVideo(asset: PickedVideo): Promise<MuxUploadResult> {
    if (!userId) throw new Error('Not authenticated');
    setProgress({ stage: 'video', message: 'Uploading video…', ratio: 0 });
    return uploadCandonVideo(asset.uri, (r) => {
      setProgress((p) => ({
        ...p,
        ratio: r,
        message: r < 0.8 ? 'Uploading video…' : 'Mux is processing your video…',
      }));
    });
  }

  function reset() {
    setProgress({ stage: 'idle', message: '', ratio: 0 });
  }

  return {
    progress,
    pickPhotos,
    pickVideo,
    uploadPhotos,
    uploadVideo,
    reset,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────

function inferExt(uri: string, mime: string | undefined, fallback: string): string {
  if (mime) {
    const m = mime.match(/\/([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  }
  const m = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : fallback;
}

async function assetToBlob(asset: PickedPhoto): Promise<Blob> {
  if (Platform.OS === 'web') {
    const r = await fetch(asset.uri);
    return r.blob();
  }
  // Native: fetch the local file URI as a blob.
  const r = await fetch(asset.uri);
  return r.blob();
}
