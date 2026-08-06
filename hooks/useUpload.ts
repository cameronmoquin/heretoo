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
    const uid = userId;
    if (!uid) throw new Error('Not authenticated');
    if (assets.length === 0) return [];
    setState((s) => ({ ...s, stage: 'uploading', progress: 0 }));

    if (DEV_MODE) {
      return assets.map((a) => ({ path: a.uri, width: a.width, height: a.height }));
    }

    // Run uploads in parallel — sequential was the single biggest cause
    // of the "post takes forever" feel. Photos rarely need 2048px on
    // mobile; 1600px @ 0.78 quality is visually indistinguishable on a
    // phone screen and cuts file size roughly in half.
    //
    // Resilience layers added here:
    //   1. normalizePhoto() re-encodes to JPEG, then falls back to a
    //      plain re-encode, then to the raw bytes, so one odd format
    //      (PNG, HEIC, animated GIF) can't throw the whole batch.
    //   2. Each upload retries transient storage errors on a fresh
    //      object name so a duplicate-name error can't block the retry.
    //   3. Promise.allSettled lets siblings finish; a failure names the
    //      exact photo instead of a bare "Photo upload failed".
    const ts = Date.now();
    let done = 0;
    const tasks = assets.map(async (asset, i) => {
      const prep = await normalizePhoto(asset, uid, ts, i);
      const path = await uploadPhotoWithRetry(prep);
      done += 1;
      setState((s) => ({ ...s, progress: done / assets.length }));
      return { path, width: prep.width, height: prep.height };
    });

    const settled = await Promise.allSettled(tasks);
    const ok: { path: string; width?: number; height?: number }[] = [];
    const failures: string[] = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') ok.push(r.value);
      else failures.push((r.reason as Error)?.message ?? `Photo #${i + 1} failed`);
    });

    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error('PHOTO_UPLOAD_FAILED', failures);
      // Nothing is written to the post yet. Surface the exact failure so
      // the user can retry rather than silently dropping a photo.
      const more = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
      throw new Error(`${failures[0]}${more}`);
    }
    return ok;
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
      /**
       * 'direct' is migration 065. PostVisibility itself is not widened
       * here; that type is shared and other callers have no business
       * with a DM.
       */
      visibility: PostVisibility | 'direct';
      familyId?: string;
      /**
       * visibility='direct' only: the one person this drop is for.
       * Migration 065 pairs the two with a check constraint.
       */
      directRecipientId?: string;
      /**
       * The burn. Pass true only when the author asked for it. Omitted,
       * the column never appears in the insert, so a drop still lands on
       * a database that predates migration 065.
       */
      destructOnView?: boolean;
      /** 'post' (default) or 'update' for time-sensitive family news. */
      kind?: 'post' | 'update';
      /**
       * For kind='update' only: a non-empty list locks visibility to
       * just these family members (plus the author). Empty/undefined
       * means broadcast to the whole family. Backed by the
       * update_recipient_ids column + posts_read RLS in migration 019.
       */
      updateRecipientIds?: string[];
      photoUploads?: { path: string; width?: number; height?: number }[];
      muxPlaybackId?: string;
      muxThumbnailUrl?: string;
      videoDurationMs?: number;
      /**
       * A drop carries insert time + 24h; a submit carries nothing.
       * Written only when set, so a drop still lands on a database that
       * predates migration 074.
       */
      expiresAt?: string;
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
        kind: params.kind ?? 'post',
      };
      if (params.familyId) row.family_id = params.familyId;
      // Migration 065 columns. Written only when the author picked them.
      // An absent key is an absent column in the request body, so a
      // plain drop is byte-identical to what shipped before 065 and
      // still inserts on an un-migrated database.
      if (params.visibility === 'direct' && params.directRecipientId) {
        row.direct_recipient_id = params.directRecipientId;
      }
      if (params.destructOnView) row.destruct_on_view = true;
      if (params.expiresAt) row.expires_at = params.expiresAt;
      // Recipient-restricted updates: only set the column when there's
      // an actual list. NULL means "broadcast to whole family", which
      // matches the legacy behavior — important to preserve so the UI
      // can opt-in without breaking existing posts.
      if (
        (params.kind ?? 'post') === 'update'
        && params.updateRecipientIds
        && params.updateRecipientIds.length > 0
      ) {
        row.update_recipient_ids = params.updateRecipientIds;
      }

      const { data: post, error } = await supabase
        .from('posts')
        .insert(row)
        .select()
        .single();
      if (error) {
        // eslint-disable-next-line no-console
        console.error('POST_INSERT_ERROR', JSON.stringify(error, null, 2));
        const behind = schemaBehindMessage(error, params.visibility);
        if (behind) throw new Error(behind);
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
    // Optimistic insert: drop a placeholder post into the relevant
    // feed cache immediately so the new post appears the moment the
    // user taps Post, not after the network roundtrip + refetch.
    onMutate: async (vars) => {
      if (!userId) return;
      const tempId = `optimistic-${Date.now()}`;
      const tempMedia = (vars.photoUploads ?? []).map((pu, i) => ({
        id: `${tempId}-m${i}`,
        post_id: tempId,
        storage_path: pu.path,
        media_type: 'image',
        width: pu.width ?? null,
        height: pu.height ?? null,
        position: i,
      }));
      if (vars.muxPlaybackId) {
        tempMedia.push({
          id: `${tempId}-vid`,
          post_id: tempId,
          storage_path: `mux:${vars.muxPlaybackId}`,
          media_type: 'video',
          width: null, height: null, position: 0,
        });
      }
      const tempPost: any = {
        id: tempId,
        author_id: userId,
        body: vars.body || null,
        visibility: vars.visibility,
        family_id: vars.familyId ?? null,
        direct_recipient_id: vars.directRecipientId ?? null,
        destruct_on_view: !!vars.destructOnView,
        kind: vars.kind ?? 'post',
        heart_count: 0, boost_count: 0, comment_count: 0,
        viewer_hearted: false,
        comments_disabled: false,
        created_at: new Date().toISOString(),
        author: undefined,           // PostCard handles this gracefully
        media: tempMedia,
        _optimistic: true,
      };

      const isFamilyPost = !!vars.familyId && vars.visibility === 'family';
      const isUpdate = vars.kind === 'update';

      if (isFamilyPost && isUpdate) {
        await queryClient.cancelQueries({ queryKey: ['family-updates', vars.familyId] });
        const prev = queryClient.getQueryData<any[]>(['family-updates', vars.familyId]);
        queryClient.setQueryData<any[]>(['family-updates', vars.familyId],
          (old) => [tempPost, ...(old ?? [])]);
        return { undo: () => queryClient.setQueryData(['family-updates', vars.familyId], prev) };
      }
      if (isFamilyPost) {
        await queryClient.cancelQueries({ queryKey: ['family-feed', vars.familyId] });
        const prev = queryClient.getQueryData<any[]>(['family-feed', vars.familyId]);
        queryClient.setQueryData<any[]>(['family-feed', vars.familyId],
          (old) => [tempPost, ...(old ?? [])]);
        return { undo: () => queryClient.setQueryData(['family-feed', vars.familyId], prev) };
      }
      // Public / connections: prepend to every infinite-feed page-set we know about.
      const feedKeys = queryClient.getQueryCache().findAll({ queryKey: ['feed'] });
      const undos: Array<() => void> = [];
      for (const q of feedKeys) {
        const key = q.queryKey;
        const data: any = queryClient.getQueryData(key);
        if (!data?.pages) continue;
        const prev = data;
        const nextPages = [...data.pages];
        nextPages[0] = [tempPost, ...(nextPages[0] ?? [])];
        queryClient.setQueryData(key, { ...data, pages: nextPages });
        undos.push(() => queryClient.setQueryData(key, prev));
      }
      return { undo: () => undos.forEach((u) => u()) };
    },
    onSuccess: (_post, vars) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (vars.familyId) {
        queryClient.invalidateQueries({ queryKey: ['family-feed', vars.familyId] });
        queryClient.invalidateQueries({ queryKey: ['family-updates', vars.familyId] });
      }
    },
    onError: (error: any, _vars, context: any) => {
      // Roll back the optimistic insert.
      if (context?.undo) try { context.undo(); } catch {}
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

/**
 * Turn "the server has not run migration 065" into a sentence.
 *
 * The new fields ride the insert only when the author picks them, so
 * this fires on exactly one situation: someone chose a DM or armed the
 * burn against a database that predates 065. Everything else falls
 * through to the raw Postgres error, unchanged.
 *
 * Codes seen in the wild:
 *   PGRST204  PostgREST schema cache has no such column
 *   42703     undefined_column
 *   23514     check_violation, here the visibility list without 'direct'
 */
function schemaBehindMessage(error: any, visibility: string): string | null {
  const code = String(error?.code ?? '');
  const text = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase();

  if (code === 'PGRST204' || code === '42703') {
    if (text.includes('destruct_on_view')) {
      return 'Destroy after viewing is not live on this server yet. Run migration 065.';
    }
    if (text.includes('direct_recipient_id')) {
      return 'Direct drops are not live on this server yet. Run migration 065.';
    }
    return 'This server is behind the app. Run migration 065.';
  }

  if (code === '23514' && visibility === 'direct') {
    return 'Direct drops are not live on this server yet. Run migration 065.';
  }
  return null;
}

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

// ── photo upload resilience ──────────────────────────────────────────
const MAX_PHOTO_BYTES = 25 * 1024 * 1024; // 25 MB after normalization

interface PreparedPhoto {
  uid: string;
  baseName: string;        // `${uid}/${ts}_${i}` — retries append a suffix
  ext: string;
  blob: Blob;
  contentType: string;
  width?: number;
  height?: number;
  label: string;           // "#3" for user-facing messages
}

function extForMime(mime: string): string {
  switch (mime) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/heic': return 'heic';
    case 'image/heif': return 'heif';
    default: return 'jpg';
  }
}

