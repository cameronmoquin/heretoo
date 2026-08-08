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
import { useUnreadCount } from '../hooks/useChat';
import { useRadio, useActiveStation } from '../stores/radioStore';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type, Heights } from '../constants/design';

interface Door {
  icon: any;
  label: string;
  route: string;
  badge?: string;
}

export default function RoomsScreen() {
  const s = makeStyles();
  const { data: unread } = useUnreadCount();
  const radioPlaying = useRadio((st) => st.playing);
  const radioToggle = useRadio((st) => st.toggle);
  const station = useActiveStation();

  /**
   * Two shelves, split by whether the door leads to another person.
   *
   * APPS still end in interaction — someone reads the drop, receives the
   * letter, finds the cache, hears the same station. ANTI-SOCIAL ends
   * with you: the journal is encrypted so that nobody, including the
   * platform, can read it, and the memoir is written before it is ever
   * a book. Babybook is not here because it now lives under Memoir.
   *
   * The split is the product's argument made into furniture, so a door
   * only moves shelf if what it does to a person changes.
   */
  const apps: Door[] = [
    { icon: 'navigate', label: 'Deaddrop', route: '/hunt' },
    // Feed has no door either — it is the home tab, one tap away always.
    { icon: 'chatbubbles', label: 'Messages', route: '/messages', badge: unread && unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined },
    { icon: 'mail', label: 'Letters', route: '/letter' },
    // The player had no door on mobile at all. The radio row above is a
    // play/pause control and nothing else, and the only route into
    // /music anywhere was a long-press on the desktop sidebar.
    { icon: 'disc', label: 'Music', route: '/music' },
    { icon: 'people', label: 'Network', route: '/network' },
    { icon: 'pricetag', label: 'Advertise', route: '/advertise' },
    { icon: 'boat', label: 'Social', route: '/family' },
    // Give is off the shelf — donations sit inside regulatory territory
    // that a lemonade stand has no business standing in. The /give route
    // still exists; no door points at it. Profile is off because the
    // tab bar already carries it; one door per place.
  ];

  const antisocial: Door[] = [
    { icon: 'lock-closed', label: 'Journal', route: '/journal' },
    { icon: 'create', label: 'Memoir', route: '/memoir' },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* No headline. The doors are the page. */}

        {/* Radio: a live control, not a door. The visible row shows the
            station and its genre and says nothing about what tapping does,
            so the state lives entirely in the icon. Screen readers get it
            from the label instead. */}
        <TouchableOpacity
          style={s.radioRow}
          onPress={() => { radioToggle().catch(() => {}); }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={radioPlaying ? `Pause ${station.name}` : `Play ${station.name}`}
        >
          <View style={[s.radioIcon, radioPlaying && s.radioIconOn]}>
            <Ionicons name={radioPlaying ? 'pause' : 'musical-notes'} size={20} color={radioPlaying ? Colors.primary : Colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.radioName}>{station.name}</Text>
            <Text style={s.radioSub}>{station.genre}</Text>
          </View>
        </TouchableOpacity>

        <Text style={s.shelf}>Apps</Text>
        <Grid doors={apps} s={s} />

        {/* Second, and last, on purpose. The rooms that end with you are
            not the ones you reach for on the way somewhere else. */}
        <Text style={s.shelf}>Anti-social</Text>
        <Grid doors={antisocial} s={s} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** One shelf of doors. Both shelves render identically; only the
 *  heading above them says what kind of room is behind each. */
function Grid({ doors, s }: { doors: Door[]; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.grid}>
      {doors.map((d) => (
        <TouchableOpacity
          key={d.route}
          style={s.door}
          onPress={() => router.push(d.route as any)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={d.label}
        >
          <View>
            <Ionicons name={`${d.icon}-outline` as any} size={26} color={Colors.primary} />
            {!!d.badge && (
              <View style={s.badge}><Text style={s.badgeText}>{d.badge}</Text></View>
            )}
          </View>
          <Text style={s.doorLabel}>{d.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    shelf: {
      fontSize: Type.caption.size,
      lineHeight: Type.caption.lineHeight,
      color: Colors.textMuted,
      marginTop: Spacing.xs,
    },
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.md, paddingBottom: 110, gap: Spacing.md },
    title: {
      fontSize: 22, fontWeight: '800', color: Colors.primary,
      marginTop: Spacing.xxs, marginBottom: 2,
    },

    radioRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      padding: Spacing.md, borderRadius: Radius.lg,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      minHeight: 64,
    },
    radioIcon: {
      width: Heights.touchTarget, height: Heights.touchTarget,
      borderRadius: Radius.full,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: Colors.border,
    },
    radioIconOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
    radioName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
    radioSub: { fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 2 },

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
    doorLabel: {
      fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary,
    },
    badge: {
      position: 'absolute', top: -6, left: 18,
      minWidth: 18, height: 18, borderRadius: Radius.full,
      paddingHorizontal: Spacing.xxs,
      backgroundColor: Colors.heart, alignItems: 'center', justifyContent: 'center',
    },
    // Ivory, not #FFF. The count sits on Colors.heart and has to stay
    // legible when the skin moves that red.
    badgeText: { fontSize: 10, fontWeight: '800', color: Colors.brandIvory },
  });
}
