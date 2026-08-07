/**
 * InviteSheet — invite someone into the app, from wherever you are.
 *
 * Rides the seed-invite token (/sow/<token>): the recipient signs up,
 * names their cohort, and lands already connected to the inviter.
 *
 * Three deliveries, in order of how people actually reach each other:
 *
 *   TEXT   opens the device's own Messages app with the invitation
 *          prefilled. It sends from the inviter's real number — the
 *          one signal a friend actually answers — and needs no SMS
 *          vendor, no per-message cost, no third party holding the
 *          social graph.
 *   EMAIL  the server sends the branded note when RESEND_API_KEY is
 *          configured; until then the device's mail composer opens
 *          prefilled instead. Either way the invitation goes.
 *   LINK   copied, to carry anywhere else.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  Platform, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateSeedInvite } from '../../hooks/useSeedInvite';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, Heights } from '../../constants/design';

const SLOGAN = 'Are you intelligent enough to be HereToo?';

function inviteUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://heretoo.social';
  return `${origin}/sow/${token}`;
}

function inviteText(token: string): string {
  return `${SLOGAN} ${inviteUrl(token)}`;
}

export function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeStyles();
  const create = useCreateSeedInvite();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  // One token per opening. Closing without sending costs nothing — the
  // token expires on its own like any unplanted seed.
  useEffect(() => {
    if (!visible) { setToken(null); setEmail(''); return; }
    create.mutateAsync({}).then(setToken).catch((e: any) => {
      showAlert('Could not make the invitation', e?.message ?? 'Try again.');
      onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onText = async () => {
    if (!token) return;
    const text = inviteText(token);
    // The native share sheet, not an sms: navigation. The sms: URL made
    // the browser interrupt with an open-this-app? dialog before
    // anything happened; the share sheet opens clean, Messages is one
    // tap inside it, and the same prefilled text rides along.
    if (Platform.OS === 'web' && (navigator as any).share) {
      try {
        await (navigator as any).share({ text });
        onClose();
        return;
      } catch {
        // Dismissed the sheet — nothing sent, sheet stays open.
        return;
      }
    }
    const url = `sms:?&body=${encodeURIComponent(text)}`;
    if (Platform.OS === 'web') {
      window.location.href = url;
    } else {
      Linking.openURL(url).catch(() => {});
    }
    onClose();
  };

  const onEmail = async () => {
    if (!token) return;
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showAlert('Not an email address', 'Check it and try again.');
      return;
    }
    setSending(true);
    try {
      const { data } = await supabase.auth.getSession();
      const jwt = data?.session?.access_token;
      const res = await fetch('/.netlify/functions/invite-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ token, email: to }),
      });
      if (res.ok) {
        showAlert('Sent', to);
        onClose();
        return;
      }
      // Server mail unavailable — the device's composer carries it.
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(SLOGAN)}&body=${encodeURIComponent(inviteText(token))}`;
      if (Platform.OS === 'web') window.location.href = mailto;
      else Linking.openURL(mailto).catch(() => {});
      onClose();
    } finally {
      setSending(false);
    }
  };

  const onCopy = async () => {
    if (!token) return;
    const url = inviteUrl(token);
    try {
      await (navigator as any).clipboard?.writeText(url);
      showAlert('Link copied', url);
    } catch {
      showAlert('The link', url);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.card}>
          <Text style={s.title}>Invite</Text>

          {!token ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <>
              <TouchableOpacity style={s.row} onPress={onText} activeOpacity={0.7}>
                <Ionicons name="chatbox-outline" size={18} color={Colors.textPrimary} />
                <Text style={s.rowText}>Text</Text>
              </TouchableOpacity>

              <View style={s.emailRow}>
                <TextInput
                  style={s.emailInput}
                  accessibilityLabel="Email"
                  placeholder="Email"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[s.emailSend, (!email.trim() || sending) && { opacity: 0.4 }]}
                  onPress={onEmail}
                  disabled={!email.trim() || sending}
                >
                  {sending
                    ? <ActivityIndicator color={Colors.onPrimary} size="small" />
                    : <Ionicons name="send" size={16} color={Colors.onPrimary} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.row} onPress={onCopy} activeOpacity={0.7}>
                <Ionicons name="link-outline" size={18} color={Colors.textPrimary} />
                <Text style={s.rowText}>Copy the link</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function makeStyles() { return StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14,
    width: '100%', maxWidth: 420, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: Heights.touchTarget,
    paddingHorizontal: 12,
    borderRadius: Radius.control,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  rowText: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary },
  emailRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  emailInput: {
    flex: 1, minHeight: Heights.input,
    paddingHorizontal: 12,
    borderRadius: Radius.control,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    fontSize: 16, color: Colors.textPrimary,
  },
  emailSend: {
    width: 42, height: 42, borderRadius: Radius.control,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
