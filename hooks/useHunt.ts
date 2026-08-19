/**
 * useHunt — data layer for the deaddrop (migrations 052-054, 065).
 *
 * A deaddrop is a drop with a GPS lock. Same three destinations any
 * drop has, and one extra rule: the payload stays sealed until the
 * finder physically stands on the coordinates.
 *
 *   PUBLIC  hunt_caches.scope='public'   post visibility='public'
 *   CREW    hunt_caches.scope='family'   post visibility='family'
 *   DM      hunt_caches.scope='link'     post visibility='direct'
 *
 * The cache row holds the coordinates, the sealed photo, the radius,
 * the burn flag and the chain. The announcement post is what lands in
 * the feed; it carries the share code so the card opens /hunt/{code}.
 * The gate (within radius, 25m forgiveness) is enforced by the
 * claim_hunt_find RPC, never trusted from the client.
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
  /** The sealed thing itself (090). Private bucket; a signed URL only
   *  resolves for the hider or a claimed finder. */
  payload_photo_path?: string | null;
  scope: 'public' | 'family' | 'link';
  family_id: string | null;
  share_code: string | null;
  active: boolean;
  found_count: number;
  self_destruct: boolean;
  prerequisite_cache_id: string | null;
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
  payload_photo_path?: string | null;
  creator_name?: string | null;
  creator_handle?: string | null;
  radius_m: number;
  photo_path: string | null;
  found_count: number;
  creator_id: string | null;
  self_destruct: boolean;
  /** True when a prerequisite drop has not been found yet. When locked,
   *  lat/lng/hint/photo come back null so the seeker cannot navigate. */
  locked: boolean;
}

export interface ClaimResult {
  ok: boolean;
  error?: 'not_signed_in' | 'not_found' | 'too_far' | 'locked';
  distance_m?: number;
}

/** Where a deaddrop lands. The same three a drop has. */
export type HuntDestination = 'public' | 'crew' | 'dm';

/**
 * hunt_caches.scope for a destination. The cache schema is untouched:
 * public keeps 'public', crew rides the existing 'family' scope with a
 * family_id, and a DM stays unlisted on 'link' while the post carries
 * it to the one person.
 */
export function huntScopeFor(dest: HuntDestination): 'public' | 'family' | 'link' {
  if (dest === 'public') return 'public';
  if (dest === 'crew') return 'family';
  return 'link';
}

/** posts.visibility for a destination. */
function huntVisibilityFor(dest: HuntDestination): 'public' | 'family' | 'direct' {
  if (dest === 'public') return 'public';
  if (dest === 'crew') return 'family';
  return 'direct';
}

/** Absolute courier link for a share code. */
export function huntUrl(code: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://heretoo.social';
  return `${origin}/hunt/${code}`;
}

/**
 * The announcement body. First line is the marker PostCard parses to
 * render the X card, which is the only door the feed shows. No URL and
 * no explanation — the X is the link and the sentence both. Never the
 * coordinates, never the photo: those stay sealed behind the gate.
 */
export function huntDropBody(input: {
  shareCode: string;
  title?: string | null;
  hint?: string | null;
}): string {
  const lines: string[] = [`DEADDROP · ${input.shareCode}`];
  const title = input.title?.trim();
  if (title) lines.push(title);
  const hint = input.hint?.trim();
  if (hint) lines.push(`“${hint}”`);
  return lines.join('\n');
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
      kind: 'clue' | 'find' | 'payload';
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
      prerequisiteCacheId?: string | null;
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
          prerequisite_cache_id: input.prerequisiteCacheId ?? null,
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

/**
 * Put the deaddrop in the feed.
 *
 * Runs after the cache row is written, so the share code exists. Writes
 * one row into `posts` at the chosen destination (migration 065 opened
 * visibility='direct' and direct_recipient_id). Deliberately separate
 * from useCreateHuntCache: a failed post must not cost the author the
 * cache they already uploaded a photo for.
 */
export function useAnnounceHuntDrop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      shareCode: string;
      title?: string | null;
      hint?: string | null;
      destination: HuntDestination;
      familyId?: string | null;
      recipientId?: string | null;
    }): Promise<void> => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) throw new Error('Sign in to drop.');
      if (!input.shareCode) throw new Error('The drop has no share code.');
      if (input.destination === 'crew' && !input.familyId) {
        throw new Error('Pick a crew first.');
      }
      if (input.destination === 'dm' && !input.recipientId) {
        throw new Error('Pick who gets it.');
      }

      const row: Record<string, unknown> = {
        author_id: userId,
        body: huntDropBody(input),
        visibility: huntVisibilityFor(input.destination),
        kind: 'post',
      };
      if (input.destination === 'crew') row.family_id = input.familyId;
      if (input.destination === 'dm') row.direct_recipient_id = input.recipientId;

      const { error } = await supabase.from('posts').insert(row as any);
      if (error) throw error;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      if (vars.familyId) {
        qc.invalidateQueries({ queryKey: ['family-feed', vars.familyId] });
      }
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


