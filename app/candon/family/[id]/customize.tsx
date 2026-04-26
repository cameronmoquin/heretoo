import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useFamilyGroup, useFamilyMembers, useUpdateFamilyGroup,
} from '../../../../hooks/useFamilyGroups';
import { useAuthStore } from '../../../../stores/authStore';
import { CandonColors } from '../../../../constants/candon-theme';
import { showAlert } from '../../../../lib/alert';
import { formatPgError } from '../../../../lib/error-format';
import { FamilyCrest } from '../../../../components/candon/FamilyCrest';
import {
  PALETTE_LIST, DIVISION_LIST, CHARGE_LIST,
  type CrestDivision, type CrestCharge,
} from '../../../../lib/family-crest';

// Curated theme swatches — restrained, "house" palettes that play nicely
// with the warm cream surface. Hex strings stored on the row.
const THEME_SWATCHES = [
  { hex: null,        label: 'Default' },
  { hex: '#4A6B4A',   label: 'Forest' },
  { hex: '#8B6B9F',   label: 'Violet' },
  { hex: '#3F5C7C',   label: 'Slate' },
  { hex: '#A05A3A',   label: 'Rust' },
  { hex: '#5A7B7A',   label: 'Sage' },
  { hex: '#7A4A4A',   label: 'Brick' },
  { hex: '#3A3A4D',   label: 'Indigo' },
  { hex: '#6B5A3A',   label: 'Bronze' },
] as const;

const CHARGE_LABELS: Record<CrestCharge, string> = {
  chevron: 'Chevron', cross: 'Cross', saltire: 'Saltire', fess: 'Fess',
  pale: 'Pale', star: 'Star', mullet: 'Mullet', roundel: 'Roundel',
  lozenge: 'Lozenge', tower: 'Tower', oak: 'Oak', crescent: 'Crescent',
};
const DIVISION_LABELS: Record<CrestDivision, string> = {
  plain: 'Plain (monogram)',
  'per-pale': 'Per pale',
  'per-fess': 'Per fess',
  'per-bend': 'Per bend',
  'per-bend-sinister': 'Per bend (sinister)',
  quartered: 'Quartered',
  chief: 'Chief (banner)',
};

