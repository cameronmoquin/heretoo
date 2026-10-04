/**
 * /account — the member's own profile, password, and sign-out.
 * Officers also get a way into /admin. Signed out: the account prompt.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Page, PageTitle, Field, ErrorLine, Loading, SignedInOnly } from '../components/nffga/board/Page';
import { MemberAvatar } from '../components/nffga/board/MemberAvatar';
import { pickImage } from '../components/nffga/board/pickImage';
import { Button } from '../components/shared/Button';
import { toastSuccess } from '../components/shared/Toast';
import { Colors } from '../constants/colors';
import { Spacing, Type } from '../constants/design';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/nffga/useSession';
import { signOutMember } from '../lib/nffga/auth';
import {
  formatHandicap, parseHandicap, profileKeys, saveMyProfile, uploadMedia, useProfile, useRole,
  writeErrorText, type PickedImage,
} from '../lib/nffga/profile';
import { boardKeys } from '../lib/nffga/board';

export default function AccountScreen() {
  return (
    <SignedInOnly title="Account" reason="to manage your account">
      <Account />
    </SignedInOnly>
  );
}

function Account() {
  const s = makeStyles();
  const qc = useQueryClient();
  const { session, userId, email } = useSession();
  const profile = useProfile(userId);
  const role = useRole(userId);

  const [form, setForm] = useState({
    display_name: '', rank_title: '', department: '', city: '', state: '', handicap: '', bio: '',
  });
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [newAvatar, setNewAvatar] = useState<PickedImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Fill the form once, from the profile row or, failing that, the
  // name given at sign-up.
  useEffect(() => {
    if (loaded || profile.isLoading) return;
    const p = profile.data;
    const metaName = (session?.user?.user_metadata?.display_name as string | undefined) ?? '';
    setForm({
      display_name: p?.display_name ?? metaName,
      rank_title: p?.rank_title ?? '',
      department: p?.department ?? '',
      city: p?.city ?? '',
      state: p?.state ?? '',
      handicap: formatHandicap(p?.handicap) ?? '',
      bio: p?.bio ?? '',
    });
    setAvatarPath(p?.avatar_path ?? null);
    setLoaded(true);
  }, [loaded, profile.isLoading, profile.data, session]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const chooseAvatar = async () => {
    try {
      const img = await pickImage({ square: true });
      if (img) setNewAvatar(img);
    } catch {
      setSaveError('Could not open your photos.');
    }
  };

  const save = async () => {
    if (!userId) return;
    setSaveError(null);
    const name = form.display_name.trim();
    if (!name) { setSaveError('Add your name.'); return; }
    const hcp = parseHandicap(form.handicap);
    if (!hcp.ok) { setSaveError('Handicap should be a number, like 12.4 or +2.'); return; }
    setSaving(true);
    let nextAvatar = avatarPath;
    if (newAvatar) {
      try {
        nextAvatar = await uploadMedia(userId, 'avatar', newAvatar);
      } catch (err) {
        setSaving(false);
        setSaveError(writeErrorText(err, 'The photo did not upload. Try again.'));
        return;
      }
    }
    const clean = (v: string) => v.trim() || null;
    const res = await saveMyProfile(userId, {
      display_name: name,
      rank_title: clean(form.rank_title),
      department: clean(form.department),
      city: clean(form.city),
      state: clean(form.state),
      handicap: hcp.value,
      bio: clean(form.bio),
      avatar_path: nextAvatar,
    });
    setSaving(false);
    if (!res.ok) { setSaveError(res.error ?? 'That did not save. Try again.'); return; }
    setAvatarPath(nextAvatar);
    setNewAvatar(null);
    qc.invalidateQueries({ queryKey: profileKeys.one(userId) });
    qc.invalidateQueries({ queryKey: boardKeys.all });
    toastSuccess('Profile saved.');
  };

  const changePassword = async () => {
    setPwError(null);
    if (pw.length < 8) { setPwError('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setPwError('The two passwords do not match.'); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) { setPwError(error.message || 'The password did not change. Try again.'); return; }
    setPw('');
    setPw2('');
    toastSuccess('Password changed.');
  };

  const signOut = async () => {
    await signOutMember();
    qc.clear();
    router.replace('/' as any);
  };

  if (!loaded) return <Page title="Account"><Loading /></Page>;

  return (
    <Page title="Account">
      <PageTitle>Account</PageTitle>

      <Text style={s.heading}>Profile</Text>
      <View style={s.avatarRow}>
        <MemberAvatar name={form.display_name} path={avatarPath} uri={newAvatar?.uri} size={72} />
        <View style={s.row}>
          <Button title={avatarPath || newAvatar ? 'Change photo' : 'Add photo'} onPress={chooseAvatar} variant="outline" size="sm" />
          {avatarPath || newAvatar ? (
            <Button title="Remove photo" onPress={() => { setNewAvatar(null); setAvatarPath(null); }} variant="ghost" size="sm" />
          ) : null}
        </View>
      </View>
      <Field label="Name" value={form.display_name} onChangeText={set('display_name')} autoComplete="name" maxLength={80} />
      <Field label="Rank or title" value={form.rank_title} onChangeText={set('rank_title')} placeholder="Captain" maxLength={80} />
      <Field label="Department" value={form.department} onChangeText={set('department')} placeholder="Engine 12, City Fire" maxLength={120} />
      <View style={s.split}>
        <View style={s.grow}>
          <Field label="City" value={form.city} onChangeText={set('city')} maxLength={80} />
        </View>
        <View style={s.state}>
          <Field label="State" value={form.state} onChangeText={set('state')} autoCapitalize="characters" maxLength={40} />
        </View>
      </View>
      <Field
        label="Handicap"
        value={form.handicap}
        onChangeText={set('handicap')}
        placeholder="12.4"
        keyboardType="numbers-and-punctuation"
        hint="Leave blank if you do not have one. Use + for better than scratch."
        maxLength={6}
      />
      <Field label="About you" value={form.bio} onChangeText={set('bio')} multiline maxLength={1000} />
      <ErrorLine>{saveError}</ErrorLine>
      <View style={s.row}>
        <Button title="Save profile" onPress={save} variant="primary" size="md" loading={saving} />
        {userId ? (
          <Button title="View public profile" onPress={() => router.push(`/members/${userId}` as any)} variant="ghost" size="md" />
        ) : null}
      </View>

      <View style={s.rule} />
      <Text style={s.heading}>Sign-in</Text>
      <Field label="Email" value={email ?? ''} editable={false} />
      <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" />
      <Field label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" />
      <ErrorLine>{pwError}</ErrorLine>
      <View style={s.row}>
        <Button title="Change password" onPress={changePassword} variant="outline" size="md" loading={pwBusy} disabled={!pw || !pw2} />
      </View>

      {role.data ? (
        <>
          <View style={s.rule} />
          <Text style={s.heading}>Officers</Text>
          <View style={s.row}>
            <Button title="Open admin" onPress={() => router.push('/admin' as any)} variant="outline" size="md" />
          </View>
        </>
      ) : null}

      <View style={s.rule} />
      <View style={s.row}>
        <Button title="Sign out" onPress={signOut} variant="ghost" size="md" />
      </View>
    </Page>
  );
}

function makeStyles() { return StyleSheet.create({
  heading: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight, color: Colors.textPrimary,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', alignItems: 'center' },
  split: { flexDirection: 'row', gap: Spacing.sm },
  grow: { flex: 1 },
  state: { width: 120 },
  rule: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },
}); }
