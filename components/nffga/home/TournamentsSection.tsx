/**
 * TournamentsSection — the home page's next three upcoming tournaments.
 * Zero props; the events agent owns this file (docs/NFFGA_CONTRACT.md).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HomeSection } from '../HomeSection';
import { Spacing } from '../../../constants/design';
import { splitTournaments, useTournaments } from '../../../lib/nffga/tournaments';
import { TournamentCard } from '../tournaments/TournamentCard';

export function TournamentsSection() {
  const s = makeStyles();
  const q = useTournaments();
  const next = splitTournaments(q.data ?? []).upcoming.slice(0, 3);
  return (
    <HomeSection title="Upcoming tournaments" href="/tournaments" empty={q.isLoading ? 'Loading...' : 'No tournaments posted yet.'}>
      {next.length > 0 ? (
        <View style={s.list}>
          {next.map((t) => <TournamentCard key={t.id} t={t} compact />)}
        </View>
      ) : null}
    </HomeSection>
  );
}

function makeStyles() { return StyleSheet.create({
  list: { gap: Spacing.sm },
}); }
