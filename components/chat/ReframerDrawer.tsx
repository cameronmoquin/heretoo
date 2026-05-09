/**
 * ReframerDrawer — the calm side-drawer that reads what the other
 * person likely meant, what your draft might land as, and an optional
 * alternative phrasing. Source of Truth, Milestone 8.
 *
 * Plain prose. Source Serif. Three short paragraphs. The user
 * accepts, edits, or ignores. The other party never knows.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReframerResult } from '../../hooks/useReframer';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  visible: boolean;
  loading: boolean;
  result: ReframerResult | null;
  error: string | null;
  onClose: () => void;
  /** Called when the user copies the alternative draft into their
   *  composer. Closes the drawer and nudges the parent to update its
   *  draft state. */
  onUseAlternative: (text: string) => void;
}

export function ReframerDrawer({
  visible, loading, result, error, onClose, onUseAlternative,
}: Props) {
  const s = makeStyles();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.scrim}>
        <View style={s.sheet}>
          <View style={s.headerRow}>
            <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
            <Text style={s.kicker}>A second pair of eyes</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} contentContainerStyle={{ gap: Spacing.md }}>
            {loading && (
              <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={s.subtle}>Reading…</Text>
              </View>
            )}

            {!!error && !loading && (
              <Text style={s.errorText}>{error}</Text>
            )}

            {!loading && !error && result && (
              <>
                {!!result.readingTheirs && (
                  <View>
                    <Text style={s.label}>Reading their note</Text>
                    <Text style={s.paragraph}>{result.readingTheirs}</Text>
                  </View>
                )}
                {!!result.readingYours && (
                  <View>
                    <Text style={s.label}>Reading your draft</Text>
                    <Text style={s.paragraph}>{result.readingYours}</Text>
                  </View>
                )}
                {!!result.alternative && (
                  <View>
                    <Text style={s.label}>An alternative</Text>
                    <Text style={s.paragraph}>{result.alternative}</Text>
                    <View style={s.actions}>
                      <TouchableOpacity
                        style={s.useBtn}
                        onPress={() => onUseAlternative(result.alternative)}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="arrow-forward" size={14} color="#FFF" />
                        <Text style={s.useBtnText}>Use this</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.skipBtn}
                        onPress={onClose}
                        activeOpacity={0.85}
                      >
                        <Text style={s.skipBtnText}>I'll write my own</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles() { return StyleSheet.create({
  scrim: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xl,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 720, alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  body: { paddingTop: Spacing.md, marginBottom: 0 },
  label: {
    fontSize: 11, fontWeight: '700', color: Colors.textPrimary,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 15, lineHeight: 24, color: Colors.textPrimary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },
  subtle: { color: Colors.textMuted, fontSize: 12, marginTop: 6 },
  errorText: { color: Colors.error, fontSize: 13, padding: Spacing.md },

  actions: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  useBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  useBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  skipBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  skipBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
}); }


/** ReframerEye — the little inline icon that appears next to the
 *  send button when escalation is detected. Calm shape, never
 *  sparkles or "AI" branding. */
export function ReframerEye({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  if (!visible) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={eyeStyles.btn}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const eyeStyles = StyleSheet.create({
  btn: {
    width: 32, height: 32, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
});