function assetMime(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const uri = asset.uri.split('?')[0].toLowerCase();
  if (uri.endsWith('.png')) return 'image/png';
  if (uri.endsWith('.webp')) return 'image/webp';
  if (uri.endsWith('.gif')) return 'image/gif';
  if (uri.endsWith('.heic')) return 'image/heic';
  if (uri.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

/**
 * Turn a picked asset into upload-ready bytes.
 *
 * Manipulator first: resize + JPEG re-encode (also does HEIC→JPEG).
 * If that throws, retry a plain JPEG re-encode with no resize. If that
 * throws too, upload the original bytes with a best-guess content type.
 * A single unreadable format then costs one photo, not the whole batch.
 */
async function normalizePhoto(
  asset: ImagePicker.ImagePickerAsset,
  uid: string,
  ts: number,
  i: number,
): Promise<PreparedPhoto> {
  const label = `#${i + 1}`;
  let uri = '';
  let width = asset.width;
  let height = asset.height;
  let contentType = 'image/jpeg';
  let ext = 'jpg';

  try {
    const out = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
    );
    uri = out.uri; width = out.width; height = out.height;
  } catch {
    try {
      const out = await ImageManipulator.manipulateAsync(
        asset.uri,
        [],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      );
      uri = out.uri; width = out.width; height = out.height;
    } catch {
      // Manipulator can't read this asset. Ship the original bytes.
      uri = asset.uri;
      contentType = assetMime(asset);
      ext = extForMime(contentType);
    }
  }

  const buffer = await readAsArrayBuffer(uri);
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw new Error(
      `Photo ${label} is too large (${Math.round(buffer.byteLength / 1048576)} MB). Max 25 MB.`,
    );
  }
  const blob = new Blob([buffer], { type: contentType });
  return { uid, baseName: `${uid}/${ts}_${i}`, ext, blob, contentType, width, height, label };
}

