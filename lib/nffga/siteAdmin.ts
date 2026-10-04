/**
 * siteAdmin — the client side of migration 110 (the admin dashboard).
 *
 * Site admins are the super admin and the managing admin (seat rank
 * >= 2). The database enforces every rule here through
 * nffga_is_site_admin(); these helpers only call it.
 *
 *   Site photos      nffga_site_photos + bucket nffga-site (public).
 *   Member photos    nffga_admin_recent_photos() lists, and
 *                    nffga_admin_remove_photo() takes one off its post or
 *                    listing; the storage object is then deleted here
 *                    with the admin's session.
 *   Contact messages nffga_contact_messages (written by /api/contact).
 *   Own email        supabase.auth.updateUser + nffga_sync_my_admin_email.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { AdminRole } from '../admin';
import type { PickedImage } from './profile';
import { newId } from './profile';
import { publicObjectUrl } from './types';

/** Super admin and managing admin. */
export function isSiteAdminRole(role: AdminRole | string | null | undefined): boolean {
  return role === 'super_admin' || role === 'managing_admin';
}

function quiet(what: string, e: unknown) {
  // eslint-disable-next-line no-console
  if (__DEV__) console.warn(`[site-admin] ${what}`, (e as any)?.message ?? e);
}

export const siteAdminKeys = {
  sitePhotos: (placement: SitePhotoPlacement | 'all') => ['nffga', 'site-photos', placement] as const,
  sitePhotosAll: ['nffga', 'site-photos'] as const,
  memberPhotos: ['nffga', 'admin', 'member-photos'] as const,
  messages: ['nffga', 'admin', 'contact-messages'] as const,
};

// ── Site photos ──────────────────────────────────────────────────────

export type SitePhotoPlacement = 'home_gallery' | 'tournaments' | 'gear' | 'clubhouse';
export const SITE_PHOTO_PLACEMENTS: SitePhotoPlacement[] = ['home_gallery', 'tournaments', 'gear', 'clubhouse'];
export const PLACEMENT_LABEL: Record<SitePhotoPlacement, string> = {
  home_gallery: 'Home gallery',
  tournaments: 'Tournaments page',
  gear: 'Gear trade page',
  clubhouse: 'Clubhouse page',
};

export interface SitePhoto {
  id: string;
  path: string;
  caption: string | null;
  placement: SitePhotoPlacement;
  position: number;
  created_at: string;
}

export const SITE_BUCKET = 'nffga-site' as const;

export function sitePhotoUrl(path: string): string {
  return publicObjectUrl(SITE_BUCKET, path);
}

export async function fetchSitePhotos(placement: SitePhotoPlacement | 'all'): Promise<SitePhoto[]> {
  try {
    let q = supabase.from('nffga_site_photos').select('id, path, caption, placement, position, created_at');
    if (placement !== 'all') q = q.eq('placement', placement);
    const { data, error } = await q.order('placement').order('position').order('created_at');
    if (error) { quiet('site photos', error); return []; }
    return (data ?? []) as SitePhoto[];
  } catch (e) {
    quiet('site photos', e);
    return [];
  }
}

/** Public: the photos for one placement (or all, for the dashboard). */
export function useSitePhotos(placement: SitePhotoPlacement | 'all') {
  return useQuery({
    queryKey: siteAdminKeys.sitePhotos(placement),
    queryFn: () => fetchSitePhotos(placement),
    staleTime: 1000 * 60 * 5,
  });
}

function imageType(img: PickedImage): { ext: string; type: string } {
  const mime = (img.mimeType ?? '').toLowerCase();
  if (mime.includes('png')) return { ext: 'png', type: 'image/png' };
  if (mime.includes('webp')) return { ext: 'webp', type: 'image/webp' };
  if (mime.includes('gif')) return { ext: 'gif', type: 'image/gif' };
  if (mime.includes('heic')) return { ext: 'heic', type: 'image/heic' };
  return { ext: 'jpg', type: 'image/jpeg' };
}

export async function uploadSitePhoto(
  img: PickedImage,
  caption: string,
  placement: SitePhotoPlacement,
  position: number,
): Promise<{ ok: boolean; error?: string }> {
  const { ext, type } = imageType(img);
  const path = `${placement}/${newId()}.${ext}`;
  try {
    const body = await (await fetch(img.uri)).arrayBuffer();
    const up = await supabase.storage.from(SITE_BUCKET).upload(path, body, { contentType: type, upsert: false });
    if (up.error) { quiet('upload', up.error); return { ok: false, error: 'The photo could not be uploaded. Try again.' }; }
    const { error } = await supabase.from('nffga_site_photos').insert({
      path, caption: caption.trim() || null, placement, position,
    });
    if (error) {
      quiet('insert site photo', error);
      await supabase.storage.from(SITE_BUCKET).remove([path]).catch(() => {});
      return { ok: false, error: 'The photo could not be saved. Try again.' };
    }
    return { ok: true };
  } catch (e) {
    quiet('upload', e);
    return { ok: false, error: 'The photo could not be uploaded right now.' };
  }
}

export async function updateSitePhoto(
  id: string,
  patch: Partial<Pick<SitePhoto, 'caption' | 'placement' | 'position'>>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.from('nffga_site_photos').update(patch).eq('id', id).select('id');
    if (error || !data?.length) { quiet('update site photo', error); return { ok: false, error: 'Could not update the photo.' }; }
    return { ok: true };
  } catch (e) {
    quiet('update site photo', e);
    return { ok: false, error: 'Could not update the photo.' };
  }
}

