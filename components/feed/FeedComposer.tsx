/**
 * Inline "New Post" composer pinned to the top of the feed.
 *
 * Layout (top → bottom):
 *   ┌──────────────────────────────────────────────┐
 *   │ New post                              [Post] │
 *   │ ┌──────────────────────────────────────────┐ │
 *   │ │ What's happening?                        │ │  ← multiline TextInput
 *   │ │                                          │ │
 *   │ └──────────────────────────────────────────┘ │
 *   │ [📷 Photo]  [🎥 Video]  [↻ Two-Way]  [@ Tag] │
 *   │ {selected media thumbs}                      │
 *   │ {tagged: @alice, @bob ✕}                     │
 *   └──────────────────────────────────────────────┘
 *
 * Behaviors:
 *   - "Tag your connections" opens a modal listing everyone in the
 *     viewer's crew network. Selecting inserts an @handle into the body
 *     and tracks the profile_id locally for future post_mentions support.
 *   - Two-Way is mobile-only (web shows the existing "use the app" stub
 *     inside the modal — the component handles its own platform branch).
 *   - Posting reuses the existing useUpload pipeline. No regression on
 *     the dedicated /upload screen; that still works for power-users.
 *
 * Destination (main-feed composer only, absent when familyId is set):
 *   Crew   → the original path. useUpload.createPost. Default, always.
 *   Public → a loft post. useCreateLoftPost. Pseudonymous byline from
 *            useLoftHandle, hard 1200-char DB constraint, 24h expiry,
 *            no attachments (loft_posts has a body column and nothing
 *            else). This absorbed the composer from the deleted
 *            /loft screen, including its pseudonym claim flow.
 *   Destination resets to Crew after every send and on collapse. The
 *   dangerous mis-send is crew-thought-into-the-public-square, so the
 *   sticky state is the safe one.
 */

/** Mirrors loft_posts: check (length(body) between 1 and 1200). */
const LOFT_MAX = 1200;
const CREW_MAX = 2000;

type Destination = 'crew' | 'public';

import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Image, Platform, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUpload } from '../../hooks/useUpload';
import { useMyConnections, useMyFamilies, useFamilyMembersWithProfiles } from '../../hooks/useFamily';
import { useLoftHandle, useCreateLoftPost, useRegenerateLoftHandle } from '../../hooks/useLoft';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { TwoWayCapture, type CapturedAsset } from '../upload/TwoWayCapture';
import { OneWayCapture } from '../upload/OneWayCapture';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { MicInputButton } from '../shared/MicInputButton';

interface FeedComposerProps {
  /**
   * When set, the composer posts to this crew (visibility='family',
   * family_id=<id>) and skips the "join a crew first" gate.
   * Leave undefined for the public/main-feed composer (visibility='public').
   */
  familyId?: string;
}

