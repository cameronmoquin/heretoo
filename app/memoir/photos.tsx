/**
 * /memoir/photos — manage the book's photos.
 *
 * Upload a photograph (or scan), write a caption in your own words,
 * and place it in a chapter. The render worker downloads each photo
 * and embeds it in the LaTeX at print time, so this is the page that
 * actually fills the book with images.
 *
 * Web-only file picker for v1. Phone camera capture (the spec's
 * jscanify edge-detection flow) is a future enhancement.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useEnsureMemoirProject,
  useMemoirAssets, useUploadMemoirAsset,
  useUpdateMemoirAsset, useDeleteMemoirAsset,
  getAssetDisplayUrl,
  type MemoirAsset,
} from '../../hooks/useMemoir';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, FontFamily } from '../../constants/design';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

const CHAPTERS: Array<{ key: string; label: string }> = [
  { key: 'before_me', label: 'Before Me' },
  { key: 'earliest_memories', label: 'Earliest Memories' },
  { key: 'childhood', label: 'Childhood' },
  { key: 'adolescence', label: 'Adolescence' },
  { key: 'young_adulthood', label: 'Young Adulthood' },
  { key: 'coming_into_yourself', label: 'Coming Into Yourself' },
  { key: 'building_a_life', label: 'Building a Life' },
  { key: 'middle', label: 'The Middle Years' },
  { key: 'older', label: 'Older' },
  { key: 'now', label: 'Now' },
  { key: 'photo_specific', label: 'Photographs' },
];

export default function MemoirPhotosScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);

  const { data: projectId } = useEnsureMemoirProject();
  const { data: assets } = useMemoirAssets(projectId);
  const upload = useUploadMemoirAsset();

  const onPickFiles = (evt: any) => {
    const files: FileList | undefined = evt?.target?.files;
    if (!projectId || !files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      upload.mutateAsync({ projectId, file })
        .catch((e) => showAlert('Could not upload', e?.message ?? 'Try again.'));
    });
    if (evt.target) evt.target.value = '';
  };

  // Group photos by chapter (unassigned first, then in chapter order).
  const byChapter = new Map<string | null, MemoirAsset[]>();
  for (const a of assets ?? []) {
    const k = a.chapter_assignment ?? null;
    if (!byChapter.has(k)) byChapter.set(k, []);
    byChapter.get(k)!.push(a);
  }
  const chapterKeysInOrder = [
    null,
    ...CHAPTERS.map((c) => c.key).filter((k) => byChapter.has(k)),
  ].filter((k) => byChapter.has(k));

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title="Photographs"
        showBack
        right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.page}>
          {/* Upload zone — web file picker. Phone camera capture flow lands later. */}
          {Platform.OS === 'web' ? (
            <View style={s.uploadZone}>
              <Ionicons name="cloud-upload-outline" size={24} color={Colors.primary} />
              <label style={({
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px',
                background: Colors.primary, color: Colors.onPrimary,
                borderRadius: Radius.control, cursor: 'pointer',
                fontWeight: 700, fontSize: 14,
              } as any)}>
                {upload.isPending ? 'Uploading…' : 'Choose photos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickFiles}
                  style={({ display: 'none' } as any)}
                />
              </label>
              <Text style={s.uploadFootnote}>JPG, PNG, HEIC.</Text>
            </View>
          ) : (
            <Text style={s.lede}>Upload from the desktop site to add photos.</Text>
          )}

          {/* Photo gallery, grouped by chapter */}
          {chapterKeysInOrder.length === 0 ? (
            <Text style={s.empty}>No photos yet.</Text>
          ) : (
            chapterKeysInOrder.map((key) => {
              const label = key === null
                ? 'Not yet placed'
                : (CHAPTERS.find((c) => c.key === key)?.label ?? 'Other');
              const list = byChapter.get(key) ?? [];
              return (
                <View key={String(key)} style={s.chapterBlock}>
                  <Eyebrow accentColor={Colors.primary}>{label}</Eyebrow>
                  <View style={s.grid}>
                    {list.map((a) => (
                      <PhotoCard key={a.id} asset={a} projectId={projectId!} scale={scale} />
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PhotoCard({
  asset, projectId, scale,
}: {
  asset: MemoirAsset; projectId: string; scale: number;
}) {
  const s = makeStyles(scale);
  const update = useUpdateMemoirAsset();
  const remove = useDeleteMemoirAsset();
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [url, setUrl] = useState<string | null>(null);
  const [chapterOpen, setChapterOpen] = useState(false);

  React.useEffect(() => {
    let alive = true;
    getAssetDisplayUrl(asset.storage_path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [asset.storage_path]);

  const saveCaption = () => {
    if (caption.trim() === (asset.caption ?? '').trim()) return;
    update.mutate({
      id: asset.id, projectId,
      patch: { caption: caption.trim() || null } as any,
    });
  };

  const setChapter = (key: string | null) => {
    setChapterOpen(false);
    update.mutate({
      id: asset.id, projectId,
      patch: { chapter_assignment: key } as any,
    });
  };

  const onDelete = async () => {
    await remove.mutateAsync({
      id: asset.id, projectId, storagePath: asset.storage_path,
    }).catch((e) => showAlert('Could not delete', e?.message ?? 'Try again.'));
  };

  const chapterLabel = asset.chapter_assignment
    ? CHAPTERS.find((c) => c.key === asset.chapter_assignment)?.label ?? 'Other'
    : 'Place in a chapter';

  return (
    <View style={s.photoCard}>
      <View style={s.photoFrame}>
        {url ? (
          <RNImage source={{ uri: url }} style={s.photoImg} resizeMode="cover" />
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}
      </View>
      <TextInput
        style={s.captionInput}
        value={caption}
        onChangeText={setCaption}
        onBlur={saveCaption}
        accessibilityLabel="Caption"
        placeholder="Caption"
        placeholderTextColor={Colors.textMuted}
        multiline
        maxLength={400}
      />
      <View style={s.cardRow}>
        <TouchableOpacity
          style={s.chapterBtn}
          onPress={() => setChapterOpen((v) => !v)}
          activeOpacity={0.85}
          accessibilityLabel="Place in a chapter"
        >
          <Ionicons name="bookmark-outline" size={12} color={Colors.primary} />
          <Text style={s.chapterBtnText}>{chapterLabel}</Text>
          <Ionicons name="chevron-down" size={12} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={s.delBtn} accessibilityLabel="Delete photo" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={14} color={Colors.error} />
        </TouchableOpacity>
      </View>
      {chapterOpen && (
        <View style={s.chapterMenu}>
          <TouchableOpacity style={s.chapterItem} onPress={() => setChapter(null)}>
            <Text style={s.chapterItemText}>Not yet placed</Text>
          </TouchableOpacity>
          {CHAPTERS.map((c) => (
            <TouchableOpacity key={c.key} style={s.chapterItem} onPress={() => setChapter(c.key)}>
              <Text style={[
                s.chapterItemText,
                asset.chapter_assignment === c.key && { color: Colors.primary, fontWeight: '700' },
              ]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 760, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.sm, gap: Spacing.lg },

    page: { gap: Spacing.lg, marginTop: Spacing.xs },

    lede: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight), color: Colors.textPrimary, fontStyle: 'italic',
      ...bodyFont,
    },

    uploadZone: {
      padding: Spacing.lg, gap: 10,
      borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.border,
      borderStyle: 'dashed' as any, alignItems: 'center',
      backgroundColor: Colors.surface,
    },
    uploadFootnote: { fontSize: Type.eyebrow.size, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center' },

    empty: {
      fontSize: fs(Type.body.size), color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 24,
      ...bodyFont,
    },

    chapterBlock: { gap: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

    photoCard: {
      width: 220, gap: 6, padding: 10,
      borderRadius: Radius.card, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
    },
    photoFrame: {
      width: '100%', aspectRatio: 1.2,
      backgroundColor: Colors.surfaceLight, borderRadius: Radius.xs, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
    },
    photoImg: { width: '100%', height: '100%' },
    captionInput: {
      minHeight: 44, padding: 8,
      fontSize: fs(Type.caption.size + 1), lineHeight: fs(Type.caption.lineHeight + 4), color: Colors.textPrimary,
      borderRadius: Radius.xs, backgroundColor: Colors.background,
      borderWidth: 1, borderColor: Colors.border,
      ...bodyFont,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chapterBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 6,
      borderRadius: Radius.control,
      borderWidth: 1, borderColor: Colors.primary,
      flex: 1,
    },
    chapterBtnText: { fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.primary, flex: 1 },
    delBtn: { padding: 6 },

    chapterMenu: {
      padding: 6, borderRadius: Radius.sm,
      backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
      maxHeight: 240,
    },
    chapterItem: { paddingVertical: 6, paddingHorizontal: 8 },
    chapterItemText: { fontSize: fs(Type.caption.size + 1), color: Colors.textPrimary, ...bodyFont },
  });
}
