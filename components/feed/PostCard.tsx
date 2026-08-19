/**
 * One drop in the feed. A ROW, not a card. Full column width, 16 of
 * padding, one hairline along the bottom. No fill, no outline, no
 * radius, no rail, no kicker. The hairline is the whole separation.
 *
 * Reads the new schema (migrations 001 + 002).
 *
 * Reads body + media (image grid or Mux video) + denormalized engagement
 * counts off the `posts` row. Heart toggle is wired through onHeart prop.
 *
 * Two shapes ride on top of that, both from migration 065, both optional
 * at runtime. Before 065 is run by hand the columns are simply absent,
 * every flag below reads undefined, and the card renders exactly as it
 * always has.
 *
 *   BURNING   destruct_on_view. The card lands sealed for everyone but
 *             the author. Body, media, actions and comments stay off it
 *             until an explicit tap opens it, and that tap is what writes
 *             the post_views row the RLS filter reads. A scroll past is
 *             not a read. Once open the drop shows for the session and
 *             the marker says it will not come back.
 *
 *   DIRECT    visibility='direct'. Marked on the card, with the other
 *             party named. RLS restricts the row to the author and the
 *             one recipient, so this only renders what it was handed.
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
import { Button } from '../shared/Button';
import { useDeletePost } from '../../hooks/useFeed';
import { useLatestComments } from '../../hooks/useComments';
import { useBoostPost, type BoostScope } from '../../hooks/useBoosts';
import { useMyFamilies } from '../../hooks/useFamily';
import { useAuthStore } from '../../stores/authStore';
import { useTTS } from '../../stores/ttsStore';
import { useFlagContent, FLAG_REASONS, type FlagReason } from '../../hooks/useFlagContent';
import { useRevealed, useRevealedBody, useOpenDrop, type DropExtras } from '../../hooks/usePostViews';
import {
  useLineReactions, useFireLine, useUnfireLine, type LineReactionRow,
} from '../../hooks/useLineReactions';
import { drawLines, resolveLineRef, attribution, type PaletteLine } from '../../lib/lineReactions';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Layout, Spacing, Radius, Type } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

/** Action row icons. One size, outline, muted. */
const ACTION_ICON = 22;

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

  // Migration 065 fields. Optional at runtime; undefined before the
  // migration runs, which lands every branch below on the old behavior.
  const extra = post as typeof post & DropExtras;
  const isDirect = (post.visibility as string) === 'direct';
  const burns = !!extra.destruct_on_view;

  // A deaddrop announcement is not a text post — it is a spot on a map.
  // The card is an X, because X marks it. Tapping goes straight into
  // the hunt; the old behavior pushed the post detail with a raw URL in
  // the body, which is a page about a link about a place.
  const huntCode = React.useMemo(() => {
    const m = (post.body ?? '').match(/^DEADDROP · ([A-Z0-9]{6,12})/);
    return m ? m[1] : null;
  }, [post.body]);
  const huntTitle = React.useMemo(() => {
    if (!huntCode) return null;
    const line = (post.body ?? '').split('\n')[1]?.trim() ?? '';
    if (!line || line.startsWith('Sealed until') || line.startsWith('“')) return null;
    return line;
  }, [post.body, huntCode]);

  // Sealed until an explicit tap. The author is never sealed out of
  // their own drop, and the RLS filter never takes it from them either.
  const revealed = useRevealed(post.id);
  const openDrop = useOpenDrop();
  // Burned (migration 074): the first reading redacted it server-side.
  // The row is a tombstone now — never sealed, body already null.
  const burned = !!(extra as any).burned_at;
  const sealed = burns && !burned && !isMine && !revealed;
  // The opener keeps the words for THIS session only — the burn
  // overwrites the row within seconds of the open, so the cache can
  // never show them again; this in-memory copy is what "one look"
  // actually reads by.
  const revealedBody = useRevealedBody(post.id);
  const bodyText = post.body ?? (burned ? revealedBody : null);

  const recipientName =
    extra.recipient?.display_name ?? extra.recipient?.handle ?? null;

  // Who the DM went to. The author gets the name; the recipient already
  // has the sender in the header above, so they get told it was theirs.
  const directMark = !isDirect
    ? null
    : isMine
      ? (recipientName ? `Direct to ${recipientName}` : 'Direct')
      : extra.direct_recipient_id && extra.direct_recipient_id === userId
        ? 'Direct to you'
        : 'Direct';

  // The burn, stated as a fact about the object in front of you. The
  // full account of what happened renders under the redaction bar.
  const burnMark = burned
    ? 'Burned'
    : !burns
      ? null
      : isMine
        ? 'Burns on view'
        : sealed
          ? 'Sealed · one look'
          : 'Burned · gone on reload';

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
      style={s.row}
      // A sealed card does not navigate. The detail route would render
      // the payload without recording the view, which is the whole
      // mechanism. The seal control below is the only way in.
      onPress={() => {
        if (sealed) return;
        // The X opens the hunt, never the post detail.
        if (huntCode) { router.push(`/hunt/${huntCode}` as any); return; }
        router.push(`/(tabs)/feed/${post.id}` as any);
      }}
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

      {/* Destination and burn state, stated on the row. Nothing here
          explains the feature; each mark is a fact about this drop.
          Muted caption, no kicker. */}
      {(!!directMark || !!burnMark) && (
        <View style={s.markRow}>
          {!!directMark && <Text style={s.mark}>{directMark}</Text>}
          {!!directMark && !!burnMark && <Text style={s.markDot}>·</Text>}
          {!!burnMark && <Text style={s.mark}>{burnMark}</Text>}
        </View>
      )}

      {sealed ? (
        // The seal. Same device as a deaddrop: the payload is on the row
        // and off the screen until the reader asks for it. The tap writes
        // the post_views row, so it has to be deliberate.
        <View style={s.seal}>
          <Ionicons
            name="flame-outline"
            size={18}
            color={Colors.textSecondary}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
          <Button
            title="Open once"
            variant="outline"
            size="sm"
            onPress={() => openDrop(post.id, post.body)}
          />
        </View>
      ) : huntCode ? (
        // X marks the spot. Nothing else on the card; the hunt screen
        // holds the compass, the map, and the gate.
        <View style={s.xWrap}>
          <Text style={s.xMark} accessibilityLabel={`Deaddrop ${huntCode}`}>✕</Text>
          {!!huntTitle && <Text style={s.xTitle} numberOfLines={1}>{huntTitle}</Text>}
        </View>
      ) : (
        <>
        {/* The tombstone. The bar is what a redaction looks like, and
            the note under it is the literal record of the mechanics —
            not reassurance, an account. Every clause is checkable
            against open_drop() and drop-purge. */}
        {burned && !revealedBody && (
          <>
            <View style={s.redaction} accessibilityLabel="Redacted" />
            <Text style={s.burnedNote}>
              The text was overwritten in the database the moment this was
              opened. Any photos or video are destroyed within the hour.
            </Text>
          </>
        )}
        {!!bodyText && <Text style={s.body}>{bodyText}</Text>}

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
                  style: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000', borderRadius: Radius.media, objectFit: 'cover' },
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
            {/* The one color in the row. Colors.heart is reserved for this
                and nothing else. Outline and muted until it is earned. */}
            <Ionicons
              name={post.viewer_hearted ? 'heart' : 'heart-outline'}
              size={ACTION_ICON}
              color={post.viewer_hearted ? Colors.heart : Colors.textSecondary}
            />
            {heartCount > 0 && (
              <Text style={[s.actionCount, post.viewer_hearted && { color: Colors.heart }]}>
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
            <Ionicons name="chatbubble-outline" size={ACTION_ICON} color={Colors.textSecondary} />
            {(post.comment_count ?? 0) > 0 && (
              <Text style={s.actionCount}>{post.comment_count}</Text>
            )}
          </TouchableOpacity>

          {/* The dagger. You answer a submission with a real Shakespeare
              line — the quote lands on the card with its speaker and
              play. It wore a flame, but the flame means burn-after-
              reading everywhere else in this app, and a reaction must
              not share a glyph with destruction. † is the typographic
              dagger: Shakespearean twice over, and Ionicons has no
              dagger so the type case supplies one. */}
          <TouchableOpacity
            style={s.actionBtn}
            activeOpacity={0.7}
            onPress={(e) => { e.stopPropagation(); setLineOpen(true); }}
            accessibilityLabel={`Fire a Shakespeare line at this ${Vocab.post}`}
          >
            <Text style={s.daggerGlyph}>†</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            activeOpacity={0.7}
            onPress={(e) => { e.stopPropagation(); setBoostOpen(true); }}
            accessibilityLabel={`Boost this ${Vocab.post}`}
          >
            <Ionicons name="repeat-outline" size={ACTION_ICON} color={Colors.textSecondary} />
            {(post.boost_count ?? 0) > 0 && (
              <Text style={s.actionCount}>{post.boost_count}</Text>
            )}
          </TouchableOpacity>

          {/* Read-aloud — only for genuinely long posts (>200 chars).
              Below that, reading is faster than the audio loads. */}
          <ReadAloudButton postId={post.id} body={post.body ?? ''} />
        </View>

        {/* Lines fired at this drop, quoted with attribution. */}
        <LineReactionList postId={post.id} />

        {/* Inline comment preview — latest 2 top-level comments. */}
        <CommentPreview postId={post.id} commentCount={post.comment_count ?? 0} />
        </>
      )}

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
                <Text style={s.scopeHint}>Anyone in your network</Text>
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
                  <Text style={s.scopeHint}>Only members of this {Vocab.group}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setBoostOpen(false)}
              style={{ marginTop: Spacing.xs }}
            />
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
 * Lines already fired at this drop are held out of the draw.
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
 * The lines fired at this drop, quoted with speaker and play. Your own
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
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }]}
        onPress={() => { reset(); onClose(); }}
      >
        <Pressable
          style={{ backgroundColor: Colors.surface, borderRadius: Radius.media, padding: 18, gap: Spacing.xxs, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: Colors.border }}
          onPress={(e) => e.stopPropagation()}
        >
          {sent ? (
            <>
              <Text style={{ fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary }}>
                Report sent.
              </Text>
              <Button
                title="Done"
                variant="primary"
                onPress={() => { reset(); onClose(); }}
                style={{ marginTop: 14 }}
              />
            </>
          ) : (
            <>
              <Text style={{ fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.xs }}>
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
                      paddingVertical: Spacing.xs, paddingHorizontal: Spacing.xs, borderRadius: Radius.control,
                      backgroundColor: isPicked ? Colors.surfaceAlt : 'transparent',
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={isPicked ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isPicked ? Colors.primary : Colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary }}>{r.label}</Text>
                      <Text style={{ fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 1 }}>{r.sub}</Text>
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
                    backgroundColor: Colors.surfaceAlt,
                    borderWidth: 1, borderColor: Colors.border,
                    borderRadius: Radius.control, padding: 10,
                    fontSize: Type.body.size, color: Colors.textPrimary,
                    minHeight: 60, marginTop: Spacing.xxs,
                  }}
                />
              )}
              <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: 10 }}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => { reset(); onClose(); }}
                  style={{ flex: 1 }}
                />
                <Button
                  title={flag.isPending ? 'Sending…' : 'Submit'}
                  variant="primary"
                  onPress={submit}
                  disabled={!reason || flag.isPending || (reason === 'other' && note.trim().length < 5)}
                  style={{ flex: 1 }}
                />
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
        size={ACTION_ICON}
        color={isMine ? Colors.textPrimary : Colors.textSecondary}
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
  // THE ROW. No fill, no outline, no radius, no shadow, no left rail.
  // It sits on the canvas and a single hairline separates it from the
  // next one.
  row: {
    paddingHorizontal: Layout.rowPaddingHorizontal,
    paddingVertical: Layout.rowPaddingVertical,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  author: {
    fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight, color: Colors.textPrimary,
  },
  time: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary, marginTop: 1,
  },
  body: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
  // The redaction bar. Solid ink, the width of a sentence that is no
  // longer there.
  redaction: {
    height: Type.body.lineHeight,
    alignSelf: 'stretch',
    maxWidth: 260,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  // The account of the burn. Muted, under the bar.
  burnedNote: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary, marginTop: 6,
  },
  // The deaddrop X. Ink, centred, and the whole card is the door.
  xWrap: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 4 },
  xMark: { fontSize: 56, lineHeight: 60, fontWeight: '800', color: Colors.textPrimary },
  xTitle: { fontSize: Type.ui.size, color: Colors.textSecondary },
  // Right-aligned attribution. Italic and muted so it reads as a
  // citation, not a competing voice.
  slugline: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    fontStyle: 'italic',
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: -2,
  },
  // Destination / burn marks. One line, under the byline.
  markRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    flexWrap: 'wrap', marginTop: -2,
  },
  mark: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },
  markDot: { fontSize: Type.caption.size, color: Colors.textMuted },

  // The seal. A well where the payload would be, with the one control
  // that opens it.
  seal: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.xxs,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceAlt,
  },

  // Media runs the full column width.
  mediaWrap: {
    position: 'relative', marginTop: Spacing.xs,
    borderRadius: Radius.media, overflow: 'hidden',
    backgroundColor: Colors.surfaceAlt,
  },
  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Colors.surfaceAlt },
  videoBox: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%', opacity: 0.7 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaCount: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.control,
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
  // Sized to read at the same weight as the 22px Ionicons beside it.
  daggerGlyph: {
    fontSize: ACTION_ICON, lineHeight: ACTION_ICON + 2,
    color: Colors.textSecondary, fontWeight: '600',
  },
  actionCount: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },

  // Fired lines. Quoted, indented off a hairline rule so they read as
  // spoken text answering the drop rather than more body copy.
  lineReactions: {
    marginTop: Spacing.xxs,
    gap: Spacing.xs,
  },
  firedRow: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    paddingLeft: Spacing.xs,
    paddingVertical: 2,
    gap: 2,
  },
  firedQuote: {
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    fontStyle: 'italic',
    color: Colors.textPrimary,
  },
  firedAttr: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },

  // Picker.
  pickerScroll: { maxHeight: 340 },
  lineCard: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceAlt,
    marginBottom: Spacing.xs,
    gap: Spacing.xxs,
  },
  lineQuote: {
    fontSize: Type.body.size,
    lineHeight: Type.body.lineHeight,
    fontStyle: 'italic',
    color: Colors.textPrimary,
  },
  lineAttr: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: Spacing.xs,
  },
  pickerBtnText: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: Type.ui.weight, color: Colors.textSecondary,
  },

  commentPreview: {
    marginTop: Spacing.xxs, paddingTop: Spacing.xs,
    gap: Spacing.xxs,
  },
  commentLine: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  commentName: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    fontWeight: '600', color: Colors.textPrimary, flexShrink: 0,
  },
  commentBody: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary, flex: 1,
  },
  commentMore: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary, marginTop: 2,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.media, padding: Spacing.lg, gap: Spacing.xxs,
    width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight, color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.xs,
    borderRadius: Radius.control,
  },
  scopeLabel: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: '600', color: Colors.textPrimary,
  },
  scopeHint: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 1,
  },
}); }
