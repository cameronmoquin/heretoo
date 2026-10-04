/**
 * /tournaments/[id]/edit — the organizer's sheet for an existing
 * tournament. Officers and the tournament's organizer only.
 */
import React from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { RequireAccount } from '../../../components/nffga/RequireAccount';
import { useSession } from '../../../lib/nffga/useSession';
import { saveTournament, tournamentKeys, useNffgaRole, useTournament } from '../../../lib/nffga/tournaments';
import { TournamentForm } from '../../../components/nffga/tournaments/TournamentForm';
import { Loading, Notice, Page, PageTitle } from '../../../components/nffga/tournaments/ui';

export default function EditTournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'Edit tournament' }} />
      <PageTitle title="Edit tournament" />
      <RequireAccount reason="to edit a tournament">
        <Body id={id} />
      </RequireAccount>
    </Page>
  );
}

function Body({ id }: { id: string }) {
  const { userId } = useSession();
  const { role, loading } = useNffgaRole(userId);
  const tq = useTournament(id);
  const qc = useQueryClient();
  if (loading || tq.isLoading) return <Loading />;
  const t = tq.data;
  if (!t) return <Notice>This tournament could not be found.</Notice>;
  if (!role && t.organizer_id !== userId) {
    return <Notice>Only the organizer and association officers can edit this tournament.</Notice>;
  }
  return (
    <TournamentForm
      key={t.id}
      initial={t}
      saveLabel="Save changes"
      onCancel={() => router.replace(`/tournaments/${t.id}` as any)}
      onSave={async (input) => {
        const r = await saveTournament(input, { id: t.id, organizerId: t.organizer_id });
        if (!r.ok) return r.error;
        qc.invalidateQueries({ queryKey: tournamentKeys.all });
        qc.invalidateQueries({ queryKey: tournamentKeys.one(t.id) });
        router.replace(`/tournaments/${t.id}` as any);
        return null;
      }}
    />
  );
}
