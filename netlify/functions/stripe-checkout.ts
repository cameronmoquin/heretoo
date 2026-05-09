/**
 * /api/stripe-checkout — create a Stripe Checkout session for a
 * family subscription.
 *
 * Source of Truth, Milestone 12. The granddaughter clicks "Start your
 * family" → this fn creates a Checkout session in Stripe and returns
 * the URL. The browser redirects there for payment. On success, the
 * Stripe webhook (sibling fn) creates the subscriptions row.
 *
 * Fail-soft: if STRIPE_SECRET_KEY or the price IDs aren't set, returns
 * 503 with a clear message. The UI shows "billing not yet configured."
 *
 * Auth: the caller passes their Supabase session JWT in Authorization;
 * we verify with Supabase before creating the Stripe session.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY;
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL;

interface Body {
  family_id?: string;
  plan?: 'monthly' | 'annual';
  return_url?: string;
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!STRIPE_KEY || (!PRICE_MONTHLY && !PRICE_ANNUAL)) {
    return new Response(
      JSON.stringify({ error: 'Billing not yet configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Server misconfigured', { status: 500 });
  }

  // 1. Verify the caller via Supabase /auth/v1/user.
  const auth = req.headers.get('authorization');
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
  }
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: auth,
      apikey: SERVICE_ROLE,
    },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Auth failed' }), { status: 401 });
  }
  const user = (await userRes.json()) as { id?: string; email?: string };
  if (!user.id) {
    return new Response(JSON.stringify({ error: 'No user' }), { status: 401 });
  }

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }

  const plan = body.plan === 'annual' ? 'annual' : 'monthly';
  const priceId = plan === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY;
  if (!priceId) {
    return new Response(
      JSON.stringify({ error: `Plan ${plan} not configured` }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!body.family_id) {
    return new Response(
      JSON.stringify({ error: 'family_id required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 2. Verify the user is owner/active in the family.
  const fmRes = await fetch(
    `${SUPABASE_URL}/rest/v1/family_members?select=profile_id,role,status&family_id=eq.${body.family_id}&profile_id=eq.${user.id}`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  const fmRows = (await fmRes.json()) as Array<{ status: string; role: string }>;
  if (!Array.isArray(fmRows) || fmRows.length === 0 || fmRows[0].status !== 'active') {
    return new Response(JSON.stringify({ error: 'Not a member' }), { status: 403 });
  }

  // 3. Create a Stripe Checkout session.
  const returnUrl = body.return_url
    || `https://heretoo.social/family/${body.family_id}?billing=success`;
  const cancelUrl = `https://heretoo.social/family/${body.family_id}?billing=canceled`;

  const stripeBody = new URLSearchParams();
  stripeBody.set('mode', 'subscription');
  stripeBody.set('line_items[0][price]', priceId);
  stripeBody.set('line_items[0][quantity]', '1');
  stripeBody.set('success_url', returnUrl);
  stripeBody.set('cancel_url', cancelUrl);
  stripeBody.set('client_reference_id', user.id);
  stripeBody.set('metadata[family_id]', body.family_id);
  stripeBody.set('metadata[payer_user_id]', user.id);
  stripeBody.set('metadata[plan]', plan);
  if (user.email) stripeBody.set('customer_email', user.email);
  // No "automatic_tax" or "phone_number_collection" — keep checkout small.

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeBody.toString(),
  });
  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    // eslint-disable-next-line no-console
    console.error('[stripe-checkout]', stripeRes.status, err.slice(0, 300));
    return new Response(
      JSON.stringify({ error: 'Checkout session failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const session = (await stripeRes.json()) as { id: string; url: string };

  return new Response(
    JSON.stringify({ id: session.id, url: session.url }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = { path: '/api/stripe-checkout' };
