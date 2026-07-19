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
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamily } from '../../../hooks/useFamily';
import { useCreateWelcomeInvitation } from '../../../hooks/useWelcomeInvitations';
import { showAlert } from '../../../lib/alert';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

type CardDesign = 'pressed-flower' | 'katagami-stencil' | 'type-only';
const DESIGNS: Array<{ id: CardDesign; label: string; sub: string }> = [
  { id: 'pressed-flower', label: 'Pressed flower', sub: 'Botanical, soft, watercolor edge.' },
  { id: 'katagami-stencil', label: 'Katagami stencil', sub: 'Japanese paper-cut floral repeat.' },
  { id: 'type-only', label: 'Type only', sub: 'Letterpress style, just words.' },
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
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>A welcome card</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {!savedUrl && (
          <>
            <View style={s.preamble}>
              <Text style={s.preambleTitle}>For someone who isn't on HereToo yet.</Text>
              <Text style={s.preambleBody}>
                You'll get a link to send them. When they open it, the platform reads
                them a 30-second greeting in a calm voice that names you. No fields,
                no signup wall. They step inside on their own time.
              </Text>
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>Their first name</Text>
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
              <Text style={s.fieldLabel}>How they know you</Text>
              <TextInput
                style={s.input}
                value={relationship}
                onChangeText={setRelationship}
                placeholder="friend"
                placeholderTextColor={Colors.textMuted}
                maxLength={60}
              />
              <Text style={s.fieldHint}>
                The voice greeting will say "Your {relationship.trim() || 'friend'}, [your name], made you a place here."
              </Text>
            </View>

            <View style={s.field}>
              <Text style={s.fieldLabel}>Card design</Text>
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
                        <Text style={s.designSub}>{d.sub}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s.fieldHint}>
                The printed card pipeline (Lob postage, $4 per card) ships in a follow-up.
                For now, you'll share the welcome URL by hand.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, (create.isPending || recipientName.trim().length < 1) && { opacity: 0.4 }]}
              onPress={onSave}
              disabled={create.isPending || recipientName.trim().length < 1}
              activeOpacity={0.85}
            >
              {create.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={16} color="#FFF" />
                  <Text style={s.saveBtnText}>Create the welcome</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {savedUrl && (
          <View style={s.successWrap}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.primary} />
            <Text style={s.successTitle}>Welcome link is ready.</Text>
            <Text style={s.successBody}>
              Share this URL with {recipientName}. When they open it, the
              ceremony begins.
            </Text>
            <View style={s.urlBox}>
              <Text selectable style={s.urlText} numberOfLines={2}>{savedUrl}</Text>
            </View>
            <View style={s.successActions}>
              <TouchableOpacity style={s.urlBtn} onPress={onShare} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={14} color="#FFF" />
                <Text style={s.urlBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.urlBtnAlt} onPress={onCopy} activeOpacity={0.85}>
                <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                <Text style={s.urlBtnAltText}>Copy link</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 14, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  scroll: { padding: Spacing.md, paddingBottom: 80, gap: Spacing.lg },

  preamble: {
    padding: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: 6,
  },
  preambleTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  preambleBody: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },

  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: Colors.textPrimary,
  },
  fieldHint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },

  designRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  designRowOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  designDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  designLabel: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  designSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },

  successWrap: {
    padding: Spacing.lg, borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: 10,
  },
  successTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  successBody: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  urlBox: {
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  urlText: {
    fontSize: 12, color: Colors.textPrimary,
    fontFamily: Platform.OS === 'web' ? ('ui-monospace, SFMono-Regular, monospace' as any) : 'monospace',
  },
  successActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  urlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  urlBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  urlBtnAlt: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  urlBtnAltText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
}); }
