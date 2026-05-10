/**
 * /loft — HereToo, the public square.
 *
 * The wider-world section of the platform. Open to anyone signed
 * into HereToo — pseudonymous, sharp-edged, posts that vanish in
 * 24 hours. This is the only part of HereToo where ads are allowed.
 * The family rooms remain ad-free, paid by subscription. A first-
 * visit disclosure makes the carve-out plain.
 *
 * Visually the page is OUTSIDE the parlor wallpaper. We blank the
 * body with a hard near-black background so the modernist register
 * reads. Inter only, no Syne, no Source Serif.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useLoftFeed, useLoftHandle, useCreateLoftPost, useDeleteLoftPost,
  useRegenerateLoftHandle,
  type LoftPost,
} from '../../hooks/useLoft';
import { useAuthStore } from '../../stores/authStore';
import { showAlert } from '../../lib/alert';
import { AdSlot } from '../../components/loft/AdSlot';

const DISCLOSURE_KEY = 'heretoo:loft-disclosure-seen';

// The Loft uses its own palette — locked, not theme-driven. The whole
// point is that it doesn't look like the parlor.
const LOFT = {
  bg: '#0E0E0E',
  surface: '#1A1A1A',
  surfaceLight: '#262626',
  border: '#3A3A3A',
  text: '#F5F5F5',
  muted: '#9A9A9A',
  accent: '#E0FF4F',     // sharp acid-yellow — visible but not gold
  accentInk: '#0E0E0E',
};

export default function LoftScreen() {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const { data: feed, isLoading } = useLoftFeed();
  const { data: myHandle, refetch: refetchHandle } = useLoftHandle();
  const regenerate = useRegenerateLoftHandle();
  const create = useCreateLoftPost();
  const remove = useDeleteLoftPost();
  const [draft, setDraft] = useState('');
  const [disclosureOpen, setDisclosureOpen] = useState(false);

  // First-visit ad disclosure. localStorage-keyed so we don't nag.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem(DISCLOSURE_KEY);
      if (!seen) setDisclosureOpen(true);
    } catch {}
  }, []);

  const dismissDisclosure = () => {
    setDisclosureOpen(false);
    try { window.localStorage.setItem(DISCLOSURE_KEY, '1'); } catch {}
  };

  // Override the body bg while the Loft is mounted; restore on unmount.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.setAttribute('data-loft', 'on');
    const styleEl = document.createElement('style');
    styleEl.id = 'loft-overrides';
    styleEl.textContent = `
      body[data-loft='on'] #heretoo-wallpaper { display: none !important; }
      body[data-loft='on'] { background-color: ${LOFT.bg} !important; }
      body[data-loft='on'] #root > div:first-child { background-color: ${LOFT.bg} !important; }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.body.removeAttribute('data-loft');
      const existing = document.getElementById('loft-overrides');
      if (existing) existing.remove();
    };
  }, []);

  const onSubmit = async () => {
    const body = draft.trim();
    if (body.length < 1) return;
    try {
      await create.mutateAsync(body);
      setDraft('');
    } catch (e: any) {
      showAlert('Could not post', e?.message ?? 'Try again.');
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/' as any)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={20} color={LOFT.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={s.brand}>HERETOO</Text>
          <Text style={s.brandSub}>the public square</Text>
        </View>
        <View style={{ width: 20 }} />
      </View>

      <View style={s.subbarRow}>
        {myHandle ? (
          <View style={{ flex: 1 }}>
            <Text style={s.subbar}>
              You are <Text style={s.subbarHandle}>{myHandle}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => regenerate.mutate()}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              disabled={regenerate.isPending}
            >
              <Text style={s.changeLink}>
                {regenerate.isPending ? 'rolling…' : 'change pseudonym'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={s.subbar}>You are <Text style={s.subbarHandle}>unnamed</Text></Text>
            <TouchableOpacity
              onPress={() => refetchHandle()}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={s.changeLink}>get a pseudonym</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={s.dotRow}>
          <View style={s.dotLive} />
          <Text style={s.subbarMuted}>24h</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Composer */}
        <View style={s.composerCard}>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="say something. it disappears tomorrow."
            placeholderTextColor={LOFT.muted}
            multiline
            maxLength={1200}
          />
          <View style={s.composerFooter}>
            <Text style={s.charCount}>
              {1200 - draft.length}
            </Text>
            <TouchableOpacity
              style={[s.postBtn, (create.isPending || !draft.trim()) && { opacity: 0.4 }]}
              onPress={onSubmit}
              disabled={create.isPending || !draft.trim()}
              activeOpacity={0.85}
            >
              {create.isPending ? (
                <ActivityIndicator color={LOFT.accentInk} size="small" />
              ) : (
                <Text style={s.postBtnText}>post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && (feed ?? []).length === 0 && (
          <ActivityIndicator color={LOFT.accent} style={{ marginTop: 24 }} />
        )}

        {!isLoading && (feed ?? []).length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>nothing here right now.</Text>
            <Text style={s.emptyBody}>be the first. tomorrow it&apos;s gone.</Text>
          </View>
        )}

        {(feed ?? []).map((p, idx) => (
          <React.Fragment key={p.id}>
            <LoftPostRow
              post={p}
              isMine={p.author_id === userId}
              onDelete={() => remove.mutate(p.id)}
            />
            {/* Ads land every 5 posts. Family rooms stay clean. */}
            {(idx + 1) % 5 === 0 && <AdSlot />}
          </React.Fragment>
        ))}

        <View style={s.footer}>
          <Text style={s.footerText}>
            no follower counts. no algorithm. posts last 24 hours and disappear.
            {'\n'}supported by ads — the family rooms stay clean.
          </Text>
        </View>
      </ScrollView>

      {/* First-visit disclosure */}
      <Modal visible={disclosureOpen} transparent animationType="fade" onRequestClose={dismissDisclosure}>
        <View style={s.discScrim}>
          <View style={s.discSheet}>
            <Text style={s.discKicker}>HERETOO · THE PUBLIC SQUARE</Text>
            <Text style={s.discTitle}>This part of HereToo is supported by ads.</Text>
            <Text style={s.discBody}>
              The family rooms — the parlor, the letters, the memoir, the trivia,
              all the private surfaces — stay ad-free. They&apos;re paid for by the
              family subscription.
            </Text>
            <Text style={s.discBody}>
              The public square is the open part of the platform. Anyone signed
              into HereToo can post or read here, pseudonymously. Ads appear in
              the feed about every fifth post. Posts vanish in 24 hours.
            </Text>
            <TouchableOpacity onPress={dismissDisclosure} style={s.discBtn} activeOpacity={0.85}>
              <Text style={s.discBtnText}>I understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function LoftPostRow({
  post, isMine, onDelete,
}: { post: LoftPost; isMine: boolean; onDelete: () => void }) {
  const s = makeStyles();
  const expiresIn = Math.max(0, Math.floor((new Date(post.expires_at).getTime() - Date.now()) / (60 * 60 * 1000)));
  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <Text style={s.postPseudonym}>{post.pseudonym}</Text>
        <Text style={s.postExpires}>{expiresIn}h left</Text>
      </View>
      <Text style={s.postBody}>{post.body}</Text>
      {isMine && (
        <TouchableOpacity onPress={onDelete} style={s.deleteRow} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={s.deleteText}>delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: LOFT.bg, maxWidth: 720, alignSelf: 'center', width: '100%' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: LOFT.border,
  },
  brand: {
    fontSize: 16, fontWeight: '900', color: LOFT.text,
    letterSpacing: 6,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  brandSub: {
    fontSize: 9, fontWeight: '500', color: LOFT.muted, letterSpacing: 1.4,
    textTransform: 'uppercase', marginTop: 1,
  },

  // Disclosure modal
  discScrim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  discSheet: {
    backgroundColor: LOFT.surface,
    borderWidth: 1, borderColor: LOFT.accent,
    padding: 24, gap: 12, maxWidth: 460, width: '100%',
  },
  discKicker: {
    fontSize: 10, fontWeight: '700', color: LOFT.accent, letterSpacing: 2.4,
  },
  discTitle: {
    fontSize: 22, fontWeight: '900', color: LOFT.text, lineHeight: 28,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  discBody: {
    fontSize: 14, lineHeight: 21, color: LOFT.text, fontWeight: '400',
  },
  discBtn: {
    paddingHorizontal: 18, paddingVertical: 11,
    backgroundColor: LOFT.accent,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  discBtnText: {
    color: LOFT.accentInk, fontSize: 13, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.6,
  },

  subbarRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: LOFT.border,
  },
  subbar: { fontSize: 12, color: LOFT.muted, fontWeight: '500' },
  subbarHandle: { color: LOFT.accent, fontWeight: '700' },
  subbarMuted: { fontSize: 11, color: LOFT.muted, fontWeight: '500' },
  changeLink: {
    fontSize: 10, color: LOFT.muted, fontWeight: '500',
    textDecorationLine: 'underline', marginTop: 2, letterSpacing: 0.4,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotLive: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: LOFT.accent,
  },

  scroll: { padding: 16, gap: 14, paddingBottom: 80 },

  composerCard: {
    backgroundColor: LOFT.surface,
    borderWidth: 1, borderColor: LOFT.border,
    borderRadius: 0,                   // hard edges; no parlor curves
    padding: 14,
    gap: 8,
  },
  input: {
    color: LOFT.text,
    fontSize: 15, lineHeight: 22,
    minHeight: 80,
    fontWeight: '400',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  composerFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: LOFT.border,
    paddingTop: 8,
  },
  charCount: { fontSize: 11, color: LOFT.muted, fontWeight: '500' },
  postBtn: {
    paddingHorizontal: 18, paddingVertical: 7,
    backgroundColor: LOFT.accent,
    borderRadius: 0,
  },
  postBtnText: {
    color: LOFT.accentInk, fontSize: 13, fontWeight: '700',
    textTransform: 'lowercase', letterSpacing: 1.6,
  },

  emptyWrap: { padding: 24, gap: 8 },
  emptyTitle: { color: LOFT.text, fontSize: 18, fontWeight: '600' },
  emptyBody: { color: LOFT.muted, fontSize: 13, lineHeight: 19 },

  postCard: {
    backgroundColor: LOFT.surface,
    borderWidth: 1, borderColor: LOFT.border,
    borderRadius: 0,
    padding: 14,
    gap: 8,
  },
  postHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  postPseudonym: {
    fontSize: 12, fontWeight: '700', color: LOFT.accent,
    textTransform: 'lowercase', letterSpacing: 1,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  postExpires: { fontSize: 10, color: LOFT.muted, fontWeight: '600', letterSpacing: 1 },
  postBody: {
    fontSize: 15, lineHeight: 22, color: LOFT.text, fontWeight: '400',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  deleteRow: { alignSelf: 'flex-end' },
  deleteText: { fontSize: 11, color: LOFT.muted, textDecorationLine: 'underline', fontWeight: '500' },

  footer: { paddingTop: 12 },
  footerText: { fontSize: 11, color: LOFT.muted, lineHeight: 16, textAlign: 'center' },
}); }
