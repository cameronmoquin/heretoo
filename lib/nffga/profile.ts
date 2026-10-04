/**
 * Member profiles (nffga_profiles), officer lookup, and the shared
 * plumbing the community data layer leans on: a quiet treatment of
 * "the table isn't there yet", author lookups, and media upload.
 *
 * See docs/NFFGA_CONTRACT.md. Profiles are public: anon can read them.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { NffgaProfile } from './types';

export type AuthorLite = Pick<NffgaProfile, 'user_id' | 'display_name' | 'department'>;

// ── Missing-table tolerance ─────────────────────────────────────────
// The community tables may not be applied yet. A missing relation or
// function must read as "nothing here", with one console warning, not
// a red screen.

const MISSING_CODES = new Set(['PGRST205', 'PGRST202', '42P01', '42883', 'PGRST200']);
const warned = new Set<string>();

export function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code && MISSING_CODES.has(e.code)) return true;
  const m = (e.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find the function');
}

/** Log once per key. Used for read failures that the screen absorbs. */
export function quietWarn(key: string, error: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  const e = error as { message?: string } | null;
  // eslint-disable-next-line no-console
  console.warn(`[nffga] ${key}: ${e?.message ?? String(error)}`);
}

/**
 * Run a read. A missing table (or any read error) yields `fallback` and
 * a quiet warning. Reads should never take a public page down.
 */
export async function quietRead<T>(
  key: string,
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await run();
    if (error) { quietWarn(key, error); return fallback; }
    return (data ?? fallback) as T;
  } catch (err) {
    quietWarn(key, err);
    return fallback;
  }
}

/** Turn a write error into a short line a person can read. */
export function writeErrorText(error: unknown, fallback = 'That did not save. Try again.'): string {
  if (isMissingRelation(error)) return 'This part of the site is not switched on yet. Try again later.';
  const e = error as { message?: string } | null;
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('row-level security') || m.includes('permission denied')) return 'You do not have permission to do that.';
  if (m.includes('network') || m.includes('fetch')) return 'No connection. Check your network and try again.';
  return fallback;
}

// ── Profiles ────────────────────────────────────────────────────────

/** Author name + department for a set of user ids. */
export async function fetchAuthors(ids: string[]): Promise<Map<string, AuthorLite>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, AuthorLite>();
  if (!unique.length) return map;
  const rows = await quietRead<AuthorLite[]>(
    'nffga_profiles authors',
    () => supabase.from('nffga_profiles').select('user_id, display_name, department').in('user_id', unique),
    [],
  );
  for (const r of rows) map.set(r.user_id, r);
  return map;
}

export async function getProfile(userId: string): Promise<NffgaProfile | null> {
  if (!userId) return null;
  return quietRead<NffgaProfile | null>(
    'nffga_profiles get',
    () => supabase.from('nffga_profiles').select('*').eq('user_id', userId).maybeSingle(),
    null,
  );
}

export type ProfilePatch = Partial<Pick<NffgaProfile,
  'display_name' | 'department' | 'rank_title' | 'city' | 'state' | 'handicap' | 'bio' | 'avatar_path'>>;

/** Save the caller's own profile, creating the row first if it is missing. */
export async function saveMyProfile(userId: string, patch: ProfilePatch): Promise<{ ok: boolean; error?: string }> {
  try {
    const ensured = await supabase.rpc('nffga_ensure_profile', { p_display_name: patch.display_name ?? null });
    if (ensured.error && isMissingRelation(ensured.error)) {
      return { ok: false, error: writeErrorText(ensured.error) };
    }
    const { error } = await supabase
      .from('nffga_profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) return { ok: false, error: writeErrorText(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: writeErrorText(err) };
  }
}

/** The member's officer role, or null. Signed-in callers only. */
export async function getRole(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.rpc('nffga_role_of', { p_user_id: userId });
    if (error) { quietWarn('nffga_role_of', error); return null; }
    return typeof data === 'string' && data ? data : null;
  } catch (err) {
    quietWarn('nffga_role_of', err);
    return null;
  }
}

/** Golf writes a better-than-scratch handicap as "+2"; stored negative. */
export function formatHandicap(h: number | null | undefined): string | null {
  if (h == null) return null;
  const n = Number(h);
  if (Number.isNaN(n)) return null;
  return n < 0 ? `+${Math.abs(n)}` : String(n);
}

/** Parse what a person types ("12.4", "+2", "") into the stored number. */
export function parseHandicap(text: string): { ok: true; value: number | null } | { ok: false } {
  const t = text.trim();
  if (!t) return { ok: true, value: null };
  const plus = t.startsWith('+');
  const n = Number(plus ? t.slice(1) : t);
  if (!Number.isFinite(n) || Math.abs(n) > 54) return { ok: false };
  return { ok: true, value: Math.round((plus ? -n : n) * 10) / 10 };
}

// ── Media ───────────────────────────────────────────────────────────

/** The bits of an expo-image-picker asset an upload needs. */
export interface PickedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function extFor(img: PickedImage): { ext: string; type: string } {
  const mime = (img.mimeType ?? '').toLowerCase();
  if (mime.includes('png')) return { ext: 'png', type: 'image/png' };
  if (mime.includes('webp')) return { ext: 'webp', type: 'image/webp' };
  if (mime.includes('gif')) return { ext: 'gif', type: 'image/gif' };
  if (mime.includes('heic')) return { ext: 'heic', type: 'image/heic' };
  if (mime.includes('jpeg') || mime.includes('jpg')) return { ext: 'jpg', type: 'image/jpeg' };
  const fromName = (img.fileName ?? img.uri).split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (fromName === 'png') return { ext: 'png', type: 'image/png' };
  if (fromName === 'webp') return { ext: 'webp', type: 'image/webp' };
  if (fromName === 'heic') return { ext: 'heic', type: 'image/heic' };
  return { ext: 'jpg', type: 'image/jpeg' };
}

/**
 * Upload an image to the public `nffga-media` bucket under the caller's
 * own folder: `${userId}/${folder}/${uuid}.${ext}`. Returns the path.
 */
export async function uploadMedia(userId: string, folder: 'posts' | 'avatar', img: PickedImage): Promise<string> {
  const { ext, type } = extFor(img);
  const path = `${userId}/${folder}/${newId()}.${ext}`;
  const res = await fetch(img.uri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage.from('nffga-media').upload(path, body, { contentType: type, upsert: false });
  if (error) throw error;
  return path;
}

// ── Hooks ───────────────────────────────────────────────────────────

export const profileKeys = {
  one: (id: string) => ['nffga', 'profile', id] as const,
  role: (id: string | null) => ['nffga', 'role', id] as const,
};

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: profileKeys.one(userId ?? ''),
    queryFn: () => getProfile(userId as string),
    enabled: !!userId,
  });
}

export function useRole(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.role(userId),
    queryFn: () => getRole(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
}
