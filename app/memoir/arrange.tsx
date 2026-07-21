/**
 * /memoir/arrange — put the chapters in the order you want them read.
 *
 * The interview saves answers as they come, and the prompt library
 * guesses which chapter each one belongs to. This screen lets the
 * writer correct both: nudge an entry up or down within its chapter,
 * or move it to a different chapter entirely. The order here is the
 * order the printed book follows.
 *
 * Photographs are arranged on the Photographs screen; this screen is
 * for the written entries.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useEnsureMemoirProject,
  useMemoirResponses, useMemoirAssets,
  useUpdateMemoirResponse, useReorderMemoirResponses,
} from '../../hooks/useMemoir';
import {
  assembleBook, chapterChoices,
  type BookChapter, type BookEntry,
} from '../../lib/memoir-book';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function MemoirArrangeScreen() {
  const reading = useMemoirReadingMode();
  const { elder } = reading;
  const s = makeStyles(elder);
  const ic = elder
    ? { chrome: Colors.brandIvory, accent: '#8A5B1A', onAccent: '#FBF4DE' }
    : { chrome: Colors.textPrimary, accent: Colors.primary, onAccent: '#0A0A0F' };

  const { data: projectId } = useEnsureMemoirProject();
  const { data: responses } = useMemoirResponses(projectId);
  const { data: assets } = useMemoirAssets(projectId);
  const update = useUpdateMemoirResponse();
  const reorder = useReorderMemoirResponses();

  const book = useMemo(() => assembleBook(responses, assets), [responses, assets]);
  // Only chapters that actually hold written entries are arrangeable
  // here; photo-only chapters are managed on the Photographs screen.
  const chapters = book.chapters.filter((c) => c.entries.length > 0);

  const busy = update.isPending || reorder.isPending;

  // Move an entry up/down within its chapter by renumbering the chapter.
  const move = (chapter: BookChapter, id: string, dir: 'up' | 'down') => {
    if (!projectId || busy) return;
    const ids = chapter.entries.map((e) => e.id);
    const i = ids.indexOf(id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate(
      { projectId, orderedIds: ids },
      { onError: (e: any) => showAlert('Could not reorder', e?.message ?? 'Try again.') },
    );
  };

  // Move an entry into a different chapter, landing at the end of it.
  const moveToChapter = (id: string, key: string) => {
    if (!projectId || busy) return;
    const targetCount =
      book.chapters.find((c) => c.key === key)?.entries.length ?? 0;
    update.mutate(
      { id, projectId, patch: { chapter_assignment: key, ordering_hint: targetCount } },
      { onError: (e: any) => showAlert('Could not move', e?.message ?? 'Try again.') },
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={ic.chrome} />
          </TouchableOpacity>
          <Text style={s.kicker}>Arrange</Text>
          <View style={{ flex: 1 }} />
          {busy && <ActivityIndicator color={ic.accent} size="small" />}
          <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.page}>
          {chapters.length === 0 ? (
            <Text style={s.empty}>Nothing to arrange yet.</Text>
          ) : (
            chapters.map((chapter) => (
              <View key={chapter.key} style={s.chapterBlock}>
                <Text style={s.chapterTitle}>{chapter.title}</Text>
                {chapter.entries.map((entry, idx) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    isFirst={idx === 0}
                    isLast={idx === chapter.entries.length - 1}
                    currentKey={chapter.key}
                    disabled={busy}
                    elder={elder}
                    onUp={() => move(chapter, entry.id, 'up')}
                    onDown={() => move(chapter, entry.id, 'down')}
                    onMoveToChapter={(key) => moveToChapter(entry.id, key)}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Entry row ────────────────────────────────────────────────────────

function EntryRow({
  entry, isFirst, isLast, currentKey, disabled, elder,
  onUp, onDown, onMoveToChapter,
}: {
  entry: BookEntry;
  isFirst: boolean;
  isLast: boolean;
  currentKey: string;
  disabled: boolean;
  elder: boolean;
  onUp: () => void;
  onDown: () => void;
  onMoveToChapter: (key: string) => void;
}) {
  const s = makeStyles(elder);
  const accent = elder ? '#8A5B1A' : Colors.primary;
  const muted = elder ? '#8C7E60' : Colors.textMuted;
  const [menuOpen, setMenuOpen] = useState(false);

  // A short, readable label for the entry: its question if it has one,
  // otherwise the opening of the prose.
  const snippet =
    entry.question?.trim() ||
    entry.paragraphs[0] ||
    'Untitled entry';
  const trimmed = snippet.length > 110 ? `${snippet.slice(0, 110).trimEnd()}…` : snippet;

  const choices = chapterChoices().filter((c) => c.key !== currentKey);

  return (
    <View style={s.entryRow}>
      <View style={s.entryMain}>
        <Text style={s.entrySnippet} numberOfLines={2}>{trimmed}</Text>
        {!entry.question && (
          <Text style={s.entryMeta}>Free writing</Text>
        )}
      </View>

      {/* Up / down within the chapter */}
      <View style={s.arrows}>
        <TouchableOpacity
          onPress={onUp}
          disabled={isFirst || disabled}
          style={[s.arrowBtn, (isFirst || disabled) && s.arrowDisabled]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-up" size={18} color={isFirst ? muted : accent} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDown}
          disabled={isLast || disabled}
          style={[s.arrowBtn, (isLast || disabled) && s.arrowDisabled]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-down" size={18} color={isLast ? muted : accent} />
        </TouchableOpacity>
      </View>

      {/* Move to a different chapter */}
      <TouchableOpacity
        onPress={() => setMenuOpen((v) => !v)}
        disabled={disabled}
        style={s.moveBtn}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="swap-horizontal" size={16} color={accent} />
      </TouchableOpacity>

      {menuOpen && (
        <View style={s.menu}>
          <Text style={s.menuHeading}>Move to…</Text>
          <ScrollView style={s.menuScroll} nestedScrollEnabled>
            {choices.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={s.menuItem}
                onPress={() => { setMenuOpen(false); onMoveToChapter(c.key); }}
              >
                <Text style={s.menuItemText}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

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

    page: elder ? {
      marginTop: 24, padding: 32, borderRadius: 14,
      backgroundColor: pageCardBg, borderWidth: 1, borderColor: pageBorder,
      gap: Spacing.lg, ...pageCardWeb,
    } : { gap: Spacing.lg, marginTop: 8 },

    empty: {
      fontSize: 16, color: pageInkSecondary, fontStyle: 'italic',
      textAlign: 'center', marginTop: 16, ...serif,
    },

    chapterBlock: { gap: 8 },
    chapterTitle: {
      fontSize: 12, fontWeight: '700', color: pageAccent,
      letterSpacing: 1.8, textTransform: 'uppercase', marginTop: 8, ...display,
    },

    entryRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: Spacing.md,
      borderRadius: Radius.lg,
      backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
      // The chapter menu is positioned relative to this row.
      position: 'relative',
    },
    entryMain: { flex: 1, gap: 2 },
    entrySnippet: { fontSize: 15, lineHeight: 21, color: pageInk, ...serif },
    entryMeta: {
      fontSize: 11, color: pageInkMuted, letterSpacing: 0.6,
      textTransform: 'uppercase',
    },

    arrows: { flexDirection: 'column', gap: 2 },
    arrowBtn: {
      width: 30, height: 24, alignItems: 'center', justifyContent: 'center',
      borderRadius: 6, borderWidth: 1, borderColor: pageBorder,
    },
    arrowDisabled: { opacity: 0.4 },

    moveBtn: {
      width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
      borderRadius: Radius.full, borderWidth: 1, borderColor: pageAccent,
    },

    menu: {
      position: 'absolute', right: Spacing.md, top: '100%', zIndex: 20,
      marginTop: 4, width: 240,
      padding: 6, borderRadius: 10,
      backgroundColor: elder ? '#FFFCF1' : Colors.surfaceLight,
      borderWidth: 1, borderColor: pageBorder,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 12px 28px rgba(0,0,0,0.35)' } as any)
        : { elevation: 8 }),
    },
    menuHeading: {
      fontSize: 11, fontWeight: '700', color: pageInkMuted,
      letterSpacing: 1.2, textTransform: 'uppercase',
      paddingHorizontal: 8, paddingVertical: 6,
    },
    menuScroll: { maxHeight: 280 },
    menuItem: { paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6 },
    menuItemText: { fontSize: 14, color: pageInk, ...serif },
  });
}
