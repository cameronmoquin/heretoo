/**
 * GearForm — create or edit a listing: what it is, what the seller
 * wants, and up to eight photos (uploaded to nffga-gear on save).
 */
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../../shared/Button';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import type { GearCategory, GearCondition, GearListing, GearTradeType } from '../../../lib/nffga/types';
import {
  CATEGORY_LABEL, CONDITION_LABEL, GEAR_CATEGORIES, GEAR_CONDITIONS, HANDEDNESS_LABEL, MAX_GEAR_PHOTOS,
  SHIPPING_LABEL, TRADE_TYPE_LABEL, photoUrl, type ListingInput, type PhotoDraft,
} from '../../../lib/nffga/gear';
import {
  ChipPicker, ErrorText, Field, FieldRow, FormSection, TextField, blankToNull, centsToDollars, dollarsToCents,
} from '../tournaments/ui';

/** Common spec fields. Other keys already in specs are kept as they are. */
const SPEC_FIELDS: { key: string; label: string; placeholder?: string }[] = [
  { key: 'shaft', label: 'Shaft', placeholder: 'Graphite, steel, model' },
  { key: 'flex', label: 'Flex', placeholder: 'Regular, stiff, senior' },
  { key: 'loft', label: 'Loft', placeholder: '10.5' },
  { key: 'length', label: 'Length', placeholder: '+0.5 in' },
  { key: 'set_makeup', label: 'Set makeup', placeholder: '4-PW' },
  { key: 'grip', label: 'Grip' },
  { key: 'size', label: 'Size', placeholder: 'For apparel and shoes' },
  { key: 'quantity', label: 'Quantity', placeholder: 'For balls' },
];

const TRADE_TYPES: GearTradeType[] = ['sell', 'sell_or_trade', 'trade', 'giveaway'];
const HANDS: GearListing['handedness'][] = ['right', 'left', 'either'];
const SHIPPING: GearListing['shipping'][] = ['local_only', 'will_ship', 'either'];

