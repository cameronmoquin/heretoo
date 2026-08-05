/**
 * /cipher — a Caesar shift, for passing notes.
 *
 * Type a message, pick a shift, read the scrambled version. Swap moves the
 * result back into the input so decoding is the same screen with the opposite
 * shift, rather than a second mode to explain.
 *
 * "Try all 25" exists because the interesting half of a cipher is breaking one
 * you don't have the key for. It shows every possible decoding and lets the
 * reader find the line that looks like English — which teaches why 25 keys is
 * not security, without anyone having to say so.
 *
 * Pairs with Deaddrop: scramble here, hide the code there.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type, Heights, Layout } from '../constants/design';
import { encode, crack } from '../lib/caesar';

export default function CipherScreen() {
  const [text, setText] = useState('');
  const [shift, setShift] = useState(3);
  const [showAll, setShowAll] = useState(false);

  const styles = makeStyles();

  const result = useMemo(() => encode(text, shift), [text, shift]);
  const attempts = useMemo(
    () => (showAll && text ? crack(text) : []),
    [showAll, text]
  );

  const bump = (by: number) => setShift((s) => (((s + by) % 26) + 26) % 26);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="Cipher" showBack />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write a message"
            placeholderTextColor={Colors.textMuted}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Message to scramble"
          />

          <View style={styles.shiftRow}>
            <Text style={styles.shiftLabel}>Shift</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                onPress={() => bump(-1)}
                style={styles.stepBtn}
                accessibilityLabel="Decrease shift"
              >
                <Ionicons name="remove" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.shiftValue}>{shift}</Text>
              <TouchableOpacity
                onPress={() => bump(1)}
                style={styles.stepBtn}
                accessibilityLabel="Increase shift"
              >
                <Ionicons name="add" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.output}>
            <Text style={styles.outputText} selectable>
              {result || ' '}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              // The whole decode flow: put the scrambled text back in, then
              // walk the shift down until it reads.
              setText(result);
              setShift((s) => (26 - s) % 26);
            }}
            disabled={!text}
            style={[styles.btn, styles.ghostBtn, !text && styles.btnDisabled]}
            accessibilityLabel="Move result into the message box and reverse the shift"
          >
            <Text style={styles.ghostBtnText}>Swap and reverse</Text>
          </TouchableOpacity>

          <Pressable
            onPress={() => setShowAll((v) => !v)}
            style={styles.allToggle}
            accessibilityRole="button"
          >
            <Ionicons
              name={showAll ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.allToggleText}>
              Try all 25 shifts
            </Text>
          </Pressable>

          {showAll && !text && (
            <Text style={styles.hint}>Paste a scrambled message first.</Text>
          )}

          {attempts.map((row) => (
            <Pressable
              key={row.shift}
              style={styles.attemptRow}
              onPress={() => {
                setText(row.text);
                setShowAll(false);
                setShift(0);
              }}
              accessibilityLabel={`Use shift ${row.shift}`}
            >
              <Text style={styles.attemptShift}>{row.shift}</Text>
              <Text style={styles.attemptText} numberOfLines={2}>
                {row.text}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: {
    padding: Layout.columnPadding,
    paddingBottom: Spacing.xxl,
    maxWidth: Layout.columnMaxWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.control,
    padding: Spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shiftLabel: {
    fontSize: Type.ui.size,
    lineHeight: Type.ui.lineHeight,
    fontWeight: Type.ui.weight,
    color: Colors.textSecondary,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepBtn: {
    width: Heights.touchTarget,
    height: Heights.touchTarget,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftValue: {
    fontSize: Type.title.size,
    lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight,
    color: Colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  output: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.control,
    padding: Spacing.md,
    minHeight: 120,
  },
  outputText: {
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
  btn: {
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Heights.button,
  },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: { borderWidth: 1, borderColor: Colors.border },
  ghostBtnText: {
    fontSize: Type.ui.size,
    fontWeight: Type.uiBold.weight,
    color: Colors.textPrimary,
  },
  allToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: Heights.touchTarget,
  },
  allToggleText: {
    fontSize: Type.ui.size,
    lineHeight: Type.ui.lineHeight,
    fontWeight: Type.ui.weight,
    color: Colors.textSecondary,
  },
  hint: {
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  attemptShift: {
    fontSize: Type.caption.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.textMuted,
    minWidth: 20,
    textAlign: 'right',
  },
  attemptText: {
    flex: 1,
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
}); }
