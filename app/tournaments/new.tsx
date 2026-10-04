/**
 * /tournaments/new — officers create a tournament. Everyone else sees a
 * short note; signed-out visitors are asked to sign in.
 */
import React from 'react';
import { Stack, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { RequireAccount } from '../../components/nffga/RequireAccount';
import { useSession } from '../../lib/nffga/useSession';
import { saveTournament, tournamentKeys, useNffgaRole } from '../../lib/nffga/tournaments';
import { TournamentForm } from '../../components/nffga/tournaments/TournamentForm';
import { Loading, Notice, Page, PageTitle } from '../../components/nffga/tournaments/ui';

export default function NewTournamentScreen() {
  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'New tournament' }} />
      <PageTitle title="New tournament" />
      <RequireAccount reason="to create a tournament">
        <Body />
      </RequireAccount>
    </Page>
  );
}

function Body() {
  const { userId } = useSession();
  const { role, loading } = useNffgaRole(userId);
  const qc = useQueryClient();
  if (loading) return <Loading />;
  if (!role) return <Notice>Tournaments are created by association officers. Contact an officer if you would like to host one.</Notice>;
  return (
    <TournamentForm
      saveLabel="Create tournament"
      onCancel={() => router.replace('/tournaments' as any)}
      onSave={async (input) => {
        const r = await saveTournament(input, { organizerId: userId as string });
        if (!r.ok) return r.error;
        qc.invalidateQueries({ queryKey: tournamentKeys.all });
        router.replace(`/tournaments/${r.id}` as any);
        return null;
      }}
    />
  );
}
