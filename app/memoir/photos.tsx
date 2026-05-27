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
import { router } from 'expo-router';
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
import { Spacing, Radius } from '../../constants/design';

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
  const { elder } = reading;
  const s = makeStyles(elder);
  const ic = elder
    ? { chrome: Colors.brandIvory, page: '#2A1F18', accent: '#8A5B1A', onAccent: '#FBF4DE' }
    : { chrome: Colors.textPrimary, page: Colors.textPrimary, accent: Colors.primary, onAccent: '#0A0A0F' };

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
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={ic.chrome} />
          </TouchableOpacity>
          <Text style={s.kicker}>Photographs</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.page}>
          <Text style={s.lede}>
            Add the photos you want in the book. A caption in your own words,
            placed in the chapter where the story belongs. The book picks them
            up when you print.
          </Text>

          {/* Upload zone — web file picker. Phone camera capture flow lands later. */}
          {Platform.OS === 'web' ? (
            <View style={s.uploadZone}>
              <Ionicons name="cloud-upload-outline" size={24} color={ic.accent} />
              <Text style={s.uploadHint}>
                Drop a photo, or
              </Text>
              <label style={({
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px',
                background: ic.accent, color: ic.onAccent,
                borderRadius: 999, cursor: 'pointer',
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
              <Text style={s.uploadFootnote}>
                JPG, PNG, HEIC. We&apos;ll preserve the original at full resolution.
              </Text>
            </View>
          ) : (
            <Text style={s.lede}>Upload from the desktop site to add photos.</Text>
          )}

          {/* Photo gallery, grouped by chapter */}
          {chapterKeysInOrder.length === 0 ? (
            <Text style={s.empty}>No photos yet. The first one goes here.</Text>
          ) : (
            chapterKeysInOrder.map((key) => {
              const label = key === null
                ? 'Not yet placed'
                : (CHAPTERS.find((c) => c.key === key)?.label ?? 'Other');
              const list = byChapter.get(key) ?? [];
              return (
                <View key={String(key)} style={s.chapterBlock}>
                  <Text style={s.chapterTitle}>{label}</Text>
                  <View style={s.grid}>
                    {list.map((a) => (
                      <PhotoCard key={a.id} asset={a} projectId={projectId!} elder={elder} ic={ic} />
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
  asset, projectId, elder, ic,
}: {
  asset: MemoirAsset; projectId: string; elder: boolean;
  ic: { chrome: string; page: string; accent: string; onAccent: string };
}) {
  const s = makeStyles(elder);
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
          <ActivityIndicator color={ic.accent} />
        )}
      </View>
      <TextInput
        style={s.captionInput}
        value={caption}
        onChangeText={setCaption}
        onBlur={saveCaption}
        placeholder="A caption in your own words"
        placeholderTextColor={elder ? '#9A9684' : Colors.textMuted}
        multiline
        maxLength={400}
      />
      <View style={s.cardRow}>
        <TouchableOpacity
          style={s.chapterBtn}
          onPress={() => setChapterOpen((v) => !v)}
          activeOpacity={0.85}
        >
          <Ionicons name="bookmark-outline" size={12} color={ic.accent} />
          <Text style={s.chapterBtnText}>{chapterLabel}</Text>
          <Ionicons name="chevron-down" size={12} color={ic.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={s.delBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={14} color={elder ? '#9C3D2C' : '#C2604F'} />
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
                asset.chapter_assignment === c.key && { color: ic.accent, fontWeight: '700' },
              ]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(elder: boolean) {
  const chromeText = Colors.brandIvory;
  const chromeMuted = Colors.textMuted;
  const chromeBorder = Colors.border;
  const chromeSecondary = Colors.textSecondary;

  const pageCardBg = elder ? '#F2E8CC' : 'transparent';
  const pageInk = elder ? '#2A1F18' : Colors.textPrimary;
  const pageInkSecondary = elder ? '#5A4A38' : Colors.textSecondary;
  const pageInkMuted = elder ? '#8C7E60' : Colors.textMuted;
  const pageAccent = elder ? '#8A5B1A' : Colors.primary;
  const pageBorder = elder ? '#CFC0A0' : Colors.border;
  const pageSurface = elder ? '#FBF4DE' : Colors.surface;

  const pageCardWeb = (elder && Platform.OS === 'web') ? ({
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(95,70,40,0.07) 31px, rgba(95,70,40,0.07) 32px)',
    boxShadow:
      '0 24px 50px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(95,70,40,0.08)',
  } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 760, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 2,
      textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    aaBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1, borderColor: chromeBorder,
    },
    aaText: { fontSize: 14, fontWeight: '700', color: chromeSecondary },

    page: elder ? {
      marginTop: 24, padding: 32, borderRadius: 14,
      backgroundColor: pageCardBg, borderWidth: 1, borderColor: pageBorder,
      gap: Spacing.lg, ...pageCardWeb,
    } : { gap: Spacing.lg, marginTop: 8 },

    lede: {
      fontSize: 17, lineHeight: 28, color: pageInk, fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    uploadZone: {
      padding: Spacing.lg, gap: 10,
      borderRadius: Radius.lg, borderWidth: 1, borderColor: pageBorder,
      borderStyle: 'dashed' as any, alignItems: 'center',
      backgroundColor: pageSurface,
    },
    uploadHint: { fontSize: 14, color: pageInkSecondary, fontStyle: 'italic' },
    uploadFootnote: { fontSize: 11, color: pageInkMuted, fontStyle: 'italic', textAlign: 'center' },

    empty: {
      fontSize: 16, color: pageInkSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: 24,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    chapterBlock: { gap: 10 },
    chapterTitle: {
      fontSize: 12, fontWeight: '700', color: pageAccent,
      letterSpacing: 1.8, textTransform: 'uppercase', marginTop: 8,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

    photoCard: {
      width: 220, gap: 6, padding: 10,
      borderRadius: 10, backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
    },
    photoFrame: {
      width: '100%', aspectRatio: 1.2,
      backgroundColor: '#EAE0C6', borderRadius: 6, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
    },
    photoImg: { width: '100%', height: '100%' },
    captionInput: {
      minHeight: 44, padding: 8,
      fontSize: 13, lineHeight: 20, color: pageInk,
      borderRadius: 6, backgroundColor: '#FFFCF1',
      borderWidth: 1, borderColor: pageBorder,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chapterBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: pageAccent,
      flex: 1,
    },
    chapterBtnText: { fontSize: 11, fontWeight: '700', color: pageAccent, flex: 1 },
    delBtn: { padding: 6 },

    chapterMenu: {
      padding: 6, borderRadius: 8,
      backgroundColor: '#FFFCF1', borderWidth: 1, borderColor: pageBorder,
      maxHeight: 240,
    },
    chapterItem: { paddingVertical: 6, paddingHorizontal: 8 },
    chapterItemText: { fontSize: 13, color: pageInk },
  });
}
