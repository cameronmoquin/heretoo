/**
 * The composer. Pinned to the top of the feed.
 *
 * A contribution forks two ways (migration 074):
 *
 *   SUBMIT  persists. No burn.
 *   DROP    out after a day (expires_at = insert + 24h), and it may
 *           burn on first reading.
 *
 * Either goes to one of three places, chosen on screen before the send:
 *
 *   PUBLIC  a DROP rides loft_posts — pseudonymous byline, 1200
 *           characters, 24-hour expiry, text only. A SUBMIT is a named
 *           posts row, visibility='public', that stays.
 *   COHORT  posts, visibility='family', family_id set.
 *           One: used automatically. Several: picked. None: off.
 *   DM      posts, visibility='direct', direct_recipient_id set. One
 *           person, from the author's connections.
 *
 * THE BURN REDACTS NOW. "Destroy after viewing" writes
 * posts.destruct_on_view; the first non-author reading physically wipes
 * the body server-side and the row stays as a redacted tombstone.
 *
 * A DEADDROP is this same drop with a GPS lock on the payload. It lands
 * in the feed at the chosen destination like anything else. The physical
 * unlock lives in the hunt screens, not here.
 *
 * NO CREW GATE. A person with no crew drops on their own platform. Crew
 * is a destination, not a permission. The old gate replaced the whole
 * composer, send button included, and that was the broken send.
 *
 * NO CREW ASSUMPTION EITHER. The composer opens on Public. Crew is the
 * default only when the composer itself is crew-scoped (a crew room),
 * where the room already made the choice. The main feed guessing "crew"
 * put a picker in front of the first keystroke and sent nothing public
 * by default on a platform whose front door is the public square.
 *
 * TWO SEAMS WORTH KNOWING:
 *   1. Migration 065 may not have run. destruct_on_view and
 *      direct_recipient_id ride the insert only when the author picks
 *      them, so a plain drop lands on an old schema. useUpload turns a
 *      missing column into a sentence.
 *   2. Public rides loft_posts, which has a body column and nothing
 *      else. No media, no burn. Switching to Public clears both and says
 *      so first.
 *
 * Destination resets to the default after every send and on collapse.
 */

/** Mirrors loft_posts: check (length(body) between 1 and 1200). */
const LOFT_MAX = 1200;
const CREW_MAX = 2000;

type Destination = 'public' | 'crew' | 'dm';

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Image, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { Vocab } from '../../constants/vocab';
import { MicInputButton } from '../shared/MicInputButton';
import { Eyebrow } from '../shared/Eyebrow';

interface FeedComposerProps {
  /**
   * When set, the crew destination is pinned to this crew and the crew
   * picker never opens. Public and DM stay reachable; the audiences are
   * different enough that hiding them would be the guess, not the
   * safeguard.
   */
  familyId?: string;
  /**
   * A counter. Every change opens the composer. The floating compose
   * button on wide viewports bumps it; nothing else touches it. Absent,
   * or unchanged, and the composer behaves exactly as it always has.
   */
  openSignal?: number;
}

