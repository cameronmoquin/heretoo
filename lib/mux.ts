import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID ?? '';
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET ?? '';
const MUX_BASE_URL = 'https://api.mux.com';

function getMuxAuth(): string {
  return btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
}

interface MuxUploadResult {
  assetId: string;
  playbackId: string;
  thumbnailUrl: string;
}

/**
 * Create a Mux direct upload URL.
 * In production this should go through an Edge Function.
 * For dev/testing we call Mux directly.
 */
async function createDirectUpload(): Promise<{ uploadUrl: string; uploadId: string }> {
  const res = await fetch(`${MUX_BASE_URL}/video/v1/uploads`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${getMuxAuth()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'baseline',
      },
      cors_origin: '*',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux upload creation failed: ${text}`);
  }

  const data = await res.json();
  return {
    uploadUrl: data.data.url,
    uploadId: data.data.id,
  };
}

/**
 * Check if a Mux upload has finished processing.
 */
async function checkUploadStatus(uploadId: string): Promise<any> {
  const res = await fetch(`${MUX_BASE_URL}/video/v1/uploads/${uploadId}`, {
    headers: { 'Authorization': `Basic ${getMuxAuth()}` },
  });
  if (!res.ok) throw new Error('Failed to check upload status');
  const data = await res.json();

  if (data.data?.asset_id) {
    const assetRes = await fetch(
      `${MUX_BASE_URL}/video/v1/assets/${data.data.asset_id}`,
      { headers: { 'Authorization': `Basic ${getMuxAuth()}` } }
    );
    if (!assetRes.ok) throw new Error('Failed to get asset');
    const assetData = await assetRes.json();
    return assetData.data;
  }

  return null;
}

/**
 * Upload a video to Mux and return the playback info.
 */
export async function uploadVideoToMux(
  localUri: string,
  onProgress: (progress: number) => void
): Promise<MuxUploadResult> {
  // 1. Create upload URL
  const { uploadUrl, uploadId } = await createDirectUpload();
  onProgress(0.1);

  // 2. Upload the file
  if (Platform.OS === 'web') {
    // Web: fetch the file and PUT it
    const response = await fetch(localUri);
    const blob = await response.blob();
    await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'video/*' },
    });
  } else {
    // Native: use FileSystem upload
    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      localUri,
      {
        httpMethod: 'PUT',
        headers: { 'Content-Type': 'video/*' },
      },
      (progressEvent) => {
        const p = progressEvent.totalBytesSent / progressEvent.totalBytesExpectedToSend;
        onProgress(0.1 + p * 0.7);
      }
    );
    await uploadTask.uploadAsync();
  }

  onProgress(0.8);

  // 3. Poll for asset ready
  const asset = await pollMuxAssetReady(uploadId);
  onProgress(1.0);

  return {
    assetId: asset.id,
    playbackId: asset.playback_ids[0].id,
    thumbnailUrl: `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg`,
  };
}

async function pollMuxAssetReady(
  uploadId: string,
  maxAttempts = 60,
  intervalMs = 3000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const asset = await checkUploadStatus(uploadId);
    if (asset?.status === 'ready') return asset;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Video processing timed out. Try again.');
}

/**
 * Get the Mux stream URL for a playback ID.
 */
export function getMuxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/**
 * Get the Mux thumbnail URL.
 */
export function getMuxThumbnailUrl(playbackId: string, options?: {
  width?: number;
  time?: number;
}): string {
  const params = new URLSearchParams();
  if (options?.width) params.set('width', String(options.width));
  if (options?.time) params.set('time', String(options.time));
  const query = params.toString();
  return `https://image.mux.com/${playbackId}/thumbnail.jpg${query ? '?' + query : ''}`;
}
