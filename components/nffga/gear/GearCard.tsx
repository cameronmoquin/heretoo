/**
 * GearCard — one listing in the grid: first photo, title, price or
 * "Trade" / "Free", condition, seller.
 */
import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import type { GearListing } from '../../../lib/nffga/types';
import { CONDITION_LABEL, STATUS_LABEL, photoUrl, priceLabel } from '../../../lib/nffga/gear';

export function GearCard({ l, width }: { l: GearListing; width?: number }) {
  const s = makeStyles();
  const first = l.photos?.[0];
  return (
    <Pressable
      onPress={() => router.push(`/gear/${l.id}` as any)}
      style={({ pressed }) => [s.card, width != null && { width }, pressed && s.pressed]}
      accessibilityRole="link"
      accessibilityLabel={l.title}
    >
      <View style={s.photoWrap}>
        {first ? (
          <Image source={{ uri: photoUrl(first.path) }} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={s.noPhoto}><Text style={s.noPhotoText}>No photo</Text></View>
        )}
      </View>
      <View style={s.body}>
        <Text style={s.price} numberOfLines={1}>{priceLabel(l)}</Text>
        <Text style={s.title} numberOfLines={2}>{l.title}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {[CONDITION_LABEL[l.condition], l.status !== 'active' ? STATUS_LABEL[l.status] : null].filter(Boolean).join(' · ')}
        </Text>
        {l.seller?.display_name ? <Text style={s.meta} numberOfLines={1}>{l.seller.display_name}</Text> : null}
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media, overflow: 'hidden', backgroundColor: Colors.surface },
  pressed: { backgroundColor: Colors.surfaceAlt },
  photoWrap: { width: '100%', aspectRatio: 1, backgroundColor: Colors.surfaceAlt },
  photo: { width: '100%', height: '100%' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { fontSize: Type.caption.size, color: Colors.textMuted },
  body: { padding: Spacing.sm, gap: 2 },
  price: { fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight, fontWeight: '700', color: Colors.textPrimary },
  title: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  meta: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
}); }
