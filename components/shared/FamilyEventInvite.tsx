/**
 * Crew event invitation creator, sidebar tile.
 *
 * Lets the user fill in a quick form (title, date/time, location,
 * note) and get an .ics file they can drop into iMessage / email /
 * Slack / DM. Anyone who opens the .ics gets a calendar event added
 * — Apple Calendar, Google Calendar, Outlook all parse it.
 *
 * Doesn't go through the server. Pure client-side ICS generation
 * (RFC 5545). The UID is deterministic so an updated re-issue
 * replaces the old event in the recipient's calendar.
 *
 * Future: post-as-update to a crew page so all members get the
 * invite without needing the file shared individually.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Vocab } from '../../constants/vocab';
import { Spacing, Radius } from '../../constants/design';

interface EventForm {
  title: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:MM (24h)
  duration: number; // minutes
  location: string;
  note: string;
}

const EMPTY: EventForm = {
  title: '',
  date: '',
  time: '18:00',
  duration: 120,
  location: '',
  note: '',
};

/**
 * Build an RFC 5545 .ics file from an event spec. Times are emitted
 * with a Z suffix (UTC) — quick + simple. Longer-term we should
 * preserve the user's timezone via VTIMEZONE blocks but for casual
 * crew events UTC is fine and Apple/Google convert automatically.
 */
function buildIcs(ev: EventForm): string | null {
  if (!ev.title.trim() || !ev.date) return null;

  // Local interpretation — treat the user's input as their local time
  // and emit a "floating" date-time (no Z). Most calendar apps will
  // show in viewer's local zone, which is what people expect for a
  // birthday or crew dinner: "6pm" means 6pm where you are.
  const [y, m, d] = ev.date.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = (ev.time || '18:00').split(':').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;

  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + ev.duration * 60 * 1000);

  const fmt = (dt: Date): string => {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      dt.getFullYear() +
      p(dt.getMonth() + 1) +
      p(dt.getDate()) +
      'T' +
      p(dt.getHours()) +
      p(dt.getMinutes()) +
      '00'
    );
  };

  // Deterministic UID so updates replace prior copies in the
  // recipient's calendar. Hash of (title + date) is good enough
  // for friendly use.
  const uid = `heretoo-${ev.date}-${ev.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}@heretoo.social`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HereToo//Family Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}Z`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${ev.title.replace(/[\r\n]+/g, ' ')}`,
    ev.location ? `LOCATION:${ev.location.replace(/[\r\n]+/g, ' ')}` : '',
    ev.note ? `DESCRIPTION:${ev.note.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  // RFC 5545 line endings are CRLF.
  return lines.join('\r\n') + '\r\n';
}

export function FamilyEventInvite() {
  const s = makeStyles();
  const [form, setForm] = useState<EventForm>(EMPTY);
  const [downloaded, setDownloaded] = useState(false);

  if (Platform.OS !== 'web') return null;

  const onChange = <K extends keyof EventForm>(k: K, v: EventForm[K]) => {
    setForm((c) => ({ ...c, [k]: v }));
  };

  const onDownload = () => {
    const ics = buildIcs(form);
    if (!ics) return;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title.replace(/[^a-z0-9-_]/gi, '_').slice(0, 40) || 'invite'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2500);
  };

  const canDownload = form.title.trim().length > 0 && form.date.length === 10;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="gift-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.eyebrow}>{Vocab.Group} event invite</Text>
      </View>

      <TextInput
        value={form.title}
        onChangeText={(t) => onChange('title', t)}
        placeholder="Mom's 70th"
        placeholderTextColor={Colors.textMuted}
        style={s.input}
        maxLength={80}
      />
      <View style={s.row}>
        <TextInput
          value={form.date}
          onChangeText={(t) => onChange('date', t)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textMuted}
          style={[s.input, { flex: 1.4 }]}
          maxLength={10}
        />
        <TextInput
          value={form.time}
          onChangeText={(t) => onChange('time', t)}
          placeholder="18:00"
          placeholderTextColor={Colors.textMuted}
          style={[s.input, { flex: 1 }]}
          maxLength={5}
        />
      </View>
      <TextInput
        value={form.location}
        onChangeText={(t) => onChange('location', t)}
        placeholder="Location (optional)"
        placeholderTextColor={Colors.textMuted}
        style={s.input}
        maxLength={120}
      />
      <TextInput
        value={form.note}
        onChangeText={(t) => onChange('note', t)}
        placeholder="Note (optional)"
        placeholderTextColor={Colors.textMuted}
        style={[s.input, { minHeight: 50 }]}
        multiline
        maxLength={400}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[s.downloadBtn, !canDownload && s.downloadBtnDisabled]}
        disabled={!canDownload}
        onPress={onDownload}
        activeOpacity={0.85}
      >
        <Ionicons
          name={downloaded ? 'checkmark' : 'calendar'}
          size={14}
          color="#FFF"
        />
        <Text style={s.downloadBtnText}>
          {downloaded ? 'Downloaded' : 'Download invite (.ics)'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  row: { flexDirection: 'row', gap: 6 },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 12, color: Colors.textPrimary,
  },

  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 999, paddingVertical: 9,
    marginTop: 4,
  },
  downloadBtnDisabled: { opacity: 0.4 },
  downloadBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
}); }