export function GearForm({ initial, onSave, onCancel, saveLabel }: {
  initial?: GearListing | null;
  onSave: (input: ListingInput, photos: PhotoDraft[]) => Promise<string | null>;
  onCancel: () => void;
  saveLabel: string;
}) {
  const s = makeStyles();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<GearCategory | null>(initial?.category ?? null);
  const [condition, setCondition] = useState<GearCondition | null>(initial?.condition ?? null);
  const [handedness, setHandedness] = useState<GearListing['handedness']>(initial?.handedness ?? 'right');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [specs, setSpecs] = useState<Record<string, unknown>>(initial?.specs ?? {});
  const [tradeType, setTradeType] = useState<GearTradeType>(initial?.trade_type ?? 'sell_or_trade');
  const [price, setPrice] = useState(centsToDollars(initial?.price_cents));
  const [tradeFor, setTradeFor] = useState(initial?.trade_for ?? '');
  const [shipping, setShipping] = useState<GearListing['shipping']>(initial?.shipping ?? 'local_only');
  const [location, setLocation] = useState(initial?.location_text ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [photos, setPhotos] = useState<PhotoDraft[]>(
    (initial?.photos ?? []).slice().sort((a, b) => a.position - b.position).map((p) => ({ kind: 'stored' as const, path: p.path })),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wantsPrice = tradeType === 'sell' || tradeType === 'sell_or_trade';
  const wantsTrade = tradeType === 'trade' || tradeType === 'sell_or_trade';
  const cents = dollarsToCents(price);
  const priceErr = wantsPrice && Number.isNaN(cents as number) ? 'Enter dollars, like 120 or 120.50' : null;

  async function pick() {
    setErr(null);
    const room = MAX_GEAR_PHOTOS - photos.length;
    if (room <= 0) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        quality: 0.85,
      });
      if (res.canceled) return;
      const added: PhotoDraft[] = res.assets.slice(0, room).map((a) => ({
        kind: 'new', uri: a.uri, mimeType: a.mimeType ?? null, fileName: a.fileName ?? null,
      }));
      setPhotos((p) => [...p, ...added].slice(0, MAX_GEAR_PHOTOS));
    } catch {
      setErr('Could not open your photos. Try again.');
    }
  }

  async function save() {
    setErr(null);
    const t = title.trim();
    if (t.length < 3) { setErr('Give the listing a title (at least 3 characters).'); return; }
    if (!category) { setErr('Choose a category.'); return; }
    if (!condition) { setErr('Choose a condition.'); return; }
    if (wantsPrice && (cents == null || Number.isNaN(cents))) {
      setErr(tradeType === 'sell' ? 'Enter a price.' : 'Enter a price. Buyers can still offer a trade.');
      return;
    }
    if (tradeType === 'trade' && !tradeFor.trim()) { setErr('Say what you would like in trade.'); return; }

    const cleanSpecs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(specs)) {
      if (v == null) continue;
      if (typeof v === 'string' && !v.trim()) continue;
      cleanSpecs[k] = typeof v === 'string' ? v.trim() : v;
    }

    const input: ListingInput = {
      title: t,
      description: blankToNull(description),
      category,
      brand: blankToNull(brand),
      model: blankToNull(model),
      condition,
      handedness,
      specs: cleanSpecs,
      trade_type: tradeType,
      price_cents: wantsPrice ? (cents as number) : null,
      trade_for: wantsTrade ? blankToNull(tradeFor) : null,
      shipping,
      location_text: blankToNull(location),
    };
    setBusy(true);
    const e = await onSave(input, photos);
    setBusy(false);
    if (e) setErr(e);
  }

  const specText = (k: string) => (specs[k] == null ? '' : String(specs[k]));

  return (
    <View style={s.form}>
      <FormSection title="Photos">
        <Field label={`Photos (${photos.length} of ${MAX_GEAR_PHOTOS})`} help="The first photo shows in the grid.">
          <View style={s.photos}>
            {photos.map((p, i) => (
              <View key={p.kind === 'stored' ? p.path : p.uri} style={s.photoCell}>
                <Image source={{ uri: p.kind === 'stored' ? photoUrl(p.path) : p.uri }} style={s.photo} resizeMode="cover" />
                <View style={s.photoBar}>
                  {i > 0 ? (
                    <Pressable onPress={() => setPhotos((ps) => [ps[i], ...ps.filter((_, j) => j !== i)])} accessibilityRole="button" accessibilityLabel={`Make photo ${i + 1} first`}>
                      <Text style={s.photoAction}>First</Text>
                    </Pressable>
                  ) : <Text style={s.photoFirst}>First</Text>}
                  <Pressable onPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`}>
                    <Text style={s.photoAction}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
          {photos.length < MAX_GEAR_PHOTOS ? (
            <View style={s.inline}><Button title="Add photos" onPress={pick} variant="outline" size="md" /></View>
          ) : null}
        </Field>
      </FormSection>

      <FormSection title="Item">
        <TextField label="Title" required value={title} onChangeText={setTitle} maxLength={120} placeholder="TaylorMade Stealth 2 driver, 10.5" />
        <ChipPicker label="Category" required options={GEAR_CATEGORIES} value={category} onChange={setCategory} labels={CATEGORY_LABEL} />
        <ChipPicker label="Condition" required options={GEAR_CONDITIONS} value={condition} onChange={setCondition} labels={CONDITION_LABEL} />
        <ChipPicker label="Hand" options={HANDS} value={handedness} onChange={(v) => v && setHandedness(v)} labels={HANDEDNESS_LABEL} />
        <FieldRow>
          <TextField label="Brand" value={brand} onChangeText={setBrand} />
          <TextField label="Model" value={model} onChangeText={setModel} />
        </FieldRow>
        <View style={s.specs}>
          {SPEC_FIELDS.map((f) => (
            <View key={f.key} style={s.specCell}>
              <TextField label={f.label} value={specText(f.key)} placeholder={f.placeholder}
                onChangeText={(v) => setSpecs((p) => ({ ...p, [f.key]: v }))} />
            </View>
          ))}
        </View>
        <TextField label="Description" value={description} onChangeText={setDescription} multiline={5} maxLength={4000} />
      </FormSection>

      <FormSection title="Deal">
        <ChipPicker label="You want to" options={TRADE_TYPES} value={tradeType} onChange={(v) => v && setTradeType(v)} labels={TRADE_TYPE_LABEL} />
        {wantsPrice ? (
          <TextField label="Price (dollars)" required value={price} onChangeText={setPrice} keyboardType="decimal-pad" error={priceErr} />
        ) : null}
        {wantsTrade ? (
          <TextField label="Would trade for" required={tradeType === 'trade'} value={tradeFor} onChangeText={setTradeFor} multiline={2} maxLength={500} />
        ) : null}
        <ChipPicker label="Shipping" options={SHIPPING} value={shipping} onChange={(v) => v && setShipping(v)} labels={SHIPPING_LABEL} />
        <TextField label="Location" value={location} onChangeText={setLocation} placeholder="City, state" />
      </FormSection>

      <ErrorText>{err}</ErrorText>
      <View style={s.actions}>
        <Button title={saveLabel} onPress={save} variant="primary" size="lg" loading={busy} />
        <Button title="Cancel" onPress={onCancel} variant="ghost" size="lg" />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  form: { gap: Spacing.lg },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', marginTop: Spacing.xs },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoCell: { width: 120, gap: Spacing.xxs },
  photo: { width: 120, height: 120, borderRadius: Radius.control, backgroundColor: Colors.surfaceAlt },
  photoBar: { flexDirection: 'row', justifyContent: 'space-between' },
  photoAction: { fontSize: Type.caption.size, lineHeight: 24, color: Colors.textSecondary, textDecorationLine: 'underline' },
  photoFirst: { fontSize: Type.caption.size, lineHeight: 24, color: Colors.textMuted },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  specCell: { flexGrow: 1, flexBasis: 200, minWidth: 0 },
}); }
