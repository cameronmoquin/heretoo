/**
 * PhotosTab — two jobs.
 *
 *   Site photos     The association's own photos (bucket nffga-site).
 *                   Upload with a caption and a placement, reorder within
 *                   a placement, edit the caption, delete. The home
 *                   gallery shows on the home page under the name; the
 *                   other placements show at the top of that room's page.
 *   Member photos   Recent photos members put on Clubhouse posts and gear
 *                   listings, newest first. Delete takes the photo off its
 *                   post or listing (nffga_admin_remove_photo) and then
 *                   deletes the stored file.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Image, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../shared/Button';
import { confirm } from '../../shared/ConfirmSheet';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';
import { publicObjectUrl } from '../../../lib/nffga/types';
import {
  PLACEMENT_LABEL, SITE_PHOTO_PLACEMENTS, deleteSitePhoto, removeMemberPhoto, siteAdminKeys, sitePhotoUrl,
  swapSitePhotos, updateSitePhoto, uploadSitePhoto, useMemberPhotos, useSitePhotos,
  type MemberPhoto, type SitePhoto, type SitePhotoPlacement,
} from '../../../lib/nffga/siteAdmin';
import { pickImage } from '../board/pickImage';
import { makeAdminStyles } from './styles';

export function PhotosTab() {
  const s = makeAdminStyles();
  return (
    <View style={{ gap: Spacing.lg }}>
      <SitePhotos />
      <View style={s.divider} />
      <MemberPhotos />
    </View>
  );
}

// ── Site photos ──────────────────────────────────────────────────────

function SitePhotos() {
  const s = makeAdminStyles();
  const qc = useQueryClient();
  const q = useSitePhotos('all');
  const [caption, setCaption] = useState('');
  const [placement, setPlacement] = useState<SitePhotoPlacement>('home_gallery');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const photos = q.data ?? [];

  const grouped = useMemo(() => SITE_PHOTO_PLACEMENTS.map((p) => ({
    placement: p,
    items: photos.filter((x) => x.placement === p).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
  })), [photos]);

  const refresh = () => qc.invalidateQueries({ queryKey: siteAdminKeys.sitePhotosAll });

  const upload = async () => {
    setMsg(null);
    const img = await pickImage();
    if (!img) return;
    setBusy(true);
    const inPlace = photos.filter((x) => x.placement === placement);
    const position = inPlace.length ? Math.max(...inPlace.map((x) => x.position)) + 1 : 0;
    const res = await uploadSitePhoto(img, caption, placement, position);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: res.error ?? 'Upload failed.' }); return; }
    setCaption('');
    setMsg({ ok: true, text: `Added to ${PLACEMENT_LABEL[placement]}.` });
    refresh();
  };

  return (
    <View style={s.section}>
      <Text style={s.h2} accessibilityRole="header">Site photos</Text>
      <Text style={s.muted}>
        Photos the association posts itself. Home gallery photos show on the home page under the name; the others show at the top of that page.
      </Text>

      <View style={s.card}>
        <Text style={s.h3}>Add a photo</Text>
        <TextInput
          style={s.input} value={caption} onChangeText={setCaption} maxLength={300}
          placeholder="Caption (optional)" placeholderTextColor={Colors.textMuted}
        />
        <View style={s.chips}>
          {SITE_PHOTO_PLACEMENTS.map((p) => (
            <Pressable key={p} style={[s.chip, placement === p && s.chipOn]} onPress={() => setPlacement(p)}
              accessibilityRole="button" accessibilityState={{ selected: placement === p }}>
              <Text style={[s.chipText, placement === p && s.chipTextOn]}>{PLACEMENT_LABEL[p]}</Text>
            </Pressable>
          ))}
        </View>
        {msg ? <Text style={msg.ok ? s.ok : s.err}>{msg.text}</Text> : null}
        <View style={s.actions}>
          <Button title={busy ? 'Uploading…' : 'Choose photo and upload'} onPress={upload} loading={busy} disabled={busy} variant="primary" size="md" />
        </View>
      </View>

      {q.isLoading ? <ActivityIndicator color={Colors.primary} /> : null}
      {!q.isLoading && photos.length === 0 ? <Text style={s.secondary}>No site photos yet.</Text> : null}
      {grouped.filter((g) => g.items.length > 0).map((g) => (
        <View key={g.placement} style={s.section}>
          <Text style={s.h3}>{PLACEMENT_LABEL[g.placement]}</Text>
          {g.items.map((p, i) => (
            <SitePhotoRow key={p.id} p={p} prev={g.items[i - 1]} next={g.items[i + 1]} onChanged={refresh} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SitePhotoRow({ p, prev, next, onChanged }: {
  p: SitePhoto; prev?: SitePhoto; next?: SitePhoto; onChanged: () => void;
}) {
  const s = makeAdminStyles();
  const l = makeLocalStyles();
  const [caption, setCaption] = useState(p.caption ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const dirty = caption.trim() !== (p.caption ?? '');

  const run = async (what: string, op: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null); setBusy(what);
    const res = await op();
    setBusy(null);
    if (!res.ok) { setErr(res.error ?? 'Could not update.'); return; }
    onChanged();
  };

  const del = () => confirm({
    title: 'Delete this photo?',
    message: 'It is removed from the site and the file is deleted.',
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: () => { void run('delete', () => deleteSitePhoto(p)); },
  });

  return (
    <View style={[s.card, l.siteRow]}>
      <Image source={{ uri: sitePhotoUrl(p.path) }} style={l.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={l.siteBody}>
        <TextInput
          style={s.input} value={caption} onChangeText={setCaption} maxLength={300}
          placeholder="No caption" placeholderTextColor={Colors.textMuted}
        />
        {err ? <Text style={s.err}>{err}</Text> : null}
        <View style={s.actions}>
          {dirty ? (
            <Button title="Save caption" size="sm" variant="primary" loading={busy === 'caption'}
              onPress={() => run('caption', () => updateSitePhoto(p.id, { caption: caption.trim() || null }))} />
          ) : null}
          <Button title="Move up" size="sm" variant="outline" disabled={!prev || !!busy} loading={busy === 'up'}
            onPress={() => prev && run('up', () => swapSitePhotos(p, prev))} />
          <Button title="Move down" size="sm" variant="outline" disabled={!next || !!busy} loading={busy === 'down'}
            onPress={() => next && run('down', () => swapSitePhotos(p, next))} />
          <Button title="Delete" size="sm" variant="ghost" textStyle={{ color: Colors.error }} loading={busy === 'delete'} onPress={del} />
        </View>
      </View>
    </View>
  );
}

// ── Member photos ────────────────────────────────────────────────────

function MemberPhotos() {
  const s = makeAdminStyles();
  const l = makeLocalStyles();
  const [limit, setLimit] = useState(60);
  const q = useMemberPhotos(true, limit);
  const rows = q.data ?? [];

  return (
    <View style={s.section}>
      <Text style={s.h2} accessibilityRole="header">Member photos</Text>
      <Text style={s.muted}>
        Recent photos on Clubhouse posts and gear listings, newest first. Delete takes the photo off the post or listing for everyone.
      </Text>
      {q.isLoading ? <ActivityIndicator color={Colors.primary} /> : null}
      {!q.isLoading && rows.length === 0 ? <Text style={s.secondary}>No member photos.</Text> : null}
      <View style={l.grid}>
        {rows.map((p) => <MemberTile key={`${p.kind}-${p.ref_id}-${p.photo_id ?? ''}-${p.path}`} p={p} />)}
      </View>
      {rows.length >= limit && limit < 300 ? (
        <View style={s.actions}>
          <Button title="Show more" onPress={() => setLimit((n) => Math.min(300, n + 60))} variant="outline" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

function MemberTile({ p }: { p: MemberPhoto }) {
  const s = makeAdminStyles();
  const l = makeLocalStyles();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const del = () => confirm({
    title: 'Delete this photo?',
    message: p.kind === 'gear'
      ? 'It is taken off the gear listing and the file is deleted.'
      : 'It is taken off the Clubhouse post and the file is deleted. A post with no words and no other photo is removed.',
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: async () => {
      setErr(null); setBusy(true);
      const res = await removeMemberPhoto(p);
      setBusy(false);
      if (!res.ok) { setErr(res.error ?? 'Could not delete.'); return; }
      // Member photos, and every feed / listing that showed this photo.
      qc.invalidateQueries({ queryKey: ['nffga'] });
    },
  });

  return (
    <View style={[s.card, l.tile]}>
      <Image source={{ uri: publicObjectUrl(p.bucket, p.path) }} style={l.tileImg} resizeMode="cover" accessibilityIgnoresInvertColors />
      <Text style={s.rowMeta} numberOfLines={1}>
        {p.kind === 'gear' ? 'Gear listing' : 'Clubhouse post'} · {new Date(p.created_at).toLocaleDateString()}
      </Text>
      <Text style={s.secondary} numberOfLines={2}>{p.title?.trim() || '(no text)'}</Text>
      <Text style={s.muted} numberOfLines={1}>{p.owner_name ?? 'Member'}</Text>
      {err ? <Text style={s.err}>{err}</Text> : null}
      <View style={s.actions}>
        <Button title="Open" onPress={() => router.push(p.link as any)} variant="outline" size="sm" />
        <Button title="Delete" onPress={del} variant="ghost" size="sm" loading={busy} textStyle={{ color: Colors.error }} />
      </View>
    </View>
  );
}

function makeLocalStyles() { return StyleSheet.create({
  siteRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  siteBody: { flex: 1, minWidth: 220, gap: Spacing.xs },
  thumb: { width: 120, aspectRatio: 4 / 3, borderRadius: Radius.media, backgroundColor: Colors.surfaceAlt },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { flexGrow: 1, flexBasis: 200, maxWidth: 280, gap: Spacing.xxs, padding: Spacing.sm },
  tileImg: { width: '100%', aspectRatio: 1, borderRadius: Radius.media, backgroundColor: Colors.surfaceAlt },
}); }
