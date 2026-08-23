/**
 * /memoir/timeline. The navigable spine.
 *
 * A vertical, chronological run of life events beside the prompt
 * interview. Schools K-12 and college, jobs, homes, milestones,
 * relationships, travel, births, and custom rows. Each event can pull
 * interview prompts to answer and gather dated photos.
 *
 * DATA LAYER (hooks/useMemoirTimeline.ts). This screen calls:
 *
 *   useTimelineEvents(projectId) -> UseQueryResult<TimelineEvent[]>
 *   useCreateTimelineEvent()     -> mutation, input: NewTimelineEvent
 *        (project_id and author_id are filled by the hook)
 *   useUpdateTimelineEvent()     -> mutation, input:
 *        { id, projectId, patch: TimelineEventPatch }
 *   useDeleteTimelineEvent()     -> mutation, input: { id, projectId }
 *   useEventResponses(eventId)   -> UseQueryResult<MemoirResponse[]>
 *   usePhotosForEvent(eventId)   -> UseQueryResult<MemoirAsset[]>
 *   useSetAssetTimeline()        -> mutation, input:
 *        { id, projectId, patch: AssetTimelinePatch }
 *   type TimelineEvent           -> the memoir_timeline_events row
 *   formatFuzzyDate(dateStr, precision) -> string
 *   formatRange(event)                  -> string
 *
 * The link back from an answer to its event: useSaveMemoirResponse (in
 * useMemoir.ts) does NOT accept a timeline_event_id today, and that hook
 * is off-limits. So we save the response, then patch its
 * timeline_event_id with useUpdateMemoirResponse. See onSaveAnswer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, Modal, Switch, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useTimelineEvents,
  useCreateTimelineEvent,
  useUpdateTimelineEvent,
  useDeleteTimelineEvent,
  useEventResponses,
  usePhotosForEvent,
  useSetAssetTimeline,
  useTimelinePrompts,
  formatFuzzyDate,
  formatRange,
  type TimelineEvent,
} from '../../hooks/useMemoirTimeline';
import {
  useEnsureMemoirProject,
  useStartMemoirSession,
  useEndMemoirSession,
  useSaveMemoirResponse,
  useUpdateMemoirResponse,
  useUploadMemoirAsset,
  getAssetDisplayUrl,
  type MemoirResponse,
  type MemoirAsset,
} from '../../hooks/useMemoir';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, FontFamily } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

// ── Vocabulary of the spine ─────────────────────────────────────────

type Kind = TimelineEvent['kind'];
type Precision = 'year' | 'month' | 'day';

// Baby moved to its own room (/babybook). The DB kind stays a valid enum
// value; the memoir spine no longer offers it.
type SpineKind = Exclude<Kind, 'baby'>;

const KIND_META: Record<SpineKind, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  birth:        { label: 'Born',         icon: 'star-outline' },
  school:       { label: 'School',       icon: 'school-outline' },
  job:          { label: 'Job',          icon: 'briefcase-outline' },
  residence:    { label: 'Home',         icon: 'home-outline' },
  milestone:    { label: 'Milestone',    icon: 'flag-outline' },
  relationship: { label: 'Relationship', icon: 'heart-outline' },
  travel:       { label: 'Travel',       icon: 'airplane-outline' },
  custom:       { label: 'Custom',       icon: 'ellipse-outline' },
};
const KIND_ORDER: SpineKind[] = ['school', 'job', 'residence', 'milestone', 'relationship', 'travel', 'custom'];

/** Meta for any stored kind. A legacy 'baby' row (none exist in
 *  production) falls back to the custom marker rather than crashing. */
function kindMeta(kind: Kind): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  return KIND_META[kind as SpineKind] ?? { label: 'Custom', icon: 'ellipse-outline' };
}

// K-12 grade labels for the school quick-add.
const GRADES = [
  'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
];
const SEED_RANGES: Record<string, [number, number]> = {
  'K-5': [0, 5], '6-8': [6, 8], '9-12': [9, 12], 'K-12': [0, 12],
};

// ── Date part helpers ───────────────────────────────────────────────

interface DateParts { y: string; m: string; d: string; precision: Precision }

function emptyParts(): DateParts { return { y: '', m: '', d: '', precision: 'year' }; }

/** Compose a real 'YYYY-MM-DD' from the parts the author actually knows,
 *  padding the unknown tail. Null when no year. */
function composeDate(dp: DateParts): string | null {
  if (!dp.y.trim()) return null;
  const yy = dp.y.trim().padStart(4, '0').slice(0, 4);
  if (dp.precision === 'year') return `${yy}-01-01`;
  const mm = (dp.m.trim() || '1').padStart(2, '0').slice(0, 2);
  if (dp.precision === 'month') return `${yy}-${mm}-01`;
  const dd = (dp.d.trim() || '1').padStart(2, '0').slice(0, 2);
  return `${yy}-${mm}-${dd}`;
}

