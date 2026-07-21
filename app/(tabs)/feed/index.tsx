/**
 * Home tab — now The Room (Source of Truth, Milestone 1).
 *
 * The feed (For You / Connections) used to live here. It was promoted
 * to a fallback at /common; the Room is now the front door. The Room
 * presents at most three Postcards drawn from the same unifying-feed
 * ranker, plus a hearth (today / room switcher) and a side table
 * (music + read-aloud + compose).
 *
 * Per-crew rooms live at /family/{id} (reached via the hearth's
 * room-switcher); they will gain the full Room layout in a follow-up.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemeStore } from '../../../stores/themeStore';
import { hardSignOutAndRedirect } from '../../../lib/auth-recovery';
import { HereTooLogo } from '../../../components/shared/Logo';
import { Room } from '../../../components/room/Room';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

export default function RoomHomeScreen() {
  const styles = makeStyles();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* Mobile-only header with brand + utility icons. Desktop uses
          the LeftSidebar so this row is redundant there. */}
      {!isDesktop && (
        <View style={styles.header}>
          <HereTooLogo size={28} color={Colors.textPrimary} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/common' as any)}
              accessibilityLabel="Common feed"
            >
              <Ionicons name="reader-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/chat' as any)}
              accessibilityLabel="Messages"
            >
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={toggleTheme}
              accessibilityLabel="Toggle light/dark theme"
            >
              <Ionicons
                name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => hardSignOutAndRedirect()}
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Room />
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    height: 52,
    maxWidth: 720, alignSelf: 'center', width: '100%',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
