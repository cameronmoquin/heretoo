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
  useDeleteMemoirResponse,
} from '../../hooks/useMemoir';
import {
  assembleBook, chapterChoices,
  type BookChapter, type BookEntry,
} from '../../lib/memoir-book';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, FontFamily } from '../../constants/design';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

export default function MemoirArrangeScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);

  const { data: projectId } = useEnsureMemoirProject();
  const { data: responses } = useMemoirResponses(projectId);
  const { data: assets } = useMemoirAssets(projectId);
  const update = useUpdateMemoirResponse();
  const reorder = useReorderMemoirResponses();
  const del = useDeleteMemoirResponse();

  const book = useMemo(() => assembleBook(responses, assets), [responses, assets]);
  // Only chapters that actually hold written entries are arrangeable
  // here; photo-only chapters are managed on the Photographs screen.
  const chapters = book.chapters.filter((c) => c.entries.length > 0);

  const busy = update.isPending || reorder.isPending || del.isPending;

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

  // Remove an entry entirely, after a warning. Optimistic in the hook.
  const removeEntry = (id: string) => {
    if (!projectId) return;
    showConfirm(
      'Delete this entry?',
      'This cannot be undone.',
      () => {
        del.mutate(
          { id, projectId },
          { onError: (e: any) => showAlert('Could not delete', e?.message ?? 'Try again.') },
        );
      },
      'Delete',
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title="Arrange"
        showBack
        right={(
          <>
            {busy && <ActivityIndicator color={Colors.primary} size="small" />}
            <ReadingSizeAction large={large} onToggle={reading.toggle} />
          </>
        )}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.page}>
          {chapters.length === 0 ? (
            <Text style={s.empty}>Nothing to arrange yet.</Text>
          ) : (
            chapters.map((chapter) => (
              <View key={chapter.key} style={s.chapterBlock}>
                <Eyebrow accentColor={Colors.primary}>{chapter.title}</Eyebrow>
                {chapter.entries.map((entry, idx) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    isFirst={idx === 0}
                    isLast={idx === chapter.entries.length - 1}
                    currentKey={chapter.key}
                    disabled={busy}
                    scale={scale}
                    onUp={() => move(chapter, entry.id, 'up')}
                    onDown={() => move(chapter, entry.id, 'down')}
                    onMoveToChapter={(key) => moveToChapter(entry.id, key)}
                    onDelete={() => removeEntry(entry.id)}
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
  entry, isFirst, isLast, currentKey, disabled, scale,
  onUp, onDown, onMoveToChapter, onDelete,
}: {
  entry: BookEntry;
  isFirst: boolean;
  isLast: boolean;
  currentKey: string;
  disabled: boolean;
  scale: number;
  onUp: () => void;
  onDown: () => void;
  onMoveToChapter: (key: string) => void;
  onDelete: () => void;
}) {
  const s = makeStyles(scale);
  const accent = Colors.primary;
  const muted = Colors.textMuted;
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
          accessibilityLabel="Move entry up"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-up" size={18} color={isFirst ? muted : accent} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDown}
          disabled={isLast || disabled}
          style={[s.arrowBtn, (isLast || disabled) && s.arrowDisabled]}
          accessibilityLabel="Move entry down"
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
        accessibilityLabel="Move entry to another chapter"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="swap-horizontal" size={16} color={accent} />
      </TouchableOpacity>

      {/* Delete the entry */}
      <TouchableOpacity
        onPress={onDelete}
        disabled={disabled}
        style={s.deleteBtn}
        accessibilityLabel="Delete this entry"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="trash-outline" size={16} color={muted} />
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

function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120, paddingTop: Spacing.sm, gap: Spacing.lg },

    page: { gap: Spacing.lg, marginTop: Spacing.xs },

    empty: {
      fontSize: fs(Type.body.size), color: Colors.textSecondary, fontStyle: 'italic',
      textAlign: 'center', marginTop: 16, ...bodyFont,
    },

    chapterBlock: { gap: Spacing.xs },

    entryRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: Spacing.md,
      borderRadius: Radius.card,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      // The chapter menu is positioned relative to this row.
      position: 'relative',
    },
    entryMain: { flex: 1, gap: 2 },
    entrySnippet: { fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 2), color: Colors.textPrimary, ...bodyFont },
    entryMeta: {
      fontSize: Type.eyebrow.size, color: Colors.textMuted, letterSpacing: 0.6,
      textTransform: 'uppercase',
    },

    arrows: { flexDirection: 'column', gap: 2 },
    arrowBtn: {
      width: 30, height: 24, alignItems: 'center', justifyContent: 'center',
      borderRadius: Radius.xs, borderWidth: 1, borderColor: Colors.border,
    },
    arrowDisabled: { opacity: 0.4 },

    moveBtn: {
      width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
      borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.primary,
    },

    deleteBtn: {
      width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
      borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.border,
    },

    menu: {
      position: 'absolute', right: Spacing.md, top: '100%', zIndex: 20,
      marginTop: 4, width: 240,
      padding: 6, borderRadius: Radius.sm,
      backgroundColor: Colors.surfaceLight,
      borderWidth: 1, borderColor: Colors.border,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 12px 28px rgba(0,0,0,0.35)' } as any)
        : { elevation: 8 }),
    },
    menuHeading: {
      fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.textMuted,
      letterSpacing: 1.2, textTransform: 'uppercase',
      paddingHorizontal: 8, paddingVertical: 6,
    },
    menuScroll: { maxHeight: 280 },
    menuItem: { paddingVertical: 9, paddingHorizontal: 8, borderRadius: Radius.xs },
    menuItemText: { fontSize: fs(Type.ui.size), color: Colors.textPrimary, ...bodyFont },
  });
}
