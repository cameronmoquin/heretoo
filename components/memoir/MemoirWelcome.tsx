/**
 * MemoirWelcome — three plain pages that introduce the memoir to a
 * first-time writer.
 *
 *   1. What this is. We ask questions, you answer in your own voice,
 *      and we turn it into a real paperback your family can hold.
 *   2. Privacy. Your words are yours. We do not train AI on them and
 *      we do not sell them. Only you read them unless you choose to
 *      share.
 *   3. Title. What would you like to call your book? (Optional; you
 *      can change it later from the book screen.)
 *
 * Rendered as a full-page overlay before the interview surface.
 * Elder-readable by default so a 75-year-old can read it on first
 * sight without squinting. No nags, no streaks, no quest mechanics —
 * exactly what the spec asks for.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';

interface Props {
  initialTitle: string;
  onComplete: (title: string) => void;
  onSkip?: () => void;
}

const STEPS = 3;

export function MemoirWelcome({ initialTitle, onComplete, onSkip }: Props) {
  const reading = useMemoirReadingMode();
  const { elder } = reading;
  const s = makeStyles(elder);
  // Icons inside the page card use the manuscript palette (sepia /
  // bronze on vellum). The Continue / Begin button text uses onAccent.
  const ic = elder
    ? { primary: '#2A1F18', accent: '#8A5B1A', secondary: '#5A4A38', onAccent: '#FBF4DE' }
    : { primary: Colors.textPrimary, accent: Colors.primary, secondary: Colors.textSecondary, onAccent: '#0A0A0F' };

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(initialTitle || 'My Life, So Far');

  const next = () => {
    if (step < STEPS - 1) setStep(step + 1);
    else onComplete(title.trim() || 'My Life, So Far');
  };
  const back = () => { if (step > 0) setStep(step - 1); };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header: Aa toggle + skip */}
        <View style={s.header}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
          </TouchableOpacity>
          {!!onSkip && (
            <TouchableOpacity onPress={onSkip} style={s.skipBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.stage}>
          {step === 0 && (
            <>
              <Text style={s.kicker}>Welcome</Text>
              <Text style={s.h1}>You&apos;re going to write a book.</Text>
              <Text style={s.body}>
                We&apos;ll ask you a question. You&apos;ll answer in your own words, by
                voice or by typing. Then another question. Then another. Over
                weeks or months — your pace — your answers become a real
                paperback your family can hold.
              </Text>
              <Text style={s.body}>
                There is no schedule. No deadline. No streak. The room is here
                whenever you come back.
              </Text>
              <View style={s.illoRow}>
                <Illo icon="mic-outline" label="You speak or type" ic={ic} s={s} />
                <Illo icon="chatbubble-ellipses-outline" label="We ask the next question" ic={ic} s={s} />
                <Illo icon="book-outline" label="It becomes a book" ic={ic} s={s} />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={s.kicker}>Your words are yours</Text>
              <Text style={s.h1}>Private by default.</Text>
              <View style={s.privacyList}>
                <PrivacyLine icon="lock-closed-outline"
                  text="Only you can read your answers. Nobody at HereToo, no other family, nobody else." ic={ic} s={s} />
                <PrivacyLine icon="shield-checkmark-outline"
                  text="We do not use your stories to train AI." ic={ic} s={s} />
                <PrivacyLine icon="cash-outline"
                  text="We do not sell your stories. Ever." ic={ic} s={s} />
                <PrivacyLine icon="heart-outline"
                  text="If you want to share a particular answer with your family, you decide which one and when." ic={ic} s={s} />
              </View>
              <Text style={s.bodySmall}>
                When the time comes to print the book, you&apos;ll download the
                files and place the order yourself with Amazon&apos;s print
                service — the book is yours, start to finish.
              </Text>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={s.kicker}>One last thing</Text>
              <Text style={s.h1}>What should we call your book?</Text>
              <Text style={s.body}>
                You can change this any time. If you&apos;re not sure, leave it
                as &ldquo;My Life, So Far.&rdquo;
              </Text>
              <TextInput
                style={s.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="My Life, So Far"
                placeholderTextColor={elder ? '#9A9684' : Colors.textMuted}
                maxLength={120}
                autoFocus
              />
            </>
          )}
        </View>

        {/* Step dots */}
        <View style={s.dots}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <View key={i} style={[s.dot, i === step && s.dotActive]} />
          ))}
        </View>

        {/* Nav */}
        <View style={s.nav}>
          {step > 0 ? (
            <TouchableOpacity style={s.backBtn} onPress={back} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={18} color={ic.secondary} />
              <Text style={s.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : <View />}
          <TouchableOpacity style={s.nextBtn} onPress={next} activeOpacity={0.85}>
            <Text style={s.nextBtnText}>
              {step === STEPS - 1 ? 'Begin' : 'Continue'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={ic.onAccent} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Illo({ icon, label, ic, s }: { icon: any; label: string; ic: any; s: any }) {
  return (
    <View style={s.illo}>
      <View style={s.illoCircle}>
        <Ionicons name={icon} size={22} color={ic.accent} />
      </View>
      <Text style={s.illoLabel}>{label}</Text>
    </View>
  );
}

function PrivacyLine({ icon, text, ic, s }: { icon: any; text: string; ic: any; s: any }) {
  return (
    <View style={s.privacyRow}>
      <Ionicons name={icon} size={20} color={ic.accent} style={{ marginTop: 2 }} />
      <Text style={s.privacyText}>{text}</Text>
    </View>
  );
}

function makeStyles(elder: boolean) {
  // Manuscript mode: brand wallpaper visible, vellum page card holds
  // the welcome content. Chrome colours (header, toggles) stay on the
  // dark wallpaper; page contents use sepia ink on vellum.
  const chromeText = elder ? Colors.brandIvory : Colors.brandIvory;
  const chromeMuted = elder ? Colors.textMuted : Colors.textMuted;
  const chromeBorder = elder ? Colors.border : Colors.border;
  const chromeSecondary = elder ? Colors.textSecondary : Colors.textSecondary;

  const pageCardBg = elder ? '#F2E8CC' : 'transparent';
  const pageInk = elder ? '#2A1F18' : Colors.brandIvory;
  const pageInkSecondary = elder ? '#5A4A38' : Colors.textSecondary;
  const pageAccent = elder ? '#8A5B1A' : Colors.primary;
  const pageBorder = elder ? '#CFC0A0' : Colors.border;
  const pageSurface = elder ? '#FBF4DE' : Colors.surface;
  const onAccent = elder ? '#FBF4DE' : '#0A0A0F';

  const pageCardWeb = (elder && Platform.OS === 'web') ? ({
    backgroundImage:
      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(95,70,40,0.07) 31px, rgba(95,70,40,0.07) 32px)',
    boxShadow:
      '0 24px 50px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(95,70,40,0.08)',
  } as any) : {};

  const pageCard = elder ? {
    backgroundColor: pageCardBg,
    borderRadius: 14,
    padding: 36,
    borderWidth: 1, borderColor: pageBorder,
    ...pageCardWeb,
  } : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg, minHeight: '100%' as any },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    aaBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: Radius.full, borderWidth: 1, borderColor: chromeBorder,
    },
    aaText: { fontSize: 14, fontWeight: '700', color: chromeSecondary },
    skipBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    skipText: { fontSize: 13, color: chromeMuted, textDecorationLine: 'underline' },

    stage: {
      gap: Spacing.md,
      marginTop: 24,
      ...pageCard,
    },

    kicker: {
      fontSize: 12, fontWeight: '700', color: pageAccent, letterSpacing: 2,
      textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    h1: {
      fontSize: elder ? 30 : 32, lineHeight: elder ? 40 : 42,
      fontWeight: '800', color: pageInk, letterSpacing: -0.4,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    body: {
      fontSize: 17, lineHeight: 28,
      color: pageInk,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    bodySmall: {
      fontSize: 14, lineHeight: 22,
      color: pageInkSecondary, marginTop: 4, fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    illoRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: Spacing.md,
      justifyContent: 'center',
    },
    illo: {
      width: 180, padding: Spacing.md, gap: 8,
      borderRadius: Radius.lg,
      backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
      alignItems: 'center',
    },
    illoCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: elder ? pageCardBg : 'rgba(201,161,75,0.12)',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: pageAccent,
    },
    illoLabel: {
      fontSize: 14, lineHeight: 20, color: pageInkSecondary, textAlign: 'center',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    privacyList: { gap: 14, marginTop: Spacing.sm },
    privacyRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    privacyText: {
      flex: 1,
      fontSize: 16, lineHeight: 26,
      color: pageInk,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    titleInput: {
      padding: Spacing.md,
      borderRadius: 6,
      backgroundColor: pageSurface,
      borderWidth: 1, borderColor: pageBorder,
      fontSize: 19, lineHeight: 28, color: pageInk,
      marginTop: Spacing.sm,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 'auto' as any, paddingTop: Spacing.lg },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: chromeBorder },
    dotActive: { backgroundColor: chromeText, width: 24 },

    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10 },
    backBtnText: { fontSize: 14, color: chromeSecondary, fontWeight: '600' },
    nextBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingHorizontal: 24, paddingVertical: 14,
      borderRadius: Radius.full,
      backgroundColor: pageAccent,
      marginLeft: 'auto',
    },
    nextBtnText: {
      color: onAccent, fontSize: 15, fontWeight: '700', letterSpacing: 0.2,
    },
  });
}
