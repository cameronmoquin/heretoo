/**
 * Billing hooks — Source of Truth, Milestone 12.
 *
 * The grandmother never sees a price. The granddaughter does. These
 * hooks power the family-creator side of the economics surface:
 * subscription status indicator, "Start a plan" CTA, and the
 * Stripe-managed billing portal handoff.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface FamilySubscriptionSummary {
  status: 'active' | 'trialing' | 'past_due';
  plan: 'monthly' | 'annual' | 'gift_annual' | 'memorial' | 'grandfathered';
  is_memorial: boolean;
  member_cap: number;
  in_grace: boolean;
  current_period_end: string | null;
}

/** Returns the family's current subscription, or null if free. */
export function useFamilySubscription(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ['family-subscription', familyId],
    queryFn: async (): Promise<FamilySubscriptionSummary | null> => {
      if (!familyId) return null;
      const { data, error } = await supabase.rpc('family_subscription_summary', {
        p_family_id: familyId,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[billing] rpc failed', error.message);
        return null;
      }
      const row = (data ?? [])[0] as FamilySubscriptionSummary | undefined;
      return row ?? null;
    },
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Kick off Stripe Checkout. Calls the /api/stripe-checkout endpoint
 *  with the user's session token; receives a Checkout URL; redirects
 *  the browser. Fail-soft: if the endpoint returns 503 (billing not
 *  configured), we surface a clear error to the caller. */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (input: {
      familyId: string;
      plan: 'monthly' | 'annual';
    }): Promise<string> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not signed in');

      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          family_id: input.familyId,
          plan: input.plan,
          return_url:
            typeof window !== 'undefined' && window.location?.origin
              ? `${window.location.origin}/family/${input.familyId}?billing=success`
              : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Checkout failed (${res.status})`);
      }
      const j = (await res.json()) as { url: string };
      // Redirect immediately — Stripe Checkout is its own page.
      if (typeof window !== 'undefined' && j.url) {
        window.location.href = j.url;
      }
      return j.url;
    },
  });
}
