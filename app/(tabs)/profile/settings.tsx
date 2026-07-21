/**
 * Profile settings — edit display name, handle, bio, avatar.
 *
 * The profile hub's "Edit profile" pill routes here. Updates write
 * directly to `public.profiles` (RLS lets the row owner update their
 * own profile). Avatar upload reuses the same `posts` storage bucket
 * and writes the path back to `profiles.avatar_path`.
 *
 * Handle uniqueness is enforced by the `profiles.handle` UNIQUE
 * constraint; we surface that as a friendly error.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { mediaPathToUrl } from '../../../hooks/useUpload';
import { useAuthStore } from '../../../stores/authStore';
import { StatureAvatar } from '../../../components/shared/StatureAvatar';
import { HeadshotCapture, type HeadshotResult } from '../../../components/upload/HeadshotCapture';
import { GenerationSwitcher } from '../../../components/shared/GenerationSwitcher';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

export default function ProfileSettings() {
  const s = makeStyles();
  const { profile } = useAuth();
  const setProfile = useAuthStore((st) => st.setProfile);

  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path ?? null);
  const [busy, setBusy] = useState<'avatar' | 'save' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [headshotOpen, setHeadshotOpen] = useState(false);

  if (!profile) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  /**
   * Library path: open the OS picker with explicit square cropping
   * (`allowsEditing` + `aspect: [1,1]` gives the user the native crop
   * UI on iOS/Android). On web there's no crop UI so we center-crop
   * to square ourselves before resizing.
   */
  const onPickFromLibrary = async () => {
    setChooserOpen(false);
    setErr(null);
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.92,
      });
      if (r.canceled || !r.assets[0]) return;
      setBusy('avatar');
      const asset = r.assets[0];

      // Make sure we end up with a square 512×512. allowsEditing already
      // produces a 1:1 crop on native, but on web it's a no-op, so we
      // center-crop here either way for safety.
      const W = asset.width ?? 0;
      const H = asset.height ?? 0;
      const ops: ImageManipulator.Action[] = [];
      if (W > 0 && H > 0 && W !== H) {
        const side = Math.min(W, H);
        ops.push({
          crop: {
            originX: Math.round((W - side) / 2),
            originY: Math.round((H - side) / 2),
            width: side,
            height: side,
          },
        });
      }
      ops.push({ resize: { width: 512, height: 512 } });

      const norm = await ImageManipulator.manipulateAsync(
        asset.uri,
        ops,
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );

      await uploadAvatarBlob(norm.uri);
    } catch (e: any) {
      setErr(e?.message ?? 'Avatar upload failed.');
    } finally {
      setBusy(null);
    }
  };

  /** Live-camera path: HeadshotCapture already emits a 512×512 JPEG. */
  const onHeadshotCapture = async (asset: HeadshotResult) => {
    setHeadshotOpen(false);
    setErr(null);
    setBusy('avatar');
    try {
      await uploadAvatarBlob(asset.uri);
    } catch (e: any) {
      setErr(e?.message ?? 'Avatar upload failed.');
    } finally {
      setBusy(null);
    }
  };

  async function uploadAvatarBlob(uri: string) {
    const filename = `${profile!.id}/avatar_${Date.now()}.jpg`;
    const buffer = await readAsArrayBuffer(uri);
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const { data, error } = await supabase.storage
      .from('posts')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    setAvatarPath(data.path);
  }

  const onSave = async () => {
    setErr(null);
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanHandle.length < 3) {
      setErr('Handle must be at least 3 characters (letters, numbers, underscore).');
      return;
    }
    setBusy('save');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          handle: cleanHandle,
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_path: avatarPath ?? null,
        })
        .eq('id', profile.id)
        .select()
        .single();
      if (error) {
        const msg = String(error.message ?? '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          throw new Error('That handle is already taken. Try another.');
        }
        throw error;
      }
      setProfile(data as any);
      router.back();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>Edit profile</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => setChooserOpen(true)}
            style={s.avatarWrap}
            activeOpacity={0.75}
            accessibilityLabel="Change profile photo"
          >
            <StatureAvatar
              profileId={profile.id}
              name={displayName || profile.display_name}
              photoUrl={avatarPath ? mediaPathToUrl(avatarPath) : null}
              size={96}
              hideMeta
            />
            <View style={s.avatarOverlay}>
              {busy === 'avatar' ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFF" />
              )}
            </View>
          </TouchableOpacity>

          <Field label="Display name">
            <TextInput
              style={s.input}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={64}
              returnKeyType="next"
            />
          </Field>

          <Field label="Handle">
            <TextInput
              style={s.input}
              value={handle}
              onChangeText={(t) => setHandle(t.toLowerCase())}
              placeholder="@yourname"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
              returnKeyType="next"
            />
          </Field>

          <Field label="Bio">
            <TextInput
              style={[s.input, s.textarea]}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={280}
              textAlignVertical="top"
            />
          </Field>

          <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md }} />
          <GenerationSwitcher />
          <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md }} />

          {err && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{err}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.saveBtn, busy === 'save' && { opacity: 0.5 }]}
            onPress={onSave}
            disabled={busy === 'save'}
            activeOpacity={0.85}
          >
            <Text style={s.saveBtnText}>{busy === 'save' ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar source chooser */}
      <Modal
        visible={chooserOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChooserOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setChooserOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Profile photo</Text>
            <TouchableOpacity
              style={s.modalRow}
              onPress={() => { setChooserOpen(false); setHeadshotOpen(true); }}
              activeOpacity={0.75}
            >
              <Ionicons name="camera-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.modalRowLabel}>Take a selfie</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.modalRow}
              onPress={onPickFromLibrary}
              activeOpacity={0.75}
            >
              <Ionicons name="images-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.modalRowLabel}>Choose from library</Text>
              </View>
            </TouchableOpacity>
            {avatarPath && (
              <TouchableOpacity
                style={s.modalRow}
                onPress={() => { setChooserOpen(false); setAvatarPath(null); }}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.modalRowLabel, { color: Colors.error }]}>Remove current photo</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.modalCancel} onPress={() => setChooserOpen(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Live headshot camera */}
      <Modal
        visible={headshotOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setHeadshotOpen(false)}
      >
        <HeadshotCapture
          onCapture={onHeadshotCapture}
          onClose={() => setHeadshotOpen(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const s = makeStyles();
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const r = await fetch(uri);
    return r.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textPrimary },

  scroll: {
    padding: Spacing.lg,
    gap: 14,
    maxWidth: 520, alignSelf: 'center', width: '100%',
    paddingBottom: 80,
  },

  avatarWrap: { alignSelf: 'center', position: 'relative', marginTop: 8 },
  avatarOverlay: {
    position: 'absolute', right: -2, bottom: -2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 90 },

  errorBox: {
    backgroundColor: 'rgba(255,64,80,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,64,80,0.30)',
    borderRadius: Radius.md, padding: 10,
  },
  errorText: { color: Colors.error, fontSize: 13 },

  saveBtn: {
    marginTop: 6, paddingVertical: 14,
    borderRadius: 999, backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    width: '100%', maxWidth: 420, padding: 18, gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8,
  },
  modalRowLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  modalCancel: { alignItems: 'center', paddingVertical: 11, marginTop: 6 },
  modalCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
}); }