export function FeedComposer({ familyId }: FeedComposerProps = {}) {
  const s = makeStyles();
  const upload = useUpload();
  const { data: connections } = useMyConnections();
  const { data: families } = useMyFamilies();
  const userId = useAuthStore((st) => st.user?.id);
  const inAFamily = (families?.length ?? 0) > 0;
  const isFamilyScoped = !!familyId;
  const [postKind, setPostKind] = useState<'post' | 'update'>('post');
  const [expanded, setExpanded] = useState(false);

  // Destination. Only the main-feed composer offers it; a crew-scoped
  // composer is pinned to its crew and uses the Post/Update toggle in
  // this slot instead.
  const [destination, setDestination] = useState<Destination>('crew');
  const canChooseDestination = !isFamilyScoped;
  const isPublic = canChooseDestination && destination === 'public';

  const { data: loftHandle, refetch: refetchLoftHandle } = useLoftHandle();
  const regenerateLoftHandle = useRegenerateLoftHandle();
  const createLoftPost = useCreateLoftPost();

  const [body, setBody] = useState('');
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [twoWayOpen, setTwoWayOpen] = useState(false);
  const [oneWayOpen, setOneWayOpen] = useState(false);

  // Recipient-restricted updates: which crew members get this update.
  // Empty set = "broadcast to whole crew" (default behavior of any
  // crew post). Picker only opens when kind='update' is selected on
  // a crew-scoped composer.
  const [updateRecipientIds, setUpdateRecipientIds] = useState<Set<string>>(new Set());
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const { data: familyMembers } = useFamilyMembersWithProfiles(familyId ?? null);

  const hasMedia = upload.selectedAssets.length > 0;
  const trimmedLen = body.trim().length;
  const overLoftLimit = isPublic && trimmedLen > LOFT_MAX;
  const isUploading = upload.stage === 'uploading' || upload.stage === 'creating_post';
  const isSending = isUploading || createLoftPost.isPending;

  // Public needs a body inside 1..1200 and a claimed pseudonym. It can
  // never be satisfied by media alone; loft posts carry no media.
  const canPost = isPublic
    ? trimmedLen > 0 && !overLoftLimit && !!loftHandle
    : trimmedLen > 0 || hasMedia;

  /**
   * Pseudonym claim. Lifted unchanged from the /loft screen: roll a
   * handle, and if the RPC fails, refetch as the fallback path before
   * surfacing the error.
   */
  const claimPseudonym = async () => {
    try {
      await regenerateLoftHandle.mutateAsync();
    } catch (e: any) {
      await refetchLoftHandle();
      if (e?.message) {
        showAlert('Could not generate a pseudonym', e.message);
      }
    }
  };

  // Switching to Public drops any attachment, so say so before it
  // happens. loft_posts stores a body and nothing else; carrying the
  // asset along would silently discard it at insert time.
  const switchDestination = (next: Destination) => {
    if (next === destination) return;
    if (next === 'public' && hasMedia) {
      showAlert('Attachments dropped', 'Public posts are text only.');
      upload.reset();
    }
    setDestination(next);
  };

  const onTwoWayCapture = (asset: CapturedAsset) => {
    upload.setAssets([asset as any]);
    setTwoWayOpen(false);
  };

  const onOneWayCapture = (asset: CapturedAsset) => {
    upload.setAssets([asset as any]);
    setOneWayOpen(false);
  };

  const toggleTag = (profileId: string, handle: string | null) => {
    const next = new Set(taggedIds);
    if (next.has(profileId)) {
      next.delete(profileId);
      // also strip the @handle text if present
      if (handle) {
        setBody((b) => b.replace(new RegExp(`\\s?@${escapeRe(handle)}\\b`, 'g'), '').trim());
      }
    } else {
      next.add(profileId);
      if (handle) {
        setBody((b) => (b.length > 0 ? `${b} @${handle}` : `@${handle}`));
      }
    }
    setTaggedIds(next);
  };

  /** Public path. Validates against the DB constraint before the
   *  insert so the user reads a sentence instead of a Postgres error. */
  const handlePublicPost = async () => {
    const text = body.trim();
    if (text.length < 1) {
      showAlert('Nothing to post', 'Write something first.');
      return;
    }
    if (text.length > LOFT_MAX) {
      showAlert('Too long', `Public posts stop at ${LOFT_MAX} characters. Yours is ${text.length}.`);
      return;
    }
    if (!loftHandle) {
      showAlert('No pseudonym yet', 'Claim one before posting to Public.');
      return;
    }
    try {
      await createLoftPost.mutateAsync(text);
      setBody('');
      setTaggedIds(new Set());
      setDestination('crew');
      setExpanded(false);
      upload.reset();
    } catch (e: any) {
      showAlert('Could not post', e?.message ?? 'Try again.');
    }
  };

  const handlePost = async () => {
    if (isPublic) return handlePublicPost();
    try {
      let photoUploads: { path: string; width?: number; height?: number }[] | undefined;
      let muxPlaybackId: string | undefined;
      let videoDurationMs: number | undefined;

      if (hasMedia) {
        const first = upload.selectedAssets[0];
        const isVideo = first.type === 'video';
        if (isVideo) {
          const v = await upload.uploadVideo(first);
          muxPlaybackId = v.playbackId;
          videoDurationMs = first.duration ?? undefined;
        } else {
          photoUploads = await upload.uploadPhotos(upload.selectedAssets);
        }
      }

      await upload.createPost.mutateAsync({
        body: body.trim(),
        visibility: isFamilyScoped ? 'family' : 'public',
        familyId: familyId,
        kind: isFamilyScoped ? postKind : 'post',
        // Only pass recipient list for genuine crew updates with a
        // non-empty selection. Author is implicit — RLS lets them read
        // their own posts unconditionally.
        updateRecipientIds:
          isFamilyScoped && postKind === 'update' && updateRecipientIds.size > 0
            ? [...updateRecipientIds]
            : undefined,
        photoUploads,
        muxPlaybackId,
        videoDurationMs,
      });

      // reset
      setBody('');
      setTaggedIds(new Set());
      setUpdateRecipientIds(new Set());
      setPostKind('post');
      setExpanded(false);
      upload.reset();
    } catch (e: any) {
      showAlert('Could not post', e?.message ?? 'Try again.');
    }
  };

  const taggedList = connections?.filter((c) => taggedIds.has(c.id)) ?? [];

  // Public posting requires at least one active crew membership.
  // The whole point of HereToo: crew ties are the anti-spam layer that
  // earns the right to post in the common area.
  // Crew-scoped composers skip this gate. If you're on the crew
  // page, you're necessarily a member of that crew.
  // Public is exempt: loft posts only require an authenticated user,
  // so the gate steps aside once that destination is chosen.
  if (!isFamilyScoped && !isPublic && families !== undefined && !inAFamily) {
    return (
      <View style={s.gateCard}>
        <Ionicons name="people-outline" size={24} color={Colors.primary} />
        <Text style={s.gateTitle}>Join a crew to post here</Text>
        <View style={s.gateRow}>
          <TouchableOpacity
            style={s.gateBtn}
            onPress={() => router.push('/family/join' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.gateBtnText}>Enter invite code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.gateBtn, s.gateBtnAlt]}
            onPress={() => router.push('/family' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.gateBtnTextAlt}>Start a crew</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.gateBtn, s.gateBtnAlt]}
            onPress={() => { setDestination('public'); setExpanded(true); }}
            activeOpacity={0.85}
            accessibilityLabel="Post to Public instead. Pseudonymous, vanishes after 24 hours"
          >
            <Text style={s.gateBtnTextAlt}>Post to Public</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Collapsed: tiny one-row entry point. The user taps it (or the
  // direct camera/photo buttons) to expand into the full composer.
  // Posting volume is low enough that giving the feed back ~200px of
  // vertical real-estate is worth the extra tap to expand.
  const isQuiet = !expanded && body.length === 0 && !hasMedia && !isSending;
  if (isQuiet) {
    return (
      <View style={s.collapsedRow}>
        <TouchableOpacity
          style={s.collapsedInput}
          onPress={() => setExpanded(true)}
          activeOpacity={0.7}
          accessibilityLabel="New post"
        >
          <Ionicons name="create-outline" size={14} color={Colors.textMuted} />
          <Text style={s.collapsedPlaceholder}>Post</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.collapsedIcon}
          onPress={() => { setExpanded(true); upload.pickPhotos(); }}
          accessibilityLabel="Add photo"
        >
          <Ionicons name="image-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.title}>
          {isPublic
            ? 'New public post'
            : isFamilyScoped && postKind === 'update' ? 'New update' : 'New post'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={() => { setExpanded(false); setBody(''); setDestination('crew'); upload.reset(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.collapseBtn}
            accessibilityLabel="Collapse composer"
          >
            <Ionicons name="chevron-up" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.postBtn, isPublic && s.postBtnPublic, (!canPost || isSending) && s.postBtnDisabled]}
            onPress={handlePost}
            disabled={!canPost || isSending}
            activeOpacity={0.85}
            accessibilityLabel={
              isPublic ? 'Post to Public'
                : postKind === 'update' ? 'Send update'
                  : isFamilyScoped ? 'Post to this crew' : 'Post to the feed'
            }
          >
            {isSending
              ? <ActivityIndicator color="#FFF" size="small" />
              : (
                <Text style={s.postBtnText}>
                  {isPublic ? 'Post to Public' : postKind === 'update' ? 'Send update' : 'Post'}
                </Text>
              )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Destination. Two very different audiences, so the control is
          always on screen before the send, never behind a menu. */}
      {canChooseDestination && (
        <View style={s.destRow}>
          <TouchableOpacity
            style={[s.destBtn, !isPublic && s.destBtnActive]}
            onPress={() => switchDestination('crew')}
            activeOpacity={0.7}
            accessibilityLabel={isFamilyScoped ? 'Post to this crew' : 'Post to the feed'}
            accessibilityState={{ selected: !isPublic }}
          >
            <Ionicons
              name="people-outline"
              size={14}
              color={!isPublic ? Colors.primary : Colors.textMuted}
            />
            {/* Only a crew-scoped composer writes visibility 'family'. On
                the main feed this writes 'public', so calling it Crew there
                would promise an audience the post does not get. */}
            <Text style={[s.destBtnText, !isPublic && s.destBtnTextActive]}>
              {isFamilyScoped ? 'Crew' : 'Feed'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.destBtn, isPublic && s.destBtnActive]}
            onPress={() => switchDestination('public')}
            activeOpacity={0.7}
            accessibilityLabel="Post to Public. Pseudonymous, vanishes after 24 hours"
            accessibilityState={{ selected: isPublic }}
          >
            <Ionicons
              name="earth-outline"
              size={14}
              color={isPublic ? Colors.primary : Colors.textMuted}
            />
            <Text style={[s.destBtnText, isPublic && s.destBtnTextActive]}>Public</Text>
            <Text style={[s.destTag, isPublic && s.destTagActive]}>24h</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Which pseudonym carries the post. Identity disclosure, shown
          before the send. Also the claim flow when there is no handle
          yet, same two paths the /loft sub-bar had. */}
      {isPublic && (
        <View style={s.bylineRow}>
          <Ionicons name="eye-off-outline" size={14} color={Colors.textSecondary} />
          {loftHandle ? (
            <>
              <Text style={s.bylineText}>
                You are <Text style={s.bylineHandle}>{loftHandle}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => regenerateLoftHandle.mutate()}
                disabled={regenerateLoftHandle.isPending}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Change pseudonym"
              >
                <Text style={s.bylineLink}>
                  {regenerateLoftHandle.isPending ? 'rolling…' : 'change pseudonym'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.bylineText}>
                You are <Text style={s.bylineHandle}>unnamed</Text>
              </Text>
              <TouchableOpacity
                onPress={claimPseudonym}
                disabled={regenerateLoftHandle.isPending}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Get a pseudonym"
              >
                <Text style={s.bylineLink}>
                  {regenerateLoftHandle.isPending ? 'rolling…' : 'get a pseudonym'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Update / Post toggle, crew-scoped composers only. */}
      {isFamilyScoped && (
        <View style={s.kindRow}>
          <TouchableOpacity
            style={[s.kindBtn, postKind === 'post' && s.kindBtnActive]}
            onPress={() => setPostKind('post')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chatbubble-outline"
              size={13}
              color={postKind === 'post' ? Colors.primary : Colors.textMuted}
            />
            <Text style={[s.kindBtnText, postKind === 'post' && s.kindBtnTextActive]}>Post</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.kindBtn, postKind === 'update' && s.kindBtnActive]}
            onPress={() => setPostKind('update')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="medkit-outline"
              size={13}
              color={postKind === 'update' ? Colors.primary : Colors.textMuted}
            />
            <Text style={[s.kindBtnText, postKind === 'update' && s.kindBtnTextActive]}>Update</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recipient row, only for crew updates. Defaults to "Everyone
          in this crew"; tap to narrow to specific members (the
          health-emergency use case from the original pitch). */}
      {isFamilyScoped && postKind === 'update' && (
        <TouchableOpacity
          style={s.recipientRow}
          onPress={() => setRecipientPickerOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.recipientLabel}>To:</Text>
          <Text style={s.recipientValue} numberOfLines={1}>
            {updateRecipientIds.size === 0
              ? 'Everyone in this crew'
              : recipientSummary(familyMembers ?? [], updateRecipientIds, userId)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      <TextInput
        style={[s.input, overLoftLimit && s.inputOver]}
        accessibilityLabel="Post body"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={isPublic ? LOFT_MAX : CREW_MAX}
        textAlignVertical="top"
      />

      <View style={s.actionRow}>
        {/* Media and tagging are crew-only. loft_posts has a body
            column and no media table, and an @handle in a pseudonymous
            post undoes the pseudonym. */}
        {!isPublic && (
          <>
            <ActionBtn
              icon="image-outline"
              label={hasMedia && upload.selectedAssets[0]?.type !== 'video' ? `${upload.selectedAssets.length} photo${upload.selectedAssets.length === 1 ? '' : 's'}` : 'Photo'}
              onPress={() => upload.pickPhotos()}
            />
            <ActionBtn
              icon="videocam-outline"
              label="Video"
              onPress={() => upload.pickVideo()}
            />
            <ActionBtn
              icon="camera-outline"
              label="One-Way"
              onPress={() => setOneWayOpen(true)}
            />
            <ActionBtn
              icon="sync-outline"
              label="Two-Way"
              onPress={() => setTwoWayOpen(true)}
            />
            <ActionBtn
              icon="at-outline"
              label="Tag"
              onPress={() => setTagPickerOpen(true)}
            />
          </>
        )}
        {/* Voice-to-text — speak instead of type. Appends transcribed
            text to the existing body so users can dictate then tweak. */}
        <MicInputButton
          size={16}
          onText={(t) => setBody((b) => (b ? `${b} ${t}`.trim() : t))}
        />
        {hasMedia && !isPublic && (
          <TouchableOpacity onPress={() => upload.reset()} style={s.clearBtn}>
            <Text style={s.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
        {isPublic && (
          <Text style={[s.charCount, overLoftLimit && s.charCountOver]}>
            {LOFT_MAX - trimmedLen}
          </Text>
        )}
      </View>

      {hasMedia && !isPublic && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbStrip}>
          {upload.selectedAssets.map((a, i) => (
            <Image key={a.uri + i} source={{ uri: a.uri }} style={s.thumb} />
          ))}
        </ScrollView>
      )}

      {taggedList.length > 0 && !isPublic && (
        <View style={s.taggedRow}>
          {taggedList.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={s.taggedChip}
              onPress={() => toggleTag(c.id, c.handle)}
              activeOpacity={0.7}
            >
              <Text style={s.taggedChipText}>@{c.handle ?? c.display_name ?? 'user'}</Text>
              <Ionicons name="close" size={12} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isUploading && (
        <View style={s.progressContainer}>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${Math.round(upload.progress * 100)}%` }]} />
          </View>
          <Text style={s.progressText}>
            {upload.stage === 'uploading'
              ? `Uploading… ${Math.round(upload.progress * 100)}%`
              : 'Posting…'}
          </Text>
        </View>
      )}

      {/* One-Way modal */}
      <Modal
        visible={oneWayOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setOneWayOpen(false)}
      >
        <OneWayCapture
          onCapture={onOneWayCapture}
          onClose={() => setOneWayOpen(false)}
        />
      </Modal>

      {/* Two-Way modal */}
      <Modal
        visible={twoWayOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setTwoWayOpen(false)}
      >
        <TwoWayCapture
          onCapture={onTwoWayCapture}
          onClose={() => setTwoWayOpen(false)}
        />
      </Modal>

      {/* Recipient picker, for kind='update' only. Restricts the
          update to specific crew members; empty selection means
          "broadcast to everyone in the crew" (the default). */}
      <Modal
        visible={recipientPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRecipientPickerOpen(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setRecipientPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>Send this update to…</Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {(familyMembers ?? [])
                .filter((m) => m.profile_id !== userId)
                .map((m) => {
                  const checked = updateRecipientIds.has(m.profile_id);
                  return (
                    <TouchableOpacity
                      key={m.profile_id}
                      style={s.connRow}
                      onPress={() => {
                        const next = new Set(updateRecipientIds);
                        if (checked) next.delete(m.profile_id);
                        else next.add(m.profile_id);
                        setUpdateRecipientIds(next);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={s.connAvatar}>
                        {m.profile.avatar_path ? (
                          <Image source={{ uri: mediaPathToUrl(m.profile.avatar_path) }} style={s.connAvatarImg} />
                        ) : (
                          <Text style={s.connAvatarText}>
                            {(m.profile.display_name ?? m.profile.handle ?? '?').slice(0, 1).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.connName}>
                          {m.profile.display_name ?? m.profile.handle ?? 'Unknown'}
                        </Text>
                        {m.relationship_label && (
                          <Text style={s.connHandle}>{m.relationship_label}</Text>
                        )}
                      </View>
                      <Ionicons
                        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={checked ? Colors.primary : Colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[s.modalDone, { flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border }]}
                onPress={() => { setUpdateRecipientIds(new Set()); setRecipientPickerOpen(false); }}
              >
                <Text style={[s.modalDoneText, { color: Colors.textSecondary }]}>Everyone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalDone, { flex: 1 }]}
                onPress={() => setRecipientPickerOpen(false)}
              >
                <Text style={s.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Tag connections modal */}
      <Modal
        visible={tagPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTagPickerOpen(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setTagPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>Tag your connections</Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {(connections ?? []).map((c) => {
                const checked = taggedIds.has(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={s.connRow}
                    onPress={() => toggleTag(c.id, c.handle)}
                    activeOpacity={0.7}
                  >
                    <View style={s.connAvatar}>
                      {c.avatar_path ? (
                        <Image source={{ uri: mediaPathToUrl(c.avatar_path) }} style={s.connAvatarImg} />
                      ) : (
                        <Text style={s.connAvatarText}>
                          {(c.display_name ?? c.handle ?? '?').slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.connName}>{c.display_name ?? c.handle ?? 'Unknown'}</Text>
                      {c.handle && <Text style={s.connHandle}>@{c.handle}</Text>}
                    </View>
                    <Ionicons
                      name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={checked ? Colors.primary : Colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={s.modalDone}
              onPress={() => setTagPickerOpen(false)}
            >
              <Text style={s.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function ActionBtn({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const s = makeStyles();
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={s.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Render a short summary of the recipient selection for the inline
 * "To:" row in the composer. Shows up to two names, then "+N more".
 * The author is always the implicit (N+1)th recipient via RLS, so we
 * don't include them in the count.
 */
function recipientSummary(
  members: Array<{ profile_id: string; profile: { display_name: string | null; handle: string | null } }>,
  selected: Set<string>,
  selfId: string | null | undefined,
): string {
  const picked = members
    .filter((m) => selected.has(m.profile_id) && m.profile_id !== selfId)
    .map((m) => m.profile.display_name ?? m.profile.handle ?? 'someone');
  if (picked.length === 0) return 'No one selected';
  if (picked.length === 1) return picked[0];
  if (picked.length === 2) return `${picked[0]}, ${picked[1]}`;
  return `${picked[0]}, ${picked[1]}, +${picked.length - 2} more`;
}

function makeStyles() { return StyleSheet.create({
  // Collapsed: a single ~52px row, more polished than the v1 outline.
  // Surface tone matches the app, with the input pill subtly recessed.
  collapsedRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  collapsedInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  collapsedPlaceholder: {
    color: Colors.textMuted,
    fontSize: 14, lineHeight: 18,
  },
  collapsedIcon: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  collapseBtn: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },

  card: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: {
    fontSize: 11, fontWeight: '700',
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.4,
  },
  postBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  postBtnDisabled: { opacity: 0.4 },
  // Public send carries a ring so the button itself reads differently
  // from the crew send at a glance.
  postBtnPublic: {
    borderWidth: 1, borderColor: Colors.textPrimary,
  },
  // White text on the new indigo primary — was '#000' which was fine on
  // the old gold-toned primary but reads as low-contrast on indigo.
  postBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },

  // Destination selector — Crew vs Public. Full-width, both options
  // legible at rest, so the target audience is never a guess.
  destRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    padding: 4,
  },
  destBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.full,
  },
  destBtnActive: {
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1, borderColor: Colors.primary,
  },
  destBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  destBtnTextActive: { color: Colors.textPrimary },
  destTag: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.6,
    color: Colors.textMuted,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xs,
    paddingHorizontal: 4, paddingVertical: 1,
    overflow: 'hidden',
  },
  destTagActive: { color: Colors.primary, borderColor: Colors.primary },

  // Pseudonym byline, public destination only.
  bylineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    paddingHorizontal: 2,
  },
  bylineText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  bylineHandle: { color: Colors.primary, fontWeight: '700' },
  bylineLink: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '500',
    textDecorationLine: 'underline',
  },

  charCount: { marginLeft: 'auto', fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  charCountOver: { color: Colors.error },

  kindRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: Colors.surfaceLight, borderRadius: 999,
    padding: 4, alignSelf: 'flex-start',
  },
  kindBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  kindBtnActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  kindBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  kindBtnTextActive: { color: Colors.textPrimary },

  // Recipient row, shown only on crew-update composers
  recipientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  recipientLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  recipientValue: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },

  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: Colors.textPrimary,
    minHeight: 48, lineHeight: 22,    // was 80; multiline still grows naturally
  },
  inputOver: { borderColor: Colors.error },

  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  actionBtnText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  clearBtnText: { color: Colors.textMuted, fontSize: 12 },

  thumbStrip: { marginTop: 2 },
  thumb: {
    width: 64, height: 64, borderRadius: 8,
    marginRight: 6, backgroundColor: Colors.surfaceLight,
  },

  taggedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  taggedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1, borderColor: Colors.border,
  },
  taggedChipText: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },

  progressContainer: { gap: 4, marginTop: 4 },
  progressBar: {
    height: 4, backgroundColor: Colors.surfaceLight,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { fontSize: 11, color: Colors.textMuted },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    width: '100%', maxWidth: 460, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },

  connRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  connAvatar: {
    width: 36, height: 36, borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  connAvatarImg: { width: '100%', height: '100%' },
  connAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  connName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  connHandle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  modalDone: {
    marginTop: 12, alignItems: 'center',
    paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  modalDoneText: { color: '#FFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.1 },

  // Gate state, shown when the viewer is in no crew yet.
  gateCard: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center', gap: 8,
  },
  gateTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
    marginTop: 4,
  },
  gateRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  gateBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  gateBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  gateBtnAlt: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: Colors.border,
  },
  gateBtnTextAlt: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
}); }
