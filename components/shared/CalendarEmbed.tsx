/**
 * Calendar embed widget — sidebar tile that lets the user paste a
 * Google or Apple Calendar public share URL and shows their schedule
 * inline.
 *
 * Why this lives here: the right ⅓ of the desktop layout was empty
 * canvas. A schedule the user can glance at while they're in the feed
 * keeps them in HereToo for plan-coordination ("when's that party?")
 * instead of bouncing out to another tab.
 *
 * Storage: the calendar URL goes into profile.style_prefs.calendar_url
 * via the existing style_prefs jsonb column (migration 022). Same
 * best-effort sync pattern as wallpaper / radio — localStorage on
 * the device, mirror to DB so the user's choice persists across
 * sessions and devices.
 *
 * Privacy: only the user themselves can see their embedded calendar
 * (calendar_url isn't exposed on /u/<handle>). The iframe is
 * sandboxed.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

const STORAGE_KEY = 'heretoo:calendar-url';

/**
 * Detect provider + return an embeddable URL. Users paste either:
 *   - Google Calendar embed URL ("https://calendar.google.com/calendar/embed?src=...")
 *   - Google Calendar share URL ("https://calendar.google.com/calendar/u/0/r?cid=...")
 *   - Apple Calendar webcal:// URL → convert to https://
 *   - A pre-formed iframe src
 *
 * Returns null if the URL isn't recognized as embeddable.
 */
function normalizeCalendarUrl(raw: string): { url: string; provider: string } | null {
  const v = raw.trim();
  if (!v) return null;

  // Google Calendar embed (already iframe-ready)
  if (/^https:\/\/calendar\.google\.com\/calendar\/embed/i.test(v)) {
    return { url: v, provider: 'Google Calendar' };
  }
  // Google share URL → convert to embed format
  const cidMatch = v.match(/^https:\/\/calendar\.google\.com\/calendar\/u\/\d+\/r\?cid=(.+)$/i);
  if (cidMatch) {
    const src = decodeURIComponent(cidMatch[1]);
    return {
      url: `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(src)}&ctz=UTC`,
      provider: 'Google Calendar',
    };
  }
  // Apple Calendar webcal://
  if (/^webcal:\/\//i.test(v)) {
    return {
      url: 'https://' + v.replace(/^webcal:\/\//i, ''),
      provider: 'Apple Calendar',
    };
  }
  // Apple Calendar https iCloud public link
  if (/^https:\/\/p\d+-caldav\.icloud\.com/i.test(v) || /^https:\/\/.*\.icloud\.com/i.test(v)) {
    return { url: v, provider: 'Apple Calendar' };
  }
  // Generic ICS feed URL — can't iframe, but show download link
  if (v.endsWith('.ics')) {
    return { url: v, provider: 'ICS feed' };
  }
  // Generic — try as iframe
  if (/^https:\/\//i.test(v)) {
    return { url: v, provider: 'Calendar' };
  }
  return null;
}

export function CalendarEmbed() {
  const userId = useAuthStore((s) => s.user?.id);
  const [url, setUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  // Load saved URL on mount: localStorage first (instant), then DB
  // (cross-device fallback).
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const cached = window.localStorage.getItem(STORAGE_KEY);
        if (cached) {
          setUrl(cached);
          setDraft(cached);
          return;
        }
      } catch {}
    }
    if (userId) {
      supabase
        .from('profiles')
        .select('style_prefs')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => {
          const fromDb = (data as any)?.style_prefs?.calendar_url as string | undefined;
          if (fromDb) {
            setUrl(fromDb);
            setDraft(fromDb);
            try { window.localStorage.setItem(STORAGE_KEY, fromDb); } catch {}
          }
        });
    }
  }, [userId]);

  const save = async () => {
    const norm = normalizeCalendarUrl(draft);
    if (!norm) {
      // Reset draft to current url; user can try again
      return;
    }
    setUrl(norm.url);
    setEditing(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.localStorage.setItem(STORAGE_KEY, norm.url); } catch {}
    }
    if (userId) {
      try {
        const { data: cur } = await supabase
          .from('profiles')
          .select('style_prefs')
          .eq('id', userId)
          .maybeSingle();
        const next = { ...((cur as any)?.style_prefs ?? {}), calendar_url: norm.url };
        await supabase.from('profiles').update({ style_prefs: next }).eq('id', userId);
      } catch {}
    }
  };

  const remove = async () => {
    setUrl(null);
    setDraft('');
    setEditing(false);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
    }
    if (userId) {
      try {
        const { data: cur } = await supabase
          .from('profiles')
          .select('style_prefs')
          .eq('id', userId)
          .maybeSingle();
        const next = { ...((cur as any)?.style_prefs ?? {}) };
        delete next.calendar_url;
        await supabase.from('profiles').update({ style_prefs: next }).eq('id', userId);
      } catch {}
    }
  };

  if (Platform.OS !== 'web') return null;

  // Web only — RN-on-web doesn't have a real <iframe> primitive in
  // <View>, so we use React.createElement('iframe', ...) directly.
  if (url && !editing) {
    return (
      <View style={s.card}>
        <View style={s.header}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.eyebrow}>Calendar</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => setEditing(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Change calendar"
          >
            <Ionicons name="pencil-outline" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        {url.endsWith('.ics') ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(url)}
            style={s.icsLink}
          >
            <Ionicons name="download-outline" size={16} color={Colors.primary} />
            <Text style={s.icsLinkText}>Download calendar feed</Text>
          </TouchableOpacity>
        ) : (
          React.createElement('iframe', {
            src: url,
            title: 'Calendar',
            sandbox: 'allow-scripts allow-same-origin allow-popups',
            style: {
              width: '100%',
              height: 360,
              border: 'none',
              borderRadius: 8,
              background: '#FFF',
            },
          })
        )}
      </View>
    );
  }

  // No URL configured OR editing
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.eyebrow}>Calendar</Text>
        {editing && (
          <>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => { setEditing(false); setDraft(url ?? ''); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>
      <Text style={s.body}>
        Paste a public Google or Apple Calendar URL. It'll show inline so you can plan family stuff without leaving HereToo.
      </Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="https://calendar.google.com/…"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={s.input}
      />
      <View style={s.btnRow}>
        <TouchableOpacity onPress={save} style={s.saveBtn} disabled={!draft.trim()} activeOpacity={0.85}>
          <Text style={s.saveBtnText}>Save</Text>
        </TouchableOpacity>
        {url && (
          <TouchableOpacity onPress={remove} style={s.clearBtn} activeOpacity={0.7}>
            <Text style={s.clearBtnText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.help}>
        Find your share URL in Google Calendar (Settings → Integrate calendar → Public URL) or Apple Calendar (right-click your calendar → Share Calendar → Public).
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  body: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 12, color: Colors.textPrimary,
  },
  btnRow: { flexDirection: 'row', gap: 6 },
  saveBtn: {
    flex: 1, alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 999, paddingVertical: 8,
  },
  saveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  clearBtnText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  help: { fontSize: 10, color: Colors.textMuted, lineHeight: 14, marginTop: 2 },
  icsLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 14, justifyContent: 'center',
    backgroundColor: Colors.primaryFaint, borderRadius: 8,
  },
  icsLinkText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
});
