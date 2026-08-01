/**
 * Other-user profile page — `/u/<handle>`.
 *
 * Shows what HereToo wants to surface about another person without
 * giving away anything they haven't already shared:
 *   - Stature avatar (letter + generation + reach), display name, bio
 *   - Mutual crews (where you and they overlap) — tap to enter
 *   - Recent public posts (RLS already filters out anything they've
 *     scoped to crew or connections-only that you can't see)
 *   - "Send message" button — opens a thread, with the >3-hop
 *     approval gate handled by useOpenThread
 *
 * If the handle doesn't resolve, we render a clean "not found" state.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { useMyFamilies } from '../../hooks/useFamily';
import { useOpenThread } from '../../hooks/useChat';
import { StatureAvatar } from '../../components/shared/StatureAvatar';
import { PostCard } from '../../components/feed/PostCard';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { WALLPAPERS, wallpaperToDataUri, type WallpaperId } from '../../stores/wallpaperStore';
import { STATIONS } from '../../stores/radioStore';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

export default function UserProfile() {
  const s = makeStyles();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const viewerId = useAuthStore((st) => st.user?.id);
  const cleanHandle = (handle ?? '').toLowerCase().replace(/^@/, '');

  // 1. Resolve handle → profile.
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile-by-handle', cleanHandle],
    queryFn: async () => {
      if (!cleanHandle) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, handle, display_name, avatar_path, bio, created_at, style_prefs')
        .eq('handle', cleanHandle)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cleanHandle,
  });

  // 2. Their public posts (RLS filters out anything we can't see).
  const { data: posts } = useQuery({
    queryKey: ['user-posts', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('posts')
        .select(
          '*, author:profiles!author_id(id, handle, display_name, avatar_path), media:post_media(*)'
        )
        .eq('author_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  // 3. Mutual crews = both you and them are active members.
  const { data: myFamilies } = useMyFamilies();
  const { data: theirFamilyIds } = useQuery({
    queryKey: ['their-families', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return new Set<string>();
      const { data, error } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('profile_id', profile.id)
        .eq('status', 'active');
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.family_id as string));
    },
    enabled: !!profile?.id,
  });

  const mutualFamilies = useMemo(
    () => (myFamilies ?? []).filter((f: any) => theirFamilyIds?.has(f.id)),
    [myFamilies, theirFamilyIds],
  );

  const openThread = useOpenThread();
  const onMessage = () => {
    if (!profile?.id) return;
    if (profile.id === viewerId) return;
    openThread.mutate(profile.id, {
      onSuccess: (thread) => router.push(`/chat/${thread.id}` as any),
      onError: (e: any) => showAlert('Could not open chat', e?.message ?? 'Try again.'),
    });
  };

  if (loadingProfile) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.notFound}>
          <Ionicons name="search-outline" size={36} color={Colors.textMuted} />
          <Text style={s.notFoundTitle}>No one with that handle</Text>
          <Text style={s.notFoundSub}>
            @{cleanHandle} doesn't match anyone on HereToo.
          </Text>
          <Button
            title="Back to feed"
            style={s.cta}
            onPress={() => router.replace('/(tabs)/feed' as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isMe = profile.id === viewerId;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader title={`@${profile.handle}`} showBack style={s.header} />

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.identity}>
          <StatureAvatar
            profileId={profile.id}
            name={profile.display_name}
            photoUrl={profile.avatar_path ? mediaPathToUrl(profile.avatar_path) : null}
            size={84}
          />
          <Text style={s.displayName}>{profile.display_name ?? 'Member'}</Text>
          <Text style={s.handle}>@{profile.handle}</Text>
          {!!profile.bio && <Text style={s.bio}>{profile.bio}</Text>}

          {!isMe && (
            <Button
              title={openThread.isPending ? 'Opening…' : 'Send message'}
              icon={<Ionicons name="chatbubble-outline" size={15} color={Colors.onPrimary} />}
              style={s.messageBtn}
              onPress={onMessage}
              disabled={openThread.isPending}
            />
          )}
        </View>

        {/* Mutual crews */}
        {mutualFamilies.length > 0 && (
          <View style={s.section}>
            <Eyebrow>Mutual crews</Eyebrow>
            {mutualFamilies.map((f: any) => (
              <TouchableOpacity
                key={f.id}
                style={s.familyRow}
                onPress={() => router.push(`/family/${f.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={s.familyIcon}>
                  {f.cover_path ? (
                    <Image source={{ uri: mediaPathToUrl(f.cover_path) }} style={s.familyIconImg} />
                  ) : (
                    <Ionicons name="people" size={16} color={Colors.primary} />
                  )}
                </View>
                <Text style={s.familyName}>{f.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Their style — wallpaper + radio + gallery picks. Reads from
            profile.style_prefs which is synced from the user's own
            stores (wallpaperStore, radioStore, artPrefsStore). The
            visited person's choices appear here without changing the
            visitor's own — a glimpse of their "room" / "soundtrack"
            / "taste in art." */}
        <TheirStyleCard profile={profile} />

        {/* Posts */}
        <View style={s.section}>
          <Eyebrow>Recent {Vocab.postPlural}</Eyebrow>
          {(posts ?? []).length === 0 ? (
            <Text style={s.emptyPosts}>Nothing public to show yet.</Text>
          ) : (
            (posts ?? []).map((p: any) => <PostCard key={p.id} post={p} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * "Their style" — three-row card on the visited user's profile that
 * surfaces their wallpaper / radio station / art-filter picks.
 *
 * Renders nothing if profile.style_prefs has none of the three set —
 * we don't want a sad empty card on profiles that haven't picked
 * anything yet (default state).
 */
function TheirStyleCard({ profile }: { profile: any }) {
  const s = makeStyles();
  const prefs = profile?.style_prefs ?? {};

  // ── Wallpaper ─────────────────────────────────────────────────────
  const wid = prefs.wallpaper_id as WallpaperId | undefined;
  const wallpaperDef = wid && wid !== 'plain' ? WALLPAPERS[wid] : null;
  const wallpaperBg = wallpaperDef ? wallpaperToDataUri(wallpaperDef) : '';

  // ── Radio station ─────────────────────────────────────────────────
  const radioId = prefs.radio_station_id as string | undefined;
  const station = radioId ? STATIONS.find((st) => st.id === radioId) : null;

  // ── Art filter ────────────────────────────────────────────────────
  const af = prefs.art_filter ?? {};
  const filterChips: string[] = [];
  for (const e of (af.eras ?? []) as string[]) filterChips.push(capitalize(e));
  for (const sch of (af.schools ?? []) as string[]) filterChips.push(capitalize(sch));
  for (const g of (af.genres ?? []) as string[]) filterChips.push(capitalize(g));
  for (const m of (af.mediums ?? []) as string[]) filterChips.push(capitalize(m));
  // De-dup + cap so the list stays compact
  const uniqueChips = [...new Set(filterChips)].slice(0, 6);

  // Don't render the section at all if there's nothing to show.
  if (!wallpaperDef && !station && uniqueChips.length === 0) return null;

  return (
    <View style={s.section}>
      <Eyebrow>Their style</Eyebrow>

      {wallpaperDef && (
        <View style={s.styleRow}>
          <View
            style={[
              s.stylePreview,
              { backgroundColor: wallpaperDef.swatchBg, ...({
                backgroundImage: wallpaperBg,
                backgroundRepeat: 'repeat',
                backgroundSize: `${wallpaperDef.tileSize}px ${wallpaperDef.tileSize}px`,
              } as any) },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.styleLabel}>{wallpaperDef.label}</Text>
            <Text style={s.styleEra}>{wallpaperDef.era} wallpaper</Text>
          </View>
        </View>
      )}

      {station && (
        <View style={s.styleRow}>
          <View style={s.stationIcon}>
            <Ionicons name="musical-notes" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.styleLabel}>{station.name}</Text>
            <Text style={s.styleEra}>
              {station.genre.replace(/^./, (c) => c.toUpperCase())} · {station.city}
            </Text>
          </View>
        </View>
      )}

      {uniqueChips.length > 0 && (
        <View style={[s.styleRow, { alignItems: 'flex-start' }]}>
          <View style={s.stationIcon}>
            <Ionicons name="color-palette" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.styleLabel}>Gallery taste</Text>
            <View style={s.chipsWrap}>
              {uniqueChips.map((c) => (
                <View key={c} style={s.chip}>
                  <Text style={s.chipText}>{c}</Text>
                </View>
              ))}
              {filterChips.length > uniqueChips.length && (
                <Text style={s.chipMore}>+{filterChips.length - uniqueChips.length} more</Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },

  scroll: {
    paddingBottom: 80, gap: 14,
    maxWidth: 600, alignSelf: 'center', width: '100%',
  },
  identity: { alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: Spacing.md },
  displayName: { fontWeight: '800', fontSize: 22, color: Colors.textPrimary, marginTop: Spacing.sm },
  handle: { fontSize: Type.ui.size, color: Colors.textMuted },
  bio: {
    fontSize: Type.ui.size, color: Colors.textSecondary, textAlign: 'center',
    marginTop: 6, lineHeight: 20, maxWidth: 360,
  },
  messageBtn: { marginTop: Spacing.sm, borderRadius: Radius.full },

  section: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: Spacing.xs,
  },
  familyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: Spacing.xs,
  },
  familyIcon: {
    width: Spacing.xl, height: Spacing.xl, borderRadius: Radius.xs,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  familyIconImg: { width: '100%', height: '100%' },
  familyName: {
    flex: 1, fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary,
  },

  emptyPosts: { fontSize: 13, color: Colors.textMuted, paddingVertical: Spacing.xs },

  // "Their style" wallpaper preview row
  styleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 6,
  },
  stylePreview: {
    width: 64, height: 64, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  styleLabel: {
    fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary,
  },
  styleEra: {
    fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 2,
  },

  stationIcon: {
    width: 64, height: 64, borderRadius: Radius.md,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xxs, marginTop: Spacing.xxs },
  chip: {
    paddingHorizontal: Spacing.xs, paddingVertical: 3, borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipText: {
    fontSize: Type.eyebrow.size, fontWeight: '600', color: Colors.primary,
  },
  chipMore: {
    alignSelf: 'center',
    fontSize: Type.eyebrow.size, color: Colors.textMuted, paddingHorizontal: Spacing.xxs,
  },

  notFound: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10, marginTop: 60 },
  notFoundTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.xs },
  notFoundSub: {
    fontSize: Type.ui.size, color: Colors.textSecondary, textAlign: 'center', maxWidth: 320,
  },
  cta: { marginTop: 14, borderRadius: Radius.full },
}); }
