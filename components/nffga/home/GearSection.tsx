/**
 * GearSection — the home page's four newest gear listings.
 * Zero props; the events agent owns this file (docs/NFFGA_CONTRACT.md).
 */
import React from 'react';
import { HomeSection } from '../HomeSection';
import { useGearListings } from '../../../lib/nffga/gear';
import { GearGrid } from '../gear/GearGrid';

export function GearSection() {
  const q = useGearListings(null, 4);
  const items = q.data ?? [];
  return (
    <HomeSection title="Gear trade" href="/gear" empty={q.isLoading ? 'Loading...' : 'No gear listed yet.'}>
      {items.length > 0 ? <GearGrid items={items} maxColumns={2} /> : null}
    </HomeSection>
  );
}
