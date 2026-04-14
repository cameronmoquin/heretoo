import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { Avatar } from '../shared/Avatar';
import { FlagModal } from '../shared/FlagModal';
import { VideoPlayer } from './VideoPlayer';
import { useFeedFormatStore, type FeedFormat } from '../../stores/feedFormatStore';
import type { Post, EngagementType } from '../../stores/feedStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onEngage: (postId: string, type: EngagementType) => void;
}

const REACTIONS: { type: EngagementType; label: string; color: string }[] = [
  { type: 'agree', label: 'Agree', color: Colors.agree },
  { type: 'important', label: 'Important', color: Colors.important },
  { type: 'disagree', label: 'Disagree', color: Colors.disagree },
  { type: 'bridge', label: 'Bridge', color: Colors.bridge },
];

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ReactionRow({ post, onEngage, format }: { post: Post; onEngage: (id: string, t: EngagementType) => void; format: FeedFormat }) {
  const active = post.user_engagements ?? [];
  if (format === 'twitter') {
    return (
      <View style={tw.reactions}>
        {REACTIONS.map(({ type, label, color }) => {
          const on = active.includes(type);
          return (
            <TouchableOpacity key={type} onPress={() => onEngage(post.id, type)} style={tw.rxBtn}>
              <Text style={[tw.rxText, on && { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  if (format === 'instagram') {
    return (
      <View style={ig.reactions}>
        {REACTIONS.slice(0, 3).map(({ type, label, color }) => {
          const on = active.includes(type);
          return (
            <TouchableOpacity key={type} onPress={() => onEngage(post.id, type)}>
              <Ionicons name={type === 'agree' ? (on ? 'heart' : 'heart-outline') : type === 'important' ? (on ? 'star' : 'star-outline') : 'paper-plane-outline'} size={22} color={on ? color : Colors.textPrimary} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  if (format === 'facebook') {
    return (
      <View style={fb.reactions}>
        {REACTIONS.map(({ type, label, color }) => {
          const on = active.includes(type);
          return (
            <TouchableOpacity key={type} onPress={() => onEngage(post.id, type)} style={[fb.rxBtn, on && { backgroundColor: `${color}12` }]}>
              <Text style={[fb.rxText, on && { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  if (format === 'myspace') {
    return (
      <View style={ms.reactions}>
        {REACTIONS.map(({ type, label, color }) => {
          const on = active.includes(type);
          return (
            <TouchableOpacity key={type} onPress={() => onEngage(post.id, type)}>
              <Text style={[ms.rxText, on && { color: '#FF00FF' }]}>[ {label} ]</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  // default + snapchat
  return (
    <View style={def.reactions}>
      {REACTIONS.map(({ type, label, color }) => {
        const on = active.includes(type);
        return (
          <TouchableOpacity key={type} style={[def.rxBtn, on && { backgroundColor: `${color}0D` }]} onPress={() => onEngage(post.id, type)} activeOpacity={0.6}>
            <Text style={[def.rxText, on && { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function PostCard({ post, onEngage }: PostCardProps) {
  const format = useFeedFormatStore((s) => s.format);
  const myspaceBg = useFeedFormatStore((s) => s.myspaceBackground);
  const [flagOpen, setFlagOpen] = useState(false);
  const photo = post.photo_urls?.[0];
  const nav = () => router.push(`/(tabs)/feed/${post.id}`);
  const navProfile = () => router.push(`/(tabs)/profile/${post.author_id}`);

  // ── Twitter: compact text-first ──
  if (format === 'twitter') {
    return (
      <TouchableOpacity style={tw.card} onPress={nav} onLongPress={() => setFlagOpen(true)} activeOpacity={0.95}>
        <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={32} />
        <View style={tw.body}>
          <View style={tw.nameRow}>
            <Text style={tw.name} onPress={navProfile}>{post.author?.display_name}</Text>
            <Text style={tw.handle}>@{post.author?.username}</Text>
            <Text style={tw.dot}>·</Text>
            <Text style={tw.time}>{timeAgo(post.created_at)}</Text>
          </View>
          {post.content ? <Text style={tw.text}>{post.content}</Text> : null}
          {photo && <Image source={{ uri: photo }} style={tw.img} resizeMode="cover" />}
          <ReactionRow post={post} onEngage={onEngage} format="twitter" />
        </View>
        <FlagModal visible={flagOpen} onClose={() => setFlagOpen(false)} contentType="post" contentId={post.id} />
      </TouchableOpacity>
    );
  }

  // ── Instagram: photo-first ──
  if (format === 'instagram') {
    return (
      <TouchableOpacity style={ig.card} onLongPress={() => setFlagOpen(true)} activeOpacity={1}>
        <TouchableOpacity style={ig.header} onPress={navProfile}>
          <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={30} />
          <Text style={ig.name}>{post.author?.display_name}</Text>
        </TouchableOpacity>
        {photo && <Image source={{ uri: photo }} style={ig.photo} resizeMode="cover" />}
        {post.media_type === 'video' && post.mux_playback_id && (
          <VideoPlayer playbackId={post.mux_playback_id} thumbnailUrl={post.mux_thumbnail_url ?? undefined} />
        )}
        <View style={ig.footer}>
          <ReactionRow post={post} onEngage={onEngage} format="instagram" />
          {post.content ? <Text style={ig.caption}><Text style={ig.captionName}>{post.author?.display_name} </Text>{post.content}</Text> : null}
          <Text style={ig.time}>{timeAgo(post.created_at)}</Text>
        </View>
        <FlagModal visible={flagOpen} onClose={() => setFlagOpen(false)} contentType="post" contentId={post.id} />
      </TouchableOpacity>
    );
  }

  // ── Facebook: card with reactions bar ──
  if (format === 'facebook') {
    return (
      <TouchableOpacity style={fb.card} onLongPress={() => setFlagOpen(true)} activeOpacity={1}>
        <TouchableOpacity style={fb.header} onPress={navProfile}>
          <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={36} />
          <View>
            <Text style={fb.name}>{post.author?.display_name}</Text>
            <Text style={fb.time}>{timeAgo(post.created_at)} · 🌐</Text>
          </View>
        </TouchableOpacity>
        {post.content ? <Text style={fb.text}>{post.content}</Text> : null}
        {photo && <Image source={{ uri: photo }} style={fb.photo} resizeMode="cover" />}
        <View style={fb.statsRow}>
          <Text style={fb.stat}>{post.total_engagements} reactions</Text>
          <Text style={fb.stat}>{post.cluster_reach} communities</Text>
        </View>
        <View style={fb.divider} />
        <ReactionRow post={post} onEngage={onEngage} format="facebook" />
        <FlagModal visible={flagOpen} onClose={() => setFlagOpen(false)} contentType="post" contentId={post.id} />
      </TouchableOpacity>
    );
  }

  // ── Snapchat: vertical story-style ──
  if (format === 'snapchat') {
    return (
      <TouchableOpacity style={sc.card} onLongPress={() => setFlagOpen(true)} activeOpacity={1}>
        <View style={sc.storyBar}>
          <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={28} />
          <Text style={sc.name}>{post.author?.display_name}</Text>
          <Text style={sc.time}>{timeAgo(post.created_at)}</Text>
        </View>
        <TouchableOpacity onPress={nav} activeOpacity={0.9}>
          {post.content ? <Text style={sc.text}>{post.content}</Text> : null}
        </TouchableOpacity>
        <ReactionRow post={post} onEngage={onEngage} format="snapchat" />
        <FlagModal visible={flagOpen} onClose={() => setFlagOpen(false)} contentType="post" contentId={post.id} />
      </TouchableOpacity>
    );
  }

  // ── MySpace: retro ──
  if (format === 'myspace') {
    return (
      <TouchableOpacity style={[ms.card, { backgroundColor: myspaceBg }]} onLongPress={() => setFlagOpen(true)} activeOpacity={1}>
        <TouchableOpacity style={ms.header} onPress={navProfile}>
          <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={42} />
          <View>
            <Text style={ms.name}>{post.author?.display_name}</Text>
            <Text style={ms.mood}>Mood: contemplative</Text>
          </View>
        </TouchableOpacity>
        {post.content ? <Text style={ms.text}>{post.content}</Text> : null}
        {photo && <Image source={{ uri: photo }} style={ms.photo} resizeMode="cover" />}
        <ReactionRow post={post} onEngage={onEngage} format="myspace" />
        <Text style={ms.html}>&lt;/div&gt;</Text>
        <FlagModal visible={flagOpen} onClose={() => setFlagOpen(false)} contentType="post" contentId={post.id} />
      </TouchableOpacity>
    );
  }

  // ── Default (HereToo) ──
  return (
    <View style={def.card}>
      <TouchableOpacity style={def.authorRow} onPress={navProfile} activeOpacity={0.7}>
        <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={def.name}>{post.author?.display_name ?? 'Someone'}</Text>
          <Text style={def.meta}>@{post.author?.username} · {timeAgo(post.created_at)}</Text>
        </View>
        <TouchableOpacity onPress={() => setFlagOpen(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.9} onPress={nav}>
        {post.content ? <Text style={def.body}>{post.content}</Text> : null}
        {photo && <Image source={{ uri: photo }} style={def.photo} resizeMode="cover" />}
        {post.media_type === 'video' && post.mux_playback_id && (
          <VideoPlayer playbackId={post.mux_playback_id} thumbnailUrl={post.mux_thumbnail_url ?? undefined} />
        )}
      </TouchableOpacity>
      {post.cluster_reach > 2 && <Text style={def.bridge}>Heard across {post.cluster_reach} communities</Text>}
      <ReactionRow post={post} onEngage={onEngage} format="default" />
      <FlagModal visible={flagOpen} onClose={() => setFlagOpen(false)} contentType="post" contentId={post.id} />
    </View>
  );
}

// ── Default styles ──
const def = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  meta: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  more: { fontSize: 16, color: Colors.textMuted, letterSpacing: 1 },
  body: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginBottom: 10 },
  photo: { width: '100%', height: 240, borderRadius: 10, marginBottom: 10 },
  bridge: { fontSize: 11, color: Colors.textMuted, marginBottom: 6 },
  reactions: { flexDirection: 'row', gap: 6 },
  rxBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  rxText: { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
});

// ── Twitter styles ──
const tw = StyleSheet.create({
  card: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, gap: 10 },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  name: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  handle: { fontSize: 12, color: Colors.textMuted },
  dot: { fontSize: 12, color: Colors.textMuted },
  time: { fontSize: 12, color: Colors.textMuted },
  text: { fontSize: 14, color: Colors.textPrimary, lineHeight: 19, marginBottom: 8 },
  img: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
  reactions: { flexDirection: 'row', gap: 20 },
  rxBtn: {},
  rxText: { fontSize: 12, color: Colors.textMuted },
});

// ── Instagram styles ──
const ig = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  name: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  photo: { width: '100%', height: 340 },
  footer: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  reactions: { flexDirection: 'row', gap: 16 },
  rxIcon: { fontSize: 22, color: Colors.textPrimary },
  caption: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  captionName: { fontWeight: '600' },
  time: { fontSize: 11, color: Colors.textMuted },
});

// ── Facebook styles ──
const fb = StyleSheet.create({
  card: { backgroundColor: Colors.surface, marginHorizontal: 0, marginBottom: 8, paddingBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  name: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textMuted },
  text: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, paddingHorizontal: 12, marginBottom: 8 },
  photo: { width: '100%', height: 260 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  stat: { fontSize: 12, color: Colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: 12 },
  reactions: { flexDirection: 'row', gap: 4, padding: 8, paddingHorizontal: 12 },
  rxBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  rxText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
});

// ── Snapchat styles ──
const sc = StyleSheet.create({
  card: { backgroundColor: '#FFFDE7', marginHorizontal: 12, marginBottom: 10, borderRadius: 16, padding: 14, gap: 8 },
  storyBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  time: { fontSize: 11, color: Colors.textMuted },
  text: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22, fontWeight: '500' },
});

// ── MySpace styles ──
const ms = StyleSheet.create({
  card: { marginHorizontal: 12, marginBottom: 10, borderRadius: 4, borderWidth: 2, borderColor: '#00FFFF', padding: 14, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14, fontWeight: '700', color: '#00FF00', fontFamily: 'Courier' },
  mood: { fontSize: 11, color: '#FFFF00', fontFamily: 'Courier' },
  text: { fontSize: 13, color: '#FFFFFF', lineHeight: 20, fontFamily: 'Courier' },
  photo: { width: '100%', height: 200, borderRadius: 2, borderWidth: 1, borderColor: '#FF00FF' },
  reactions: { flexDirection: 'row', gap: 10 },
  rxText: { fontSize: 12, color: '#00FFFF', fontFamily: 'Courier' },
  html: { fontSize: 10, color: '#666666', fontFamily: 'Courier', alignSelf: 'flex-end' },
});
