/**
 * Candon media upload helpers.
 *
 * Photos go to Supabase Storage bucket `candon-photos` under `{userId}/...`.
 * Video goes through Mux via the Netlify function.
 */

import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
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
      try {
        // 1. Normalize to JPEG, max width 2048, compress 0.85.
        //    This kills HEIC (iPhone default) and EXIF / orientation issues
        //    that break image rendering on Android and the web.
        const normalized = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 2048 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );

        // 2. Read the file as base64, convert to ArrayBuffer.
        //    Required because Supabase storage upload from a React Native
        //    fetch().blob() is unreliable on native — the request body ends
        //    up empty or wrapped weird. Base64 → ArrayBuffer is the path
        //    that consistently works across web + iOS + Android.
        const filename = `${userId}/${Date.now()}_${i}.jpg`;
        const body = await readAsArrayBuffer(normalized.uri);

        const { error } = await supabase.storage
          .from('candon-photos')
          .upload(filename, body, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) {
          // eslint-disable-next-line no-console
          console.error('STORAGE_UPLOAD_ERROR', JSON.stringify(error, null, 2));
          throw new Error(`Photo upload failed: ${error.message}`);
        }

        const { data } = supabase.storage.from('candon-photos').getPublicUrl(filename);
        urls.push(data.publicUrl);
        setProgress((p) => ({ ...p, ratio: (i + 1) / assets.length }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('PHOTO_PROCESS_ERROR', err);
        throw err;
      }
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

/**
 * Read a local file URI into an ArrayBuffer reliably across platforms.
 * Web: fetch + arrayBuffer (works as expected).
 * Native: base64 via FileSystem, then decode to bytes.
 */
async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const r = await fetch(uri);
    return r.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    // SDK 54 moved EncodingType to legacy; use the string form for forward compat.
    encoding: 'base64' as any,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
