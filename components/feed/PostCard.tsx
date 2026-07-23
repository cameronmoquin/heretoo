/**
 * Single feed post card. Clean rewrite for the new schema (migrations 001 + 002).
 *
 * Reads body + media (image grid or Mux video) + denormalized engagement
 * counts off the `posts` row. Heart toggle is wired through onHeart prop.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Post } from '../../stores/feedStore';
import { Platform } from 'react-native';
import { mediaPathToUrl, mediaPathToThumb } from '../../hooks/useUpload';
import { StatureAvatar } from '../shared/StatureAvatar';
import { Lightbox } from '../shared/Lightbox';
import { useDeletePost } from '../../hooks/useFeed';
import { useLatestComments } from '../../hooks/useComments';
import { useBoostPost, type BoostScope } from '../../hooks/useBoosts';
import { useMyFamilies } from '../../hooks/useFamily';
import { useAuthStore } from '../../stores/authStore';
import { useTTS } from '../../stores/ttsStore';
import { useFlagContent, FLAG_REASONS, type FlagReason } from '../../hooks/useFlagContent';
import {
  useLineReactions, useFireLine, useUnfireLine, type LineReactionRow,
} from '../../hooks/useLineReactions';
import { drawLines, resolveLineRef, attribution, type PaletteLine } from '../../lib/lineReactions';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, Shadow } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

// Recognizable "liked" red — same hue Twitter, Instagram, and Reddit
// converged on. Sits adjacent to the brand primary indigo without
// fighting it; the brand color stays meaningful for primary CTAs.
const HEART_RED = '#E0245E';

/** How many lines the picker lays out per draw. */
const DRAW = 5;

interface PostCardProps {
  post: Post;
  onHeart?: (postId: string) => void;
}

