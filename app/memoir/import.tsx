/**
 * /memoir/import — seed the timeline from a document.
 *
 * Paste, or on web upload, a resume, a CV, a college transcript, or a
 * report card. useParseCv hands the plain text to /api/parse-cv, which
 * extracts a strict list of schools and jobs. Transcripts and report
 * cards arrive as school events with a factual detail line.
 *
 * REVIEW BEFORE WRITE. Nothing is saved on parse. The author sees every
 * extracted event, unchecks the ones they do not want, edits any field,
 * and only then confirms. Confirm calls useBulkCreateTimelineEvents and
 * the author lands on the timeline with the new events in place.
 *
 * The parser fails soft: it always answers, and a bad reply surfaces a
 * plain message instead of a crash.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useParseCv,
  type ParsedTimelineEvent,
  type TimelinePrecision,
} from '../../hooks/useCvImport';
import {
  useBulkCreateTimelineEvents,
  formatFuzzyDate,
  type NewTimelineEvent,
} from '../../hooks/useMemoirTimeline';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { showAlert } from '../../lib/alert';
import { docxToText } from '../../lib/docx-text';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, FontFamily } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { RailCard } from '../../components/shared/RailCard';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

// ── Kind glyphs (only school and job come from the parser) ──────────

const KIND: Record<'school' | 'job', { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  school: { label: 'School', icon: 'school-outline' },
  job: { label: 'Job', icon: 'briefcase-outline' },
};

// ── One editable review row, seeded from a parsed event ─────────────

interface ReviewRow {
  include: boolean;
  kind: 'school' | 'job';
  title: string;
  organization: string;
  role_or_grade: string;
  location: string;
  notes: string; // the parsed detail line
  // Dates pass through as parsed; the timeline owns full date editing.
  start_date: string | null;
  start_precision: TimelinePrecision;
  end_date: string | null;
  end_precision: TimelinePrecision | null;
  is_ongoing: boolean;
}

function toRow(e: ParsedTimelineEvent): ReviewRow {
  return {
    include: true,
    kind: e.kind,
    title: e.title,
    organization: e.organization ?? '',
    role_or_grade: e.role_or_grade ?? '',
    location: e.location ?? '',
    notes: e.notes ?? '',
    start_date: e.start_date,
    start_precision: e.start_precision,
    end_date: e.end_date,
    end_precision: e.end_precision,
    is_ongoing: e.is_ongoing,
  };
}

/** The date line for a row, at the precision the parser found. Undated
 *  rows read "Undated" and land at the foot of the spine. */
function dateLine(r: ReviewRow): string {
  const start = formatFuzzyDate(r.start_date, r.start_precision);
  if (!start) return 'Undated';
  if (r.is_ongoing) return `${start} – present`;
  const end = formatFuzzyDate(r.end_date, r.end_precision);
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}

/** Printable ratio of a text sample. A compressed PDF or a binary file
 *  reads low, so we nudge the author to paste the text instead of
 *  feeding the parser garbage. */
function readableRatio(s: string): number {
  const sample = s.slice(0, 4000);
  if (!sample) return 0;
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) printable++;
  }
  return printable / sample.length;
}

