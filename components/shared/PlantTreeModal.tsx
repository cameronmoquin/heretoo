/**
 * "Plant a tree" modal — sponsor flow.
 *
 * Opens from a Quick Action; lets the user write a note + optionally
 * suggest a crew name for the recipient; generates a token; shows
 * the resulting share link with copy + native-share buttons.
 *
 * The recipient lands at /sow/<TOKEN> and goes through the
 * SeedInviteAccept flow (separate page).
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, Pressable, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateSeedInvite } from '../../hooks/useSeedInvite';
import { toastSuccess, toastError } from './Toast';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PlantTreeModal({ visible, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [suggestedName, setSuggestedName] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const create = useCreateSeedInvite();

  const reset = () => {
    setMessage('');
    setSuggestedName('');
    setLink(null);
    create.reset();
  };

  const onCreate = () => {
    create.mutate(
      { message: message.trim(), suggestedFamilyName: suggestedName.trim() },
      {
        onSuccess: (token) => {
          const origin =
            typeof window !== 'undefined' && window.location?.origin
              ? window.location.origin
              : 'https://heretoo.social';
          setLink(`${origin}/sow/${token}`);
        },
        onError: (e: any) => toastError(e?.message ?? 'Could not create seed invite'),
      },
    );
  };

  const onShare = async () => {
    if (!link) return;
    const text = `Start your crew on HereToo. I'm sowing a seed for you: ${link}`;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav?.share) {
      try { await nav.share({ title: 'HereToo invite', text, url: link }); return; } catch {}
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(link);
      toastSuccess('Link copied to clipboard');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { reset(); onClose(); }}
    >
      <Pressable style={s.backdrop} onPress={() => { reset(); onClose(); }}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={s.title}>Plant a tree</Text>

          {!link ? (
            <>
              <Field label="Note to them (optional)">
                <TextInput
                  style={[s.input, s.textarea]}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
              </Field>
              <Field label="Crew name suggestion (optional)">
                <TextInput
                  style={s.input}
                  value={suggestedName}
                  onChangeText={setSuggestedName}
                  placeholder="The Garcías"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={60}
                />
              </Field>

              <View style={s.row}>
                <TouchableOpacity
                  style={[s.btn, s.btnGhost]}
                  onPress={() => { reset(); onClose(); }}
                >
                  <Text style={s.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.btnPrimary, create.isPending && { opacity: 0.5 }]}
                  onPress={onCreate}
                  disabled={create.isPending}
                >
                  <Text style={s.btnPrimaryText}>
                    {create.isPending ? 'Generating…' : 'Generate link'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={s.linkBox}>
                <Ionicons name="leaf-outline" size={16} color={Colors.primary} />
                <Text style={s.linkText} selectable numberOfLines={2}>{link}</Text>
              </View>
              <Text style={s.fineprint}>
                One-time use. Expires in 30 days.
              </Text>
              <View style={s.row}>
                <TouchableOpacity
                  style={[s.btn, s.btnGhost]}
                  onPress={() => { reset(); }}
                >
                  <Text style={s.btnGhostText}>New link</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={onShare}>
                  <Text style={s.btnPrimaryText}>
                    {Platform.OS === 'web' ? 'Copy / share' : 'Share'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => { reset(); onClose(); }} style={s.doneBtn}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    width: '100%', maxWidth: 460, padding: 18, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
  },
  textarea: { minHeight: 70 },

  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  btnGhost: { borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },

  linkBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  linkText: { flex: 1, fontSize: 12, color: Colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  fineprint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  doneBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  doneBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
});
