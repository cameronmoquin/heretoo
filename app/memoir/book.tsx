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
  View, Text, StyleSheet, ScrollView, TextInput,
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
import { Spacing, Radius, Type } from '../../constants/design';
import { Gen } from '../../constants/generations';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { Button } from '../../components/shared/Button';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

export default function MemoirBookScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);
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
      <ScreenHeader
        title="Make the book"
        showBack
        right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
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
            placeholderTextColor={Colors.textMuted}
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
          <Stat label="Answers" value={String(progress?.answered_count ?? 0)} scale={scale} />
          <Stat label="Words" value={String(progress?.word_count ?? 0)} scale={scale} />
          <Stat label="Est. pages" value={`~${estPages}`} scale={scale} />
        </View>

        {/* Side links — preview, photos manager, and print guide. */}
        <View style={s.sideLinks}>
          <Button
            title="Read it through"
            variant="outline"
            size="sm"
            onPress={() => router.push('/memoir/preview')}
            icon={<Ionicons name="book-outline" size={16} color={Colors.primary} />}
          />
          <Button
            title="Arrange chapters"
            variant="outline"
            size="sm"
            onPress={() => router.push('/memoir/arrange')}
            icon={<Ionicons name="swap-vertical-outline" size={16} color={Colors.primary} />}
          />
          <Button
            title="Add photographs"
            variant="outline"
            size="sm"
            onPress={() => router.push('/memoir/photos')}
            icon={<Ionicons name="images-outline" size={16} color={Colors.primary} />}
          />
          <Button
            title="Where to print"
            variant="outline"
            size="sm"
            onPress={() => router.push('/memoir/print')}
            icon={<Ionicons name="print-outline" size={16} color={Colors.primary} />}
          />
        </View>

        {/* Render button */}
        <Button
          title={busy || render.isPending ? 'Making your book…' : 'Make the book'}
          onPress={onRender}
          loading={busy || render.isPending}
          size="lg"
          icon={!(busy || render.isPending) ? <Ionicons name="book" size={18} color={Colors.onPrimary} /> : undefined}
        />

        {/* Renders */}
        {(renders ?? []).length > 0 && (
          <View style={s.renders}>
            <Text style={s.rendersTitle}>Your books</Text>
            {(renders ?? []).map((r) => <RenderRow key={r.id} render={r} scale={scale} />)}
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, scale }: { label: string; value: string; scale: number }) {
  const s = makeStyles(scale);
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function RenderRow({ render, scale }: { render: MemoirBookRender; scale: number }) {
  const s = makeStyles(scale);

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
        <StatusPill status={render.status} />
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
            onPress={() => openArtifact(render.interior_pdf_path)} primary />
          {render.cover_pdf_path && (
            <DownloadChip label="Cover PDF" icon="image-outline"
              onPress={() => openArtifact(render.cover_pdf_path)} />
          )}
          {render.epub_path && (
            <DownloadChip label="EPUB" icon="phone-portrait-outline"
              onPress={() => openArtifact(render.epub_path)} />
          )}
        </View>
      )}

    </View>
  );
}

function StatusPill({ status }: { status: MemoirBookRender['status'] }) {
  const s = makeStyles();
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Queued', color: Colors.textMuted },
    rendering: { label: 'Making…', color: Colors.primary },
    done: { label: 'Ready', color: Colors.success },
    failed: { label: 'Failed', color: Colors.error },
  };
  const m = map[status] ?? map.pending;
  return (
    <View style={[s.pill, { borderColor: m.color }]}>
      <Text style={[s.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function DownloadChip({ label, icon, onPress, primary }: {
  label: string; icon: any; onPress: () => void; primary?: boolean;
}) {
  return (
    <Button
      title={label}
      variant={primary ? 'primary' : 'outline'}
      size="sm"
      onPress={onPress}
      icon={<Ionicons name={icon} size={14} color={primary ? Colors.onPrimary : Colors.primary} />}
    />
  );
}

// One palette, driven by the skin engine. `scale` multiplies the Type.*
// reading sizes; color, font, and corner come from Colors / Gen so
// setGeneration reskins the whole surface.
function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: Gen.bodyFont } as any) : {};
  const displayFont = Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.sm, gap: Spacing.lg },

    page: { gap: Spacing.lg, marginTop: Spacing.xs },

    field: { gap: 6 },
    fieldLabel: {
      fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.textMuted,
      textTransform: 'uppercase', letterSpacing: Type.eyebrow.letterSpacing,
    },
    input: {
      padding: Spacing.md,
      borderRadius: Gen.radius,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight), color: Colors.textPrimary,
      ...bodyFont,
    },

    estimateRow: { flexDirection: 'row', gap: 10 },
    stat: {
      flex: 1, padding: Spacing.md, borderRadius: Radius.card,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', gap: 4,
    },
    statValue: {
      fontSize: fs(Type.title.size), lineHeight: fs(Type.title.lineHeight), fontWeight: '800', color: Colors.textPrimary,
      ...displayFont,
    },
    statLabel: { fontSize: Type.eyebrow.size, color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },

    sideLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    renders: { gap: 10, marginTop: 8 },
    rendersTitle: {
      fontSize: fs(Type.title.size), lineHeight: fs(Type.title.lineHeight), fontWeight: '700', color: Colors.textPrimary,
      ...displayFont,
    },
    renderRow: {
      padding: Spacing.md, gap: 8,
      borderRadius: Radius.card,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
    },
    renderHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    renderDate: { fontSize: fs(Type.caption.size), color: Colors.textSecondary },
    renderPages: { fontSize: fs(Type.caption.size), color: Colors.textMuted, marginLeft: 'auto' },
    renderError: { fontSize: fs(Type.ui.size), color: Colors.error, lineHeight: fs(Type.ui.lineHeight + 1) },
    pill: {
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
      borderWidth: 1,
    },
    pillText: { fontSize: Type.eyebrow.size, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

    downloads: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  });
}
