/**
 * /rooms — the hallway.
 *
 * The house has more rooms than a phone's tab bar can hold. Desktop
 * gets the left sidebar; this is mobile's answer: every room, one
 * screen, thumb-sized doors. Reachable from the Rooms tab.
 *
 * Order follows pull, not alphabet: the game first, the social rooms,
 * the writing rooms, then the utility doors.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlitchText } from '../components/shared/GlitchText';
import { useUnreadCount } from '../hooks/useChat';
import { useRadio, useActiveStation } from '../stores/radioStore';
import { Colors } from '../constants/colors';
import { Spacing, Radius } from '../constants/design';

interface Door {
  icon: any;
  label: string;
  sub?: string;
  route: string;
  badge?: string;
}

export default function RoomsScreen() {
  const s = makeStyles();
  const { data: unread } = useUnreadCount();
  const radioPlaying = useRadio((st) => st.playing);
  const radioToggle = useRadio((st) => st.toggle);
  const station = useActiveStation();

  const doors: Door[] = [
    { icon: 'navigate', label: 'Deaddrop', sub: 'hide it. find it.', route: '/hunt' },
    { icon: 'home', label: 'The Room', sub: 'the feed', route: '/feed' },
    { icon: 'chatbubbles', label: 'Messages', route: '/chat', badge: unread && unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined },
    { icon: 'globe', label: 'The Loft', sub: 'public. vanishes daily.', route: '/loft' },
    { icon: 'book', label: 'Insults', sub: 'the playhouse', route: '/shakespearean-insults' },
    { icon: 'game-controller', label: 'Games', route: '/games' },
    { icon: 'mail', label: 'Letters', sub: 'opens years from now', route: '/letter' },
    { icon: 'create', label: 'Memoir', sub: 'the book of you', route: '/memoir' },
    { icon: 'reader', label: 'Common', route: '/common' },
    { icon: 'newspaper', label: 'News', sub: 'public broadcasting', route: '/news' },
    { icon: 'people', label: 'Network', route: '/network' },
    { icon: 'leaf', label: 'Families', route: '/family' },
    { icon: 'heart', label: 'Give', route: '/give' },
    { icon: 'person', label: 'Profile', route: '/profile' },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <GlitchText style={s.title}>ROOMS</GlitchText>

        {/* Radio: a live control, not a door. One tap plays the station. */}
        <TouchableOpacity style={s.radioRow} onPress={() => { radioToggle().catch(() => {}); }} activeOpacity={0.8}>
          <View style={[s.radioIcon, radioPlaying && s.radioIconOn]}>
            <Ionicons name={radioPlaying ? 'pause' : 'musical-notes'} size={20} color={radioPlaying ? Colors.primary : Colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.radioName}>{station.name}</Text>
            <Text style={s.radioSub}>{radioPlaying ? 'now playing · tap to pause' : station.genre}</Text>
          </View>
        </TouchableOpacity>

        <View style={s.grid}>
          {doors.map((d) => (
            <TouchableOpacity
              key={d.route}
              style={s.door}
              onPress={() => router.push(d.route as any)}
              activeOpacity={0.8}
            >
              <View>
                <Ionicons name={`${d.icon}-outline` as any} size={26} color={Colors.primary} />
                {!!d.badge && (
                  <View style={s.badge}><Text style={s.badgeText}>{d.badge}</Text></View>
                )}
              </View>
              <Text style={s.doorLabel}>{d.label}</Text>
              {!!d.sub && <Text style={s.doorSub} numberOfLines={1}>{d.sub}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.md, paddingBottom: 110, gap: Spacing.md },
    title: {
      fontSize: 22, fontWeight: '800', color: Colors.primary, marginTop: 4, marginBottom: 2,
    },

    radioRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: Spacing.md, borderRadius: Radius.lg,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      minHeight: 64,
    },
    radioIcon: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: Colors.border,
    },
    radioIconOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
    radioName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
    radioSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

    // Two doors per row on phones; the 720 max-width caps them on
    // bigger screens. 48%+gap keeps targets comfortably over 44pt.
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    door: {
      width: '48%', flexGrow: 1, minHeight: 92,
      padding: Spacing.md, gap: 6,
      borderRadius: Radius.lg,
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      justifyContent: 'center',
    },
    doorLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
    doorSub: { fontSize: 11, color: Colors.textMuted },
    badge: {
      position: 'absolute', top: -6, left: 18,
      minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
      backgroundColor: Colors.heart, alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  });
}
