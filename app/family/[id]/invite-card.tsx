/**
 * /family/[id]/invite-card — the granddaughter side of the welcome
 * ceremony. Source of Truth, Milestone 9.
 *
 * The Lob print pipeline is a follow-up. v1 lets the inviter:
 *   - Enter the recipient's first name + relationship
 *   - Pick a card design (cosmetic for now; visible to the recipient
 *     in v2 as the visual canvas behind their welcome screen)
 *   - Save → get back a welcome URL to share by hand
 *
 * The recipient opens that URL on /welcome/{token} and gets the
 * full Bike Messenger ceremony.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamily } from '../../../hooks/useFamily';
import { useCreateWelcomeInvitation } from '../../../hooks/useWelcomeInvitations';
import { showAlert } from '../../../lib/alert';
import { Button } from '../../../components/shared/Button';
import { Eyebrow } from '../../../components/shared/Eyebrow';
import { ScreenHeader } from '../../../components/shared/ScreenHeader';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';

type CardDesign = 'pressed-flower' | 'katagami-stencil' | 'type-only';
const DESIGNS: Array<{ id: CardDesign; label: string }> = [
  { id: 'pressed-flower', label: 'Pressed flower' },
  { id: 'katagami-stencil', label: 'Katagami stencil' },
  { id: 'type-only', label: 'Type only' },
];

export default function InviteCardScreen() {
  const s = makeStyles();
  const { id: familyId } = useLocalSearchParams<{ id: string }>();
  const { data: family } = useFamily(familyId);
  const create = useCreateWelcomeInvitation();
  const [recipientName, setRecipientName] = useState('');
  const [relationship, setRelationship] = useState('friend');
  const [design, setDesign] = useState<CardDesign>('pressed-flower');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const onSave = async () => {
    const name = recipientName.trim();
    if (name.length < 1) {
      showAlert('Name needed', 'Add the recipient\'s first name so the greeting can address them.');
      return;
    }
    try {
      const inv = await create.mutateAsync({
        recipientFirstName: name,
        recipientRelationship: relationship.trim() || undefined,
        familyId,
        cardDesign: design,
      });
      const origin = typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://heretoo.social';
      setSavedUrl(`${origin}/welcome/${inv.token}`);
    } catch (e: any) {
      showAlert('Could not create', e?.message ?? 'Try again.');
    }
  };

  const onCopy = async () => {
    if (!savedUrl) return;
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(savedUrl);
        showAlert('Copied', 'Welcome link copied to your clipboard.');
      }
    } catch {}
  };

  const onShare = async () => {
    if (!savedUrl) return;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav?.share) {
      try {
        await nav.share({
          title: family?.name ? `Join ${family.name} on HereToo` : 'Welcome to HereToo',
          text: `${recipientName}, here's your welcome link.`,
          url: savedUrl,
        });
        return;
      } catch {}
    }
    await onCopy();
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader title="A welcome card" showBack />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {!savedUrl && (
          <>
            <View style={s.field}>
              <Eyebrow>Their first name</Eyebrow>
              <TextInput
                style={s.input}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Margaret"
                placeholderTextColor={Colors.textMuted}
                maxLength={60}
              />
            </View>

            <View style={s.field}>
              <Eyebrow>How they know you</Eyebrow>
              <TextInput
                style={s.input}
                value={relationship}
                onChangeText={setRelationship}
                placeholder="friend"
                placeholderTextColor={Colors.textMuted}
                maxLength={60}
              />
            </View>

            <View style={s.field}>
              <Eyebrow>Card design</Eyebrow>
              <View style={{ gap: 6 }}>
                {DESIGNS.map((d) => {
                  const on = d.id === design;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[s.designRow, on && s.designRowOn]}
                      onPress={() => setDesign(d.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.designDot, on && { backgroundColor: Colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.designLabel, on && { color: Colors.primary, fontWeight: '700' }]}>
                          {d.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Button
              title="Create the welcome"
              icon={<Ionicons name="mail-outline" size={16} color={Colors.onPrimary} />}
              onPress={onSave}
              loading={create.isPending}
              disabled={recipientName.trim().length < 1}
              size="lg"
              style={s.saveBtn}
            />
          </>
        )}

        {savedUrl && (
          <View style={s.successWrap}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.primary} />
            <Text style={s.successTitle}>Welcome link is ready.</Text>
            <View style={s.urlBox}>
              <Text selectable style={s.urlText} numberOfLines={2}>{savedUrl}</Text>
            </View>
            <View style={s.successActions}>
              <Button
                title="Share"
                size="sm"
                icon={<Ionicons name="share-outline" size={14} color={Colors.onPrimary} />}
                style={s.urlBtn}
                onPress={onShare}
              />
              <Button
                title="Copy link"
                variant="ghost"
                size="sm"
                icon={<Ionicons name="copy-outline" size={14} color={Colors.primary} />}
                style={s.urlBtnAlt}
                onPress={onCopy}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.md, paddingBottom: 80, gap: Spacing.lg },

  field: { gap: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    fontSize: 15, color: Colors.textPrimary,
  },
  designRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  designRowOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  designDot: {
    width: 8, height: 8, borderRadius: Radius.full,
    backgroundColor: Colors.textMuted,
  },
  designLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

  saveBtn: { borderRadius: Radius.full },

  successWrap: {
    padding: Spacing.lg, borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: 10,
  },
  successTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  urlBox: {
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  urlText: {
    fontSize: Type.caption.size, color: Colors.textPrimary,
    fontFamily: Platform.OS === 'web' ? ('ui-monospace, SFMono-Regular, monospace' as any) : 'monospace',
  },
  successActions: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xxs },
  urlBtn: { borderRadius: Radius.full },
  urlBtnAlt: {
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
}); }
