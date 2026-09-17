/**
 * /verify — the gate into a public voice.
 *
 * A new account reaches verified_human through one of two doors:
 *
 *   invite   a member sent them a personal invite (/add) and they
 *            consumed it. Migration 098 stamps that from a trigger on
 *            seed_invites, so nothing in the response says it happened
 *            — this screen re-reads on mount to notice.
 *
 *            A COHORT INVITE CODE IS NOT THIS. Every cohort's standing
 *            code is readable by any signed-in account, so joining with
 *            one proves nothing and 098 refuses to vouch on it. The
 *            copy below says so; keep the two in step.
 *
 *   selfie   a photo whose camera timestamp sits within 24 hours of
 *            now, judged by /api/verify-selfie. ONLY THE HEAD OF THE
 *            FILE travels (EXIF lives there), the server reads the
 *            timestamp in memory and discards the bytes. Nothing is
 *            stored, ever — the selfie is not a profile picture and
 *            never becomes one.
 *
 * WEB ONLY for the selfie door, and deliberately raw DOM: any
 * picker that re-encodes the image (expo-image-picker on web does)
 * strips the EXIF this whole check reads. The original File object is
 * the only trustworthy source, so the input is created by hand.
 *
 * Unverified accounts still browse everything. This screen is not a
 * wall in front of the app; it is the door in front of posting.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { refreshVerified } from '../hooks/useAuth';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/shared/Button';
import { Eyebrow } from '../components/shared/Eyebrow';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type } from '../constants/design';

/** EXIF rides in the first APP1 segment; 1MB is generous headroom. */
const HEAD_BYTES = 1024 * 1024;

type Stage = 'idle' | 'checking' | 'failed';

const FAIL_COPY: Record<string, string> = {
  not_jpeg: 'That file is not a JPEG photo. Upload the photo straight from your camera, not a screenshot or an edit.',
  no_timestamp: 'That photo carries no camera timestamp. Take a fresh one with your camera app and upload the original file.',
  out_of_window: 'That photo was taken more than 24 hours ago. Take a new one.',
  rate_limited: 'Too many tries. Wait an hour and try again.',
  confirm_failed: 'Your photo checked out, but we could not confirm it just now. Reload this page — you may already be verified.',
  guest: 'This is a guest session. Make an account first, then verify it.',
};

