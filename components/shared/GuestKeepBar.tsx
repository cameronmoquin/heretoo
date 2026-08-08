/**
 * GuestKeepBar — one line for anonymous sessions.
 *
 * A guest lives in one browser on one phone; clearing it ends them.
 * The bar states the way out and takes the email on the spot —
 * supabase promotes the anonymous user in place, so the thread, the
 * connection, and the name all survive the upgrade. Gone once done.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Radius, Type } from '../../constants/design';

export function GuestKeepBar() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const s = makeStyles();

  if (!(user as any)?.is_anonymous || done) return null;

  const save = async () => {
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showAlert('Not an email address', 'Check it and try again.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: to });
      if (error) throw error;
      setDone(true);
      showAlert('One more step', `Confirm from ${to} and this chat is yours for good.`);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.bar}>
      {open ? (
        <>
          <TextInput
            style={s.input}
            accessibilityLabel="Email"
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
          />
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={busy} accessibilityLabel="Save email">
            {busy
              ? <ActivityIndicator color={Colors.onPrimary} size="small" />
              : <Ionicons name="checkmark" size={16} color={Colors.onPrimary} />}
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={s.line} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Ionicons name="mail-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.text}>Add an email to preserve this chat.</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minHeight: 28 },
  text: { fontSize: Type.caption.size, color: Colors.textSecondary, fontWeight: '600' },
  input: {
    flex: 1, minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: Radius.control,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 16, color: Colors.textPrimary,
  },
  saveBtn: {
    width: 34, height: 34, borderRadius: Radius.control,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
