/**
 * /memoir/preview — read the book as it stands.
 *
 * This is the manuscript laid out the way it will print: a title page,
 * a table of contents, then each chapter with its entries (the prompt
 * question set as a small italic heading above the writer's prose) and
 * its photographs placed where the book puts them. The grouping comes
 * from lib/memoir-book.ts, which mirrors the render worker exactly — so
 * what you read here is what you'll hold.
 *
 * No editing here; this is the reading surface. Editing lives in the
 * interview (Past entries) and photos screens.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Image as RNImage, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useEnsureMemoirProject, useMemoirProject,
  useMemoirResponses, useMemoirAssets,
  getAssetDisplayUrl,
  type MemoirAsset,
} from '../../hooks/useMemoir';
import { assembleBook, type BookChapter, type BookEntry } from '../../lib/memoir-book';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function MemoirPreviewScreen() {
  const reading = useMemoirReadingMode();
  const { elder } = reading;
  const s = makeStyles(elder);
  const ic = elder
    ? { chrome: Colors.brandIvory, accent: '#8A5B1A' }
    : { chrome: Colors.textPrimary, accent: Colors.primary };

  const { data: projectId } = useEnsureMemoirProject();
  const { data: project } = useMemoirProject(projectId);
  const { data: responses } = useMemoirResponses(projectId);
  const { data: assets } = useMemoirAssets(projectId);
  const profile = useAuthStore((st) => st.profile);

  const book = useMemo(
    () => assembleBook(responses, assets),
    [responses, assets],
  );

  const authorName =
    profile?.display_name?.trim() ||
    (profile?.handle ? `@${profile.handle}` : 'Anonymous');
  const title = project?.title?.trim() || 'My Life, So Far';
  const dedication = project?.dedication?.trim() || '';

  const isEmpty = book.entryCount === 0 && book.photoCount === 0;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Chrome — back, label, reading-size toggle. */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={ic.chrome} />
          </TouchableOpacity>
          <Text style={s.kicker}>Read it through</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
          </TouchableOpacity>
        </View>

        {isEmpty ? (
          <View style={s.page}>
            <Text style={s.empty}>The book is empty so far.</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => router.replace('/memoir')}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={16} color={elder ? '#FBF4DE' : '#0A0A0F'} />
              <Text style={s.emptyBtnText}>Start writing</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.page}>
            {/* ── Title page ───────────────────────────────────────── */}
            <View style={s.titlePage}>
              <Text style={s.bookTitle}>{title}</Text>
              <View style={s.titleRule} />
              <Text style={s.byline}>by {authorName}</Text>
              {!!dedication && (
                <Text style={s.dedication}>{dedication}</Text>
              )}
            </View>

            {/* ── Table of contents ────────────────────────────────── */}
            {book.chapters.length > 1 && (
              <View style={s.toc}>
                <Text style={s.tocTitle}>Contents</Text>
                {book.chapters.map((c, i) => (
                  <View key={c.key} style={s.tocRow}>
                    <Text style={s.tocNum}>{romanish(i + 1)}</Text>
                    <Text style={s.tocChapter}>{c.title}</Text>
                    <View style={s.tocDots} />
                    <Text style={s.tocCount}>
                      {chapterMeta(c)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Chapters ─────────────────────────────────────────── */}
            {book.chapters.map((chapter) => (
              <ChapterBlock key={chapter.key} chapter={chapter} elder={elder} />
            ))}

            <Text style={s.colophon}>
              {`${book.entryCount} ${book.entryCount === 1 ? 'entry' : 'entries'}`}
              {book.photoCount > 0
                ? ` · ${book.photoCount} ${book.photoCount === 1 ? 'photograph' : 'photographs'}`
                : ''}
              {` · about ${Math.max(1, Math.round(book.wordCount / 320))} printed pages`}
            </Text>

            <View style={s.closingLinks}>
              <TouchableOpacity
                style={s.makeLink}
                onPress={() => router.push('/memoir/arrange')}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-vertical-outline" size={16} color={ic.accent} />
                <Text style={s.makeLinkText}>Arrange the order →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.makeLink}
                onPress={() => router.replace('/memoir/book')}
                activeOpacity={0.85}
              >
                <Ionicons name="book-outline" size={16} color={ic.accent} />
                <Text style={s.makeLinkText}>Make the book →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Chapter ──────────────────────────────────────────────────────────

function ChapterBlock({ chapter, elder }: { chapter: BookChapter; elder: boolean }) {
  const s = makeStyles(elder);
  return (
    <View style={s.chapter}>
      <Text style={s.chapterEyebrow}>Chapter</Text>
      <Text style={s.chapterTitle}>{chapter.title}</Text>
      <View style={s.chapterRule} />

      {chapter.entries.map((entry) => (
        <EntryBlock key={entry.id} entry={entry} elder={elder} />
      ))}

      {chapter.photos.map((photo) => (
        <PhotoPlate key={photo.id} asset={photo} elder={elder} />
      ))}
    </View>
  );
}

function EntryBlock({ entry, elder }: { entry: BookEntry; elder: boolean }) {
  const s = makeStyles(elder);
  return (
    <View style={s.entry}>
      {!!entry.question && <Text style={s.entryQuestion}>{entry.question}</Text>}
      {entry.paragraphs.map((p, i) => (
        <Text key={i} style={[s.prose, i === 0 && s.proseFirst]}>{p}</Text>
      ))}
    </View>
  );
}

// A photo as it sits on the page: framed image with the writer's
// caption set in italics beneath, like a plate in a printed book.
function PhotoPlate({ asset, elder }: { asset: MemoirAsset; elder: boolean }) {
  const s = makeStyles(elder);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAssetDisplayUrl(asset.storage_path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [asset.storage_path]);

  return (
    <View style={s.plate}>
      <View style={s.plateFrame}>
        {url ? (
          <RNImage source={{ uri: url }} style={s.plateImg} resizeMode="contain" />
        ) : (
          <ActivityIndicator color={elder ? '#8A5B1A' : Colors.primary} />
        )}
      </View>
      {!!asset.caption?.trim() && (
        <Text style={s.plateCaption}>{asset.caption.trim()}</Text>
      )}
    </View>
  );
}

// ── Small helpers ────────────────────────────────────────────────────

/** A light "numbered chapter" feel without forcing real roman numerals
 *  on a grandmother. We just show the arabic number; kept as a function
 *  so the styling hook is one place if we ever want true numerals. */
function romanish(n: number): string {
  return String(n);
}

function chapterMeta(c: BookChapter): string {
  const parts: string[] = [];
  if (c.entries.length) parts.push(`${c.entries.length}`);
  if (c.photos.length) parts.push(`${c.photos.length}📷`);
  return parts.join(' · ');
}

// ── Styles ───────────────────────────────────────────────────────────
//
// Same manuscript/vellum architecture as the interview and book pages:
// chrome rides the dark brand wallpaper; the book itself sits in a warm
// vellum page card with sepia ink and a faint ruled-line texture on web.

function makeStyles(elder: boolean) {
  const chromeSecondary = Colors.textSecondary;
  const chromeBorder = Colors.border;

  const pageCardBg = elder ? '#F2E8CC' : 'transparent';
  const pageInk = elder ? '#2A1F18' : Colors.textPrimary;
  const pageInkSecondary = elder ? '#5A4A38' : Colors.textSecondary;
  const pageInkMuted = elder ? '#8C7E60' : Colors.textMuted;
  const pageAccent = elder ? '#8A5B1A' : Colors.primary;
  const pageBorder = elder ? '#CFC0A0' : Colors.border;
  const pageSurface = elder ? '#FBF4DE' : Colors.surface;
  const onAccent = elder ? '#FBF4DE' : '#0A0A0F';

  const serif = Platform.OS === 'web'
    ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any)
    : {};
  const display = Platform.OS === 'web'
    ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any)
    : {};

  const pageCardWeb = (elder && Platform.OS === 'web') ? ({
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(95,70,40,0.07) 31px, rgba(95,70,40,0.07) 32px)',
    boxShadow:
      '0 24px 50px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(95,70,40,0.08)',
  } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.lg },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 2,
      textTransform: 'uppercase', ...display,
    },
    aaBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1, borderColor: chromeBorder,
    },
    aaText: { fontSize: 14, fontWeight: '700', color: chromeSecondary, letterSpacing: 0.4 },

    // The vellum page that holds the whole book.
    page: elder ? {
      marginTop: 24, padding: 40, borderRadius: 14,
      backgroundColor: pageCardBg, borderWidth: 1, borderColor: pageBorder,
      gap: Spacing.xl, ...pageCardWeb,
    } : { gap: Spacing.xl, marginTop: 8 },

    // ── Empty state ─────────────────────────────────────────────────
    empty: {
      fontSize: 18, lineHeight: 28, color: pageInkSecondary, fontStyle: 'italic',
      textAlign: 'center', ...serif,
    },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      alignSelf: 'center',
      paddingHorizontal: 22, paddingVertical: 12,
      borderRadius: Radius.full, backgroundColor: pageAccent,
    },
    emptyBtnText: { color: onAccent, fontSize: 14, fontWeight: '700' },

    // ── Title page ──────────────────────────────────────────────────
    titlePage: {
      alignItems: 'center', gap: 18,
      paddingVertical: elder ? 40 : 28,
    },
    bookTitle: {
      fontSize: 34, lineHeight: 42, color: pageInk,
      textAlign: 'center', fontWeight: '600', ...serif,
    },
    titleRule: { width: 56, height: 2, backgroundColor: pageAccent, borderRadius: 1 },
    byline: {
      fontSize: 17, color: pageInkSecondary, fontStyle: 'italic',
      textAlign: 'center', ...serif,
    },
    dedication: {
      fontSize: 16, lineHeight: 26, color: pageInkMuted, fontStyle: 'italic',
      textAlign: 'center', marginTop: 12, maxWidth: 420, ...serif,
    },

    // ── Table of contents ───────────────────────────────────────────
    toc: {
      gap: 10,
      paddingTop: 8, paddingBottom: 8,
      borderTopWidth: 1, borderTopColor: elder ? 'rgba(95,70,40,0.18)' : pageBorder,
      borderBottomWidth: 1, borderBottomColor: elder ? 'rgba(95,70,40,0.18)' : pageBorder,
    },
    tocTitle: {
      fontSize: 12, fontWeight: '700', color: pageAccent,
      letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', ...display,
    },
    tocRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    tocNum: {
      fontSize: 13, color: pageInkMuted, width: 22, ...serif,
    },
    tocChapter: { fontSize: 15, color: pageInk, ...serif },
    tocDots: {
      flex: 1, height: 1, marginBottom: 4,
      borderBottomWidth: 1, borderBottomColor: pageBorder,
      borderStyle: 'dotted' as any,
    },
    tocCount: { fontSize: 12, color: pageInkMuted, ...serif },

    // ── Chapter ─────────────────────────────────────────────────────
    chapter: { gap: 14 },
    chapterEyebrow: {
      fontSize: 11, fontWeight: '700', color: pageInkMuted,
      letterSpacing: 2.4, textTransform: 'uppercase', textAlign: 'center', ...display,
    },
    chapterTitle: {
      fontSize: 26, lineHeight: 34, color: pageInk,
      textAlign: 'center', fontWeight: '600', ...serif,
    },
    chapterRule: {
      width: 40, height: 2, backgroundColor: pageAccent,
      borderRadius: 1, alignSelf: 'center', marginTop: 2,
    },

    // ── Entry ───────────────────────────────────────────────────────
    entry: { gap: 10, marginTop: 8 },
    entryQuestion: {
      fontSize: 15, lineHeight: 22, color: pageAccent, fontStyle: 'italic',
      fontWeight: '600', ...serif,
    },
    prose: {
      fontSize: elder ? 18 : 17, lineHeight: elder ? 30 : 28, color: pageInk,
      ...serif,
    },
    proseFirst: { marginTop: 0 },

    // ── Photo plate ─────────────────────────────────────────────────
    plate: { gap: 8, marginTop: 8, alignItems: 'center' },
    plateFrame: {
      width: '100%', aspectRatio: 1.4,
      backgroundColor: elder ? '#EAE0C6' : Colors.surface,
      borderRadius: 8, overflow: 'hidden',
      borderWidth: 1, borderColor: pageBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    plateImg: { width: '100%', height: '100%' },
    plateCaption: {
      fontSize: 14, lineHeight: 22, color: pageInkSecondary, fontStyle: 'italic',
      textAlign: 'center', maxWidth: 460, ...serif,
    },

    // ── Closing ─────────────────────────────────────────────────────
    colophon: {
      fontSize: 13, color: pageInkMuted, textAlign: 'center',
      letterSpacing: 0.4, marginTop: 8, ...serif,
    },
    closingLinks: {
      flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
      gap: 10, marginTop: 4,
    },
    makeLink: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingHorizontal: 18, paddingVertical: 10,
      borderRadius: Radius.full, borderWidth: 1, borderColor: pageAccent,
    },
    makeLinkText: { fontSize: 14, fontWeight: '700', color: pageAccent },
  });
}
