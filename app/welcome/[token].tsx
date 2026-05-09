/**
 * /welcome/[token] — the recipient's onboarding ceremony.
 *
 * Source of Truth, Milestone 9. The single most leverage-rich screen
 * in the product. The first 90 seconds for a grandmother decide
 * whether HereToo enters her life.
 *
 * Flow:
 *   1. Page loads. Full-bleed warm canvas, one button: "Begin."
 *   2. Tap Begin. Bike Messenger reads a 30-second greeting that
 *      addresses her by name and names her granddaughter.
 *   3. After the voice ends, if the inviter recorded a 20-second
 *      voice note, that plays next.
 *   4. After both audio clips, "Step inside." lights up. Tapping it
 *      routes to the auth flow with the family's invite code
 *      pre-filled, so signup is one form.
 *
 * No fields. No "Skip." No header chrome. The whole screen is the
 * ceremony.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWelcomePublic } from '../../hooks/useWelcomeInvitations';
import { useTTS } from '../../stores/ttsStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

type Phase = 'idle' | 'greeting' | 'voice-note' | 'ready';

export default function WelcomeCeremony() {
  const s = makeStyles();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data, isLoading } = useWelcomePublic(token);
  const tts = useTTS();
  const [phase, setPhase] = useState<Phase>('idle');
  const voiceNoteRef = useRef<HTMLAudioElement | null>(null);

  // Compose the Bike Messenger greeting. Names are interpolated from
  // the invitation row. Tone: a calm friend, not a corporate brand.
  const greetingText = React.useMemo(() => {
    if (!data) return '';
    const recipient = data.recipient_first_name || 'there';
    const relationship = data.recipient_relationship || 'family';
    const inviter = data.inviter_first_name || 'someone in your family';
    return [
      `${recipient}.`,
      `Your ${relationship}, ${inviter}, made you a place here.`,
      `This is HereToo. It's a quieter corner of the internet, made for the people you love.`,
      `I'll walk you through it. There's no rush, and you can come back to this any time.`,
    ].join(' ');
  }, [data]);

  // Track when the greeting finishes so we can auto-advance to the
  // inviter's voice note (if any) or the "ready" phase.
  useEffect(() => {
    if (phase !== 'greeting') return;
    if (!tts.playing && tts.currentId === `welcome-${token}`) {
      // The TTS clip just ended OR the user paused. We move on
      // either way — pausing before the end is still a transition.
      const hasVoiceNote = !!data?.voice_note_url;
      if (hasVoiceNote) setPhase('voice-note');
      else setPhase('ready');
    }
  }, [phase, tts.playing, tts.currentId, token, data?.voice_note_url]);

  // Voice-note playback (granddaughter's actual voice, recorded at
  // create time). Not TTS — a plain HTMLAudio of the stored mp3.
  useEffect(() => {
    if (phase !== 'voice-note' || !data?.voice_note_url) return;
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setPhase('ready');
      return;
    }
    const a = new Audio(data.voice_note_url);
    voiceNoteRef.current = a;
    const onEnd = () => setPhase('ready');
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onEnd);
    a.play().catch(() => setPhase('ready'));
    return () => {
      a.pause();
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onEnd);
    };
  }, [phase, data?.voice_note_url]);

  const onBegin = async () => {
    setPhase('greeting');
    try {
      await tts.toggle(`welcome-${token}`, greetingText);
    } catch {
      // If TTS fails, advance the user past the audio rather than
      // trapping them on the page.
      setPhase('ready');
    }
  };

  const onStepInside = () => {
    // Route to the welcome / auth screen, pre-filled with the family
    // invite code so signup is one form.
    const code = data?.family_invite_code;
    if (code) {
      router.replace(`/(auth)/welcome?invite=${encodeURIComponent(code)}` as any);
    } else {
      router.replace('/(auth)/welcome' as any);
    }
  };

  if (isLoading || !data) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Text style={s.kicker}>This invitation could not be found</Text>
              <Text style={s.fallback}>
                It may have been used already, or the link could have a typo.
                Check with whoever sent it to you.
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        {/* Idle — welcome plaque + Begin button. */}
        {phase === 'idle' && (
          <>
            <Text style={s.kicker}>An invitation</Text>
            <Text style={s.title}>{data.recipient_first_name}.</Text>
            <Text style={s.body}>
              {data.inviter_first_name ? `Your ${data.recipient_relationship || 'family'}, ${data.inviter_first_name}, ` : 'Someone '}
              made you a place here.
            </Text>
            <TouchableOpacity style={s.beginBtn} onPress={onBegin} activeOpacity={0.85}>
              <Ionicons name="play" size={18} color="#FFF" />
              <Text style={s.beginBtnText}>Begin</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Greeting — Bike Messenger speaking. */}
        {phase === 'greeting' && (
          <>
            <View style={s.candleWrap}>
              <Ionicons name="volume-medium" size={22} color={Colors.primary} />
            </View>
            <Text style={s.body}>Listening…</Text>
            <TouchableOpacity onPress={() => setPhase(data?.voice_note_url ? 'voice-note' : 'ready')}>
              <Text style={s.skip}>Skip the introduction</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Voice note — inviter's actual voice. */}
        {phase === 'voice-note' && (
          <>
            <View style={s.candleWrap}>
              <Ionicons name="mic" size={22} color={Colors.primary} />
            </View>
            <Text style={s.body}>A note from {data.inviter_first_name || 'them'}.</Text>
            <TouchableOpacity onPress={() => setPhase('ready')}>
              <Text style={s.skip}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Ready — Step inside. */}
        {phase === 'ready' && (
          <>
            <Text style={s.kicker}>Welcome to HereToo</Text>
            <Text style={s.title}>{data.family_name || 'Your family'}</Text>
            <Text style={s.body}>
              You can come back to this any time. Step inside when you're ready.
            </Text>
            <TouchableOpacity style={s.beginBtn} onPress={onStepInside} activeOpacity={0.85}>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
              <Text style={s.beginBtnText}>Step inside</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.md,
    maxWidth: 540, alignSelf: 'center', width: '100%',
  },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  title: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.textPrimary,
    textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  body: {
    fontSize: 17, lineHeight: 26, color: Colors.textSecondary,
    textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  fallback: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  beginBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    marginTop: Spacing.md,
  },
  beginBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  skip: {
    fontSize: 12, color: Colors.textMuted, marginTop: Spacing.lg,
    textDecorationLine: 'underline',
  },
  candleWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
