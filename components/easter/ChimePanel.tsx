/**
 * ChimePanel — discoverable crystal-bowl chimes.
 *
 * A small, hidden delight: long-press the HereToo wordmark on the
 * Room's masthead and a row of five chime bowls slides down. Each
 * one rings a tone tuned to C pentatonic (C, D, E, G, A across the
 * 4th and 5th octaves). The pentatonic scale has the property that
 * every subset is consonant — the user can tap one bowl, three at
 * once, all five rapidly, and they will all be in harmony.
 *
 * Sound is synthesized live via Web Audio API. No audio files are
 * shipped; each chime is a sine fundamental + two quiet partials
 * (octave + perfect fifth) with a soft 200ms attack and a 6-second
 * exponential release. Multiple voices stack indefinitely.
 *
 * Native: returns null (Web Audio is web-only).
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';

// C major pentatonic across two octaves — every subset consonant.
const NOTES: Array<{ label: string; freq: number }> = [
  { label: 'C', freq: 261.63 },  // C4
  { label: 'D', freq: 293.66 },
  { label: 'E', freq: 329.63 },
  { label: 'G', freq: 392.00 },
  { label: 'A', freq: 440.00 },
  { label: 'C', freq: 523.25 },  // C5
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!_ctx) {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    _ctx = new Ctx();
  }
  // Re-pin to a non-null local so TS narrows.
  const ctx = _ctx as AudioContext;
  // Some browsers suspend the context until user interaction; this call
  // is a no-op if it's already running.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Strike a singing-bowl tone at the given frequency. Multiple calls
 *  layer freely — the function returns immediately and the voice
 *  rings out on its own envelope. */
function strike(freq: number) {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 6.5;

  // Master gain (the bowl envelope).
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.45, now + 0.2);          // soft attack
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);    // long release
  env.connect(ctx.destination);

  // Fundamental — slightly detuned pair for the gentle wobble that
  // gives a bowl its breathing quality.
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 1.0035; // +6 cents
  const fundGain = ctx.createGain();
  fundGain.gain.value = 0.7;
  o1.connect(fundGain);
  o2.connect(fundGain);
  fundGain.connect(env);

  // Octave partial (quiet, softer envelope).
  const oct = ctx.createOscillator();
  oct.type = 'sine';
  oct.frequency.value = freq * 2;
  const octG = ctx.createGain();
  octG.gain.value = 0.18;
  oct.connect(octG);
  octG.connect(env);

  // Perfect-fifth partial (very quiet — adds shimmer without altering
  // the perceived pitch).
  const fifth = ctx.createOscillator();
  fifth.type = 'sine';
  fifth.frequency.value = freq * 3;
  const fifthG = ctx.createGain();
  fifthG.gain.value = 0.06;
  fifth.connect(fifthG);
  fifthG.connect(env);

  // Start + stop. Stops slightly past the envelope end so the GC
  // collects the nodes cleanly.
  [o1, o2, oct, fifth].forEach((o) => {
    o.start(now);
    o.stop(now + dur + 0.2);
  });
}

export function ChimePanel({ visible, onClose }: Props) {
  const s = makeStyles();
  // Pre-warm the AudioContext on first mount so the very first tap
  // doesn't have a noticeable startup delay.
  useEffect(() => { if (visible) getCtx(); }, [visible]);

  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.row}>
        <Text style={s.kicker}>chime · c pentatonic</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={onClose}
          style={s.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={s.bowls}>
        {NOTES.map((n, i) => (
          <Bowl key={i} freq={n.freq} label={n.label} index={i} />
        ))}
      </View>
    </View>
  );
}

function Bowl({ freq, label, index }: { freq: number; label: string; index: number }) {
  const s = makeStyles();
  const ringRef = useRef<View | null>(null);

  const ring = () => {
    strike(freq);
    // Visual: a small inflate + fade on the bowl ring. Web only,
    // accomplished by mutating the DOM directly via the ref.
    if (Platform.OS !== 'web') return;
    const el = ringRef.current as unknown as HTMLElement | null;
    if (!el) return;
    el.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.18)', opacity: 0.35, offset: 0.2 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 1400, easing: 'cubic-bezier(0.2, 0.0, 0, 1)' },
    );
  };

  // Each bowl is a slightly different size — the visual analog of
  // pitch. The lower notes are larger.
  const size = 56 - index * 4;

  return (
    <TouchableOpacity onPress={ring} activeOpacity={0.7} style={s.bowlSlot}>
      <View
        ref={ringRef as any}
        style={[s.bowl, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={s.bowlLabel}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(22, 22, 29, 0.85)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.primary,
    marginVertical: Spacing.sm,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as any) : {}),
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  kicker: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    letterSpacing: 2, textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  closeBtn: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244, 241, 232, 0.06)',
  },
  bowls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  bowlSlot: {
    alignItems: 'center', justifyContent: 'center',
    flex: 1,
  },
  bowl: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(201, 161, 75, 0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  bowlLabel: {
    fontSize: 14, fontWeight: '600', color: Colors.primary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
}); }
