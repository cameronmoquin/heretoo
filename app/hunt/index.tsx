/**
 * /hunt — the photo geocache hub.
 *
 * Hide a cache, or pick a public one to seek. Your own caches list with
 * their share code + link so you can send them to a seeker.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMyHuntCaches, usePublicHuntCaches, type HuntCache,
} from '../../hooks/useHunt';
import { showAlert } from '../../lib/alert';
import { GlitchText } from '../../components/shared/GlitchText';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

function huntUrl(code: string) {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://heretoo.social';
  return `${origin}/hunt/${code}`;
}

export default function HuntHome() {
  const s = makeStyles();
  const { data: mine } = useMyHuntCaches();
  const { data: pub } = usePublicHuntCaches();

  const shareCache = async (c: HuntCache) => {
    if (!c.share_code) return;
    const url = huntUrl(c.share_code);
    try {
      if (Platform.OS !== 'web' && (Share as any)?.share) {
        await Share.share({ message: `I left something. Come collect it: ${url}` });
      } else if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(url);
        showAlert('Link copied', url);
      } else {
        showAlert('Courier link', url);
      }
    } catch {}
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <GlitchText style={s.glitchTitle}>DEADDROP</GlitchText>
        </View>

        <Text style={s.lede}>
          Leave a photo at a fixed set of coordinates. The code is the
          receipt. Whoever holds it rides out and collects.
        </Text>

        <TouchableOpacity style={s.hideBtn} onPress={() => router.push('/hunt/new')} activeOpacity={0.85}>
          <Ionicons name="add-circle" size={18} color="#FFF" />
          <Text style={s.hideBtnText}>Set a drop</Text>
        </TouchableOpacity>

        {/* My caches */}
        {(mine ?? []).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Your drops</Text>
            {(mine ?? []).map((c) => (
              <View key={c.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{c.title || 'Unmarked drop'}</Text>
                  <Text style={s.rowMeta}>
                    Code {c.share_code} · {c.found_count} {c.found_count === 1 ? 'pickup' : 'pickups'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => shareCache(c)} style={s.rowAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="share-outline" size={16} color={Colors.primary} />
                  <Text style={s.rowActionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push(`/hunt/${c.share_code}`)} style={s.rowAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="navigate-outline" size={16} color={Colors.primary} />
                  <Text style={s.rowActionText}>Collect</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Public caches to seek */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Open runs</Text>
          {(pub ?? []).length === 0 ? (
            <Text style={s.empty}>Nothing on the open board. Set a drop and mark it public.</Text>
          ) : (
            (pub ?? []).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.row}
                onPress={() => router.push(`/hunt/${c.share_code}`)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{c.title || 'Unmarked drop'}</Text>
                  <Text style={s.rowMeta}>{c.found_count} {c.found_count === 1 ? 'pickup' : 'pickups'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    glitchTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary },
    lede: { fontSize: 17, lineHeight: 26, color: Colors.textPrimary },
    hideBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: Radius.full, backgroundColor: Colors.primary,
    },
    hideBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    section: { gap: 8 },
    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.4, textTransform: 'uppercase',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: Spacing.md, borderRadius: Radius.lg,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    },
    rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
    rowMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
    rowAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowActionText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
    empty: { fontSize: 14, color: Colors.textSecondary, fontStyle: 'italic' },
  });
}
