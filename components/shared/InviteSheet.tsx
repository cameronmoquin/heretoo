/**
 * InviteSheet — the invitation is a message.
 *
 * The text reads "«Name» sent you a message on HereToo" and the link
 * opens the conversation itself: the recipient lands in the thread as
 * a guest, signed in anonymously, named by the number the sender
 * addressed. No form between a person and a message meant for them.
 *
 * Three deliveries:
 *
 *   TEXT   type their number, and the native share sheet opens with
 *          the invitation prefilled — it sends from the inviter's own
 *          phone, and the number rides the invite as the guest's
 *          username. The platform reads no address books; the sender
 *          typed what the sender knows.
 *   EMAIL  the server sends the branded note (mailto fallback when
 *          unconfigured).
 *   LINK   copied, to carry anywhere else.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  Platform, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useCreateSeedInvite } from '../../hooks/useSeedInvite';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, Heights } from '../../constants/design';

function inviteUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://heretoo.social';
  return `${origin}/sow/${token}`;
}

function inviteText(name: string, token: string): string {
  return `${name} sent you a message on HereToo. Click to respond: ${inviteUrl(token)}`;
}

export function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = makeStyles();
  const create = useCreateSeedInvite();
  const userId = useAuthStore((st) => st.user?.id);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState<'text' | 'email' | 'link' | null>(null);

  // The share sheet only opens inside the tap itself — an await before
  // navigator.share() spends the user gesture and the browser refuses.
  // So the token is minted WHILE the number is typed, and the tap finds
  // it ready and calls share() synchronously.
  const [readyToken, setReadyToken] = useState<{ handle: string; token: string } | null>(null);
  const mintTimer = useRef<any>(null);
  useEffect(() => {
    const to = phone.replace(/[^\d+]/g, '');
    if (to.length < 7) { setReadyToken(null); return; }
    if (readyToken?.handle === to) return;
    clearTimeout(mintTimer.current);
    mintTimer.current = setTimeout(() => {
      create.mutateAsync({ guestHandle: to })
        .then((token) => setReadyToken({ handle: to, token }))
        .catch(() => setReadyToken(null));
    }, 500);
    return () => clearTimeout(mintTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const { data: me } = useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, handle')
        .eq('id', userId!)
        .maybeSingle();
      return data;
    },
  });
  const myName = me?.display_name ?? (me?.handle ? `@${me.handle}` : 'Someone');

  const onText = () => {
    const to = phone.replace(/[^\d+]/g, '');
    if (to.length < 7) {
      showAlert('Not a number', 'Check it and try again.');
      return;
    }
    // Synchronous from here to share() — the gesture must not be spent.
    if (readyToken?.handle === to && Platform.OS === 'web' && (navigator as any).share) {
      const text = inviteText(myName, readyToken.token);
      (navigator as any).share({ text })
        .then(() => onClose())
        .catch((e: any) => {
          // Dismissing the sheet is not an error. Anything else falls
          // back to the sms: composer with the same text.
          if (e?.name === 'AbortError') return;
          window.location.href = `sms:${encodeURIComponent(to)}?&body=${encodeURIComponent(text)}`;
          onClose();
        });
      return;
    }
    // Token not minted yet (fast tap) or no Web Share: the sms: path
    // tolerates the await.
    setWorking('text');
    (readyToken?.handle === to
      ? Promise.resolve(readyToken.token)
      : create.mutateAsync({ guestHandle: to }))
      .then((token) => {
        const url = `sms:${encodeURIComponent(to)}?&body=${encodeURIComponent(inviteText(myName, token))}`;
        if (Platform.OS === 'web') window.location.href = url;
        else Linking.openURL(url).catch(() => {});
        onClose();
      })
      .catch((e: any) => showAlert('Could not make the invitation', e?.message ?? 'Try again.'))
      .finally(() => setWorking(null));
  };

  const onEmail = async () => {
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showAlert('Not an email address', 'Check it and try again.');
      return;
    }
    setWorking('email');
    try {
      const token = await create.mutateAsync({});
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
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`${myName} sent you a message on HereToo`)}&body=${encodeURIComponent(inviteText(myName, token))}`;
      if (Platform.OS === 'web') window.location.href = mailto;
      else Linking.openURL(mailto).catch(() => {});
      onClose();
    } catch (e: any) {
      showAlert('Could not make the invitation', e?.message ?? 'Try again.');
    } finally {
      setWorking(null);
    }
  };

  const onCopy = async () => {
    setWorking('link');
    try {
      const token = await create.mutateAsync({});
      const url = inviteUrl(token);
      try {
        await (navigator as any).clipboard?.writeText(url);
        showAlert('Link copied', url);
      } catch {
        showAlert('The link', url);
      }
      onClose();
    } catch (e: any) {
      showAlert('Could not make the invitation', e?.message ?? 'Try again.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.card}>
          <Text style={s.title}>Invite</Text>

          <View style={s.sendRow}>
            <TextInput
              style={s.input}
              accessibilityLabel="Phone number"
              placeholder="Phone number"
              placeholderTextColor={Colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.sendBtn, (working === 'text' || phone.replace(/[^\d]/g, '').length < 7) && { opacity: 0.4 }]}
              onPress={onText}
              disabled={working !== null}
              accessibilityLabel="Text"
            >
              {working === 'text'
                ? <ActivityIndicator color={Colors.onPrimary} size="small" />
                : <Ionicons name="chatbox-outline" size={16} color={Colors.onPrimary} />}
            </TouchableOpacity>
          </View>

          <View style={s.sendRow}>
            <TextInput
              style={s.input}
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
              style={[s.sendBtn, (working === 'email' || !email.trim()) && { opacity: 0.4 }]}
              onPress={onEmail}
              disabled={working !== null}
              accessibilityLabel="Email"
            >
              {working === 'email'
                ? <ActivityIndicator color={Colors.onPrimary} size="small" />
                : <Ionicons name="send" size={16} color={Colors.onPrimary} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.row} onPress={onCopy} activeOpacity={0.7} disabled={working !== null}>
            <Ionicons name="link-outline" size={18} color={Colors.textPrimary} />
            <Text style={s.rowText}>{working === 'link' ? 'Making the link…' : 'Copy the link'}</Text>
          </TouchableOpacity>
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
  sendRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1, minHeight: Heights.input,
    paddingHorizontal: 12,
    borderRadius: Radius.control,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    fontSize: 16, color: Colors.textPrimary,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: Radius.control,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
