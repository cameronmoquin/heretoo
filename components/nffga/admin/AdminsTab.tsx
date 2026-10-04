/**
 * AdminsTab — designate and revoke admin and officer seats (migration
 * 102's designate_admin / revoke_admin / list_nffga_admins). Moved from
 * app/admin.tsx; behaviour unchanged. The database decides who may
 * grant what; canGrant() only hides buttons that would be refused.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  listAdmins, designateAdmin, revokeAdmin, canGrant, GRANTABLE_ROLES, ROLE_LABEL,
  type AdminRole, type AdminRow,
} from '../../../lib/admin';
import { Button } from '../../shared/Button';
import { Eyebrow } from '../../shared/Eyebrow';
import { Colors } from '../../../constants/colors';
import { makeAdminStyles } from './styles';

export function AdminsTab({ me, myEmail }: { me: AdminRole; myEmail: string }) {
  const s = makeAdminStyles();
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>(me === 'super_admin' ? 'managing_admin' : 'admin');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listAdmins()); setLoadErr(null); }
    catch (e: any) { setLoadErr(e?.message ?? 'Could not load the admin list.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grantable = GRANTABLE_ROLES.filter((r) => canGrant(me, r));

  const add = async () => {
    setMsg(null);
    const e = newEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setMsg({ ok: false, text: 'Enter a full email address.' }); return; }
    setBusy(true);
    const res = await designateAdmin(e, newRole);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: res.error === 'not_allowed' ? "You can't grant that role." : (res.error ?? 'Could not add.') }); return; }
    setNewEmail('');
    setMsg({ ok: true, text: `${e} added as ${ROLE_LABEL[newRole]}. Tell them to open this site, type that email, and tap "Email me a sign-in link".` });
    void load();
  };

  const remove = async (email: string) => {
    if (confirming !== email) { setConfirming(email); return; }
    setConfirming(null);
    const res = await revokeAdmin(email);
    if (!res.ok) { setMsg({ ok: false, text: res.error === 'not_allowed' ? "You can't remove that seat." : (res.error ?? 'Could not remove.') }); return; }
    void load();
  };

  return (
    <View style={s.card}>
      <Eyebrow>Admins and officers</Eyebrow>
      <Text style={s.muted}>
        Only the super admin and the managing admin can open this dashboard. Other officer seats are recorded but have no dashboard access.
      </Text>

      {loadErr && <Text style={s.err}>{loadErr}</Text>}
      {!rows && !loadErr && <ActivityIndicator color={Colors.primary} />}
      {rows?.map((r) => {
        const removable = r.email !== myEmail.toLowerCase() && canGrant(me, r.role);
        return (
          <View key={r.email} style={s.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.rowEmail} numberOfLines={1}>{r.email}</Text>
              <Text style={s.rowMeta}>
                {ROLE_LABEL[r.role]} · {r.claimed ? 'active' : 'invited, not signed in yet'}
              </Text>
            </View>
            {removable && (
              <TouchableOpacity onPress={() => remove(r.email)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.remove}>{confirming === r.email ? 'Confirm remove' : 'Remove'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <View style={s.divider} />
      <Eyebrow>Add someone</Eyebrow>
      <TextInput
        style={s.input} value={newEmail} onChangeText={(t) => { setNewEmail(t); setMsg(null); }}
        placeholder="their@email.com" placeholderTextColor={Colors.textMuted}
        autoCapitalize="none" keyboardType="email-address" autoComplete="off"
      />
      <View style={s.chips}>
        {grantable.map((r) => (
          <TouchableOpacity
            key={r}
            style={[s.chip, newRole === r && s.chipOn]}
            onPress={() => setNewRole(r)}
            accessibilityRole="button"
            accessibilityState={{ selected: newRole === r }}
          >
            <Text style={[s.chipText, newRole === r && s.chipTextOn]}>{ROLE_LABEL[r]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {msg && <Text style={msg.ok ? s.ok : s.err}>{msg.text}</Text>}
      <Button title={busy ? 'Adding…' : 'Add'} onPress={add} loading={busy} disabled={busy || !newEmail.trim()} variant="primary" size="md" />
    </View>
  );
}
