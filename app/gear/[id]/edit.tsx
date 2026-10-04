/**
 * /gear/[id]/edit — the seller edits their listing.
 */
import React from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { RequireAccount } from '../../../components/nffga/RequireAccount';
import { toastInfo } from '../../../components/shared/Toast';
import { useSession } from '../../../lib/nffga/useSession';
import { gearKeys, saveListing, useGearListing } from '../../../lib/nffga/gear';
import { GearForm } from '../../../components/nffga/gear/GearForm';
import { Loading, Notice, Page, PageTitle } from '../../../components/nffga/tournaments/ui';

export default function EditGearScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'Edit listing' }} />
      <PageTitle title="Edit listing" />
      <RequireAccount reason="to edit a listing">
        <Body id={id} />
      </RequireAccount>
    </Page>
  );
}

function Body({ id }: { id: string }) {
  const { userId } = useSession();
  const qc = useQueryClient();
  const lq = useGearListing(id);
  if (lq.isLoading) return <Loading />;
  const l = lq.data;
  if (!l) return <Notice>This listing could not be found.</Notice>;
  if (l.seller_id !== userId) return <Notice>Only the seller can edit this listing.</Notice>;
  return (
    <GearForm
      key={l.id}
      initial={l}
      saveLabel="Save changes"
      onCancel={() => router.replace(`/gear/${l.id}` as any)}
      onSave={async (input, photos) => {
        const r = await saveListing(input, photos, { id: l.id, sellerId: l.seller_id });
        if (!r.ok) return r.error;
        if (r.photoError) toastInfo(r.photoError, 5000);
        qc.invalidateQueries({ queryKey: gearKeys.all });
        qc.invalidateQueries({ queryKey: gearKeys.one(l.id) });
        router.replace(`/gear/${l.id}` as any);
        return null;
      }}
    />
  );
}