export default function CustomizeFamily() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: group, isLoading } = useFamilyGroup(id);
  const { data: members } = useFamilyMembers(id);
  const update = useUpdateFamilyGroup();

  const [motto, setMotto] = useState('');
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [paletteIndex, setPaletteIndex] = useState<number | null>(null);
  const [division, setDivision] = useState<CrestDivision | null>(null);
  const [charge, setCharge] = useState<CrestCharge | null>(null);

  useEffect(() => {
    if (!group) return;
    setMotto(group.motto ?? '');
    setThemeColor(group.theme_primary ?? null);
    setPaletteIndex(group.crest_palette_index ?? null);
    setDivision((group.crest_division as CrestDivision | null) ?? null);
    setCharge((group.crest_charge as CrestCharge | null) ?? null);
  }, [group]);

  if (isLoading || !group || !id) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const myMember = members?.find((m) => m.user_id === userId);
  const canEdit = group.owner_user_id === userId
    || myMember?.role === 'owner'
    || myMember?.role === 'admin';

  if (!canEdit) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.notAllowed}>
          <Ionicons name="lock-closed" size={28} color={CandonColors.textMuted} />
          <Text style={s.notAllowedTitle}>Owner & admins only</Text>
          <Text style={s.notAllowedText}>
            Only the group&apos;s owner or admins can customize the look and motto.
          </Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const onSave = () => {
    update.mutate(
      {
        id,
        updates: {
          motto: motto.trim() || null,
          theme_primary: themeColor,
          crest_palette_index: paletteIndex,
          crest_division: division,
          crest_charge: charge,
        },
      },
      {
        onSuccess: () => router.back(),
        onError: (e: unknown) => {
          const f = formatPgError(e, 'Could not save customization.');
          showAlert('Could not save', f.message);
        },
      },
    );
  };

  const onReset = () => {
    setMotto('');
    setThemeColor(null);
    setPaletteIndex(null);
    setDivision(null);
    setCharge(null);
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Live preview */}
          <View style={s.previewCard}>
            <FamilyCrest
              seed={group.id}
              name={group.name}
              size={92}
              paletteIndex={paletteIndex}
              division={division}
              charge={charge}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.previewName}>{group.name}</Text>
              {motto.trim().length > 0 && (
                <Text style={[s.previewMotto, !!themeColor && { color: themeColor }]}>
                  {motto.trim()}
                </Text>
              )}
              <View style={[s.previewChip, !!themeColor && { backgroundColor: (themeColor ?? '') + '22' }]}>
                <View style={[s.previewDot, { backgroundColor: themeColor ?? CandonColors.primary }]} />
                <Text style={[s.previewChipText, !!themeColor && { color: themeColor }]}>
                  {THEME_SWATCHES.find((t) => t.hex === themeColor)?.label ?? 'Custom'}
                </Text>
              </View>
            </View>
          </View>

          {/* Motto */}
          <Text style={s.label}>Motto (optional)</Text>
          <TextInput
            style={s.input}
            value={motto}
            onChangeText={setMotto}
            placeholder="A short line that captures this family"
            placeholderTextColor={CandonColors.textMuted}
            maxLength={80}
          />
          <Text style={s.hint}>{motto.length} / 80</Text>

          {/* Theme color */}
          <Text style={s.label}>Family color</Text>
          <View style={s.swatchRow}>
            {THEME_SWATCHES.map((t) => {
              const active = themeColor === t.hex;
              return (
                <TouchableOpacity
                  key={t.label}
                  style={[
                    s.swatch,
                    { backgroundColor: t.hex ?? CandonColors.surface },
                    active && s.swatchActive,
                    !t.hex && { borderWidth: 1, borderColor: CandonColors.border },
                  ]}
                  onPress={() => setThemeColor(t.hex)}
                  activeOpacity={0.8}
                  accessibilityLabel={t.label}
                >
                  {active && (
                    <Ionicons name="checkmark" size={16} color={t.hex ? '#FFF' : CandonColors.textPrimary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.hint}>
            Tints the header, accent buttons, and motto inside this group.
          </Text>

          {/* Crest: palette */}
          <Text style={s.label}>Crest palette</Text>
          <View style={s.gridRow}>
            <PaletteOption active={paletteIndex == null} label="Auto" onPress={() => setPaletteIndex(null)} />
            {PALETTE_LIST.map((p, i) => (
              <PaletteOption
                key={p.name}
                active={paletteIndex === i}
                fieldColor={p.field}
                chargeColor={p.charge}
                label={p.name.replace('-', ' / ')}
                onPress={() => setPaletteIndex(i)}
              />
            ))}
          </View>

          {/* Crest: division */}
          <Text style={s.label}>Field division</Text>
          <View style={s.chipRow}>
            <Chip active={division == null} label="Auto" onPress={() => setDivision(null)} />
            {DIVISION_LIST.map((d) => (
              <Chip
                key={d}
                active={division === d}
                label={DIVISION_LABELS[d]}
                onPress={() => setDivision(d)}
              />
            ))}
          </View>

          {/* Crest: charge */}
          <Text style={s.label}>Central charge</Text>
          <View style={s.chipRow}>
            <Chip active={charge == null} label="Auto" onPress={() => setCharge(null)} />
            {CHARGE_LIST.map((c) => (
              <Chip
                key={c}
                active={charge === c}
                label={CHARGE_LABELS[c]}
                onPress={() => setCharge(c)}
              />
            ))}
          </View>
          <Text style={s.hint}>
            &quot;Plain&quot; or &quot;Chief&quot; fields show family monogram initials in place of a charge.
          </Text>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={s.resetBtn} onPress={onReset} activeOpacity={0.7}>
              <Text style={s.resetBtnText}>Reset to defaults</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, update.isPending && { opacity: 0.5 }]}
              onPress={onSave}
              disabled={update.isPending}
              activeOpacity={0.85}
            >
              <Text style={s.saveBtnText}>{update.isPending ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function PaletteOption({
  active, label, fieldColor, chargeColor, onPress,
}: {
  active: boolean;
  label: string;
  fieldColor?: string;
  chargeColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[s.paletteOpt, active && s.paletteOptActive]}>
      {fieldColor ? (
        <View style={[s.paletteSwatch, { backgroundColor: fieldColor }]}>
          <View style={[s.paletteSwatchInner, { backgroundColor: chargeColor }]} />
        </View>
      ) : (
        <View style={[s.paletteSwatch, { backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="sparkles-outline" size={14} color={CandonColors.textMuted} />
        </View>
      )}
      <Text style={[s.paletteLabel, active && { color: CandonColors.primary, fontWeight: '600' }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.chip, active && s.chipActive]}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 18, gap: 4, maxWidth: 600, alignSelf: 'center', width: '100%' },

  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CandonColors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, marginBottom: 8,
  },
  previewName: { fontSize: 18, fontWeight: '700', color: CandonColors.textPrimary },
  previewMotto: { fontSize: 13, fontStyle: 'italic', color: CandonColors.textSecondary, marginTop: 2 },
  previewChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 8,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: CandonColors.surfaceRaise,
  },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewChipText: { fontSize: 11, color: CandonColors.textSecondary, fontWeight: '600' },

  label: {
    fontSize: 11, fontWeight: '600', color: CandonColors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 16, marginBottom: 8,
  },
  hint: { fontSize: 11, color: CandonColors.textMuted, marginTop: 6 },

  input: {
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: CandonColors.textPrimary,
  },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2, borderColor: CandonColors.textPrimary,
  },

  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletteOpt: {
    width: 70, alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8,
  },
  paletteOptActive: { backgroundColor: CandonColors.primaryFaint },
  paletteSwatch: {
    width: 38, height: 46, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  paletteSwatchInner: { width: 14, height: 14, borderRadius: 7 },
  paletteLabel: { fontSize: 10, color: CandonColors.textSecondary, textAlign: 'center' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: CandonColors.border,
    backgroundColor: CandonColors.surface,
  },
  chipActive: { backgroundColor: CandonColors.primary, borderColor: CandonColors.primary },
  chipText: { fontSize: 12, color: CandonColors.textPrimary, fontWeight: '500' },
  chipTextActive: { color: '#FFF', fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  saveBtn: {
    flex: 1, backgroundColor: CandonColors.primary,
    paddingVertical: 13, borderRadius: 10, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  resetBtn: {
    paddingVertical: 13, paddingHorizontal: 18, borderRadius: 10,
    borderWidth: 1, borderColor: CandonColors.border,
    backgroundColor: CandonColors.surface,
  },
  resetBtnText: { color: CandonColors.textSecondary, fontSize: 14, fontWeight: '500' },

  notAllowed: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 10,
  },
  notAllowedTitle: { fontSize: 18, fontWeight: '600', color: CandonColors.textPrimary, marginTop: 8 },
  notAllowedText: { fontSize: 14, color: CandonColors.textSecondary, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  backBtn: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: CandonColors.primary },
  backBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
