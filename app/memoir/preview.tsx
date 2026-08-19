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
  View, Text, StyleSheet, ScrollView,
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
import { Spacing, Radius, Type, FontFamily } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

export default function MemoirPreviewScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);

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
  const title = project?.title?.trim() || 'Memoir';
  const dedication = project?.dedication?.trim() || '';

  const isEmpty = book.entryCount === 0 && book.photoCount === 0;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title="Read it through"
        showBack
        right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isEmpty ? (
          <View style={s.page}>
            <Text style={s.empty}>The book is empty so far.</Text>
            <Button
              title="Start writing"
              onPress={() => router.replace('/memoir')}
              style={s.emptyBtn}
              icon={<Ionicons name="create-outline" size={16} color={Colors.onPrimary} />}
            />
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
                <Eyebrow accentColor={Colors.primary} style={s.centered}>Contents</Eyebrow>
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
              <ChapterBlock key={chapter.key} chapter={chapter} scale={scale} />
            ))}

            <Text style={s.colophon}>
              {`${book.entryCount} ${book.entryCount === 1 ? 'entry' : 'entries'}`}
              {book.photoCount > 0
                ? ` · ${book.photoCount} ${book.photoCount === 1 ? 'photograph' : 'photographs'}`
                : ''}
              {` · about ${Math.max(1, Math.round(book.wordCount / 320))} printed pages`}
            </Text>

            <View style={s.closingLinks}>
              <Button
                title="Arrange the order"
                variant="outline"
                size="sm"
                onPress={() => router.push('/memoir/arrange')}
                icon={<Ionicons name="swap-vertical-outline" size={16} color={Colors.primary} />}
              />
              <Button
                title="Make the book"
                variant="outline"
                size="sm"
                onPress={() => router.replace('/memoir/book')}
                icon={<Ionicons name="book-outline" size={16} color={Colors.primary} />}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Chapter ──────────────────────────────────────────────────────────

function ChapterBlock({ chapter, scale }: { chapter: BookChapter; scale: number }) {
  const s = makeStyles(scale);
  return (
    <View style={s.chapter}>
      <Eyebrow style={s.centered}>Chapter</Eyebrow>
      <Text style={s.chapterTitle}>{chapter.title}</Text>
      <View style={s.chapterRule} />

      {chapter.entries.map((entry) => (
        <EntryBlock key={entry.id} entry={entry} scale={scale} />
      ))}

      {chapter.photos.map((photo) => (
        <PhotoPlate key={photo.id} asset={photo} scale={scale} />
      ))}
    </View>
  );
}

function EntryBlock({ entry, scale }: { entry: BookEntry; scale: number }) {
  const s = makeStyles(scale);
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
function PhotoPlate({ asset, scale }: { asset: MemoirAsset; scale: number }) {
  const s = makeStyles(scale);
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
          <ActivityIndicator color={Colors.primary} />
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
// The manuscript keeps its layout; only the palette, font, and corner
// route to the token engine. On the Boomer skin FontFamily is serif,
// so the letterpress reading voice returns there and only there.

function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120, paddingTop: Spacing.sm, gap: Spacing.lg },

    centered: { textAlign: 'center' },

    // The manuscript sits on the canvas now, no vellum card.
    page: { gap: Spacing.xl, marginTop: Spacing.xs },

    // ── Empty state ─────────────────────────────────────────────────
    empty: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', ...bodyFont,
    },
    emptyBtn: { alignSelf: 'center' },

    // ── Title page ──────────────────────────────────────────────────
    titlePage: { alignItems: 'center', gap: 18, paddingVertical: Spacing.xl },
    bookTitle: {
      fontSize: fs(Type.hero.size), lineHeight: fs(Type.hero.lineHeight), color: Colors.textPrimary,
      textAlign: 'center', fontWeight: '600', ...bodyFont,
    },
    titleRule: { width: 56, height: 2, backgroundColor: Colors.primary, borderRadius: 1 },
    byline: {
      fontSize: fs(Type.body.size), color: Colors.textSecondary, fontStyle: 'italic',
      textAlign: 'center', ...bodyFont,
    },
    dedication: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight), color: Colors.textMuted, fontStyle: 'italic',
      textAlign: 'center', marginTop: 12, maxWidth: 420, ...bodyFont,
    },

    // ── Table of contents ───────────────────────────────────────────
    toc: {
      gap: 10, paddingTop: 8, paddingBottom: 8,
      borderTopWidth: 1, borderTopColor: Colors.borderLight,
      borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    },
    tocRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    tocNum: { fontSize: fs(Type.ui.size), color: Colors.textMuted, width: 22, ...bodyFont },
    tocChapter: { fontSize: fs(Type.ui.size), color: Colors.textPrimary, ...bodyFont },
    tocDots: {
      flex: 1, height: 1, marginBottom: 4,
      borderBottomWidth: 1, borderBottomColor: Colors.border,
      borderStyle: 'dotted' as any,
    },
    tocCount: { fontSize: fs(Type.caption.size), color: Colors.textMuted, ...bodyFont },

    // ── Chapter ─────────────────────────────────────────────────────
    chapter: { gap: 14 },
    chapterTitle: {
      fontSize: fs(Type.display.size), lineHeight: fs(Type.display.lineHeight), color: Colors.textPrimary,
      textAlign: 'center', fontWeight: '600', ...bodyFont,
    },
    chapterRule: {
      width: 40, height: 2, backgroundColor: Colors.primary,
      borderRadius: 1, alignSelf: 'center', marginTop: 2,
    },

    // ── Entry ───────────────────────────────────────────────────────
    entry: { gap: 10, marginTop: 8 },
    entryQuestion: {
      fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 3), color: Colors.primary, fontStyle: 'italic',
      fontWeight: '600', ...bodyFont,
    },
    prose: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight + 4), color: Colors.textPrimary, ...bodyFont,
    },
    proseFirst: { marginTop: 0 },

    // ── Photo plate ─────────────────────────────────────────────────
    plate: { gap: 8, marginTop: 8, alignItems: 'center' },
    plateFrame: {
      width: '100%', aspectRatio: 1.4,
      backgroundColor: Colors.surface,
      borderRadius: Radius.sm, overflow: 'hidden',
      borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    plateImg: { width: '100%', height: '100%' },
    plateCaption: {
      fontSize: fs(Type.caption.size + 2), lineHeight: fs(Type.caption.lineHeight + 6), color: Colors.textSecondary, fontStyle: 'italic',
      textAlign: 'center', maxWidth: 460, ...bodyFont,
    },

    // ── Closing ─────────────────────────────────────────────────────
    colophon: {
      fontSize: fs(Type.caption.size), color: Colors.textMuted, textAlign: 'center',
      letterSpacing: 0.4, marginTop: 8, ...bodyFont,
    },
    closingLinks: {
      flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
      gap: 10, marginTop: 4,
    },
  });
}