export function PostCard({ post, onHeart }: PostCardProps) {
  const s = makeStyles();
  const author = post.author;
  const media = post.media ?? [];
  const heartCount = post.heart_count ?? 0;
  const userId = useAuthStore((st) => st.user?.id);
  const isMine = userId === post.author_id;
  const deletePost = useDeletePost();
  const [boostOpen, setBoostOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const boost = useBoostPost();
  const { data: families } = useMyFamilies();

  const onDelete = () => {
    showConfirm(
      `Delete ${Vocab.post}?`,
      'This cannot be undone.',
      () => deletePost.mutate(post.id),
      'Delete',
      'Cancel',
    );
  };

  return (
    <Pressable
      style={s.card}
      onPress={() => router.push(`/(tabs)/feed/${post.id}` as any)}
    >
      <View style={s.header}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            if (author?.handle) router.push(`/u/${author.handle}` as any);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          <StatureAvatar
            profileId={post.author_id}
            name={author?.display_name ?? author?.handle ?? null}
            photoUrl={author?.avatar_path ? mediaPathToUrl(author.avatar_path) : null}
            size={40}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.author}>{author?.display_name ?? author?.handle ?? 'Unknown'}</Text>
            <Text style={s.time}>{timeAgo(post.created_at)}</Text>
          </View>
        </Pressable>
        {isMine ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onDelete(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Delete ${Vocab.post}`}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : (
          // Not-mine posts get a flag/report icon. The actual modal
          // and reason picker is handled by FlagModal below — this
          // just opens it.
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); setFlagOpen(true); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Report ${Vocab.post}`}
          >
            <Ionicons name="flag-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!!post.body && <Text style={s.body}>{post.body}</Text>}

      {/* Optional attribution slug — used by Shakespeare bot posts
          ("— Hamlet · Hamlet · III.i") and any future post that
          wants a citation line. Right-aligned, italic, muted: visually
          subordinate to the line itself, like a stage direction. */}
      {!!post.slugline && (
        <Text style={s.slugline} numberOfLines={2}>{post.slugline}</Text>
      )}

      {media.length > 0 && (
        <View style={s.mediaWrap}>
          {media[0].media_type === 'video' ? (
            Platform.OS === 'web' ? (
              React.createElement('video', {
                src: mediaPathToUrl(media[0].storage_path),
                poster: mediaPathToThumb(media[0].storage_path) ?? undefined,
                autoPlay: true,
                loop: true,
                muted: true,
                playsInline: true,
                style: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000', borderRadius: 8, objectFit: 'cover' },
              })
            ) : (
              <View style={s.videoBox}>
                <Image
                  source={{ uri: mediaPathToThumb(media[0].storage_path) ?? mediaPathToUrl(media[0].storage_path) }}
                  style={s.videoThumb}
                />
                <View style={s.playOverlay}>
                  <Ionicons name="play" size={32} color="#FFF" />
                </View>
              </View>
            )
          ) : (
            <Pressable
              onPress={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              accessibilityLabel="View photo full screen"
            >
              <Image
                source={{ uri: mediaPathToUrl(media[0].storage_path) }}
                style={s.image}
                resizeMode="cover"
              />
            </Pressable>
          )}
          {media.length > 1 && (
            <View style={s.mediaCount}>
              <Ionicons name="copy" size={11} color="#FFF" />
              <Text style={s.mediaCountText}>{media.length}</Text>
            </View>
          )}
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={(e) => { e.stopPropagation(); onHeart?.(post.id); }}
          activeOpacity={0.7}
          accessibilityLabel={post.viewer_hearted ? `Unheart ${Vocab.post}` : `Heart ${Vocab.post}`}
        >
          {/* Filled heart in the recognizable "social red" — Twitter /
              Instagram convention. The outline version for "not yet
              hearted" matches the rest of the muted action row. */}
          <Ionicons
            name={post.viewer_hearted ? 'heart' : 'heart-outline'}
            size={18}
            color={post.viewer_hearted ? HEART_RED : Colors.textSecondary}
          />
          {heartCount > 0 && (
            <Text style={[s.actionCount, post.viewer_hearted && { color: HEART_RED }]}>
              {heartCount}
            </Text>
          )}
        </TouchableOpacity>

        {/* Tapping the comment bubble navigates to the post detail page
            using the EXACT same path string the parent Pressable uses
            (which is known to work). The object-form router.push tried
            previously bounced to login on some environments. Detail
            page reads ?focus=comment from the search params and
            auto-focuses the composer.
            e.stopPropagation prevents double-firing the parent. */}
        <TouchableOpacity
          style={s.actionBtn}
          activeOpacity={0.7}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/(tabs)/feed/${post.id}?focus=comment` as any);
          }}
          accessibilityLabel="Add a comment"
        >
          <Ionicons name="chatbubble-outline" size={17} color={Colors.textSecondary} />
          {(post.comment_count ?? 0) > 0 && (
            <Text style={s.actionCount}>{post.comment_count}</Text>
          )}
        </TouchableOpacity>

        {/* Fire a line. The reaction vocabulary here is language, not
            glyphs: you answer a slip with a real Shakespeare line and
            the quote lands on the card with its speaker and play. */}
        <TouchableOpacity
          style={s.actionBtn}
          activeOpacity={0.7}
          onPress={(e) => { e.stopPropagation(); setLineOpen(true); }}
          accessibilityLabel={`Fire a Shakespeare line at this ${Vocab.post}`}
        >
          <Ionicons name="flame-outline" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionBtn}
          activeOpacity={0.7}
          onPress={(e) => { e.stopPropagation(); setBoostOpen(true); }}
          accessibilityLabel={`Boost this ${Vocab.post}`}
        >
          <Ionicons name="repeat-outline" size={18} color={Colors.textSecondary} />
          {(post.boost_count ?? 0) > 0 && (
            <Text style={s.actionCount}>{post.boost_count}</Text>
          )}
        </TouchableOpacity>

        {/* Read-aloud — only for genuinely long posts (>200 chars).
            Below that, reading is faster than the audio loads. */}
        <ReadAloudButton postId={post.id} body={post.body ?? ''} />
      </View>

      {/* Lines fired at this slip, quoted with attribution. */}
      <LineReactionList postId={post.id} />

      {/* Inline comment preview — latest 2 top-level comments. */}
      <CommentPreview postId={post.id} commentCount={post.comment_count ?? 0} />

      <Modal
        visible={boostOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBoostOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setBoostOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Boost this {Vocab.post}</Text>

            <TouchableOpacity
              style={s.scopeRow}
              onPress={() => {
                setBoostOpen(false);
                boost.mutate(
                  { originalPostId: post.id, scope: 'public' },
                  { onError: (e: any) => showAlert('Could not boost', e?.message ?? 'Try again.') },
                );
              }}
            >
              <Ionicons name="globe-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.scopeLabel}>Public</Text>
                <Text style={s.scopeHint}>Anyone signed in</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.scopeRow}
              onPress={() => {
                setBoostOpen(false);
                boost.mutate(
                  { originalPostId: post.id, scope: 'connections' },
                  { onError: (e: any) => showAlert('Could not boost', e?.message ?? 'Try again.') },
                );
              }}
            >
              <Ionicons name="git-network-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.scopeLabel}>Your network</Text>
                <Text style={s.scopeHint}>Anyone in your crew graph</Text>
              </View>
            </TouchableOpacity>

            {(families ?? []).map((f: any) => (
              <TouchableOpacity
                key={f.id}
                style={s.scopeRow}
                onPress={() => {
                  setBoostOpen(false);
                  boost.mutate(
                    { originalPostId: post.id, scope: 'family', familyId: f.id },
                    { onError: (e: any) => showAlert('Could not boost', e?.message ?? 'Try again.') },
                  );
                }}
              >
                <Ionicons name="people-outline" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.scopeLabel}>{f.name}</Text>
                  <Text style={s.scopeHint}>Only members of this crew</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={s.modalCancel} onPress={() => setBoostOpen(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Flag / report modal — opened from the flag icon in the
          header for not-mine posts. Picks a reason and optionally a
          short note. Once N distinct users flag the same item, the
          server-side active_flagged_posts view auto-filters it from
          the feed pending review. */}
      <FlagModal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        postId={post.id}
      />

      {/* Barb picker — a handful of real lines, drawn fresh. */}
      <LinePicker
        open={lineOpen}
        onClose={() => setLineOpen(false)}
        postId={post.id}
      />

      {/* Tap a photo to open it full-screen; swipe through the rest. */}
      <Lightbox
        media={media}
        startIndex={0}
        visible={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </Pressable>
  );
}

/**
 * Barb picker. Opens on a fresh draw of real lines from the corpus,
 * each shown whole with its speaker and play. Tap one to fire it.
 * Draw again for another handful. Attribution is the point, so the
 * speaker and the play sit under every line here and on the card.
 *
 * Lines already fired at this slip are held out of the draw.
 */
function LinePicker({ open, onClose, postId }: {
  open: boolean;
  onClose: () => void;
  postId: string;
}) {
  const s = makeStyles();
  const { data: existing } = useLineReactions(postId);
  const fire = useFireLine();
  const [draw, setDraw] = useState<PaletteLine[]>([]);

  // Held in a ref so a background refetch of the existing reactions
  // cannot reshuffle the draw under the reader's thumb.
  const takenRef = useRef<Set<string>>(new Set());
  takenRef.current = new Set(
    (existing ?? []).map((r) => r.line_ref ?? '').filter(Boolean),
  );

  useEffect(() => {
    if (open) setDraw(drawLines(DRAW, takenRef.current));
  }, [open]);

  const redraw = () => setDraw(drawLines(DRAW, takenRef.current));

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={s.modalTitle}>Fire a line</Text>

          <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
            {draw.map((l) => (
              <TouchableOpacity
                key={l.ref}
                style={s.lineCard}
                activeOpacity={0.75}
                onPress={() => {
                  fire.mutate(
                    { postId, line: l },
                    {
                      onSuccess: onClose,
                      onError: (e: any) =>
                        showAlert('Could not fire that line', e?.message ?? 'Try again.'),
                    },
                  );
                }}
                accessibilityLabel={`Fire this line: ${l.text} Spoken by ${l.speaker} in ${l.play}`}
              >
                <Text style={s.lineQuote}>{`“${l.text}”`}</Text>
                <Text style={s.lineAttr}>{attribution(l)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.pickerActions}>
            <TouchableOpacity
              style={s.pickerBtn}
              onPress={redraw}
              accessibilityLabel="Draw another handful of lines"
            >
              <Ionicons name="shuffle-outline" size={16} color={Colors.textSecondary} />
              <Text style={s.pickerBtnText}>Draw again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.pickerBtn}
              onPress={onClose}
              accessibilityLabel="Close the line picker"
            >
              <Text style={s.pickerBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The lines fired at this slip, quoted with speaker and play. Your own
 * line is tappable to take it back.
 *
 * No tally. A reaction shows what was said and who said it.
 *
 * Renders nothing when the fetch comes back empty, which is also what
 * happens before migration 060 has been run by hand.
 */
function LineReactionList({ postId }: { postId: string }) {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const { data } = useLineReactions(postId);
  const unfire = useUnfireLine();

  const rows = (data ?? [])
    .map((row) => ({ row, line: resolveLineRef(row.line_ref) }))
    .filter((x): x is { row: LineReactionRow; line: PaletteLine } => !!x.line);

  if (rows.length === 0) return null;

  return (
    <View style={s.lineReactions}>
      {rows.map(({ row, line }) => {
        const quote = (
          <>
            <Text style={s.firedQuote}>{`“${line.text}”`}</Text>
            <Text style={s.firedAttr}>{attribution(line)}</Text>
          </>
        );
        if (row.profile_id !== userId) {
          return <View key={row.id} style={s.firedRow}>{quote}</View>;
        }
        return (
          <TouchableOpacity
            key={row.id}
            style={s.firedRow}
            activeOpacity={0.7}
            onPress={(e) => {
              e.stopPropagation();
              unfire.mutate(
                { postId, reactionId: row.id },
                {
                  onError: (err: any) =>
                    showAlert('Could not take that line back', err?.message ?? 'Try again.'),
                },
              );
            }}
            accessibilityLabel={`Take back your line: ${line.text} Spoken by ${line.speaker} in ${line.play}`}
          >
            {quote}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Flag/report modal — pick a reason + optional note, send to the
 * moderation queue via flag_content RPC. Shown when the user taps
 * the flag icon on a post they didn't write.
 */
function FlagModal({ open, onClose, postId, commentId }: {
  open: boolean;
  onClose: () => void;
  postId?: string;
  commentId?: string;
}) {
  const s = makeStyles();
  const flag = useFlagContent();
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const reset = () => { setReason(null); setNote(''); setSent(false); };

  const submit = () => {
    if (!reason) return;
    if (reason === 'other' && note.trim().length < 5) return;
    flag.mutate({ postId, commentId, reason, note: note.trim() || undefined }, {
      onSuccess: () => { setSent(true); },
    });
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => { reset(); onClose(); }}
    >
      <Pressable
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }]}
        onPress={() => { reset(); onClose(); }}
      >
        <Pressable
          style={{ backgroundColor: Colors.surface, borderRadius: 16, padding: 18, gap: 4, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: Colors.border }}
          onPress={(e) => e.stopPropagation()}
        >
          {sent ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>
                Report sent.
              </Text>
              <TouchableOpacity
                onPress={() => { reset(); onClose(); }}
                style={{ marginTop: 14, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.primary }}
              >
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 }}>
                Report this {commentId ? 'comment' : Vocab.post}
              </Text>
              {FLAG_REASONS.map((r) => {
                const isPicked = reason === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setReason(r.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                      paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10,
                      backgroundColor: isPicked ? Colors.primaryFaint : 'transparent',
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={isPicked ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isPicked ? Colors.primary : Colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.textPrimary }}>{r.label}</Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>{r.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {reason === 'other' && (
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Details"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={500}
                  style={{
                    backgroundColor: Colors.surfaceLight,
                    borderWidth: 1, borderColor: Colors.border,
                    borderRadius: 10, padding: 10,
                    fontSize: 13, color: Colors.textPrimary,
                    minHeight: 60, marginTop: 4,
                  }}
                />
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => { reset(); onClose(); }}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: Colors.border }}
                >
                  <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submit}
                  disabled={!reason || flag.isPending || (reason === 'other' && note.trim().length < 5)}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10,
                    backgroundColor: Colors.primary,
                    opacity: !reason || flag.isPending || (reason === 'other' && note.trim().length < 5) ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>
                    {flag.isPending ? 'Sending…' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Read-aloud control. Shown only for posts whose body is >200 chars
 * (below that, reading the text yourself is faster than waiting for
 * the audio to load). When playing, the icon flips to a stop square
 * so a second tap stops the clip in place.
 *
 * Singleton playback: tapping read-aloud on a different post stops
 * this one. The shared ttsStore handles that cross-post coordination
 * AND pauses the WCRB radio stream — only one audio source plays at
 * a time.
 */
function ReadAloudButton({ postId, body }: { postId: string; body: string }) {
  const s = makeStyles();
  const isMine = useTTS((st) => st.currentId === postId);
  const playing = useTTS((st) => st.playing);
  const loading = useTTS((st) => st.loading);
  const toggle = useTTS((st) => st.toggle);

  if (!body || body.trim().length < 200) return null;

  const myPlaying = isMine && playing;
  const myLoading = isMine && loading;

  return (
    <TouchableOpacity
      style={s.actionBtn}
      activeOpacity={0.7}
      onPress={(e) => { e.stopPropagation(); toggle(postId, body); }}
      accessibilityLabel={myPlaying ? 'Stop reading' : 'Read aloud'}
    >
      <Ionicons
        name={myLoading ? 'hourglass-outline' : myPlaying ? 'stop-circle-outline' : 'volume-high-outline'}
        size={18}
        color={isMine ? Colors.primary : Colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

/**
 * Inline comment preview shown directly under the actions row.
 * Pulls the latest 2 top-level comments. If there are more than what
 * we show, surfaces a "View all N comments" link that drops into the
 * post detail page.
 */
function CommentPreview({ postId, commentCount }: { postId: string; commentCount: number }) {
  const s = makeStyles();
  const { data: comments } = useLatestComments(postId, 2);
  if (!comments || comments.length === 0) return null;

  const moreToSee = commentCount > comments.length;

  return (
    <View style={s.commentPreview}>
      {comments.map((c) => (
        <View key={c.id} style={s.commentLine}>
          <Text style={s.commentName} numberOfLines={1}>
            {c.author?.display_name ?? c.author?.handle ?? 'someone'}
          </Text>
          <Text style={s.commentBody} numberOfLines={2}>{c.body}</Text>
        </View>
      ))}
      {moreToSee && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); router.push(`/(tabs)/feed/${postId}` as any); }}
        >
          <Text style={s.commentMore}>
            View all {commentCount} comment{commentCount === 1 ? '' : 's'} →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  return d.toLocaleDateString();
}

function makeStyles() { return StyleSheet.create({
  // Cleaner card: thin top border, no bottom hairline (next card supplies
  // its own), tighter vertical rhythm.
  card: {
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,     // was Spacing.sm — more breathing room
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  avatar: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF', fontSize: Type.body.size, fontWeight: '700' },
  author: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: Type.uiBold.weight, color: Colors.textPrimary,
  },
  time: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 1,
  },
  body: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
  // Bottom-right attribution. Italic + small + muted so it reads as
  // a citation, not a competing voice. The Em-dash prefix is part of
  // the stored string so editors can stylize the slug as needed.
  slugline: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: -2,
    letterSpacing: 0.1,
  },
  mediaWrap: {
    position: 'relative', marginTop: Spacing.xs,
    borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    ...(Shadow.sm as object),
  },
  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Colors.background },
  videoBox: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%', opacity: 0.7 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaCount: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  mediaCountText: {
    color: '#FFF', fontSize: Type.caption.size,
    fontWeight: '700', letterSpacing: 0.2,
  },
  actions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xxs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.xxs,
  },
  actionCount: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary, fontWeight: '600',
  },

  // Fired lines. Quoted, indented off a left rule so they read as
  // spoken text answering the slip rather than more body copy.
  lineReactions: {
    marginTop: Spacing.xxs,
    gap: Spacing.xs,
  },
  firedRow: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
    paddingLeft: Spacing.xs,
    paddingVertical: 2,
    gap: 2,
  },
  firedQuote: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    color: Colors.textPrimary,
  },
  firedAttr: {
    fontSize: 11.5,
    color: Colors.textMuted,
    letterSpacing: 0.1,
  },

  // Picker.
  pickerScroll: { maxHeight: 340 },
  lineCard: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  lineQuote: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    color: Colors.textPrimary,
  },
  lineAttr: {
    fontSize: 11.5,
    color: Colors.textMuted,
    letterSpacing: 0.1,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 8,
  },
  pickerBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  commentPreview: {
    marginTop: Spacing.xxs, paddingTop: Spacing.xxs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    gap: 4,
  },
  commentLine: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  commentName: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, flexShrink: 0 },
  commentBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, flex: 1 },
  commentMore: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.lg, gap: 4,
    width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: Colors.border,
    ...(Shadow.lg as object),
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  scopeLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  scopeHint: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  modalCancel: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  modalCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
}); }
