/**
 * /gear/new — list an item on the gear trade. Account needed.
 */
import React from 'react';
import { Stack, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { RequireAccount } from '../../components/nffga/RequireAccount';
import { toastInfo } from '../../components/shared/Toast';
import { useSession } from '../../lib/nffga/useSession';
import { gearKeys, saveListing } from '../../lib/nffga/gear';
import { GearForm } from '../../components/nffga/gear/GearForm';
import { Page, PageTitle } from '../../components/nffga/tournaments/ui';

export default function NewGearScreen() {
  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'List gear' }} />
      <PageTitle title="List gear" />
      <RequireAccount reason="to list gear">
        <Body />
      </RequireAccount>
    </Page>
  );
}

function Body() {
  const { userId } = useSession();
  const qc = useQueryClient();
  return (
    <GearForm
      saveLabel="Post listing"
      onCancel={() => router.replace('/gear' as any)}
      onSave={async (input, photos) => {
        const r = await saveListing(input, photos, { sellerId: userId as string });
        if (!r.ok) return r.error;
        if (r.photoError) toastInfo(r.photoError, 5000);
        qc.invalidateQueries({ queryKey: gearKeys.all });
        router.replace(`/gear/${r.id}` as any);
        return null;
      }}
    />
  );
}
