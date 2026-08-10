/**
 * /babybook/[id]. One child's book.
 *
 * A milestone spine down the page: entries by event_date, undated last,
 * each a rail card. Add a milestone from the preset list (first smile,
 * first word, first steps), still editable after a tap. Answer a baby
 * prompt and the answer lands as a note that carries the prompt's id.
 * Pin dated photos to the book.
 *
 * The house card (RailCard), the house header (ScreenHeader), the house
 * date field (FuzzyDateField), preset chips on the house Chip. Photos ride
 * the shared assets bucket through useUploadBabybookPhoto.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Image as RNImage, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useBabybooks,
  useBabybookEntries,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  useBabybookPhotos,
  useUploadBabybookPhoto,
  useSetEntryFromPrompt,
  useUpdateBabybook,
  useBabyPrompts,
  useBabybookMembers,
  useAddBabybookMember,
  useRemoveBabybookMember,
  useSetAssetBookStatus,
  useReplaceAssetImage,
  type BabybookEntry,
  type BabybookAsset,
} from '../../hooks/useBabybook';
import { useMyConnections } from '../../hooks/useFamily';
import { useAuthStore } from '../../stores/authStore';
import { exifDateOf } from '../../lib/exifDate';
import { getAssetDisplayUrl } from '../../hooks/useMemoir';
import { formatFuzzyDate } from '../../hooks/useMemoirTimeline';
import { goBack } from '../../lib/nav';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, FontFamily } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { Chip } from '../../components/shared/Chip';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { RailCard } from '../../components/shared/RailCard';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import {
  DateField, composeDate, emptyParts, partsOf, type DateParts,
} from '../../components/shared/FuzzyDateField';
import { CropPhotoModal } from '../../components/babybook/CropPhotoModal';

// The milestone presets. First-year moments the parent picks from, still
// fully editable after a tap. Moved here from the memoir timeline; baby
// lives in this room now.
const BABY_PRESETS = [
  'First smile', 'First laugh', 'Rolled over', 'First tooth', 'Sat up',
  'Crawled', 'First word', 'First steps', 'First birthday', 'First haircut',
  'First day of school', 'Lost first tooth',
];

// A photo date reads back at the precision it was entered, stored
// alongside the date so Jan and first-of-month dates keep their meaning.
function photoDateLabel(capturedAt: string | null, precision: 'year' | 'month' | 'day' | null): string {
  if (!capturedAt) return 'Undated';
  return formatFuzzyDate(capturedAt.slice(0, 10), precision ?? 'day') || 'Undated';
}

export default function BabybookScreen() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = typeof id === 'string' ? id : null;

  const booksQ = useBabybooks();
  const book = (booksQ.data ?? []).find((b) => b.id === bookId) ?? null;

  const entriesQ = useBabybookEntries(bookId);
  const photosQ = useBabybookPhotos(bookId);
  const promptsQ = useBabyPrompts();

  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const setFromPrompt = useSetEntryFromPrompt();
  const upload = useUploadBabybookPhoto();
  const updateBook = useUpdateBabybook();

  // ── Milestone add / edit form ─────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BabybookEntry | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [when, setWhen] = useState<DateParts>(emptyParts());

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setWhen(emptyParts());
    setFormOpen(true);
  };

  const openEdit = (e: BabybookEntry) => {
    setEditing(e);
    setTitle(e.title ?? '');
    setBody(e.body ?? '');
    setWhen(partsOf(e.event_date, e.event_precision));
    setFormOpen(true);
  };

  const onSaveEntry = async () => {
    if (!bookId) return;
    const t = title.trim();
    if (!t) {
      showAlert('Add a title', 'Every milestone needs a title.');
      return;
    }
    const eventDate = composeDate(when);
    try {
      if (editing) {
        await updateEntry.mutateAsync({
          id: editing.id,
          bookId,
          patch: {
            title: t,
            body: body.trim() || null,
            event_date: eventDate,
            event_precision: eventDate ? when.precision : null,
          },
        });
      } else {
        await createEntry.mutateAsync({
          bookId,
          kind: 'milestone',
          title: t,
          body: body.trim() || null,
          eventDate,
          eventPrecision: eventDate ? when.precision : null,
        });
      }
      setFormOpen(false);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  const onDeleteEntry = (e: BabybookEntry) => {
    if (!bookId) return;
    showConfirm(
      'Delete this entry?',
      'The entry goes. Its photos stay.',
      () => {
        deleteEntry.mutate(
          { id: e.id, bookId },
          { onError: (err: any) => showAlert('Could not delete', err?.message ?? 'Try again.') },
        );
        if (editing?.id === e.id) setFormOpen(false);
      },
      'Delete',
    );
  };

  // ── Answer a prompt ───────────────────────────────────────────────
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const [answer, setAnswer] = useState('');

  const answeredPromptIds = useMemo(
    () => new Set((entriesQ.data ?? []).map((e) => e.prompt_id).filter(Boolean)),
    [entriesQ.data],
  );
  const openPrompts = useMemo(
    () => (promptsQ.data ?? []).filter((p) => !answeredPromptIds.has(p.id)),
    [promptsQ.data, answeredPromptIds],
  );
  const currentPrompt = openPrompts.length > 0
    ? openPrompts[promptIdx % openPrompts.length]
    : null;

  const onSaveAnswer = async () => {
    if (!bookId || !currentPrompt) return;
    const a = answer.trim();
    if (a.length < 4) {
      showAlert('Write a little more', 'A sentence or two is enough.');
      return;
    }
    try {
      await setFromPrompt.mutateAsync({ bookId, prompt: currentPrompt, body: a });
      setAnswer('');
      setPromptOpen(false);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  // ── Photos ────────────────────────────────────────────────────────
  // The photo dates itself when it can: EXIF DateTimeOriginal, read
  // client-side, day precision. Photos that carry no date queue up and
  // the person is asked for a best guess instead.
  const [photoDate, setPhotoDate] = useState<DateParts>(emptyParts());
  const [pendingGuess, setPendingGuess] = useState<File[]>([]);

  const onPickPhoto = async (evt: any) => {
    const files: FileList | undefined = evt?.target?.files;
    if (!bookId || !files || files.length === 0) return;
    const picked = Array.from(files);
    if (evt.target) evt.target.value = '';
    const unstamped: File[] = [];
    for (const file of picked) {
      const iso = await exifDateOf(file);
      if (iso) {
        try {
          await upload.mutateAsync({ bookId, file, capturedAt: iso, capturedPrecision: 'day' });
        } catch (e: any) {
          showAlert('Could not add photo', e?.message ?? 'Try again.');
        }
      } else {
        unstamped.push(file);
      }
    }
    if (unstamped.length > 0) {
      setPhotoDate(partsOf(null, null));
      setPendingGuess((cur) => [...cur, ...unstamped]);
    }
  };

  const uploadPending = async (dated: boolean) => {
    if (!bookId || pendingGuess.length === 0) return;
    const capturedAt = dated ? composeDate(photoDate) : null;
    const precision = dated && capturedAt ? photoDate.precision : null;
    const batch = pendingGuess;
    setPendingGuess([]);
    for (const file of batch) {
      try {
        await upload.mutateAsync({
          bookId, file,
          capturedAt: capturedAt ?? undefined,
          capturedPrecision: precision ?? undefined,
        });
      } catch (e: any) {
        showAlert('Could not add photo', e?.message ?? 'Try again.');
      }
    }
  };

  // ── Sharing ───────────────────────────────────────────────────────
  const userId = useAuthStore((st) => st.user?.id);
  const isBookAuthor = !!book && (book as any).author_id === userId;
  const [shareOpen, setShareOpen] = useState(false);
  const { data: members } = useBabybookMembers(bookId);
  const { data: connections } = useMyConnections();
  const addMember = useAddBabybookMember();
  const removeMember = useRemoveBabybookMember();
  const memberIds = new Set((members ?? []).map((m) => m.profile_id));

  const onSetCover = (asset: BabybookAsset) => {
    if (!bookId) return;
    updateBook.mutate(
      { id: bookId, patch: { cover_storage_path: asset.storage_path } },
      { onError: (e: any) => showAlert('Could not set cover', e?.message ?? 'Try again.') },
    );
  };

  // ── Sort the spine: dated ascending, undated grouped at the end ────
  const { dated, undated } = useMemo(() => {
    const list = entriesQ.data ?? [];
    const withDate = list.filter((e) => !!e.event_date);
    const noDate = list.filter((e) => !e.event_date);
    withDate.sort((a, b) => {
      const da = a.event_date ?? '';
      const db = b.event_date ?? '';
      if (da < db) return -1;
      if (da > db) return 1;
      return a.created_at < b.created_at ? -1 : 1;
    });
    noDate.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return { dated: withDate, undated: noDate };
  }, [entriesQ.data]);

  const photos = photosQ.data ?? [];
  const hasEntries = dated.length + undated.length > 0;

  // ── Curation (081). The book is built in passes: everything a bulk
  // ingest lands is pending; approve it in, or leave it out. A photo
  // that predates the column reads as approved, which is what it was.
  const setStatus = useSetAssetBookStatus();
  const [review, setReview] = useState<'approved' | 'pending' | 'excluded'>('approved');
  const statusOf = (a: BabybookAsset) => a.book_status ?? 'approved';
  const counts = useMemo(() => {
    const c = { approved: 0, pending: 0, excluded: 0 };
    for (const a of photos) c[statusOf(a)] += 1;
    return c;
  }, [photos]);
  const shown = useMemo(() => photos.filter((a) => statusOf(a) === review), [photos, review]);
  // A decade reads by year. Undated tails the list.
  const byYear = useMemo(() => {
    const groups: Array<{ year: string; items: BabybookAsset[] }> = [];
    for (const a of shown) {
      const year = a.captured_at ? a.captured_at.slice(0, 4) : 'Undated';
      const last = groups[groups.length - 1];
      if (last && last.year === year) last.items.push(a);
      else groups.push({ year, items: [a] });
    }
    return groups;
  }, [shown]);
  // ── Crop. The one edit a photo book needs. ─────────────────────────
  const replaceImage = useReplaceAssetImage();
  const [cropAsset, setCropAsset] = useState<BabybookAsset | null>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const openCrop = async (a: BabybookAsset) => {
    setCropAsset(a);
    setCropUrl(null);
    setCropUrl(await getAssetDisplayUrl(a.storage_path));
  };
  const onCropSave = (blob: Blob) => {
    if (!cropAsset) return;
    replaceImage.mutate(
      { asset: cropAsset, blob },
      {
        onSuccess: () => { setCropAsset(null); setCropUrl(null); },
        onError: (e: any) => showAlert('Could not save the crop', e?.message ?? 'Try again.'),
      },
    );
  };

  const judge = (a: BabybookAsset, status: 'approved' | 'excluded' | 'pending') => {
    if (!bookId) return;
    setStatus.mutate(
      { assetId: a.id, bookId, status },
      { onError: (e: any) => showAlert('Could not save', e?.message ?? 'Try again.') },
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title={book?.child_name ?? 'Babybook'}
        showBack
        onBack={() => goBack('/babybook')}
        backLabel="Back"
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Add affordances */}
        <View style={s.addRow}>
          <Button
            title="Add milestone"
            variant="outline"
            size="sm"
            onPress={openAdd}
            icon={<Ionicons name="flag-outline" size={14} color={Colors.primary} />}
          />
          {openPrompts.length > 0 && (
            <Button
              title="Answer a prompt"
              variant="outline"
              size="sm"
              onPress={() => { setPromptOpen(true); setAnswer(''); }}
              icon={<Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primary} />}
            />
          )}
          {isBookAuthor && (
            <Button
              title="Share"
              variant="outline"
              size="sm"
              onPress={() => setShareOpen((v) => !v)}
              icon={<Ionicons name="person-add-outline" size={14} color={Colors.primary} />}
            />
          )}
        </View>

        {/* Who else holds this book. Members read everything and add
            their own entries and photos; the book stays the author's. */}
        {shareOpen && (
          <RailCard eyebrow="The other parent" accentColor={Colors.primary}>
            {(connections ?? []).length === 0 ? (
              <Text style={s.promptQ}>No connections yet.</Text>
            ) : (
              (connections ?? []).map((c: any) => {
                const on = memberIds.has(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={s.memberRow}
                    activeOpacity={0.7}
                    onPress={() =>
                      (on ? removeMember : addMember).mutate(
                        { bookId: bookId!, profileId: c.id },
                        { onError: (e: any) => showAlert('Could not update sharing', e?.message ?? 'Try again.') },
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={c.display_name ?? c.handle ?? 'Unknown'}
                  >
                    <Text style={s.memberName}>
                      {c.display_name ?? (c.handle ? `@${c.handle}` : 'Unknown')}
                    </Text>
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={on ? Colors.primary : Colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </RailCard>
        )}

        {/* Answer-a-prompt panel */}
        {promptOpen && currentPrompt && (
          <RailCard eyebrow="A question" accentColor={Colors.info}>
            <Text style={s.promptQ}>{currentPrompt.primary_question}</Text>
            <TextInput
              style={[s.input, s.answerInput]}
              value={answer}
              onChangeText={setAnswer}
              accessibilityLabel="Your answer"
              multiline
              textAlignVertical="top"
              maxLength={8000}
            />
            <View style={s.formActions}>
              <Button title="Save answer" onPress={onSaveAnswer} loading={setFromPrompt.isPending} />
              {openPrompts.length > 1 && (
                <TouchableOpacity
                  style={s.linkBtn}
                  onPress={() => setPromptIdx((i) => i + 1)}
                  accessibilityLabel="Different question"
                  activeOpacity={0.85}
                >
                  <Text style={s.linkText}>Different question</Text>
                </TouchableOpacity>
              )}
              <Button title="Close" variant="ghost" onPress={() => { setPromptOpen(false); setAnswer(''); }} />
            </View>
          </RailCard>
        )}

        {/* Milestone spine */}
        {hasEntries && (
          <View style={s.list}>
            {dated.map((e) => (
              <EntryCard key={e.id} entry={e} onEdit={openEdit} onDelete={onDeleteEntry} canEdit={isBookAuthor || e.author_id === userId} />
            ))}
            {undated.length > 0 && (
              <View style={s.undatedDivider}>
                <Eyebrow>Undated</Eyebrow>
              </View>
            )}
            {undated.map((e) => (
              <EntryCard key={e.id} entry={e} onEdit={openEdit} onDelete={onDeleteEntry} canEdit={isBookAuthor || e.author_id === userId} />
            ))}
          </View>
        )}

        {/* Photos */}
        {(photos.length > 0 || Platform.OS === 'web') && (
          <View style={s.photoSection}>
            <Eyebrow accentColor={Colors.primary}>Photos</Eyebrow>
            {Platform.OS === 'web' && (
              <View style={s.photoAdd}>
                <label
                  style={({
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '7px 12px', borderRadius: Radius.control, cursor: 'pointer',
                    border: `1px solid ${Colors.border}`, color: Colors.textPrimary,
                    fontWeight: 700, fontSize: 13, alignSelf: 'flex-start',
                  } as any)}
                  aria-label="Add a photo"
                >
                  {upload.isPending ? 'Adding…' : 'Add a photo'}
                  <input type="file" accept="image/*" multiple onChange={onPickPhoto} style={({ display: 'none' } as any)} />
                </label>
              </View>
            )}
            {/* Photos that named their own date are already in. These
                didn't, so the person is the metadata. */}
            {pendingGuess.length > 0 && (
              <RailCard eyebrow="Best guess" accentColor={Colors.info}>
                <Text style={s.promptQ}>
                  {pendingGuess.length === 1
                    ? 'This photo carries no date.'
                    : `These ${pendingGuess.length} photos carry no date.`}
                </Text>
                <DateField label="Taken around" value={photoDate} onChange={setPhotoDate} compact />
                <View style={s.formActions}>
                  <Button title="Add" onPress={() => uploadPending(true)} loading={upload.isPending} />
                  <Button title="Undated" variant="ghost" onPress={() => uploadPending(false)} />
                </View>
              </RailCard>
            )}
            {photos.length > 0 && (
              <View style={s.chipRowWrap}>
                <Chip label={`In the book · ${counts.approved}`} selected={review === 'approved'} onPress={() => setReview('approved')} />
                <Chip label={`Pending · ${counts.pending}`} selected={review === 'pending'} onPress={() => setReview('pending')} />
                <Chip label={`Left out · ${counts.excluded}`} selected={review === 'excluded'} onPress={() => setReview('excluded')} />
              </View>
            )}
            {byYear.map((g) => (
              <View key={g.year} style={{ gap: 6 }}>
                <Eyebrow>{g.year}</Eyebrow>
                <View style={s.photoStrip}>
                  {g.items.map((a) => (
                    <PhotoTile
                      key={a.id}
                      asset={a}
                      isCover={book?.cover_storage_path === a.storage_path}
                      onSetCover={isBookAuthor ? () => onSetCover(a) : null}
                      status={statusOf(a)}
                      onJudge={isBookAuthor ? (st) => judge(a, st) : null}
                      onCrop={() => openCrop(a)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {!hasEntries && photos.length === 0 && (
          <Text style={s.empty}>Nothing yet.</Text>
        )}
      </ScrollView>

      {/* Milestone add / edit form */}
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.modalHead}>
                <Text style={s.modalTitle}>{editing ? 'Edit entry' : 'New milestone'}</Text>
                <TouchableOpacity onPress={() => setFormOpen(false)} accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Presets. Only when adding a fresh milestone */}
              {!editing && (
                <View style={s.presetWrap}>
                  {BABY_PRESETS.map((p) => (
                    <Chip key={p} label={p} selected={title === p} onPress={() => setTitle(p)} />
                  ))}
                </View>
              )}

              <View style={s.field}>
                <Eyebrow>Title</Eyebrow>
                <TextInput style={s.input} value={title} onChangeText={setTitle} accessibilityLabel="Title" placeholder="Title" placeholderTextColor={Colors.textMuted} />
              </View>

              <View style={s.field}>
                <Eyebrow>Note</Eyebrow>
                <TextInput style={[s.input, s.inputMultiline]} value={body} onChangeText={setBody} accessibilityLabel="Note" placeholder="Note" placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" maxLength={4000} />
              </View>

              <DateField label="When" value={when} onChange={setWhen} />

              <View style={s.modalActions}>
                <Button title="Save" onPress={onSaveEntry} loading={createEntry.isPending || updateEntry.isPending} />
                {editing && (
                  <Button
                    title="Delete"
                    variant="outline"
                    onPress={() => onDeleteEntry(editing)}
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
    </SafeAreaView>
  );
}

// ── One entry on the spine ──────────────────────────────────────────

function EntryCard({
  entry, onEdit, onDelete, canEdit,
}: {
  // False for a member looking at the other parent's entry: RLS
  // refuses the write and PostgREST reports success on zero rows, so
  // the card would vanish and come back. Hide the controls instead.
  canEdit: boolean;
  entry: BabybookEntry;
  onEdit: (e: BabybookEntry) => void;
  onDelete: (e: BabybookEntry) => void;
}) {
  const s = makeStyles();
  const isNote = entry.kind === 'note';
  const eyebrow = entry.event_date
    ? formatFuzzyDate(entry.event_date, entry.event_precision)
    : (isNote ? 'Note' : 'Undated');
  const accent = isNote ? Colors.info : Colors.primary;

  return (
    <RailCard eyebrow={eyebrow || 'Undated'} accentColor={accent}>
      <Text style={[s.entryTitle, isNote && s.entryTitleNote]}>{entry.title}</Text>
      {!!entry.body && <Text style={s.entryBody}>{entry.body}</Text>}
      {canEdit && (
        <View style={s.entryActions}>
          <TouchableOpacity
            style={s.entryAction}
            onPress={() => onEdit(entry)}
            accessibilityLabel="Edit entry"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={14} color={Colors.textSecondary} />
            <Text style={s.entryActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.entryAction}
            onPress={() => onDelete(entry)}
            accessibilityLabel="Delete entry"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.error} />
            <Text style={[s.entryActionText, { color: Colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </RailCard>
  );
}

// ── A photo tile ────────────────────────────────────────────────────

function PhotoTile({
  asset, isCover, onSetCover, status, onJudge, onCrop,
}: {
  asset: BabybookAsset;
  isCover: boolean;
  // Null when the viewer is a member rather than the book's author:
  // RLS permits neither, and a control that silently does nothing is
  // worse than no control.
  onSetCover: (() => void) | null;
  status: 'approved' | 'pending' | 'excluded';
  onJudge: ((s: 'approved' | 'excluded' | 'pending') => void) | null;
  onCrop: () => void;
}) {
  const s = makeStyles();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAssetDisplayUrl(asset.storage_path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [asset.storage_path]);

  return (
    <View style={s.photoTile}>
      <View style={s.photoFrame}>
        {url ? (
          <RNImage source={{ uri: url }} style={s.photoImg} resizeMode="cover" />
        ) : (
          <ActivityIndicator color={Colors.primary} />
        )}
      </View>
      <Text style={s.photoDate}>{photoDateLabel(asset.captured_at, asset.captured_precision)}</Text>
      {onJudge && status === 'pending' ? (
        <View style={s.judgeRow}>
          <TouchableOpacity
            style={[s.judgeBtn, s.judgeBtnIn]}
            onPress={() => onJudge('approved')}
            accessibilityLabel="Into the book"
          >
            <Ionicons name="checkmark" size={16} color={Colors.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.judgeBtn}
            onPress={() => onJudge('excluded')}
            accessibilityLabel="Leave it out"
          >
            <Ionicons name="close" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.judgeRow}>
          {onJudge && (
            <TouchableOpacity
              style={s.judgeBtn}
              onPress={() => onJudge(status === 'approved' ? 'excluded' : 'approved')}
              accessibilityLabel={status === 'approved' ? 'Leave it out' : 'Into the book'}
            >
              <Ionicons
                name={status === 'approved' ? 'close' : 'checkmark'}
                size={16}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          )}
          {Platform.OS === 'web' && (
            <TouchableOpacity style={s.judgeBtn} onPress={onCrop} accessibilityLabel="Crop">
              <Ionicons name="crop-outline" size={15} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <TouchableOpacity
        style={s.coverBtn}
        onPress={onSetCover ?? undefined}
        disabled={isCover || !onSetCover}
        accessibilityLabel={isCover ? 'Cover photo' : 'Set as cover'}
        activeOpacity={0.85}
      >
        <Ionicons
          name={isCover ? 'star' : 'star-outline'}
          size={12}
          color={isCover ? Colors.primary : Colors.textSecondary}
        />
        <Text style={[s.coverBtnText, isCover && { color: Colors.primary }]}>
          {isCover ? 'Cover' : 'Set as cover'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles() {
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};
  const displayFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120, paddingTop: Spacing.sm, gap: Spacing.md },

    addRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xxs },

    list: { gap: Spacing.sm },
    undatedDivider: { marginTop: Spacing.xs, marginBottom: Spacing.xxs },

    empty: {
      fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
      color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.lg, ...bodyFont,
    },

    // Entry card
    entryTitle: { fontSize: Type.cardTitle.size, fontWeight: '700', color: Colors.textPrimary, ...bodyFont },
    entryTitleNote: { fontWeight: '600', fontStyle: 'italic', color: Colors.textPrimary },
    entryBody: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight + 5, color: Colors.textPrimary, marginTop: 2, ...bodyFont },
    entryActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
    entryAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    entryActionText: { fontSize: Type.caption.size, fontWeight: '600', color: Colors.textSecondary },

    // Prompt panel
    promptQ: {
      fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight + 2,
      color: Colors.textPrimary, fontStyle: 'italic', ...bodyFont,
    },
    answerInput: { minHeight: 120, marginTop: Spacing.xs },

    // Sharing
    memberRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, gap: Spacing.sm,
    },
    memberName: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary },

    // Photos
    photoSection: { gap: Spacing.xs, marginTop: Spacing.xs },
    photoAdd: { gap: Spacing.xs },
    photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xxs },
    chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
    judgeRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4 },
    judgeBtn: {
      flex: 1, minHeight: 30, borderRadius: Radius.control,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceLight,
    },
    judgeBtnIn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    photoTile: {
      width: 150, gap: 6, padding: Spacing.xs,
      borderRadius: Radius.sm, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
    },
    photoFrame: {
      width: '100%', aspectRatio: 1.2, borderRadius: Radius.xs, overflow: 'hidden',
      backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center',
    },
    photoImg: { width: '100%', height: '100%' },
    photoDate: { fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.primary, letterSpacing: 0.4 },
    coverBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    coverBtnText: { fontSize: Type.caption.size, fontWeight: '600', color: Colors.textSecondary },

    // Shared form bits
    field: { gap: Spacing.xs },
    input: {
      minHeight: 44, paddingHorizontal: Spacing.sm, paddingVertical: 10,
      borderRadius: Radius.control, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: Type.ui.size, color: Colors.textPrimary, ...bodyFont,
    },
    inputMultiline: { minHeight: 96 },
    formActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
    linkBtn: { paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xs },
    linkText: { fontSize: Type.caption.size, fontWeight: '600', color: Colors.textSecondary, textDecorationLine: 'underline' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center' },
    modalCard: {
      width: '100%', maxWidth: 460, maxHeight: '92%',
      backgroundColor: Colors.surface,
      borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
      borderWidth: 1, borderColor: Colors.border,
    },
    modalScroll: { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xxs },
    modalTitle: { fontSize: Type.title.size, fontWeight: '700', color: Colors.textPrimary, ...displayFont },
    presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    modalActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  });
}
