/**
 * Candon-side Mux helpers. Calls the Netlify function so Mux API tokens
 * never reach the browser bundle.
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const FUNCTION_PATH = '/.netlify/functions/candon-mux-upload';

export interface MuxUploadResult {
  assetId: string;
  playbackId: string;
  thumbnailUrl: string;
  durationSeconds: number | null;
}

async function authedFetch(body: unknown): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token ?? '';
  return fetch(FUNCTION_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
}

async function createDirectUpload(): Promise<{ uploadUrl: string; uploadId: string }> {
  const res = await authedFetch({});
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not start video upload: ${text}`);
  }
  return (await res.json()) as { uploadUrl: string; uploadId: string };
}

interface MuxAsset {
  id: string;
  status: string;
  duration?: number;
  playback_ids?: { id: string; policy: string }[];
}

async function pollAssetReady(uploadId: string, maxAttempts = 60, intervalMs = 3000): Promise<MuxAsset> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await authedFetch({ action: 'check', uploadId });
    if (res.ok) {
      const data = (await res.json()) as { asset?: MuxAsset | null };
      if (data.asset?.status === 'ready') return data.asset;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Video processing timed out. Try again.');
}

export async function uploadCandonVideo(
  localUri: string,
  onProgress: (p: number) => void,
): Promise<MuxUploadResult> {
  const { uploadUrl, uploadId } = await createDirectUpload();
  onProgress(0.05);

  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'video/*' },
    });
    if (!putRes.ok) throw new Error(`Mux upload failed: ${putRes.status}`);
  } else {
    const task = FileSystem.createUploadTask(
      uploadUrl,
      localUri,
      {
        httpMethod: 'PUT',
        headers: { 'Content-Type': 'video/*' },
      },
      (e) => {
        const p = e.totalBytesSent / Math.max(1, e.totalBytesExpectedToSend);
        onProgress(0.05 + p * 0.7);
      },
    );
    await task.uploadAsync();
  }
  onProgress(0.8);

  const asset = await pollAssetReady(uploadId);
  onProgress(1);

  const playbackId = asset.playback_ids?.[0]?.id ?? '';
  if (!playbackId) throw new Error('Mux returned no playback ID');

  return {
    assetId: asset.id,
    playbackId,
    thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
    durationSeconds: typeof asset.duration === 'number' ? Math.round(asset.duration) : null,
  };
}

export function getMuxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function getMuxThumbnailUrl(playbackId: string, opts: { width?: number; time?: number } = {}): string {
  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.time != null) params.set('time', String(opts.time));
  const q = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${q ? '?' + q : ''}`;
}
