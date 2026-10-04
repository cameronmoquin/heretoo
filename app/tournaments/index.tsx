/**
 * /tournaments — every tournament anyone may see. Upcoming first
 * (soonest first), then past. Officers also see drafts and a
 * "New tournament" button. No sign-in needed to browse.
 */
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import type { Tournament } from '../../lib/nffga/types';
import { Stack, router } from 'expo-router';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { useSession } from '../../lib/nffga/useSession';
import { splitTournaments, useNffgaRole, useTournaments } from '../../lib/nffga/tournaments';
import { TournamentCard } from '../../components/nffga/tournaments/TournamentCard';
import { Loading, Muted, Page, PageTitle } from '../../components/nffga/tournaments/ui';

export default function TournamentsScreen() {
  const { userId } = useSession();
  const { role } = useNffgaRole(userId);
  const q = useTournaments();
  const { upcoming, past, drafts } = splitTournaments(q.data ?? []);

  return (
    <Page>
      <Stack.Screen options={{ title: 'Tournaments' }} />
      <PageTitle
        title="Tournaments"
        right={role ? (
          <Button title="New tournament" onPress={() => router.push('/tournaments/new' as any)} variant="primary" size="md" />
        ) : null}
      />

      {q.isLoading ? <Loading /> : (
        <>
          <Group title="Upcoming" empty="No upcoming tournaments yet." items={upcoming} />
          {drafts.length > 0 ? <Group title="Drafts" items={drafts} /> : null}
          {past.length > 0 ? <Group title="Past" items={past} /> : null}
        </>
      )}
    </Page>
  );
}

function Group({ title, items, empty }: { title: string; items: Tournament[]; empty?: string }) {
  const s = makeStyles();
  return (
    <View style={s.group}>
      <Text style={s.groupTitle} accessibilityRole="header">{title}</Text>
      {items.length === 0 ? <Muted>{empty ?? 'None.'}</Muted> : (
        <View style={s.grid}>
          {items.map((t) => <View key={t.id} style={s.cell}><TournamentCard t={t} /></View>)}
        </View>
      )}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  group: { gap: Spacing.sm },
  groupTitle: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: Type.title.weight, color: Colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  cell: { flexGrow: 1, flexBasis: 320, minWidth: 0 },
}); }