/** Swap two photos' positions (move up / down within a placement). */
export async function swapSitePhotos(a: SitePhoto, b: SitePhoto): Promise<{ ok: boolean; error?: string }> {
  const pa = a.position === b.position ? b.position + 1 : b.position;
  const r1 = await updateSitePhoto(a.id, { position: pa });
  if (!r1.ok) return r1;
  return updateSitePhoto(b.id, { position: a.position });
}

// ── Removing a photo (site or member) ────────────────────────────────

export type RemovableKind = 'post' | 'gear' | 'site';

/**
 * Take a photo off its post / listing / the site through the RPC, then
 * delete the stored file with this admin's session. A file that cannot
 * be deleted is only orphaned storage; the photo is already gone from
 * every page, so that still counts as done.
 */
export async function removePhoto(kind: RemovableKind, id: string, path: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('nffga_admin_remove_photo', { p_kind: kind, p_id: id, p_path: path });
    if (error) { quiet('remove photo', error); return { ok: false, error: 'Could not remove the photo. Try again.' }; }
    const r = (data ?? {}) as { ok?: boolean; error?: string; bucket?: string; path?: string };
    if (!r.ok) {
      const text: Record<string, string> = {
        not_allowed: 'Only site admins can remove photos.',
        not_found: 'That photo is already gone.',
      };
      return { ok: false, error: text[r.error ?? ''] ?? 'Could not remove the photo.' };
    }
    if (r.bucket && r.path) {
      const del = await supabase.storage.from(r.bucket).remove([r.path]);
      if (del.error) quiet('remove object', del.error);
    }
    return { ok: true };
  } catch (e) {
    quiet('remove photo', e);
    return { ok: false, error: 'Could not remove the photo right now.' };
  }
}

export async function deleteSitePhoto(p: SitePhoto) {
  return removePhoto('site', p.id, p.path);
}

// ── Member photos (moderation) ───────────────────────────────────────

export interface MemberPhoto {
  kind: 'post' | 'gear';
  ref_id: string;
  photo_id: string | null;
  bucket: 'nffga-media' | 'nffga-gear';
  path: string;
  owner_id: string | null;
  owner_name: string | null;
  title: string | null;
  link: string;
  created_at: string;
}

export async function fetchMemberPhotos(limit = 60): Promise<MemberPhoto[]> {
  try {
    const { data, error } = await supabase.rpc('nffga_admin_recent_photos', { p_limit: limit });
    if (error) { quiet('member photos', error); return []; }
    return (data ?? []) as MemberPhoto[];
  } catch (e) {
    quiet('member photos', e);
    return [];
  }
}

export function useMemberPhotos(enabled: boolean, limit = 60) {
  return useQuery({ queryKey: [...siteAdminKeys.memberPhotos, limit], queryFn: () => fetchMemberPhotos(limit), enabled });
}

export function removeMemberPhoto(p: MemberPhoto) {
  return p.kind === 'gear'
    ? removePhoto('gear', p.photo_id as string, p.path)
    : removePhoto('post', p.ref_id, p.path);
}

// ── Contact messages ─────────────────────────────────────────────────

export type ContactStatus = 'new' | 'read' | 'archived';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  created_at: string;
  status: ContactStatus;
  user_id: string | null;
}

export async function fetchContactMessages(): Promise<ContactMessage[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_contact_messages')
      .select('id, name, email, subject, body, created_at, status, user_id')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { quiet('messages', error); return []; }
    return (data ?? []) as ContactMessage[];
  } catch (e) {
    quiet('messages', e);
    return [];
  }
}

export function useContactMessages(enabled: boolean) {
  return useQuery({ queryKey: siteAdminKeys.messages, queryFn: fetchContactMessages, enabled, refetchInterval: 1000 * 60 * 2 });
}

export async function setContactStatus(id: string, status: ContactStatus): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.from('nffga_contact_messages').update({ status }).eq('id', id).select('id');
    if (error || !data?.length) { quiet('message status', error); return { ok: false, error: 'Could not update the message.' }; }
    return { ok: true };
  } catch (e) {
    quiet('message status', e);
    return { ok: false, error: 'Could not update the message.' };
  }
}

// ── Own sign-in email ────────────────────────────────────────────────

/** Move the caller's admin designation to their current sign-in email.
 *  Harmless for anyone without a claimed seat. */
export async function syncMyAdminEmail(): Promise<{ ok: boolean; email?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('nffga_sync_my_admin_email');
    if (error) { quiet('sync email', error); return { ok: false, error: 'unavailable' }; }
    return (data ?? { ok: false }) as { ok: boolean; email?: string; error?: string };
  } catch (e) {
    quiet('sync email', e);
    return { ok: false, error: 'unavailable' };
  }
}

/**
 * Change the signed-in person's email. This project auto-confirms, so it
 * usually applies at once ('changed'); if confirmation is on, Supabase
 * emails a link to the new address first ('confirm_sent').
 */
export async function changeMyEmail(
  newEmail: string,
): Promise<{ ok: true; outcome: 'changed' | 'confirm_sent'; email: string } | { ok: false; error: string }> {
  const email = newEmail.trim().toLowerCase();
  try {
    const { data, error } = await supabase.auth.updateUser({ email });
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
        return { ok: false, error: 'That email is already used by another account.' };
      }
      if (m.includes('invalid')) return { ok: false, error: 'Enter a valid email address.' };
      return { ok: false, error: error.message || 'Could not change the email.' };
    }
    const now = (data.user?.email ?? '').toLowerCase();
    if (now === email) {
      // Refresh the session so the token carries the new address.
      await supabase.auth.refreshSession().catch(() => {});
      await syncMyAdminEmail();
      return { ok: true, outcome: 'changed', email };
    }
    return { ok: true, outcome: 'confirm_sent', email };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Could not change the email right now.' };
  }
}