// ── The payload, nearby search, and deletion (090) ───────────────────

/**
 * Signed URL for a sealed payload. Resolves only for the hider or a
 * claimed finder — storage RLS is the gate, so callers pass the path
 * freely and read nothing until they have stood on the spot. Enabled is
 * the caller's job: pass null until the find is claimed, or the fetch
 * burns a denied request per render.
 */
export function usePayloadUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['hunt-payload-url', path],
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from('hunt-payloads')
        .createSignedUrl(path, 60 * 10);
      if (error) return null; // denied = still sealed for this viewer
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: 5 * 60_000,
  });
}

export interface NearbyCache {
  id: string;
  title: string | null;
  hint: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  share_code: string | null;
  found_count: number;
  has_payload: boolean;
  distance_miles: number;
  creator_name: string | null;
  creator_handle: string | null;
}

/**
 * Drops around a point, by mileage radius. Public drops for anyone
 * signed in; cohort drops for their members; link drops never — a link
 * is an invitation, not a listing. Scope lives in the RPC (090).
 */
export function useNearbyCaches(
  coords: { lat: number; lng: number } | null,
  radiusMiles: number,
) {
  return useQuery({
    queryKey: ['hunt-nearby', coords?.lat?.toFixed(3), coords?.lng?.toFixed(3), radiusMiles],
    queryFn: async (): Promise<NearbyCache[]> => {
      if (!coords) return [];
      const { data, error } = await supabase.rpc('nearby_hunt_caches', {
        p_lat: coords.lat,
        p_lng: coords.lng,
        p_radius_miles: radiusMiles,
      });
      if (error) throw error;
      return (data ?? []) as NearbyCache[];
    },
    enabled: !!coords,
    staleTime: 60_000,
  });
}

/** Stamp the payload path onto a cache after its upload lands. The
 *  update policy (052) already restricts this to the creator. */
export function useSetCachePayload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cacheId: string; path: string }) => {
      const { error } = await supabase
        .from('hunt_caches')
        .update({ payload_photo_path: input.path } as any)
        .eq('id', input.cacheId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt-caches-mine'] });
    },
  });
}

/** The legacy public clue photo, for drops made before 090 ran. */
export function useSetCachePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cacheId: string; path: string }) => {
      const { error } = await supabase
        .from('hunt_caches')
        .update({ photo_path: input.path } as any)
        .eq('id', input.cacheId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt-caches-mine'] });
    },
  });
}

/**
 * Delete a drop outright. The 052 delete policy restricts this to the
 * creator; finds go with the row (FK cascade). Photos in storage are
 * not chased here — an orphaned object in a private bucket is inert,
 * and the burn path already owns server-side photo destruction.
 */
export function useDeleteHuntCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cacheId: string) => {
      const { error } = await supabase.from('hunt_caches').delete().eq('id', cacheId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt-caches-mine'] });
      qc.invalidateQueries({ queryKey: ['hunt-caches-public'] });
      qc.invalidateQueries({ queryKey: ['hunt-nearby'] });
    },
  });
}
