import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BuildInfo } from '../constants/build-info';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';

/**
 * Public debug route: /version
 * Shows exactly what build is deployed, what env it's pointing at, and
 * lets you verify Supabase connectivity in one click.
 */
export default function VersionScreen() {
  const s = makeStyles();
  const [checkResult, setCheckResult] = React.useState<string>('');

  const checkSupabase = async () => {
    setCheckResult('checking...');
    try {
      const t0 = Date.now();
      // pulse_topics was a retired feature's table, so this button
      // reported an error against a healthy database. find_hunt_by_code
      // is anon-callable and side-effect-free: any 200 — even an empty
      // one — proves the whole path.
      const { error } = await supabase.rpc('find_hunt_by_code', { p_code: 'PING' });
      const ms = Date.now() - t0;
      if (error) setCheckResult(`ERROR: ${error.message}`);
      else setCheckResult(`OK (${ms}ms)`);
    } catch (e: any) {
      setCheckResult(`FETCH ERROR: ${e?.message ?? 'unknown'}`);
    }
  };

  const row = (label: string, value: string | boolean) => (
    <View style={s.row} key={label}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value} selectable>{String(value)}</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Build Info</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.section}>Build</Text>
        {row('Commit', BuildInfo.commit)}
        {row('Commit (full)', BuildInfo.commitFull)}
        {row('Branch', BuildInfo.branch)}
        {row('Dirty', BuildInfo.dirty)}
        {row('Built at', BuildInfo.buildTime)}
        {row('Environment', BuildInfo.env)}

        <Text style={[s.section, { marginTop: 24 }]}>Backend</Text>
        {row('Supabase URL', BuildInfo.supabaseUrl)}

        <TouchableOpacity style={s.checkBtn} onPress={checkSupabase}>
          <Text style={s.checkBtnText}>Test Supabase connection</Text>
        </TouchableOpacity>
        {!!checkResult && <Text style={s.checkResult}>{checkResult}</Text>}

        <Text style={[s.section, { marginTop: 24 }]}>Runtime</Text>
        {row('User Agent', typeof navigator !== 'undefined' ? navigator.userAgent : 'native')}
        {row('URL', typeof window !== 'undefined' ? window.location.href : 'native')}
      </ScrollView>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  body: { padding: 20, gap: 4 },
  section: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  label: { fontSize: 13, color: Colors.textSecondary, flexShrink: 0 },
  value: { fontSize: 13, fontFamily: 'monospace', color: Colors.textPrimary, textAlign: 'right', flex: 1 },
  checkBtn: { marginTop: 16, padding: 12, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center' },
  checkBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  checkResult: { marginTop: 8, fontSize: 12, fontFamily: 'monospace', color: Colors.textPrimary },
}); }
