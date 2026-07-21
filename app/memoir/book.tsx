/**
 * /memoir/book — assemble + render the printed book.
 *
 * Title + dedication on top, a live page/word estimate, and a
 * "Make the book" button that kicks off the render worker. Renders
 * are listed below with status; finished ones expose download links
 * for the interior PDF (upload to KDP), the cover PDF, and the EPUB.
 *
 * The page deliberately frames the deliverable: this is the artifact
 * the family holds, so the copy points at KDP and the proof copy.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useEnsureMemoirProject, useMemoirProject, useUpdateMemoirProject,
  useMemoirProgress, useMemoirRenders, useRenderBook, getBookDownloadUrl,
  type MemoirBookRender,
} from '../../hooks/useMemoir';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';

export default function MemoirBookScreen() {
  const reading = useMemoirReadingMode();
  const { elder } = reading;
  const s = makeStyles(elder);
  // Two contexts: chrome icons sit on the dark wallpaper (header
  // chevron, "Aa" toggle) — keep them light. Page icons sit on the
  // vellum card (the Make button's bronze button text) — keep them
  // cream against the bronze.
  const ic = elder ? {
    chrome: { primary: Colors.brandIvory, secondary: Colors.textSecondary },
    page:   { primary: '#2A1F18', accent: '#8A5B1A' },
    onAccent: '#FBF4DE',
  } : {
    chrome: { primary: Colors.textPrimary, secondary: Colors.textSecondary },
    page:   { primary: Colors.textPrimary, accent: Colors.primary },
    onAccent: '#0A0A0F',
  };
  const { data: projectId } = useEnsureMemoirProject();
  const { data: project } = useMemoirProject(projectId);
  const { data: progress } = useMemoirProgress(projectId);
  const { data: renders } = useMemoirRenders(projectId);
  const updateProject = useUpdateMemoirProject();
  const render = useRenderBook();

  const [title, setTitle] = useState('');
  const [dedication, setDedication] = useState('');

  useEffect(() => {
    if (project) {
      setTitle(project.title ?? '');
      setDedication(project.dedication ?? '');
    }
  }, [project?.id]);

  const latest = renders?.[0];
  const busy = latest?.status === 'pending' || latest?.status === 'rendering';

  const saveMeta = async () => {
    if (!projectId) return;
    await updateProject.mutateAsync({
      id: projectId,
      patch: { title: title.trim() || 'My Life, So Far', dedication: dedication.trim() || null },
    }).catch(() => {});
  };

  const onRender = async () => {
    if (!projectId) return;
    if ((progress?.answered_count ?? 0) === 0) {
      showAlert('Nothing to print yet', 'Answer at least one prompt, then come back and make the book.');
      return;
    }
    await saveMeta();
    try {
      await render.mutateAsync(projectId);
    } catch (e: any) {
      showAlert('Could not start', e?.message ?? 'Try again.');
    }
  };

  // Rough page estimate: ~320 words a page once typeset.
  const estPages = Math.max(1, Math.round((progress?.word_count ?? 0) / 320));

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={ic.chrome.primary} />
          </TouchableOpacity>
          <Text style={s.kicker}>Make the book</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.page}>
        {/* Title + dedication */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Title</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            onBlur={saveMeta}
            placeholder="My Life, So Far"
            placeholderTextColor={elder ? '#9A9684' : Colors.textMuted}
            maxLength={120}
          />
        </View>
        <View style={s.field}>
          <Text style={s.fieldLabel}>Dedication (optional)</Text>
          <TextInput
            style={[s.input, { minHeight: 80 }]}
            value={dedication}
            onChangeText={setDedication}
            onBlur={saveMeta}
            accessibilityLabel="Dedication"
            multiline
            maxLength={400}
            textAlignVertical="top"
          />
        </View>

        {/* Estimate */}
        <View style={s.estimateRow}>
          <Stat label="Answers" value={String(progress?.answered_count ?? 0)} elder={elder} />
          <Stat label="Words" value={String(progress?.word_count ?? 0)} elder={elder} />
          <Stat label="Est. pages" value={`~${estPages}`} elder={elder} />
        </View>

        {/* Side links — preview, photos manager, and print guide. */}
        <View style={s.sideLinks}>
          <TouchableOpacity
            style={s.photosLink}
            onPress={() => router.push('/memoir/preview')}
            activeOpacity={0.85}
          >
            <Ionicons name="book-outline" size={16} color={ic.page.accent} />
            <Text style={s.photosLinkText}>Read it through →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.photosLink}
            onPress={() => router.push('/memoir/arrange')}
            activeOpacity={0.85}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={ic.page.accent} />
            <Text style={s.photosLinkText}>Arrange chapters →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.photosLink}
            onPress={() => router.push('/memoir/photos')}
            activeOpacity={0.85}
          >
            <Ionicons name="images-outline" size={16} color={ic.page.accent} />
            <Text style={s.photosLinkText}>Add photographs →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.photosLink}
            onPress={() => router.push('/memoir/print')}
            activeOpacity={0.85}
          >
            <Ionicons name="print-outline" size={16} color={ic.page.accent} />
            <Text style={s.photosLinkText}>Where to print →</Text>
          </TouchableOpacity>
        </View>

        {/* Render button */}
        <TouchableOpacity
          style={[s.makeBtn, (busy || render.isPending) && { opacity: 0.6 }]}
          onPress={onRender}
          disabled={busy || render.isPending}
          activeOpacity={0.85}
        >
          {busy || render.isPending ? (
            <>
              <ActivityIndicator color={ic.onAccent} />
              <Text style={s.makeBtnText}>Making your book…</Text>
            </>
          ) : (
            <>
              <Ionicons name="book" size={18} color={ic.onAccent} />
              <Text style={s.makeBtnText}>Make the book</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Renders */}
        {(renders ?? []).length > 0 && (
          <View style={s.renders}>
            <Text style={s.rendersTitle}>Your books</Text>
            {(renders ?? []).map((r) => <RenderRow key={r.id} render={r} elder={elder} />)}
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, elder }: { label: string; value: string; elder: boolean }) {
  const s = makeStyles(elder);
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function RenderRow({ render, elder }: { render: MemoirBookRender; elder: boolean }) {
  const s = makeStyles(elder);
  const accent = elder ? '#7E5F22' : Colors.primary;
  const onAccent = elder ? '#FFFFFF' : '#0A0A0F';

  const openArtifact = async (path: string | null) => {
    if (!path) return;
    const url = await getBookDownloadUrl(path);
    if (url) Linking.openURL(url);
    else showAlert('Could not open', 'The download link could not be created. Try again.');
  };

  const date = new Date(render.rendered_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <View style={s.renderRow}>
      <View style={s.renderHead}>
        <StatusPill status={render.status} elder={elder} />
        <Text style={s.renderDate}>{date}</Text>
        {render.status === 'done' && render.page_count != null && (
          <Text style={s.renderPages}>{render.page_count} pages</Text>
        )}
      </View>

      {render.status === 'failed' && !!render.error && (
        <Text style={s.renderError}>{render.error}</Text>
      )}

      {render.status === 'done' && (
        <View style={s.downloads}>
          <DownloadChip label="Interior PDF" icon="document-text-outline"
            onPress={() => openArtifact(render.interior_pdf_path)} primary elder={elder} />
          {render.cover_pdf_path && (
            <DownloadChip label="Cover PDF" icon="image-outline"
              onPress={() => openArtifact(render.cover_pdf_path)} elder={elder} />
          )}
          {render.epub_path && (
            <DownloadChip label="EPUB" icon="phone-portrait-outline"
              onPress={() => openArtifact(render.epub_path)} elder={elder} />
          )}
        </View>
      )}

    </View>
  );
}

function StatusPill({ status, elder }: { status: MemoirBookRender['status']; elder: boolean }) {
  const s = makeStyles(elder);
  const accent = elder ? '#7E5F22' : Colors.primary;
  const muted = elder ? '#6B6B5F' : Colors.textMuted;
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Queued', color: muted },
    rendering: { label: 'Making…', color: accent },
    done: { label: 'Ready', color: elder ? '#2F6B3D' : '#5BA86B' },
    failed: { label: 'Failed', color: elder ? '#7A2F1F' : '#C2604F' },
  };
  const m = map[status] ?? map.pending;
  return (
    <View style={[s.pill, { borderColor: m.color }]}>
      <Text style={[s.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function DownloadChip({ label, icon, onPress, primary, elder }: {
  label: string; icon: any; onPress: () => void; primary?: boolean; elder: boolean;
}) {
  const s = makeStyles(elder);
  const accent = elder ? '#7E5F22' : Colors.primary;
  const onAccent = elder ? '#FFFFFF' : '#0A0A0F';
  return (
    <TouchableOpacity
      style={[s.dlChip, primary && s.dlChipPrimary]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={14} color={primary ? onAccent : accent} />
      <Text style={[s.dlChipText, primary && { color: onAccent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// The book screen mirrors the interview surface — when elder mode is
// on, we paint the page on cream with near-black upright type and
// solid surfaces (no translucent dark cards). The accent button text
// flips to white because the elder accent is darker.
function makeStyles(elder: boolean = false) {
  // Manuscript mode for the book page: chrome (header bar) stays on
  // the dark brand wallpaper; the body lives in a vellum page card so
  // the deliverable feels like the artifact it makes.
  const chromeText = Colors.brandIvory;
  const chromeSecondary = Colors.textSecondary;
  const chromeMuted = Colors.textMuted;
  const chromeBorder = Colors.border;

  const pageCardBg = elder ? '#F2E8CC' : 'transparent';
  const pageInk = elder ? '#2A1F18' : Colors.textPrimary;
  const pageInkSecondary = elder ? '#5A4A38' : Colors.textSecondary;
  const pageInkMuted = elder ? '#8C7E60' : Colors.textMuted;
  const pageAccent = elder ? '#8A5B1A' : Colors.primary;
  const pageBorder = elder ? '#CFC0A0' : Colors.border;
  const pageSurface = elder ? '#FBF4DE' : Colors.surface;
  const display = elder ? pageInk : Colors.brandIvory;
  const onAccent = elder ? '#FBF4DE' : '#0A0A0F';

  const pageCardWeb = (elder && Platform.OS === 'web') ? ({
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(95,70,40,0.07) 31px, rgba(95,70,40,0.07) 32px)',
    boxShadow:
      '0 24px 50px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(95,70,40,0.08)',
  } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 2,
      textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    aaBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: chromeBorder,
    },
    aaText: { fontSize: 14, fontWeight: '700', color: chromeSecondary, letterSpacing: 0.4 },

    // The vellum page wrapper for the whole working surface.
    page: elder ? {
      marginTop: 24,
      padding: 32,
      borderRadius: 14,
      backgroundColor: pageCardBg,
      borderWidth: 1, borderColor: pageBorder,
      gap: Spacing.lg,
      ...pageCardWeb,
    } : { gap: Spacing.lg, marginTop: 8 },

    field: { gap: 6 },
    fieldLabel: {
      fontSize: 11, fontWeight: '700', color: pageInkMuted,
      textTransform: 'uppercase', letterSpacing: 1.6,
    },
    input: {
      padding: Spacing.md,
      borderRadius: elder ? 6 : Radius.lg,
      backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
      fontSize: 18, lineHeight: 28, color: pageInk,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    estimateRow: { flexDirection: 'row', gap: 10 },
    stat: {
      flex: 1, padding: Spacing.md, borderRadius: Radius.lg,
      backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
      alignItems: 'center', gap: 4,
    },
    statValue: {
      fontSize: 22, fontWeight: '800', color: pageInk,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    statLabel: { fontSize: 11, color: pageInkMuted, letterSpacing: 1, textTransform: 'uppercase' },

    makeBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      paddingVertical: 14, borderRadius: Radius.full,
      backgroundColor: pageAccent,
    },
    makeBtnText: {
      color: onAccent,
      fontSize: 15, fontWeight: '700', letterSpacing: 0.2,
    },
    sideLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photosLink: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 10, paddingHorizontal: 14,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: pageAccent,
    },
    photosLinkText: { fontSize: 13, fontWeight: '700', color: pageAccent },

    renders: { gap: 10, marginTop: 8 },
    rendersTitle: {
      fontSize: 18, fontWeight: '800', color: display,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    renderRow: {
      padding: Spacing.md, gap: 8,
      borderRadius: Radius.lg,
      backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
    },
    renderHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    renderDate: { fontSize: 13, color: pageInkSecondary },
    renderPages: { fontSize: 13, color: pageInkMuted, marginLeft: 'auto' },
    renderError: { fontSize: 14, color: elder ? '#9C3D2C' : '#C2604F', lineHeight: 20 },
    pill: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
      borderWidth: 1,
    },
    pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

    downloads: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    dlChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: pageAccent,
    },
    dlChipPrimary: { backgroundColor: pageAccent },
    dlChipText: { fontSize: 13, fontWeight: '700', color: pageAccent },
  });
}
