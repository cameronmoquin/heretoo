import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCreateFamilyPost, type PostType } from '../../../../hooks/useFamilyPosts';
import { showAlert } from '../../../../lib/alert';
import { CandonColors } from '../../../../constants/candon-theme';

const POST_TYPES: { id: PostType; label: string; icon: any }[] = [
  { id: 'general_update', label: 'Update', icon: 'create-outline' },
  { id: 'event', label: 'Event', icon: 'calendar-outline' },
  { id: 'assignment', label: 'Sign Up Sheet', icon: 'list-outline' },
];

export default function NewPost() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const createPost = useCreateFamilyPost();

  const [postType, setPostType] = useState<PostType>('general_update');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // event fields
  const [dateStr, setDateStr] = useState(''); // YYYY-MM-DD
  const [timeStr, setTimeStr] = useState(''); // HH:MM
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');

  // assignment slots
  const [slotInput, setSlotInput] = useState('');
  const [slots, setSlots] = useState<string[]>([]);

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
    if (!title.trim()) {
      showAlert('Missing title', 'Give this post a title.');
      return;
    }
    if (!groupId) return;

    const payload: any = {
      family_group_id: groupId,
      post_type: postType,
      title: title.trim(),
      body: body.trim() || undefined,
    };

    if (postType === 'event') {
      if (!dateStr) {
        showAlert('Missing date', 'Pick a date for the event.');
        return;
      }
      const startIso = timeStr
        ? new Date(`${dateStr}T${timeStr}:00`).toISOString()
        : new Date(`${dateStr}T12:00:00`).toISOString();
      payload.start_at = startIso;
      if (locationName.trim()) payload.location_name = locationName.trim();
      if (locationAddress.trim()) payload.location_address = locationAddress.trim();
      if (slots.length > 0) {
        payload.assignments = slots.map((s) => ({ label: s }));
      }
    } else if (postType === 'assignment') {
      if (slots.length === 0) {
        showAlert('Add slots', 'Add at least one item people can sign up for.');
        return;
      }
      payload.assignments = slots.map((s) => ({ label: s }));
    }

    createPost.mutate(payload, {
      onSuccess: () => router.back(),
      onError: (e: any) => showAlert('Failed', e.message),
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Post type selector */}
          <View style={s.typeRow}>
            {POST_TYPES.map((t) => {
              const active = postType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.typeBtn, active && s.typeBtnActive]}
                  onPress={() => setPostType(t.id)}
                >
                  <Ionicons name={t.icon} size={18} color={active ? CandonColors.primary : CandonColors.textSecondary} />
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
                : 'Quick update'
            }
            placeholderTextColor={CandonColors.textMuted}
            autoFocus
          />

          <Text style={s.label}>{postType === 'general_update' ? 'Message' : 'Details'}</Text>
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

          {/* Event fields */}
          {postType === 'event' && (
            <>
              <Text style={s.label}>Date</Text>
              <TextInput
                style={s.input}
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="2026-05-01"
                placeholderTextColor={CandonColors.textMuted}
                autoCapitalize="none"
              />

              <Text style={s.label}>Time (optional)</Text>
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

          {/* Slots for event OR assignment */}
          {(postType === 'event' || postType === 'assignment') && (
            <>
              <Text style={s.label}>
                {postType === 'event' ? 'Bring list (optional)' : 'Sign up slots'}
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
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
  },
  typeBtnActive: { borderColor: CandonColors.primary, backgroundColor: CandonColors.primaryFaint },
  typeLabel: { fontSize: 13, color: CandonColors.textSecondary, fontWeight: '500' },
  typeLabelActive: { color: CandonColors.primary, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: CandonColors.textSecondary, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: CandonColors.textPrimary,
  },
  textarea: { minHeight: 80 },
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