/** Retry when the storage error looks transient (network / 429 / 5xx). */
function isTransientStorageError(error: any): boolean {
  const status = Number(
    error?.statusCode ?? error?.status ?? error?.originalError?.status,
  );
  if (!Number.isFinite(status) || status === 0) return true; // no HTTP response
  if (status === 429) return true;
  return status >= 500;
}

async function uploadPhotoWithRetry(prep: PreparedPhoto): Promise<string> {
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Fresh name per attempt keeps upsert:false safe: a first attempt
    // that persisted but returned a transient error can't collide with
    // the retry. Orphaned bytes stay unreferenced and harmless.
    const suffix = attempt === 0 ? '' : `_r${attempt}`;
    const filename = `${prep.baseName}${suffix}.${prep.ext}`;
    const { data, error } = await supabase.storage
      .from('posts')
      .upload(filename, prep.blob, { contentType: prep.contentType, upsert: false });
    if (!error && data) return data.path;
    lastErr = error;
    // eslint-disable-next-line no-console
    console.error('STORAGE_UPLOAD_ERROR', prep.label, JSON.stringify(error, null, 2));
    if (!isTransientStorageError(error)) break;
    await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
  }
  throw new Error(`Photo ${prep.label} failed to upload: ${lastErr?.message ?? 'storage error'}`);
}

/**
 * Resolve a post_media.storage_path to a renderable URL.
 *
 * Storage path conventions:
 *   - "mux:{playback_id}"      → Mux video. Returns the MP4 static
 *                                rendition, which plays in every modern
 *                                browser without an HLS player.
 *   - starts with "http"       → already a URL
 *   - otherwise                → Supabase Storage path under bucket 'posts'
 */
export function mediaPathToUrl(storagePath: string): string {
  if (storagePath.startsWith('mux:')) {
    const playbackId = storagePath.slice(4);
    // static_renditions [{resolution:'highest'}] produces a file named
    // highest.mp4. The old medium.mp4 belonged to the deprecated
    // mp4_support:'standard' path Mux now rejects.
    return `https://stream.mux.com/${playbackId}/highest.mp4`;
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