export function FeedComposer({ familyId, openSignal }: FeedComposerProps = {}) {
  const s = makeStyles();
  const upload = useUpload();
  const { data: connections } = useMyConnections();
  const { data: families } = useMyFamilies();
  const userId = useAuthStore((st) => st.user?.id);
  const isFamilyScoped = !!familyId;
  const [postKind, setPostKind] = useState<'post' | 'update'>('post');
  const [expanded, setExpanded] = useState(false);

  // The floating compose button. It only ever opens; it never closes,
  // never clears a draft, and the first render is not a signal.
  const lastSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === undefined || openSignal === lastSignal.current) return;
    lastSignal.current = openSignal;
    setExpanded(true);
  }, [openSignal]);


  const myCrews = families ?? [];
  const myConnections = connections ?? [];

  // A destination the author cannot reach is never offered and never
  // becomes the live one.
  const crewAvailable = isFamilyScoped || myCrews.length > 0;
  const dmAvailable = myConnections.length > 0;
  const defaultDestination: Destination = isFamilyScoped ? 'crew' : 'public';

  const [destinationChoice, setDestinationChoice] = useState<Destination>(defaultDestination);
  const destination: Destination =
    destinationChoice === 'crew' && !crewAvailable ? 'public'
      : destinationChoice === 'dm' && !dmAvailable ? 'public'
        : destinationChoice;
  const isPublic = destination === 'public';
  const isCrew = destination === 'crew';
  const isDM = destination === 'dm';

  // THE FORK (migration 074). A contribution is a SUBMIT or a DROP.
  //   SUBMIT  persists. No burn.
  //   DROP    out after a day, and it may burn on reading.
  // Both go to the same three destinations. A public DROP rides
  // loft_posts — pseudonymous, text-only, already 24-hour — and a
  // public SUBMIT is a named posts row that stays. Drop is the default
  // because a drop is what the platform calls the thing you post.
  const [contribution, setContribution] = useState<'drop' | 'submit'>('drop');
  const isDrop = contribution === 'drop';
  const isLoft = isPublic && isDrop;

  // Which crew. Pinned when the composer is crew-scoped. Automatic when
  // the author has exactly one. Picked when they have several.
  const [crewChoice, setCrewChoice] = useState<string | null>(null);
  const [crewPickerOpen, setCrewPickerOpen] = useState(false);
  const activeCrewId = isFamilyScoped
    ? familyId!
    : crewChoice ?? (myCrews.length === 1 ? myCrews[0].id : null);
  const activeCrew = myCrews.find((f) => f.id === activeCrewId) ?? null;

  // THE DEAD SEND. switchDestination already states the rule — a
  // destination with several candidates asks immediately rather than
  // leaving a disabled send button with nothing to press — but it only
  // runs on a switch, and crew is the destination the composer OPENS in.
  // So an author in several crews never switched, was never asked, and
  // met a Drop button that could not enable: canPost needs activeCrewId,
  // and activeCrewId only auto-resolves for an author with exactly one
  // crew. Nothing on screen said which of the three destinations was the
  // broken one, so the whole composer read as broken. Same rule as the
  // switch, applied to the opening state.
  //
  // Dismissing the picker without choosing does not reopen it: none of
  // these deps change when it closes.
  useEffect(() => {
    if (!expanded || isFamilyScoped) return;
    if (destination !== 'crew' || activeCrewId) return;
    if (myCrews.length < 2) return;
    setCrewPickerOpen(true);
  }, [expanded, isFamilyScoped, destination, activeCrewId, myCrews.length]);

  // Which person. DM only. The picker carries a search because a list
  // of connections outgrows a scroll long before it outgrows a name.
  const [dmChoice, setDmChoice] = useState<string | null>(null);
  const [dmPickerOpen, setDmPickerOpen] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const dmRecipient = myConnections.find((c) => c.id === dmChoice) ?? null;
  const openDmPicker = () => { setDmSearch(''); setDmPickerOpen(true); };

  // The burn. Off by default, every time.
  const [destruct, setDestruct] = useState(false);

  const { data: loftHandle, refetch: refetchLoftHandle } = useLoftHandle();
  const regenerateLoftHandle = useRegenerateLoftHandle();
  const createLoftPost = useCreateLoftPost();

  const [body, setBody] = useState('');
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [twoWayOpen, setTwoWayOpen] = useState(false);
  const [oneWayOpen, setOneWayOpen] = useState(false);

  // Recipient-restricted updates: which crew members get this update.
  // Empty set = "broadcast to whole crew" (default behavior of any
  // crew post). Picker only opens when kind='update' is selected on
  // a crew-scoped composer.
  const [updateRecipientIds, setUpdateRecipientIds] = useState<Set<string>>(new Set());
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const { data: familyMembers } = useFamilyMembersWithProfiles(familyId ?? null);
  const isUpdate = isFamilyScoped && isCrew && postKind === 'update';

  const hasMedia = upload.selectedAssets.length > 0;
  const trimmedLen = body.trim().length;
  const overLoftLimit = isLoft && trimmedLen > LOFT_MAX;
  const isUploading = upload.stage === 'uploading' || upload.stage === 'creating_post';
  // createPost.isPending is in here on purpose. Without it the button
  // re-enables between stages and a second tap sends a second drop.
  const isSending = isUploading || upload.createPost.isPending || createLoftPost.isPending;

  // Public needs a body inside 1..1200 and a claimed pseudonym. It can
  // never be satisfied by media alone; loft posts carry no media. Crew
  // and DM need a named destination.
  const hasPayload = trimmedLen > 0 || hasMedia;
  const canPost = isLoft
    ? trimmedLen > 0 && !overLoftLimit && !!loftHandle
    : isPublic
      ? hasPayload
      : isCrew
        ? hasPayload && !!activeCrewId
        : hasPayload && !!dmChoice;

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

  // Switching to Public drops attachments and the burn, so say so before
  // it happens. loft_posts stores a body and nothing else; carrying
  // either along would discard it silently at insert time.
  const switchDestination = (next: Destination) => {
    if (next === destinationChoice) return;
    if (next === 'public' && isDrop && (hasMedia || destruct)) {
      const lost = [hasMedia ? 'Attachments' : null, destruct ? 'Self-destruct' : null]
        .filter(Boolean).join(' and ');
      showAlert(`${lost} dropped`, `Public ${Vocab.postPlural} are text. 24 hours, then gone.`);
      if (hasMedia) upload.reset();
      setDestruct(false);
    }
    setDestinationChoice(next);
    // A destination with several candidates asks immediately rather than
    // leaving a disabled send button with nothing to press.
    if (next === 'crew' && !isFamilyScoped && myCrews.length > 1 && !crewChoice) {
      setCrewPickerOpen(true);
    }
    if (next === 'dm' && !dmChoice) openDmPicker();
  };

  // Switching the fork. Heading into a public DROP means the loft, and
  // the loft carries a body and nothing else — same clearing rule as
  // switching destination. A SUBMIT cannot burn, so the flag comes off.
  const switchContribution = (next: 'drop' | 'submit') => {
    if (next === contribution) return;
    if (next === 'drop' && isPublic && (hasMedia || destruct)) {
      const lost = [hasMedia ? 'Attachments' : null, destruct ? 'Self-destruct' : null]
        .filter(Boolean).join(' and ');
      showAlert(`${lost} dropped`, `Public ${Vocab.postPlural} are text. 24 hours, then gone.`);
      if (hasMedia) upload.reset();
      setDestruct(false);
    }
    if (next === 'submit') setDestruct(false);
    setContribution(next);
  };

  const resetComposer = () => {
    setBody('');
    setTaggedIds(new Set());
    setUpdateRecipientIds(new Set());
    setPostKind('post');
    setContribution('drop');
    setDestinationChoice(defaultDestination);
    setDmChoice(null);
    setDestruct(false);
    setExpanded(false);
    upload.reset();
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
      showAlert(`Nothing to ${Vocab.postVerb}`, 'Write something first.');
      return;
    }
    if (text.length > LOFT_MAX) {
      showAlert('Too long', `Public ${Vocab.postPlural} stop at ${LOFT_MAX} characters. Yours is ${text.length}.`);
      return;
    }
    if (!loftHandle) {
      showAlert('No pseudonym yet', 'Claim one first.');
      return;
    }
    try {
      await createLoftPost.mutateAsync(text);
      resetComposer();
    } catch (e: any) {
      showAlert(`Could not ${Vocab.postVerb}`, e?.message ?? 'Try again.');
    }
  };

  const handlePost = async () => {
    if (isLoft) return handlePublicPost();
    if (isCrew && !activeCrewId) {
      showAlert(`Pick a ${Vocab.group}`, `This ${Vocab.post} needs a destination.`);
      return;
    }
    if (isDM && !dmChoice) {
      showAlert('Pick a person', `This ${Vocab.post} needs a destination.`);
      return;
    }
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
        // Public submit is a named posts row that persists — the loft
        // handles the public DROP before this function is reached.
        visibility: isDM ? 'direct' : isPublic ? 'public' : 'family',
        familyId: isCrew ? activeCrewId! : undefined,
        directRecipientId: isDM ? dmChoice! : undefined,
        // Only ride the insert when the author picked it. A plain drop
        // still lands on a schema that predates migration 065.
        destructOnView: isDrop && !isUpdate && destruct ? true : undefined,
        // The fork. A drop is out after a day; a submit and an update
        // stay. Written only when set (migration 074).
        expiresAt: isDrop && !isUpdate
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        kind: isUpdate ? 'update' : 'post',
        // Only pass recipient list for genuine crew updates with a
        // non-empty selection. Author is implicit — RLS lets them read
        // their own posts unconditionally.
        updateRecipientIds:
          isUpdate && updateRecipientIds.size > 0 ? [...updateRecipientIds] : undefined,
        photoUploads,
        muxPlaybackId,
        videoDurationMs,
      });

      resetComposer();
    } catch (e: any) {
      showAlert(`Could not ${Vocab.postVerb}`, e?.message ?? 'Try again.');
    }
  };

  const taggedList = myConnections.filter((c) => taggedIds.has(c.id));

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
          accessibilityLabel={`New ${Vocab.post}`}
        >
          <Ionicons name="create-outline" size={14} color={Colors.textMuted} />
          <Text style={s.collapsedPlaceholder}>{Vocab.Post}</Text>
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
        <Eyebrow>
          {isUpdate ? 'New update'
            : `New ${isPublic ? 'public ' : isDM ? 'direct ' : ''}${isDrop ? Vocab.post : 'submit'}`}
        </Eyebrow>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={resetComposer}
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
              isLoft ? `${Vocab.Post} to Public`
                : isPublic ? 'Submit to Public'
                  : isDM ? `Send to ${dmRecipient?.display_name ?? dmRecipient?.handle ?? 'one person'}`
                    : isUpdate ? 'Send update'
                      : `${Vocab.Post} to ${activeCrew?.name ?? `this ${Vocab.group}`}`
            }
          >
            {isSending
              ? <ActivityIndicator color={Colors.onPrimary} size="small" />
              : (
                <Text style={s.postBtnText}>
                  {isLoft ? `${Vocab.Post} to Public`
                    : isUpdate ? 'Send update'
                      : isDrop ? Vocab.Post : 'Submit'}
                </Text>
              )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Destination. Three audiences that do not overlap, so the control
          sits on screen before the send, never behind a menu. */}
      <View style={s.destRow}>
        <DestBtn
          icon="earth-outline"
          label="Public"
          tag={isDrop ? '24h' : undefined}
          selected={isPublic}
          onPress={() => switchDestination('public')}
          accessibilityLabel={isDrop
            ? `${Vocab.Post} to Public. Pseudonymous, vanishes after 24 hours`
            : 'Submit to Public'}
        />
        <DestBtn
          icon="people-outline"
          label={Vocab.Group}
          selected={isCrew}
          disabled={!crewAvailable}
          onPress={() => switchDestination('crew')}
          accessibilityLabel={`${Vocab.Post} to ${activeCrew?.name ?? `one ${Vocab.group}`}`}
        />
        <DestBtn
          icon="person-outline"
          label="DM"
          selected={isDM}
          disabled={!dmAvailable}
          onPress={() => switchDestination('dm')}
          accessibilityLabel={`${Vocab.Post} to one person`}
        />
      </View>

      {/* The fork. A drop is out after a day; a submit stays. Updates
          are their own instrument and skip the choice. */}
      {!isUpdate && (
        <View style={s.kindRow}>
          <TouchableOpacity
            style={[s.kindBtn, isDrop && s.kindBtnActive]}
            onPress={() => switchContribution('drop')}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityLabel={`${Vocab.Post} — out after a day`}
            accessibilityState={{ selected: isDrop }}
          >
            <Ionicons
              name="hourglass-outline"
              size={13}
              color={isDrop ? Colors.primary : Colors.textMuted}
            />
            <Text style={[s.kindBtnText, isDrop && s.kindBtnTextActive]}>{Vocab.Post}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.kindBtn, !isDrop && s.kindBtnActive]}
            onPress={() => switchContribution('submit')}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityLabel="Submit — it stays"
            accessibilityState={{ selected: !isDrop }}
          >
            <Ionicons
              name="archive-outline"
              size={13}
              color={!isDrop ? Colors.primary : Colors.textMuted}
            />
            <Text style={[s.kindBtnText, !isDrop && s.kindBtnTextActive]}>Submit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Which crew. Only when the author has a choice to make. */}
      {isCrew && !isFamilyScoped && myCrews.length > 1 && (
        <TouchableOpacity
          style={s.toRow}
          onPress={() => setCrewPickerOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel={`Choose ${Vocab.groupWithArticle}`}
        >
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.toLabel}>To:</Text>
          <Text style={s.toValue} numberOfLines={1}>
            {activeCrew?.name ?? `Pick a ${Vocab.group}`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Which person. DM only. */}
      {isDM && (
        <TouchableOpacity
          style={s.toRow}
          onPress={openDmPicker}
          activeOpacity={0.7}
          accessibilityLabel="Choose who gets this"
        >
          <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.toLabel}>To:</Text>
          <Text style={s.toValue} numberOfLines={1}>
            {dmRecipient
              ? (dmRecipient.display_name ?? dmRecipient.handle ?? 'Unknown')
              : 'Pick a person'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Which pseudonym carries the drop. Identity disclosure, shown
          before the send. Also the claim flow when there is no handle
          yet, same two paths the /loft sub-bar had. */}
      {isLoft && (
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

      {/* Update / Drop toggle, crew-scoped composers on the crew
          destination only. An update is a crew instrument. */}
      {isFamilyScoped && isCrew && (
        <View style={s.kindRow}>
          <TouchableOpacity
            style={[s.kindBtn, postKind === 'post' && s.kindBtnActive]}
            onPress={() => setPostKind('post')}
            activeOpacity={0.7}
            accessibilityLabel={`Send as a ${Vocab.post}`}
            accessibilityState={{ selected: postKind === 'post' }}
          >
            <Ionicons
              name="chatbubble-outline"
              size={13}
              color={postKind === 'post' ? Colors.primary : Colors.textMuted}
            />
            <Text style={[s.kindBtnText, postKind === 'post' && s.kindBtnTextActive]}>{Vocab.Post}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.kindBtn, postKind === 'update' && s.kindBtnActive]}
            onPress={() => setPostKind('update')}
            activeOpacity={0.7}
            accessibilityLabel="Send as an update"
            accessibilityState={{ selected: postKind === 'update' }}
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
      {isUpdate && (
        <TouchableOpacity
          style={s.toRow}
          onPress={() => setRecipientPickerOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel="Choose who gets this update"
        >
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.toLabel}>To:</Text>
          <Text style={s.toValue} numberOfLines={1}>
            {updateRecipientIds.size === 0
              ? `Everyone in this ${Vocab.group}`
              : recipientSummary(familyMembers ?? [], updateRecipientIds, userId)}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      <TextInput
        style={[s.input, overLoftLimit && s.inputOver]}
        accessibilityLabel={`${Vocab.Post} body`}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={isLoft ? LOFT_MAX : CREW_MAX}
        textAlignVertical="top"
      />

      <View style={s.actionRow}>
        {/* Media and tagging are off on Public. loft_posts has a body
            column and no media table, and an @handle in a pseudonymous
            drop undoes the pseudonym. */}
        {!isLoft && (
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
              onPress={() => { setTagSearch(''); setTagPickerOpen(true); }}
            />
          </>
        )}
        {/* Voice-to-text — speak instead of type. Appends transcribed
            text to the existing body so users can dictate then tweak. */}
        <MicInputButton
          size={16}
          onText={(t) => setBody((b) => (b ? `${b} ${t}`.trim() : t))}
        />
        {hasMedia && !isLoft && (
          <TouchableOpacity onPress={() => upload.reset()} style={s.clearBtn}>
            <Text style={s.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
        {isLoft && (
          <Text style={[s.charCount, overLoftLimit && s.charCountOver]}>
            {LOFT_MAX - trimmedLen}
          </Text>
        )}
      </View>

      {/* The burn. Off every time the composer opens, because a drop
          nobody can go back to is not a default. Public rides loft_posts,
          which has no burn column, so the control is inert there. */}
      <TouchableOpacity
        style={[s.burnBtn, destruct && s.burnBtnOn, isLoft && s.burnBtnOff]}
        onPress={() => setDestruct((v) => !v)}
        disabled={isLoft}
        activeOpacity={0.7}
        accessibilityRole="switch"
        accessibilityLabel="Destroy after viewing"
        accessibilityState={{ checked: destruct, disabled: isLoft }}
      >
        <Ionicons
          name={destruct ? 'flame' : 'flame-outline'}
          size={15}
          color={destruct ? Colors.error : Colors.textMuted}
        />
        <Text style={[s.burnText, destruct && s.burnTextOn]}>Destroy after viewing</Text>
        <Ionicons
          name={destruct ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={destruct ? Colors.error : Colors.textMuted}
        />
      </TouchableOpacity>

      {hasMedia && !isLoft && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbStrip}>
          {upload.selectedAssets.map((a, i) => (
            <Image key={a.uri + i} source={{ uri: a.uri }} style={s.thumb} />
          ))}
        </ScrollView>
      )}

      {taggedList.length > 0 && !isLoft && (
        <View style={s.taggedRow}>
          {taggedList.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={s.taggedChip}
              onPress={() => toggleTag(c.id, c.handle)}
              activeOpacity={0.7}
              accessibilityLabel={`Remove tag ${c.handle ?? c.display_name ?? 'user'}`}
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
              : 'Sending…'}
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

      {/* Crew picker. Only reachable when the author is in several. */}
      <Modal
        visible={crewPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCrewPickerOpen(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCrewPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>Which {Vocab.group}</Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {myCrews.map((f) => {
                const checked = f.id === activeCrewId;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={s.connRow}
                    onPress={() => { setCrewChoice(f.id); setCrewPickerOpen(false); }}
                    activeOpacity={0.7}
                    accessibilityLabel={`${Vocab.Post} to ${f.name}`}
                    accessibilityState={{ selected: checked }}
                  >
                    <View style={s.connAvatar}>
                      <Text style={s.connAvatarText}>{f.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.connName}>{f.name}</Text>
                      <Text style={s.connHandle}>{f.my_role}</Text>
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* DM picker. One person. Selecting closes it. */}
      <Modal
        visible={dmPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDmPickerOpen(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setDmPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>Send to one person</Text>

            <TextInput
              style={s.searchInput}
              accessibilityLabel="Search"
              placeholder="Search"
              placeholderTextColor={Colors.textMuted}
              value={dmSearch}
              onChangeText={setDmSearch}
              autoFocus
            />

            <ScrollView style={{ maxHeight: 360 }}>
              {myConnections.filter((c) => matchesPerson(c, dmSearch)).map((c) => {
                const checked = c.id === dmChoice;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={s.connRow}
                    onPress={() => { setDmChoice(c.id); setDmPickerOpen(false); }}
                    activeOpacity={0.7}
                    accessibilityLabel={`Send to ${c.display_name ?? c.handle ?? 'this person'}`}
                    accessibilityState={{ selected: checked }}
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
          </TouchableOpacity>
        </TouchableOpacity>
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
                .filter((m) => m.profile_id !== userId && !!m.profile)
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
                      accessibilityLabel={m.profile.display_name ?? m.profile.handle ?? 'Unknown'}
                      accessibilityState={{ selected: checked }}
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
                accessibilityLabel={`Send to everyone in this ${Vocab.group}`}
              >
                <Text style={[s.modalDoneText, { color: Colors.textSecondary }]}>Everyone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalDone, { flex: 1 }]}
                onPress={() => setRecipientPickerOpen(false)}
                accessibilityLabel="Done choosing recipients"
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

            <TextInput
              style={s.searchInput}
              accessibilityLabel="Search"
              placeholder="Search"
              placeholderTextColor={Colors.textMuted}
              value={tagSearch}
              onChangeText={setTagSearch}
              autoFocus
            />

            <ScrollView style={{ maxHeight: 360 }}>
              {myConnections.filter((c) => matchesPerson(c, tagSearch)).map((c) => {
                const checked = taggedIds.has(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={s.connRow}
                    onPress={() => toggleTag(c.id, c.handle)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Tag ${c.display_name ?? c.handle ?? 'this person'}`}
                    accessibilityState={{ selected: checked }}
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
              accessibilityLabel="Done tagging"
            >
              <Text style={s.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/**
 * One leg of the destination radio. Disabled means the author cannot
 * reach that audience at all. No explanation sits under it; the state
 * is the message.
 */
function DestBtn({
  icon, label, tag, selected, disabled, onPress, accessibilityLabel,
}: {
  icon: any;
  label: string;
  tag?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const s = makeStyles();
  const ink = disabled ? Colors.textMuted : selected ? Colors.primary : Colors.textMuted;
  return (
    <TouchableOpacity
      style={[s.destBtn, selected && !disabled && s.destBtnActive, disabled && s.destBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: selected && !disabled, disabled: !!disabled }}
    >
      <Ionicons name={icon} size={14} color={ink} />
      <Text style={[s.destBtnText, selected && !disabled && s.destBtnTextActive]}>{label}</Text>
      {tag && (
        <Text style={[s.destTag, selected && !disabled && s.destTagActive]}>{tag}</Text>
      )}
    </TouchableOpacity>
  );
}

function ActionBtn({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const s = makeStyles();
  return (
    <TouchableOpacity
      style={s.actionBtn}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <Text style={s.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Name-or-handle match for the picker searches. Empty query matches all. */
function matchesPerson(
  c: { display_name: string | null; handle: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (c.display_name ?? '').toLowerCase().includes(q) ||
    (c.handle ?? '').toLowerCase().includes(q)
  );
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
    .filter((m) => selected.has(m.profile_id) && m.profile_id !== selfId && !!m.profile)
    .map((m) => m.profile?.display_name ?? m.profile?.handle ?? 'someone');
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
    width: 28, height: 28, borderRadius: Radius.xs,
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
  postBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full,
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
  postBtnText: { color: Colors.onPrimary, fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },

  // Destination radio. Public, Crew, DM. Full-width, all three legible
  // at rest, so the audience is never a guess.
  destRow: {
    flexDirection: 'row', gap: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    padding: 4,
  },
  destBtn: {
    flex: 1, minHeight: 38,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 8,
    borderRadius: Radius.full,
  },
  destBtnActive: {
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1, borderColor: Colors.primary,
  },
  destBtnDisabled: { opacity: 0.35 },
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
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.full,
    padding: 4, alignSelf: 'flex-start',
  },
  kindBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
  },
  kindBtnActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  kindBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  kindBtnTextActive: { color: Colors.textPrimary },

  // "To:" row. Crew choice, DM choice, and the update recipient list all
  // wear the same shape, because they answer the same question.
  toRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  toLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  toValue: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },

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
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  actionBtnText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  clearBtnText: { color: Colors.textMuted, fontSize: 12 },

  // Self-destruct. Its own row, full width, so it never hides among the
  // media buttons. Red only when armed.
  burnBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  burnBtnOn: { borderColor: Colors.error },
  burnBtnOff: { opacity: 0.35 },
  burnText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  burnTextOn: { color: Colors.error },

  thumbStrip: { marginTop: 2 },
  thumb: {
    width: 64, height: 64, borderRadius: 8,
    marginRight: 6, backgroundColor: Colors.surfaceLight,
  },

  taggedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  taggedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
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
  searchInput: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: Colors.textPrimary,
    marginBottom: 10,
  },

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
}); }
