import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

interface MuxUploadResult {
  assetId: string;
  playbackId: string;
  thumbnailUrl: string;
}

export async function uploadVideoToMux(
  localUri: string,
  onProgress: (progress: number) => void
): Promise<MuxUploadResult> {
  // 1. Request upload URL from Supabase Edge Function
  const { data, error } = await supabase.functions.invoke('create-mux-upload');
  if (error || !data) throw new Error(error?.message ?? 'Failed to create Mux upload');

  const { uploadUrl, uploadId } = data;

  // 2. Upload directly to Mux from device
  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    localUri,
    {
      httpMethod: 'PUT',
      headers: { 'Content-Type': 'video/*' },
    },
    (progressEvent) => {
      onProgress(
        progressEvent.totalBytesSent / progressEvent.totalBytesExpectedToSend
      );
    }
  );

  const result = await uploadTask.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error('Video upload to Mux failed');
  }

  // 3. Poll for Mux asset ready
  const asset = await pollMuxAssetReady(uploadId);

  return {
    assetId: asset.id,
    playbackId: asset.playback_ids[0].id,
    thumbnailUrl: `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg`,
  };
}

async function pollMuxAssetReady(
  uploadId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase.functions.invoke('create-mux-upload', {
      body: { action: 'check', uploadId },
    });

    if (error) throw new Error('Failed to check Mux asset status');
    if (data?.asset?.status === 'ready') return data.asset;

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error('Mux asset did not become ready in time');
}