/** Break a stored date string back into editable parts. */
function partsOf(dateStr: string | null, precision: Precision | null): DateParts {
  if (!dateStr) return { ...emptyParts(), precision: precision ?? 'year' };
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return { y: y ?? '', m: m ?? '', d: d ?? '', precision: precision ?? 'year' };
}

// ════════════════════════════════════════════════════════════════════
// Screen
// ════════════════════════════════════════════════════════════════════

export default function MemoirTimelineScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);
  // A rail dot lands here focused on its event: that card arrives
  // expanded, with its entries readable, and the page scrolls to it.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const focusId = typeof focus === 'string' ? focus : null;
  const scrollRef = useRef<ScrollView | null>(null);
  const focusY = useRef<number | null>(null);

  const { data: projectId } = useEnsureMemoirProject();
  const eventsQ = useTimelineEvents(projectId);
  const createEvent = useCreateTimelineEvent();
  const updateEvent = useUpdateTimelineEvent();
  const deleteEvent = useDeleteTimelineEvent();

  // One session covers the visit; started lazily the first time the
  // author answers a prompt from any event.
  const startSession = useStartMemoirSession();
  const endSession = useEndMemoirSession();
  const sessionIdRef = useRef<string | null>(null);
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (!projectId) return null;
    try {
      const id = await startSession.mutateAsync({ projectId, guidanceMode: 'socratic' });
      sessionIdRef.current = id;
      return id;
    } catch {
      return null;
    }
  }, [projectId, startSession]);

  const onBack = useCallback(async () => {
    if (sessionIdRef.current) {
      try {
        await endSession.mutateAsync({ sessionId: sessionIdRef.current, summary: '', nextHint: '' });
      } catch {}
    }
    router.back();
  }, [endSession]);

  // Sort: dated ascending, undated grouped at the end.
  const { dated, undated } = useMemo(() => {
    const list = eventsQ.data ?? [];
    const withDate = list.filter((e) => !!e.start_date);
    const noDate = list.filter((e) => !e.start_date);
    withDate.sort((a, b) => {
      const da = a.start_date ?? '';
      const db = b.start_date ?? '';
      if (da < db) return -1;
      if (da > db) return 1;
      return (a.ordering ?? 0) - (b.ordering ?? 0);
    });
    noDate.sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0) || (a.created_at < b.created_at ? -1 : 1));
    return { dated: withDate, undated: noDate };
  }, [eventsQ.data]);

  // ── Add / edit form state ─────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TimelineEvent | null>(null);
  const [kind, setKind] = useState<Kind>('custom');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [start, setStart] = useState<DateParts>(emptyParts());
  const [end, setEnd] = useState<DateParts>(emptyParts());
  const [ongoing, setOngoing] = useState(false);
  const [notes, setNotes] = useState('');

  const openAdd = (preset?: Kind) => {
    setEditing(null);
    setKind(preset ?? 'custom');
    setTitle(''); setOrganization(''); setRole(''); setLocation('');
    setStart(emptyParts()); setEnd(emptyParts());
    setOngoing(false); setNotes('');
    setFormOpen(true);
  };

  const openEdit = (e: TimelineEvent) => {
    setEditing(e);
    setKind(e.kind);
    setTitle(e.title ?? '');
    setOrganization(e.organization ?? '');
    setRole(e.role_or_grade ?? '');
    setLocation(e.location ?? '');
    setStart(partsOf(e.start_date, e.start_precision));
    setEnd(partsOf(e.end_date, e.end_precision ?? 'year'));
    setOngoing(!!e.is_ongoing);
    setNotes(e.notes ?? '');
    setFormOpen(true);
  };

  const onSaveEvent = async () => {
    if (!projectId) return;
    const t = title.trim();
    if (!t) {
      showAlert('Add a title', 'Every event needs a title.');
      return;
    }
    const endDate = ongoing ? null : composeDate(end);
    const patch = {
      kind,
      title: t,
      organization: organization.trim() || null,
      role_or_grade: role.trim() || null,
      location: location.trim() || null,
      start_date: composeDate(start),
      start_precision: start.precision,
      end_date: endDate,
      end_precision: endDate ? end.precision : null,
      is_ongoing: ongoing,
      notes: notes.trim() || null,
    };
    try {
      if (editing) {
        await updateEvent.mutateAsync({ id: editing.id, projectId, patch });
      } else {
        // The create hook fills project_id and author_id itself.
        await createEvent.mutateAsync(patch);
      }
      await eventsQ.refetch();
      setFormOpen(false);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  const onDeleteEvent = (e: TimelineEvent) => {
    if (!projectId) return;
    showConfirm(
      'Delete this event?',
      'The event goes. Its photos and answers stay.',
      async () => {
        try {
          await deleteEvent.mutateAsync({ id: e.id, projectId });
          await eventsQ.refetch();
          if (editing?.id === e.id) setFormOpen(false);
        } catch (err: any) {
          showAlert('Could not delete', err?.message ?? 'Try again.');
        }
      },
      'Delete',
    );
  };

  // ── School quick-add (seed a run of grades) ───────────────────────
  const [seedOpen, setSeedOpen] = useState(false);
  const [seedSchool, setSeedSchool] = useState('');
  const [seedYear, setSeedYear] = useState('');
  const [seedRange, setSeedRange] = useState<keyof typeof SEED_RANGES>('K-12');
  const [seeding, setSeeding] = useState(false);

  const onSeedGrades = async () => {
    if (!projectId) return;
    const name = seedSchool.trim();
    const y0 = parseInt(seedYear.trim(), 10);
    if (!name || !Number.isFinite(y0)) {
      showAlert('Fill both fields', 'A school name and a start year are needed.');
      return;
    }
    const [lo, hi] = SEED_RANGES[seedRange];
    setSeeding(true);
    try {
      for (let i = lo; i <= hi; i++) {
        const year = y0 + (i - lo);
        await createEvent.mutateAsync({
          kind: 'school',
          title: GRADES[i],
          organization: name,
          role_or_grade: GRADES[i],
          location: null,
          start_date: `${year}-09-01`,
          start_precision: 'year',
          end_date: `${year + 1}-06-01`,
          end_precision: 'year',
          is_ongoing: false,
          notes: null,
        });
      }
      await eventsQ.refetch();
      setSeedOpen(false);
      setSeedSchool(''); setSeedYear('');
    } catch (e: any) {
      showAlert('Could not seed', e?.message ?? 'Try again.');
    } finally {
      setSeeding(false);
    }
  };

  const hasEvents = dated.length + undated.length > 0;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title="Timeline"
        showBack
        onBack={onBack}
        backLabel="Back"
        right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
      />
      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Add affordances. Import lives HERE now — everything that
            feeds the spine is inside the room the spine lives in. */}
        <View style={s.addRow}>
          <Button
            title="Add event"
            variant="outline"
            size="sm"
            onPress={() => openAdd()}
            icon={<Ionicons name="add" size={16} color={Colors.primary} />}
          />
          {/* The first vertebra, offered until it exists. A life gets
              one birth, so the generic kind picker never lists it —
              this button is its only door, and it disappears once the
              event is on the spine. */}
          {!(eventsQ.data ?? []).some((e) => e.kind === 'birth') && (
            <Button
              title="Born"
              variant="outline"
              size="sm"
              onPress={() => { openAdd('birth' as Kind); setTitle('Born'); }}
              icon={<Ionicons name="star-outline" size={14} color={Colors.primary} />}
            />
          )}
          <Button
            title="Import"
            variant="outline"
            size="sm"
            onPress={() => router.push('/memoir/import')}
            icon={<Ionicons name="document-attach-outline" size={14} color={Colors.primary} />}
          />
          <Button
            title="Seed school years"
            variant="outline"
            size="sm"
            onPress={() => setSeedOpen(true)}
            icon={<Ionicons name="school-outline" size={14} color={Colors.primary} />}
          />
        </View>

        {/* Spine */}
        {hasEvents && (
          <View style={s.spine}>
            {dated.map((e, i) => (
              <EventCard
                key={e.id}
                event={e}
                projectId={projectId ?? null}
                scale={scale}
                first={i === 0}
                last={i === dated.length - 1 && undated.length === 0}
                ensureSession={ensureSession}
                onEdit={openEdit}
                onDelete={onDeleteEvent}
                focused={e.id === focusId}
                onLayoutY={(y) => {
                  if (e.id !== focusId || focusY.current !== null) return;
                  focusY.current = y;
                  scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
                }}
              />
            ))}

            {undated.length > 0 && (
              <View style={s.undatedDivider}>
                <Eyebrow>Undated</Eyebrow>
              </View>
            )}
            {undated.map((e, i) => (
              <EventCard
                key={e.id}
                event={e}
                projectId={projectId ?? null}
                scale={scale}
                first={dated.length === 0 && i === 0}
                last={i === undated.length - 1}
                ensureSession={ensureSession}
                onEdit={openEdit}
                onDelete={onDeleteEvent}
                focused={e.id === focusId}
                onLayoutY={(y) => {
                  if (e.id !== focusId || focusY.current !== null) return;
                  focusY.current = y;
                  scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add / edit form */}
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>{editing ? 'Edit event' : 'New event'}</Text>
                <TouchableOpacity onPress={() => setFormOpen(false)} accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Kind */}
              <View style={s.kindWrap}>
                {KIND_ORDER.map((k) => {
                  const on = kind === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[s.kindChip, on && s.kindChipActive]}
                      onPress={() => setKind(k)}
                      accessibilityLabel={KIND_META[k].label}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={KIND_META[k].icon} size={13} color={on ? Colors.onPrimary : Colors.primary} />
                      <Text style={[s.kindChipText, on && s.kindChipTextActive]}>{KIND_META[k].label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Field label="Title" scale={scale}>
                <TextInput style={s.input} value={title} onChangeText={setTitle} accessibilityLabel="Title" placeholder="Title" placeholderTextColor={Colors.textMuted} />
              </Field>
              <Field label="Organization" scale={scale}>
                <TextInput style={s.input} value={organization} onChangeText={setOrganization} accessibilityLabel="Organization" placeholder="Organization" placeholderTextColor={Colors.textMuted} />
              </Field>
              <Field label="Role or grade" scale={scale}>
                <TextInput style={s.input} value={role} onChangeText={setRole} accessibilityLabel="Role or grade" placeholder="Role or grade" placeholderTextColor={Colors.textMuted} />
              </Field>
              <Field label="Location" scale={scale}>
                <TextInput style={s.input} value={location} onChangeText={setLocation} accessibilityLabel="Location" placeholder="Location" placeholderTextColor={Colors.textMuted} />
              </Field>

              <DateBlock label="Start" value={start} onChange={setStart} s={s} />

              <View style={s.switchRow}>
                <Text style={s.formLabel}>Ongoing</Text>
                <Switch
                  value={ongoing}
                  onValueChange={setOngoing}
                  accessibilityLabel="Ongoing"
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                  thumbColor={Platform.OS === 'android' ? (ongoing ? Colors.onPrimary : '#f4f3f4') : undefined}
                />
              </View>

              {!ongoing && (
                <DateBlock label="End" value={end} onChange={setEnd} s={s} />
              )}

              <Field label="Notes" scale={scale}>
                <TextInput style={[s.input, s.inputMultiline]} value={notes} onChangeText={setNotes} accessibilityLabel="Notes" placeholder="Notes" placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" maxLength={4000} />
              </Field>

              <View style={s.modalActions}>
                <Button
                  title="Save"
                  onPress={onSaveEvent}
                  loading={createEvent.isPending || updateEvent.isPending}
                />
                {editing && (
                  <Button
                    title="Delete"
                    variant="outline"
                    onPress={() => onDeleteEvent(editing)}
                    textStyle={{ color: Colors.error }}
                    icon={<Ionicons name="trash-outline" size={15} color={Colors.error} />}
                  />
                )}
                <Button title="Cancel" variant="ghost" onPress={() => setFormOpen(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* School quick-add */}
      <Modal visible={seedOpen} transparent animationType="slide" onRequestClose={() => setSeedOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>Seed school years</Text>
                <TouchableOpacity onPress={() => setSeedOpen(false)} accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Field label="School" scale={scale}>
                <TextInput style={s.input} value={seedSchool} onChangeText={setSeedSchool} accessibilityLabel="School name" placeholder="School" placeholderTextColor={Colors.textMuted} />
              </Field>
              <Field label="Start year" scale={scale}>
                <TextInput style={s.input} value={seedYear} onChangeText={setSeedYear} accessibilityLabel="Start year" placeholder="Year" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" maxLength={4} />
              </Field>
              <Field label="Grades" scale={scale}>
                <View style={s.kindWrap}>
                  {(Object.keys(SEED_RANGES) as Array<keyof typeof SEED_RANGES>).map((r) => {
                    const on = seedRange === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[s.kindChip, on && s.kindChipActive]}
                        onPress={() => setSeedRange(r)}
                        accessibilityLabel={`Grades ${r}`}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.kindChipText, on && s.kindChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <View style={s.modalActions}>
                <Button title="Seed" onPress={onSeedGrades} loading={seeding} />
                <Button title="Cancel" variant="ghost" onPress={() => setSeedOpen(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════
// Event card. A node on the spine, expandable to answers and photos.
// ════════════════════════════════════════════════════════════════════

function EventCard({
  event, projectId, scale, first, last, ensureSession, onEdit, onDelete,
  focused = false, onLayoutY,
}: {
  event: TimelineEvent;
  projectId: string | null;
  scale: number;
  first: boolean;
  last: boolean;
  ensureSession: () => Promise<string | null>;
  onEdit: (e: TimelineEvent) => void;
  onDelete: (e: TimelineEvent) => void;
  /** The rail sent the reader here: arrive open, and report where you
   *  landed so the page can scroll to you. */
  focused?: boolean;
  onLayoutY?: (y: number) => void;
}) {
  const s = makeStyles(scale);
  const [expanded, setExpanded] = useState(focused);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  // Rotation cursor for "different question" within this event's kind.
  const [promptIdx, setPromptIdx] = useState(0);

  // Queries only fire once the row is open. A null id keeps them idle.
  const responsesQ = useEventResponses(expanded ? event.id : null);
  const photosQ = usePhotosForEvent(expanded ? event.id : null);
  // Prompts come from this event's kind (school/job/baby/...), not the
  // generic bank. Before migration 062 this is empty and the answer flow
  // falls back to a custom prompt from the event title.
  const promptsQ = useTimelinePrompts(answerOpen ? event.kind : null);

  const save = useSaveMemoirResponse();
  const linkResponse = useUpdateMemoirResponse();
  const upload = useUploadMemoirAsset();
  const setAssetTimeline = useSetAssetTimeline();

  // The questions this event has not answered yet, in seed order. The
  // cursor rotates through them; when they run out it wraps.
  const answeredIds = React.useMemo(
    () => new Set((responsesQ.data ?? []).map((r: any) => r.prompt_id).filter(Boolean)),
    [responsesQ.data],
  );
  const openPrompts = React.useMemo(
    () => (promptsQ.data ?? []).filter((p) => !answeredIds.has(p.id)),
    [promptsQ.data, answeredIds],
  );
  const prompt = openPrompts.length > 0
    ? openPrompts[promptIdx % openPrompts.length]
    : undefined;
  const question = prompt?.primary_question ?? event.title;

  const dateLabel = (formatRange(event) || '').trim() || 'Undated';
  const subParts = [event.organization, event.role_or_grade, event.location].filter(Boolean) as string[];

  const responses = responsesQ.data ?? [];
  const photos = photosQ.data ?? [];

  const onSaveAnswer = async () => {
    if (!projectId) return;
    const trimmed = answer.trim();
    if (trimmed.length < 4) {
      showAlert('Write a little more', 'A sentence or two is enough.');
      return;
    }
    const sessionId = await ensureSession();
    if (!sessionId) {
      showAlert('Could not start', 'The writing session did not open. Try again.');
      return;
    }
    try {
      // 1. Commit the answer through the normal response hook.
      const saved = await save.mutateAsync({
        sessionId,
        projectId,
        promptId: prompt?.id ?? null,
        customPromptText: prompt?.id ? null : question,
        transcript: trimmed,
        finalText: trimmed,
        chapterAssignment: null,
      });
      // 2. Link it back to this event. useSaveMemoirResponse does not
      //    carry timeline_event_id, and useMemoir.ts is off-limits, so
      //    patch the fresh row. useUpdateMemoirResponse applies the
      //    patch verbatim, so the extra column lands.
      await linkResponse.mutateAsync({
        id: saved.id,
        projectId,
        patch: { timeline_event_id: event.id } as any,
      });
      setAnswer('');
      setAnswerOpen(false);
      await responsesQ.refetch();
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  const onPickPhoto = (evt: any) => {
    const files: FileList | undefined = evt?.target?.files;
    if (!projectId || !files || files.length === 0) return;
    Array.from(files).forEach(async (file) => {
      try {
        const asset = await upload.mutateAsync({ projectId, file });
        // Date it to the event by default (contemporaneous). The author
        // re-dates any photo from its own tile.
        await setAssetTimeline.mutateAsync({
          id: asset.id,
          projectId,
          patch: {
            captured_at: event.start_date,
            captured_precision: event.start_precision,
            timeline_event_id: event.id,
          },
        });
        await photosQ.refetch();
      } catch (e: any) {
        showAlert('Could not add photo', e?.message ?? 'Try again.');
      }
    });
    if (evt.target) evt.target.value = '';
  };

  return (
    <View
      style={[s.spineRow, last && s.spineRowLast]}
      onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)}
    >
      {/* Gutter: continuous line + node */}
      <View style={s.gutter}>
        <View style={[s.line, first && s.lineFirst, last && s.lineLast]} />
        <View style={s.node}>
          <Ionicons name={kindMeta(event.kind).icon} size={15} color={Colors.onPrimary} />
        </View>
      </View>

      {/* Body */}
      <View style={s.body}>
        <TouchableOpacity
          style={s.bodyHead}
          onPress={() => setExpanded((v) => !v)}
          accessibilityLabel={`${event.title}. ${expanded ? 'Collapse' : 'Expand'}`}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.eventDate}>{dateLabel}</Text>
            <Text style={s.eventTitle}>{event.title}</Text>
            {subParts.length > 0 && (
              <Text style={s.eventSub}>{subParts.join('   ·   ')}</Text>
            )}
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {expanded && (
          <View style={s.expand}>
            {!!event.notes && <Text style={s.notesText}>{event.notes}</Text>}

            {/* Answered prompts */}
            {responses.length > 0 && (
              <View style={s.section}>
                <Eyebrow accentColor={Colors.primary}>Answers</Eyebrow>
                {responses.map((r) => <ResponseRow key={r.id} response={r} scale={scale} projectId={projectId} />)}
              </View>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <View style={s.section}>
                <Eyebrow accentColor={Colors.primary}>Photos</Eyebrow>
                <View style={s.photoStrip}>
                  {photos.map((a) => (
                    <PhotoTile key={a.id} asset={a} projectId={projectId!} eventId={event.id} scale={scale} />
                  ))}
                </View>
              </View>
            )}

            {/* Answer composer */}
            {answerOpen && (
              <View style={s.answerPanel}>
                <Text style={s.answerQuestion}>{question}</Text>
                <TextInput
                  style={[s.input, s.answerInput]}
                  value={answer}
                  onChangeText={setAnswer}
                  accessibilityLabel="Your answer"
                  multiline
                  textAlignVertical="top"
                  maxLength={8000}
                />
                <View style={s.answerActions}>
                  <Button
                    title="Save answer"
                    onPress={onSaveAnswer}
                    loading={save.isPending || linkResponse.isPending}
                  />
                  {openPrompts.length > 1 && (
                    <TouchableOpacity style={s.linkBtn} onPress={() => setPromptIdx((i) => i + 1)} accessibilityLabel="Different question" activeOpacity={0.85}>
                      <Text style={s.linkText}>Different question</Text>
                    </TouchableOpacity>
                  )}
                  <Button title="Close" variant="ghost" onPress={() => { setAnswerOpen(false); setAnswer(''); }} />
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={s.actionRow}>
              {!answerOpen && (
                <TouchableOpacity style={s.actionBtn} onPress={() => setAnswerOpen(true)} accessibilityLabel="Answer a prompt" activeOpacity={0.85}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primary} />
                  <Text style={s.actionBtnText}>Answer a prompt</Text>
                </TouchableOpacity>
              )}

              {Platform.OS === 'web' ? (
                <label style={({
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '7px 12px', borderRadius: Radius.control, cursor: 'pointer',
                  border: `1px solid ${Colors.primary}`,
                  color: Colors.primary, fontWeight: 700, fontSize: 12,
                } as any)} aria-label="Add a photo">
                  {upload.isPending || setAssetTimeline.isPending ? 'Adding…' : 'Add a photo'}
                  <input type="file" accept="image/*" multiple onChange={onPickPhoto} style={({ display: 'none' } as any)} />
                </label>
              ) : null}

              <TouchableOpacity style={s.actionBtn} onPress={() => onEdit(event)} accessibilityLabel="Edit event" activeOpacity={0.85}>
                <Ionicons name="create-outline" size={14} color={Colors.primary} />
                <Text style={s.actionBtnText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.actionBtn} onPress={() => onDelete(event)} accessibilityLabel="Delete event" activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={14} color={Colors.error} />
                <Text style={[s.actionBtnText, { color: Colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── An answered prompt inside an event ──────────────────────────────

/**
 * One saved entry under an event: a heading first, the prose on tap,
 * and the prose editable in place. The heading is the prompt the entry
 * answered, or its own first words when it answered no prompt (a
 * journal send, an import). Reading is one tap; editing is one more.
 */
function ResponseRow({ response, scale, projectId }: {
  response: MemoirResponse; scale: number; projectId: string | null;
}) {
  const s = makeStyles(scale);
  const update = useUpdateMemoirResponse();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const q = response.prompt?.primary_question ?? response.custom_prompt_text ?? '';
  const heading = q || `${(response.final_text ?? '').slice(0, 64)}${(response.final_text ?? '').length > 64 ? '…' : ''}`;

  const onSave = () => {
    if (!projectId) return;
    update.mutate(
      { id: response.id, projectId, patch: { final_text: draft } },
      {
        onSuccess: () => setEditing(false),
        onError: (e: any) => showAlert('Could not save', e?.message ?? 'Try again.'),
      },
    );
  };

  return (
    <View style={s.respRow}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${heading}. ${open ? 'Collapse' : 'Read'}`}
        activeOpacity={0.7}
        style={s.respHead}
      >
        <Text style={[s.respQ, { flex: 1 }]} numberOfLines={open ? undefined : 2}>{heading}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
      </TouchableOpacity>
      {open && !editing && (
        <>
          <Text style={s.respBody}>{editing ? draft : (update.isPending ? draft : response.final_text)}</Text>
          <TouchableOpacity
            style={s.linkBtn}
            onPress={() => { setDraft(response.final_text ?? ''); setEditing(true); }}
            accessibilityRole="button"
            accessibilityLabel="Edit this entry"
            activeOpacity={0.85}
          >
            <Text style={s.linkText}>Edit</Text>
          </TouchableOpacity>
        </>
      )}
      {open && editing && (
        <>
          <TextInput
            style={[s.input, s.answerInput]}
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Entry text"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Save" size="sm" onPress={onSave} loading={update.isPending} />
            <Button title="Cancel" variant="ghost" size="sm" onPress={() => setEditing(false)} />
          </View>
        </>
      )}
    </View>
  );
}

// ── A dated photo tile with an inline re-date editor ────────────────

function PhotoTile({
  asset, projectId, eventId, scale,
}: {
  asset: MemoirAsset; projectId: string; eventId: string; scale: number;
}) {
  const s = makeStyles(scale);
  const setAssetTimeline = useSetAssetTimeline();
  const [url, setUrl] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [parts, setParts] = useState<DateParts>(
    partsOf((asset as any).captured_at ?? null, ((asset as any).captured_precision as Precision) ?? 'year'),
  );
  // Local display so the label updates the moment a re-date commits.
  const [shown, setShown] = useState<{ at: string | null; prec: Precision | null }>({
    at: (asset as any).captured_at ?? null,
    prec: ((asset as any).captured_precision as Precision) ?? null,
  });

  useEffect(() => {
    let alive = true;
    getAssetDisplayUrl(asset.storage_path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [asset.storage_path]);

  const label = (formatFuzzyDate(shown.at, shown.prec) || '').trim() || 'Undated';

  const onSaveDate = async () => {
    const capturedAt = composeDate(parts);
    try {
      await setAssetTimeline.mutateAsync({
        id: asset.id,
        projectId,
        patch: {
          captured_at: capturedAt,
          captured_precision: capturedAt ? parts.precision : null,
          timeline_event_id: eventId,
        },
      });
      setShown({ at: capturedAt, prec: capturedAt ? parts.precision : null });
      setDateOpen(false);
    } catch (e: any) {
      showAlert('Could not date', e?.message ?? 'Try again.');
    }
  };

  return (
    <View style={s.photoTile}>
      <View style={s.photoFrame}>
        {url ? <RNImage source={{ uri: url }} style={s.photoImg} resizeMode="cover" /> : <ActivityIndicator color={Colors.primary} />}
      </View>
      <TouchableOpacity style={s.photoDateBtn} onPress={() => setDateOpen((v) => !v)} accessibilityLabel={`Date: ${label}`} activeOpacity={0.85}>
        <Ionicons name="calendar-outline" size={11} color={Colors.primary} />
        <Text style={s.photoDate}>{label}</Text>
      </TouchableOpacity>
      {dateOpen && (
        <View style={s.photoDateEditor}>
          <DateBlock label="Taken" value={parts} onChange={setParts} s={s} compact />
          <Button title="Save" size="sm" onPress={onSaveDate} loading={setAssetTimeline.isPending} />
        </View>
      )}
    </View>
  );
}

// ── Small form building blocks ──────────────────────────────────────

function Field({ label, scale, children }: { label: string; scale: number; children: React.ReactNode }) {
  const s = makeStyles(scale);
  return (
    <View style={s.field}>
      <Text style={s.formLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Precision toggle plus the year/month/day inputs the precision reveals. */
function DateBlock({
  label, value, onChange, s, compact,
}: {
  label: string;
  value: DateParts;
  onChange: (dp: DateParts) => void;
  s: ReturnType<typeof makeStyles>;
  compact?: boolean;
}) {
  const set = (patch: Partial<DateParts>) => onChange({ ...value, ...patch });
  const precisions: Precision[] = ['year', 'month', 'day'];
  return (
    <View style={s.field}>
      <Text style={s.formLabel}>{label}</Text>
      <View style={s.precisionWrap}>
        {precisions.map((p) => {
          const on = value.precision === p;
          return (
            <TouchableOpacity
              key={p}
              style={[s.precisionChip, on && s.kindChipActive]}
              onPress={() => set({ precision: p })}
              accessibilityLabel={`Precision ${p}`}
              activeOpacity={0.85}
            >
              <Text style={[s.precisionChipText, on && s.kindChipTextActive]}>
                {p === 'year' ? 'Year' : p === 'month' ? 'Month' : 'Day'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.dateWrap}>
        <TextInput
          style={[s.input, s.numInput, { width: compact ? 66 : 84 }]}
          value={value.y}
          onChangeText={(t) => set({ y: t.replace(/[^0-9]/g, '') })}
          accessibilityLabel={`${label} year`}
          placeholder="Year"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
        />
        {value.precision !== 'year' && (
          <TextInput
            style={[s.input, s.numInput, { width: compact ? 52 : 64 }]}
            value={value.m}
            onChangeText={(t) => set({ m: t.replace(/[^0-9]/g, '') })}
            accessibilityLabel={`${label} month`}
            placeholder="Mo"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
        )}
        {value.precision === 'day' && (
          <TextInput
            style={[s.input, s.numInput, { width: compact ? 52 : 64 }]}
            value={value.d}
            onChangeText={(t) => set({ d: t.replace(/[^0-9]/g, '') })}
            accessibilityLabel={`${label} day`}
            placeholder="Day"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
        )}
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════
// Styles. One palette, driven by the skin engine; `scale` multiplies
// the Type.* reading sizes.
// ════════════════════════════════════════════════════════════════════

function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};
  const displayFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120, paddingTop: Spacing.sm, gap: Spacing.md },

    addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

    // Spine
    spine: { marginTop: Spacing.sm },
    spineRow: { flexDirection: 'row', alignItems: 'stretch' },
    spineRowLast: {},
    gutter: { width: 40, alignItems: 'center', position: 'relative' },
    line: {
      position: 'absolute', top: 0, bottom: 0, width: 2,
      backgroundColor: Colors.border, left: 19,
    },
    lineFirst: { top: 18 },
    lineLast: { bottom: undefined, height: 18 },
    node: {
      marginTop: 4, width: 30, height: 30, borderRadius: 15,
      backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: Colors.background,
    },

    body: {
      flex: 1, marginLeft: 8, marginBottom: 14,
      backgroundColor: Colors.surface, borderRadius: Radius.card,
      borderWidth: 1, borderColor: Colors.border,
    },
    bodyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
    eventDate: {
      fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.textMuted,
      letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2, ...displayFont,
    },
    eventTitle: { fontSize: fs(Type.cardTitle.size), fontWeight: '600', color: Colors.textPrimary, ...bodyFont },
    eventSub: { fontSize: fs(Type.caption.size), color: Colors.textSecondary, marginTop: 2, ...bodyFont },

    expand: {
      paddingHorizontal: 14, paddingBottom: 14, gap: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
      paddingTop: Spacing.sm,
    },
    notesText: { fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 5), color: Colors.textPrimary, ...bodyFont },

    section: { gap: 8, marginTop: 4 },

    respRow: {
      gap: 3, paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    },
    respHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    respQ: { fontSize: fs(Type.caption.size), color: Colors.primary, fontStyle: 'italic', fontWeight: '600', ...bodyFont },
    respBody: { fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 5), color: Colors.textPrimary, ...bodyFont },

    photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    photoTile: {
      width: 150, gap: 6, padding: 8,
      borderRadius: Radius.sm, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
    },
    photoFrame: {
      width: '100%', aspectRatio: 1.2, borderRadius: Radius.xs, overflow: 'hidden',
      backgroundColor: Colors.surfaceLight,
      alignItems: 'center', justifyContent: 'center',
    },
    photoImg: { width: '100%', height: '100%' },
    photoDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    photoDate: { fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.primary, letterSpacing: 0.4 },
    photoDateEditor: { gap: 8, marginTop: 4 },

    // Answer composer
    answerPanel: {
      gap: Spacing.sm, marginTop: 4, padding: 12,
      borderRadius: Radius.card, backgroundColor: Colors.surface,
      borderLeftWidth: 3, borderLeftColor: Colors.primary,
      borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    },
    answerQuestion: { fontSize: fs(Type.cardTitle.size), lineHeight: fs(Type.cardTitle.lineHeight + 2), color: Colors.textPrimary, fontStyle: 'italic', ...bodyFont },
    answerInput: { minHeight: 120 },
    answerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },

    // Action row
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.primary,
    },
    actionBtnText: { fontSize: Type.caption.size, fontWeight: '700', color: Colors.primary },

    undatedDivider: {
      flexDirection: 'row', alignItems: 'center', marginLeft: 48,
      marginTop: 8, marginBottom: 8,
    },

    // Modal
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end', alignItems: 'center',
    },
    modalCard: {
      width: '100%', maxWidth: 460, maxHeight: '92%',
      backgroundColor: Colors.surface,
      borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
      borderWidth: 1, borderColor: Colors.border,
    },
    modalScroll: { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    modalTitle: { fontSize: fs(Type.title.size), fontWeight: '700', color: Colors.textPrimary, ...displayFont },

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
    inputMultiline: { minHeight: 96 },
    numInput: { textAlign: 'center' },

    kindWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    kindChip: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 7,
      borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.primary,
    },
    kindChipActive: { backgroundColor: Colors.primary },
    kindChipText: { fontSize: Type.caption.size, fontWeight: '700', color: Colors.primary },
    kindChipTextActive: { color: Colors.onPrimary },

    precisionWrap: { flexDirection: 'row', gap: 6 },
    precisionChip: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.primary,
    },
    precisionChipText: { fontSize: Type.caption.size, fontWeight: '700', color: Colors.primary },
    dateWrap: { flexDirection: 'row', gap: 8 },

    switchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 4,
    },

    modalActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: Spacing.sm },
    linkBtn: { paddingHorizontal: 8, paddingVertical: 8 },
    linkText: { fontSize: Type.caption.size, fontWeight: '600', color: Colors.textSecondary, textDecorationLine: 'underline' },
  });
}