export default function MemoirImportScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);

  const parse = useParseCv();
  const bulk = useBulkCreateTimelineEvents();

  const [text, setText] = useState('');
  const [rows, setRows] = useState<ReviewRow[] | null>(null); // null = input phase

  const includedCount = (rows ?? []).filter((r) => r.include && r.title.trim()).length;

  // ── Input phase ───────────────────────────────────────────────────

  const onFindEvents = async () => {
    const t = text.trim();
    if (t.length < 20) {
      showAlert('Add more text', 'Paste the document, or upload it.');
      return;
    }
    try {
      const parsed = await parse.mutateAsync({ text: t });
      if (parsed.length === 0) {
        showAlert('Nothing found', 'No schools or jobs in that text. Check it and try again.');
        return;
      }
      setRows(parsed.map(toRow));
    } catch (e: any) {
      showAlert('Could not read it', e?.message ?? 'Try again.');
    }
  };

  const onPickFile = async (evt: any) => {
    const files: FileList | undefined = evt?.target?.files;
    const file = files?.[0];
    if (!file) return;
    try {
      // A .docx is a ZIP, so file.text() reads as noise and the ratio
      // check below would bounce it. lib/docx-text unzips the one entry
      // that matters in the browser; nothing leaves the device.
      const isDocx = /\.docx$/i.test(file.name)
        || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const t = isDocx ? await docxToText(await file.arrayBuffer()) : await file.text();
      if (!isDocx && readableRatio(t) < 0.85) {
        showAlert('Could not read the file', 'This file is not plain text. Paste its text instead.');
      } else if (!t.trim()) {
        showAlert('Could not read the file', 'Nothing readable inside. Paste its text instead.');
      } else {
        setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${t}` : t));
      }
    } catch (e: any) {
      showAlert('Could not read the file', e?.message ?? 'Paste its text instead.');
    }
    if (evt.target) evt.target.value = '';
  };

  // ── Review phase ──────────────────────────────────────────────────

  const patchRow = (i: number, patch: Partial<ReviewRow>) => {
    setRows((prev) => (prev ? prev.map((r, j) => (j === i ? { ...r, ...patch } : r)) : prev));
  };

  const onConfirm = async () => {
    const list = rows ?? [];
    const events: NewTimelineEvent[] = list
      .filter((r) => r.include && r.title.trim())
      .map((r) => ({
        kind: r.kind,
        title: r.title.trim(),
        organization: r.organization.trim() || null,
        role_or_grade: r.role_or_grade.trim() || null,
        location: r.location.trim() || null,
        start_date: r.start_date,
        start_precision: r.start_precision,
        end_date: r.end_date,
        end_precision: r.end_precision,
        is_ongoing: r.is_ongoing,
        notes: r.notes.trim() || null,
        source: 'cv_import',
      }));
    if (events.length === 0) {
      showAlert('Nothing to add', 'Check at least one event with a title.');
      return;
    }
    try {
      await bulk.mutateAsync(events);
      router.replace('/memoir/timeline');
    } catch (e: any) {
      showAlert('Could not add', e?.message ?? 'Try again.');
    }
  };

  const onStartOver = () => {
    setRows(null);
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title="Import"
        showBack
        onBack={() => router.back()}
        backLabel="Back"
        right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {rows === null ? (
          // ── Input ──────────────────────────────────────────────────
          <View style={s.inputPhase}>
            <Text style={s.lede}>Paste or upload a resume, CV, transcript, or report card.</Text>

            {Platform.OS === 'web' && (
              <View style={s.uploadRow}>
                <label style={({
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px',
                  border: `1px solid ${Colors.primary}`,
                  color: Colors.primary, borderRadius: Radius.control, cursor: 'pointer',
                  fontWeight: 700, fontSize: 14,
                } as any)} aria-label="Upload a file">
                  Upload a file
                  <input
                    type="file"
                    accept=".txt,.md,.text,.csv,.rtf,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={onPickFile}
                    style={({ display: 'none' } as any)}
                  />
                </label>
                <Text style={s.footnote}>Text, PDF, or Word (.docx). Scans need OCR.</Text>
              </View>
            )}

            <TextInput
              style={s.paste}
              value={text}
              onChangeText={setText}
              accessibilityLabel="Document text"
              placeholder="Paste the document text here"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={60000}
              textAlignVertical="top"
            />

            <View style={s.inputActions}>
              <Button
                title="Find events"
                onPress={onFindEvents}
                loading={parse.isPending}
                disabled={text.trim().length < 20}
                icon={<Ionicons name="search" size={16} color={Colors.onPrimary} />}
              />
              <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
            </View>
          </View>
        ) : (
          // ── Review ─────────────────────────────────────────────────
          <View style={s.reviewPhase}>
            <Eyebrow accentColor={Colors.primary}>
              {`${rows.length} found · ${includedCount} to add`}
            </Eyebrow>

            {rows.map((r, i) => (
              <RailCard key={i} accentColor={r.include ? Colors.primary : Colors.border}>
                <TouchableOpacity
                  style={s.rowHead}
                  onPress={() => patchRow(i, { include: !r.include })}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: r.include }}
                  accessibilityLabel={`${r.title || 'Untitled'}. ${r.include ? 'Included' : 'Skipped'}.`}
                >
                  <Ionicons
                    name={r.include ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={r.include ? Colors.primary : Colors.textMuted}
                  />
                  <View style={s.rowHeadText}>
                    <View style={s.rowKind}>
                      <Ionicons name={KIND[r.kind].icon} size={13} color={Colors.textSecondary} />
                      <Text style={s.rowKindLabel}>{KIND[r.kind].label}</Text>
                      <Text style={s.rowDate}>{dateLine(r)}</Text>
                    </View>
                    <Text style={s.rowTitle} numberOfLines={1}>{r.title || 'Untitled'}</Text>
                  </View>
                </TouchableOpacity>

                {r.include && (
                  <View style={s.rowFields}>
                    <Field label="Title" scale={scale}>
                      <TextInput
                        style={s.input}
                        value={r.title}
                        onChangeText={(v) => patchRow(i, { title: v })}
                        accessibilityLabel="Title"
                        placeholder="Title"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </Field>
                    <Field label="Detail" scale={scale}>
                      <TextInput
                        style={[s.input, s.inputMultiline]}
                        value={r.notes}
                        onChangeText={(v) => patchRow(i, { notes: v })}
                        accessibilityLabel="Detail"
                        placeholder="GPA, grades, honors, courses"
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        maxLength={4000}
                        textAlignVertical="top"
                      />
                    </Field>
                    <Field label="Organization" scale={scale}>
                      <TextInput
                        style={s.input}
                        value={r.organization}
                        onChangeText={(v) => patchRow(i, { organization: v })}
                        accessibilityLabel="Organization"
                        placeholder="Organization"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </Field>
                    <Field label="Role or grade" scale={scale}>
                      <TextInput
                        style={s.input}
                        value={r.role_or_grade}
                        onChangeText={(v) => patchRow(i, { role_or_grade: v })}
                        accessibilityLabel="Role or grade"
                        placeholder="Role or grade"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </Field>
                    <Field label="Location" scale={scale}>
                      <TextInput
                        style={s.input}
                        value={r.location}
                        onChangeText={(v) => patchRow(i, { location: v })}
                        accessibilityLabel="Location"
                        placeholder="Location"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </Field>
                  </View>
                )}
              </RailCard>
            ))}

            <View style={s.reviewActions}>
              <Button
                title={includedCount === 1 ? 'Add 1 event' : `Add ${includedCount} events`}
                onPress={onConfirm}
                loading={bulk.isPending}
                disabled={includedCount === 0}
                icon={<Ionicons name="add" size={16} color={Colors.onPrimary} />}
              />
              <Button title="Start over" variant="outline" onPress={onStartOver} />
              <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Small labeled field ─────────────────────────────────────────────

function Field({ label, scale, children }: { label: string; scale: number; children: React.ReactNode }) {
  const s = makeStyles(scale);
  return (
    <View style={s.field}>
      <Text style={s.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── Styles. One palette from the skin engine; scale drives read size. ─

function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};
  const displayFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120, paddingTop: Spacing.sm, gap: Spacing.md },

    // Input phase
    inputPhase: { gap: Spacing.md, marginTop: Spacing.xs },
    lede: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textPrimary, fontStyle: 'italic', ...bodyFont,
    },
    uploadRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    footnote: { fontSize: Type.eyebrow.size, color: Colors.textMuted, fontStyle: 'italic' },
    paste: {
      minHeight: 240, padding: Spacing.md,
      borderRadius: Radius.control, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textPrimary, ...bodyFont,
    },
    inputActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },

    // Review phase
    reviewPhase: { gap: Spacing.sm, marginTop: Spacing.xs },

    rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowHeadText: { flex: 1, gap: 2 },
    rowKind: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    rowKindLabel: {
      fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.textSecondary,
      letterSpacing: 0.8, textTransform: 'uppercase', ...displayFont,
    },
    rowDate: { fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4 },
    rowTitle: { fontSize: fs(Type.cardTitle.size), fontWeight: '600', color: Colors.textPrimary, ...bodyFont },

    rowFields: { gap: Spacing.sm, marginTop: Spacing.sm },

    field: { gap: 6 },
    formLabel: {
      fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.textMuted,
      letterSpacing: 1.2, textTransform: 'uppercase', ...displayFont,
    },
    input: {
      minHeight: 44, paddingHorizontal: 12, paddingVertical: 10,
      borderRadius: Radius.control, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: fs(Type.ui.size), color: Colors.textPrimary, ...bodyFont,
    },
    inputMultiline: { minHeight: 72 },

    reviewActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: Spacing.sm },
  });
}
