/**
 * useHunt — data layer for the photo geocache hunt (migration 052).
 *
 * A cache is a photo at a GPS coordinate. Hiders create caches; seekers
 * navigate to them and log a find through the server-side gate. Photos
 * live in the public `hunt-photos` bucket; the gate (within radius, 25m
 * forgiveness) is enforced by the claim_hunt_find RPC, never trusted
 * from the client.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const HUNT_BUCKET = 'hunt-photos';

export interface HuntCache {
  id: string;
  creator_id: string | null;
  title: string | null;
  hint: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  radius_m: number;
  photo_path: string | null;
  scope: 'public' | 'family' | 'link';
  family_id: string | null;
  share_code: string | null;
  active: boolean;
  found_count: number;
  self_destruct: boolean;
  created_at: string;
}

export interface HuntFind {
  id: string;
  cache_id: string;
  finder_id: string | null;
  proof_photo_path: string | null;
  distance_m: number | null;
  found_at: string;
}

/** What find_hunt_by_code returns to a (possibly anon) seeker. */
export interface HuntCachePublic {
  id: string;
  title: string | null;
  hint: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  photo_path: string | null;
  found_count: number;
  creator_id: string | null;
  self_destruct: boolean;
}

export interface ClaimResult {
  ok: boolean;
  error?: 'not_signed_in' | 'not_found' | 'too_far';
  distance_m?: number;
}

function genId(): string {
  const c = (globalThis as any).crypto;
  return c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Public URL for a hunt photo (the bucket is public-read). */
export function getHuntPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(HUNT_BUCKET).getPublicUrl(path).data.publicUrl ?? null;
}

// ── Reads ────────────────────────────────────────────────────────────

/** Caches the signed-in user created. */
export function useMyHuntCaches() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['hunt-caches-mine', userId],
    queryFn: async (): Promise<HuntCache[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('hunt_caches')
        .select('*')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HuntCache[];
    },
    enabled: !!userId,
  });
}

/** Public caches anyone can hunt. */
export function usePublicHuntCaches() {
  return useQuery({
    queryKey: ['hunt-caches-public'],
    queryFn: async (): Promise<HuntCache[]> => {
      const { data, error } = await supabase
        .from('hunt_caches')
        .select('*')
        .eq('scope', 'public')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as HuntCache[];
    },
  });
}

/** Resolve a cache from its share code (works for not-signed-in visitors). */
export function useHuntByCode(code: string | null | undefined) {
  return useQuery({
    queryKey: ['hunt-by-code', code],
    queryFn: async (): Promise<HuntCachePublic | null> => {
      if (!code) return null;
      const { data, error } = await supabase.rpc('find_hunt_by_code', { p_code: code });
      if (error) throw error;
      const row = ((data ?? []) as any[])[0];
      return (row as HuntCachePublic) ?? null;
    },
    enabled: !!code,
  });
}

/** Finds for a cache (the creator's leaderboard view). */
export function useCacheFinds(cacheId: string | null | undefined) {
  return useQuery({
    queryKey: ['hunt-finds', cacheId],
    queryFn: async (): Promise<HuntFind[]> => {
      if (!cacheId) return [];
      const { data, error } = await supabase
        .from('hunt_finds')
        .select('*')
        .eq('cache_id', cacheId)
        .order('found_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as HuntFind[];
    },
    enabled: !!cacheId,
  });
}

// ── Writes ───────────────────────────────────────────────────────────

/** Upload a photo to the hunt bucket via /api/hunt-upload (service-role
 *  write, bypasses storage RLS). Returns the storage path the server
 *  chose. kind 'clue' is the hider's cache photo; 'find' is a seeker's
 *  proof. */
export function useUploadHuntPhoto() {
  return useMutation({
    mutationFn: async (input: {
      cacheId: string;
      file: File | Blob;
      kind: 'clue' | 'find';
      ext?: string;
    }): Promise<string> => {
      const ext = input.ext || (input.file as File).name?.split('.').pop()?.toLowerCase() || 'jpg';
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Sign in to add a photo.');
      const qs = new URLSearchParams({ cacheId: input.cacheId, kind: input.kind, ext });
      const res = await fetch(`/api/hunt-upload?${qs.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': (input.file as File).type || 'image/jpeg',
        },
        body: input.file,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? `Upload failed (${res.status})`);
      return j.path as string;
    },
  });
}

/** Create a cache. Pass a client-generated id so the clue photo can be
 *  uploaded to {id}/clue.* before (or after) the row insert. */
export function useCreateHuntCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      title?: string;
      hint?: string;
      lat: number;
      lng: number;
      accuracyM?: number;
      radiusM?: number;
      photoPath?: string;
      scope?: 'public' | 'family' | 'link';
      familyId?: string | null;
      selfDestruct?: boolean;
    }): Promise<HuntCache> => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('Sign in to hide a cache.');
      const id = input.id ?? genId();
      const { data, error } = await supabase
        .from('hunt_caches')
        .insert({
          id,
          creator_id: userId,
          title: input.title?.trim() || null,
          hint: input.hint?.trim() || null,
          lat: input.lat,
          lng: input.lng,
          accuracy_m: input.accuracyM ?? null,
          radius_m: input.radiusM ?? 25,
          photo_path: input.photoPath ?? null,
          scope: input.scope ?? 'link',
          family_id: input.familyId ?? null,
          self_destruct: input.selfDestruct ?? false,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as HuntCache;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt-caches-mine'] });
      qc.invalidateQueries({ queryKey: ['hunt-caches-public'] });
    },
  });
}

/** Log a find. The server checks the GPS gate and returns the distance.
 *  too_far / not_found come back as { ok:false } rather than throwing. */
export function useClaimFind() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cacheId: string;
      lat: number;
      lng: number;
      proofPath?: string | null;
    }): Promise<ClaimResult> => {
      const { data, error } = await supabase.rpc('claim_hunt_find', {
        p_cache_id: input.cacheId,
        p_lat: input.lat,
        p_lng: input.lng,
        p_proof_path: input.proofPath ?? null,
      });
      if (error) throw error;
      return (data as ClaimResult) ?? { ok: false };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['hunt-finds', vars.cacheId] });
    },
  });
}

/** Burn a self-destructing drop after finding it: deactivates the cache
 *  and deletes its photo server-side. Fire-and-forget from the UI. */
export function useBurnCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cacheId: string): Promise<void> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) return;
      await fetch('/api/hunt-burn', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cache_id: cacheId }),
      }).catch(() => {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt-caches-mine'] });
      qc.invalidateQueries({ queryKey: ['hunt-caches-public'] });
    },
  });
}
