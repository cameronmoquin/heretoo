import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useCreateFamilyPost,
  type PostType,
  type VisibilityScope,
} from '../../../../hooks/useFamilyPosts';
import { showAlert, showConfirm } from '../../../../lib/alert';
import { CandonColors } from '../../../../constants/candon-theme';
import { VisibilityPicker } from '../../../../components/candon/VisibilityPicker';
import { formatPgError } from '../../../../lib/error-format';
import { hardSignOutAndRedirect } from '../../../../lib/auth-recovery';
import type { IoniconName } from '../../../../lib/icon-types';

const POST_TYPES: { id: PostType; label: string; icon: IoniconName }[] = [
  { id: 'general_update', label: 'Update', icon: 'create-outline' },
  { id: 'event', label: 'Event', icon: 'calendar-outline' },
  { id: 'assignment', label: 'Sign Up', icon: 'list-outline' },
  { id: 'medical_update', label: 'Medical', icon: 'medkit-outline' },
];

const MEDICAL_STATUS_OPTIONS = [
  { id: 'stable', label: 'Stable' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'improving', label: 'Improving' },
  { id: 'concerning', label: 'Concerning' },
  { id: 'critical', label: 'Critical' },
  { id: 'recovering', label: 'Recovering' },
  { id: 'passed', label: 'Passed' },
] as const;