export default function VerifyScreen() {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const session = useAuthStore((st) => st.session);
  const isLoading = useAuthStore((st) => st.isLoading);
  const verified = useAuthStore((st) => st.verified) === true;
  // Both doors refuse an anonymous session — the vouch trigger returns
  // early on uid_is_guest() and verify-selfie answers reason:'guest'.
  // Showing a guest the two-doors screen is a dead end with no way
  // forward on it, so the screen says the true thing instead.
  const isGuest = useAuthStore((st) => (st.user as any)?.is_anonymous === true);
  const [stage, setStage] = useState<Stage>('idle');
  const [failReason, setFailReason] = useState<string | null>(null);
  // The DOM input outlives renders; one per mount.
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Re-ask on arrival. The invite door is stamped by a database trigger
  // when a seed invite is consumed — no response carries that news, and
  // the store still holds whatever was true at sign-in. Without this,
  // someone who just accepted an invite lands on a screen telling them
  // to take a selfie they do not need, and the header's claim that this
  // screen "just notices" the invite door is a lie.
  useEffect(() => {
    if (!userId) return;
    void refreshVerified(userId);
  }, [userId]);

  // Auth gate. This screen sits at the root, outside the (tabs) group,
  // so it inherits no guard — and without one a signed-out visitor met
  // the full gate and an Upload button that could only ever fail
  // ("Not signed in", surfaced as a generic error). Verification is an
  // act performed BY an account; there is nothing here for someone who
  // does not have one yet. Wait out the session restore first, or a
  // reload on this URL bounces a signed-in user to the door.
  if (!isLoading && !session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  const sendHead = async (file: File) => {
    setStage('checking');
    setFailReason(null);
    try {
      const head = file.slice(0, HEAD_BYTES);
      const b64 = await blobToBase64(head);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/verify-selfie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64: b64 }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out?.ok) {
        // Confirm it before claiming it. This screen has no success
        // state of its own — it reads the store — so if the re-read
        // fails we would otherwise repaint the identical gate and the
        // user would have no idea whether their selfie counted.
        const now = userId ? await refreshVerified(userId) : null;
        if (now === true) {
          setStage('idle');
          return;
        }
        setFailReason('confirm_failed');
        setStage('failed');
        return;
      }
      setFailReason(typeof out?.reason === 'string' ? out.reason : 'error');
      setStage('failed');
    } catch {
      setFailReason('error');
      setStage('failed');
    }
  };

  const pickSelfie = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      // JPEG only: it is the format whose EXIF the server reads, and
      // iOS transcodes HEIC to JPEG when a page asks for image/jpeg.
      input.accept = 'image/jpeg,image/jpg';
      // Front camera on phones; desktop falls back to the file picker.
      input.setAttribute('capture', 'user');
      input.style.display = 'none';
      input.onchange = () => {
        const f = input.files?.[0];
        // Allow re-picking the same file after a failure.
        input.value = '';
        if (f) void sendHead(f);
      };
      document.body.appendChild(input);
      inputRef.current = input;
    }
    inputRef.current.click();
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          {verified ? (
            <>
              <Ionicons name="checkmark-circle" size={44} color={Colors.primary} style={s.icon} />
              <Eyebrow>Verified</Eyebrow>
              <Text style={s.title}>You're verified.</Text>
              <Button
                title="Go to the feed"
                onPress={() => router.replace('/(tabs)/feed' as any)}
                variant="primary"
                size="lg"
                style={s.cta}
              />
            </>
          ) : isGuest ? (
            <>
              <Ionicons name="person-outline" size={40} color={Colors.textPrimary} style={s.icon} />
              <Eyebrow>Guest</Eyebrow>
              <Text style={s.title}>You're here as a guest</Text>
              <Text style={s.body}>
                A guest can read and message. Posting in public needs an
                account of your own — make one, then verify it.
              </Text>
              <Button
                title="Make an account"
                onPress={() => router.push('/(auth)/welcome' as any)}
                variant="primary"
                size="lg"
                style={s.cta}
              />
              <TouchableOpacity
                onPress={() => router.replace('/(tabs)/feed' as any)}
                style={s.laterBtn}
                accessibilityRole="button"
                accessibilityLabel="Back to the feed"
              >
                <Text style={s.laterText}>Back to the feed</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="finger-print-outline" size={40} color={Colors.textPrimary} style={s.icon} />
              <Eyebrow>One-time check</Eyebrow>
              <Text style={s.title}>Verify your account</Text>
              <Text style={s.body}>
                Posting and replying in public need a verified account. Two
                ways in: an invite from a verified member, or a selfie taken
                within the last 24 hours.
              </Text>

              {Platform.OS === 'web' ? (
                <>
                  <Button
                    title={stage === 'checking' ? 'Checking…' : 'Upload a selfie'}
                    onPress={pickSelfie}
                    loading={stage === 'checking'}
                    disabled={stage === 'checking'}
                    variant="primary"
                    size="lg"
                    style={s.cta}
                  />
                  <Text style={s.fine}>
                    The photo is read for its timestamp and discarded — it is
                    never stored and never shown. Your profile picture is
                    separate; add one whenever you like.
                  </Text>
                </>
              ) : (
                <Text style={s.body}>
                  The selfie check runs on the web — open heretoo.social in a
                  browser, or use an invite link instead.
                </Text>
              )}

              {stage === 'checking' && (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.sm }} />
              )}

              {stage === 'failed' && (
                <View style={s.failBox}>
                  <Text style={s.failText}>
                    {FAIL_COPY[failReason ?? ''] ?? 'That did not go through. Try again.'}
                  </Text>
                </View>
              )}

              <View style={s.inviteRow}>
                <Ionicons name="mail-open-outline" size={14} color={Colors.textSecondary} />
                <Text style={s.inviteText}>
                  A personal invite from a verified member verifies you when
                  you open it. A shared cohort code does not.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.replace('/(tabs)/feed' as any)}
                style={s.laterBtn}
                accessibilityRole="button"
                accessibilityLabel="Skip for now"
              >
                <Text style={s.laterText}>Not now — look around first</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('read failed'));
    r.onload = () => {
      const url = String(r.result ?? '');
      const comma = url.indexOf(',');
      resolve(comma >= 0 ? url.slice(comma + 1) : url);
    };
    r.readAsDataURL(blob);
  });
}

function makeStyles() { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 28, paddingVertical: Spacing.xl,
    maxWidth: 460, alignSelf: 'center', width: '100%',
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs,
  },
  icon: { marginBottom: Spacing.xs },
  title: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: '700', color: Colors.textPrimary, textAlign: 'center',
  },
  body: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xxs,
  },
  cta: { width: '100%', marginTop: Spacing.sm },
  fine: {
    fontSize: 12, lineHeight: 17, color: Colors.textMuted,
    textAlign: 'center', marginTop: Spacing.xs,
  },
  failBox: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md,
    padding: Spacing.sm, marginTop: Spacing.sm, width: '100%',
  },
  failText: { color: Colors.error, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.md, paddingHorizontal: Spacing.xs,
  },
  inviteText: { flex: 1, fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  laterBtn: { marginTop: Spacing.sm, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  laterText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
}); }