export default function NewPost() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const createPost = useCreateFamilyPost();

  const [postType, setPostType] = useState<PostType>('general_update');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const [scope, setScope] = useState<VisibilityScope>('group');
  const [recipients, setRecipients] = useState<string[]>([]);

  // Event fields
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');

  // Assignment slots
  const [slotInput, setSlotInput] = useState('');
  const [slots, setSlots] = useState<string[]>([]);

  // Medical fields
  const [patientLabel, setPatientLabel] = useState('');
  const [statusLevel, setStatusLevel] = useState<typeof MEDICAL_STATUS_OPTIONS[number]['id']>('stable');
  const [careLocation, setCareLocation] = useState('');
  const [helpNeeded, setHelpNeeded] = useState('');
  const [contactPerson, setContactPerson] = useState('');

  const onPostTypeChange = (t: PostType) => {
    setPostType(t);
    if (t === 'medical_update') {
      setScope('medical_limited');
    } else if (scope === 'medical_limited') {
      setScope('group');
    }
  };

  const addSlot = () => {
    const t = slotInput.trim();
    if (!t) return;
    setSlots((prev) => [...prev, t]);
    setSlotInput('');
  };
  const removeSlot = (i: number) => {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = () => {
    if (!title.trim()) { showAlert('Missing title', 'Give this post a title.'); return; }
    if (!groupId) return;

    const payload: any = {
      family_group_id: groupId,
      post_type: postType,
      title: title.trim(),
      body: body.trim() || undefined,
      visibility_scope: scope,
      recipient_user_ids: recipients,
    };

    if (postType === 'event') {
      if (!dateStr) { showAlert('Missing date', 'Pick a date for the event.'); return; }
      const startIso = timeStr
        ? new Date(`${dateStr}T${timeStr}:00`).toISOString()
        : new Date(`${dateStr}T12:00:00`).toISOString();
      payload.start_at = startIso;
      if (locationName.trim()) payload.location_name = locationName.trim();
      if (locationAddress.trim()) payload.location_address = locationAddress.trim();
      if (slots.length > 0) payload.assignments = slots.map((s) => ({ label: s }));
    } else if (postType === 'assignment') {
      if (slots.length === 0) { showAlert('Add slots', 'Add at least one sign-up slot.'); return; }
      payload.assignments = slots.map((s) => ({ label: s }));
    } else if (postType === 'medical_update') {
      if (!patientLabel.trim()) {
        showAlert('Who is this about?', 'Add a name or label (initials are fine).');
        return;
      }
      payload.medical = {
        patient_label: patientLabel.trim(),
        status_level: statusLevel,
        care_location: careLocation.trim() || undefined,
        help_needed: helpNeeded.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
      };
    }

    createPost.mutate(payload, {
      onSuccess: () => router.back(),
      onError: (e: unknown) => {
        const f = formatPgError(e, 'Could not save your post.');
        // eslint-disable-next-line no-console
        console.error('[create-post] failed:', f.raw, '(code:', f.code, ')');
        if (f.authSuspect) {
          showConfirm(
            'Session expired',
            `${f.message}\n\nSign out and back in?`,
            () => hardSignOutAndRedirect(),
            'Sign in again',
            'Cancel',
          );
        } else {
          showAlert('Could not post', f.message);
        }
      },
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.typeRow}>
            {POST_TYPES.map((t) => {
              const active = postType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.typeBtn, active && s.typeBtnActive]}
                  onPress={() => onPostTypeChange(t.id)}
                >
                  <Ionicons
                    name={t.icon}
                    size={16}
                    color={active ? CandonColors.primary : CandonColors.textSecondary}
                  />
                  <Text style={[s.typeLabel, active && s.typeLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.label}>Title</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder={
              postType === 'event' ? 'Sunday dinner'
                : postType === 'assignment' ? 'Thanksgiving potluck'
                : postType === 'medical_update' ? 'Mom update'
                : 'Quick update'
            }
            placeholderTextColor={CandonColors.textMuted}
            autoFocus
          />

          <Text style={s.label}>{postType === 'medical_update' ? 'Update' : 'Message'}</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Write something."
            placeholderTextColor={CandonColors.textMuted}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />

          {postType === 'medical_update' && (
            <>
              <Text style={s.label}>Who is this about?</Text>
              <TextInput
                style={s.input}
                value={patientLabel}
                onChangeText={setPatientLabel}
                placeholder="Mom / Dad / J.S."
                placeholderTextColor={CandonColors.textMuted}
              />

              <Text style={s.label}>Status</Text>
              <View style={s.chipRow}>
                {MEDICAL_STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[s.chip, statusLevel === opt.id && s.chipActive]}
                    onPress={() => setStatusLevel(opt.id)}
                  >
                    <Text style={[s.chipText, statusLevel === opt.id && s.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Where (optional)</Text>
              <TextInput
                style={s.input}
                value={careLocation}
                onChangeText={setCareLocation}
                placeholder="Hospital / home / hospice"
                placeholderTextColor={CandonColors.textMuted}
              />

              <Text style={s.label}>Contact person (optional)</Text>
              <TextInput
                style={s.input}
                value={contactPerson}
                onChangeText={setContactPerson}
                placeholder="Who to reach for questions"
                placeholderTextColor={CandonColors.textMuted}
              />

              <Text style={s.label}>How others can help (optional)</Text>
              <TextInput
                style={[s.input, s.textarea]}
                value={helpNeeded}
                onChangeText={setHelpNeeded}
                placeholder="Meals, rides, visits, quiet."
                placeholderTextColor={CandonColors.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </>
          )}

          {postType === 'event' && (
            <>
              <Text style={s.label}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={s.input}
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="2026-05-01"
                placeholderTextColor={CandonColors.textMuted}
                autoCapitalize="none"
              />
              <Text style={s.label}>Time (HH:MM, optional)</Text>
              <TextInput
                style={s.input}
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="18:30"
                placeholderTextColor={CandonColors.textMuted}
                autoCapitalize="none"
              />
              <Text style={s.label}>Location name (optional)</Text>
              <TextInput
                style={s.input}
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Mom's house"
                placeholderTextColor={CandonColors.textMuted}
              />
              <Text style={s.label}>Address (optional)</Text>
              <TextInput
                style={s.input}
                value={locationAddress}
                onChangeText={setLocationAddress}
                placeholder="123 Elm St"
                placeholderTextColor={CandonColors.textMuted}
              />
            </>
          )}

          {(postType === 'event' || postType === 'assignment') && (
            <>
              <Text style={s.label}>
                {postType === 'event' ? 'Bring list (optional)' : 'Sign-up slots'}
              </Text>
              <View style={s.slotInputRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={slotInput}
                  onChangeText={setSlotInput}
                  placeholder="Salad"
                  placeholderTextColor={CandonColors.textMuted}
                  onSubmitEditing={addSlot}
                  returnKeyType="done"
                />
                <TouchableOpacity style={s.addSlotBtn} onPress={addSlot}>
                  <Ionicons name="add" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
              {slots.map((s_, i) => (
                <View key={i} style={s.slotRow}>
                  <Ionicons name="ellipse" size={6} color={CandonColors.primary} />
                  <Text style={s.slotText}>{s_}</Text>
                  <TouchableOpacity onPress={() => removeSlot(i)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={CandonColors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <View style={{ marginTop: 12 }}>
            <VisibilityPicker
              groupId={groupId!}
              scope={scope}
              recipientIds={recipients}
              onScopeChange={setScope}
              onRecipientsChange={setRecipients}
              medicalMode={postType === 'medical_update'}
            />
          </View>

          <TouchableOpacity
            style={[s.saveBtn, createPost.isPending && { opacity: 0.5 }]}
            onPress={save}
            disabled={createPost.isPending}
          >
            <Text style={s.saveBtnText}>
              {createPost.isPending ? 'Posting...' : 'Post'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  typeBtn: {
    flex: 1, minWidth: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10,
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
  },
  typeBtnActive: { borderColor: CandonColors.primary, backgroundColor: CandonColors.primaryFaint },
  typeLabel: { fontSize: 12, color: CandonColors.textSecondary, fontWeight: '500' },
  typeLabelActive: { color: CandonColors.primary, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: CandonColors.textSecondary, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: CandonColors.textPrimary,
  },
  textarea: { minHeight: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
  },
  chipActive: { borderColor: CandonColors.primary, backgroundColor: CandonColors.primaryFaint },
  chipText: { fontSize: 12, color: CandonColors.textSecondary },
  chipTextActive: { color: CandonColors.primary, fontWeight: '600' },
  slotInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addSlotBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: CandonColors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: CandonColors.surface, borderRadius: 8,
    borderWidth: 1, borderColor: CandonColors.borderLight,
    marginTop: 4,
  },
  slotText: { flex: 1, fontSize: 14, color: CandonColors.textPrimary },
  saveBtn: {
    marginTop: 24, backgroundColor: CandonColors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
