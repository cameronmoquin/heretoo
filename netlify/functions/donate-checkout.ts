/**
 * /api/donate-checkout — Stripe one-time donation checkout.
 *
 * Source of Truth: always-on charitable fund. Routes the donation to
 * the configured beneficiary (501(c)(3) or PAC) via Stripe. Uses
 * mode='payment' (one-time) with inline price_data so the donor can
 * choose any amount.
 *
 * Beneficiary is configured server-side via:
 *   - DONATION_BENEFICIARY_NAME (e.g., "National Alliance to End Homelessness")
 *   - DONATION_BENEFICIARY_URL  (e.g., https://endhomelessness.org)
 * The platform owner swaps these to redirect funds without a code
 * change. The Stripe transaction itself goes to the platform's Stripe
 * account; the platform owner is responsible for forwarding to the
 * beneficiary on a regular cadence (until we wire Stripe Connect or a
 * direct beneficiary account).
 *
 * Fail-soft when STRIPE_SECRET_KEY is not set.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const BENEFICIARY_NAME =
  process.env.DONATION_BENEFICIARY_NAME
  || 'National Alliance to End Homelessness';

const MIN_AMOUNT = 100;     // $1.00 minimum
const MAX_AMOUNT = 50000;   // $500 ceiling per single transaction

interface Body {
  amount_cents?: number;
  return_url?: string;
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!STRIPE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Donations not yet configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }

  const amount = Math.floor(Number(body.amount_cents ?? 0));
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return new Response(
      JSON.stringify({ error: `Amount must be between $${MIN_AMOUNT/100} and $${MAX_AMOUNT/100}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Optional caller identification — donors can be anonymous.
  let donorUserId: string | null = null;
  let donorEmail: string | undefined;
  const auth = req.headers.get('authorization');
  if (auth && SUPABASE_URL && SERVICE_ROLE) {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SERVICE_ROLE },
    });
    if (userRes.ok) {
      const u = (await userRes.json()) as any;
      donorUserId = u?.id ?? null;
      donorEmail = u?.email ?? undefined;
    }
  }

  // Stripe Checkout session — one-time payment.
  const stripeBody = new URLSearchParams();
  stripeBody.set('mode', 'payment');
  stripeBody.set('line_items[0][price_data][currency]', 'usd');
  stripeBody.set('line_items[0][price_data][unit_amount]', String(amount));
  stripeBody.set('line_items[0][price_data][product_data][name]',
    `Donation: ${BENEFICIARY_NAME}`);
  stripeBody.set('line_items[0][price_data][product_data][description]',
    `One-time donation routed to ${BENEFICIARY_NAME} via HereToo.`);
  stripeBody.set('line_items[0][quantity]', '1');

  const baseUrl =
    body.return_url
    || (req.headers.get('origin') ?? 'https://heretoo.social');
  stripeBody.set('success_url', `${baseUrl}/give?status=success&id={CHECKOUT_SESSION_ID}`);
  stripeBody.set('cancel_url', `${baseUrl}/give?status=canceled`);

  if (donorUserId) {
    stripeBody.set('client_reference_id', donorUserId);
    stripeBody.set('metadata[donor_user_id]', donorUserId);
  }
  if (donorEmail) stripeBody.set('customer_email', donorEmail);
  stripeBody.set('metadata[beneficiary]', BENEFICIARY_NAME);
  // Disable tip / address collection — keep it minimal.
  stripeBody.set('billing_address_collection', 'auto');
  // Submit type "donate" gives the customer a "Donate" button on the
  // Checkout page instead of "Pay."
  stripeBody.set('submit_type', 'donate');

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeBody.toString(),
  });
  if (!stripeRes.ok) {
    const errText = await stripeRes.text();
    // eslint-disable-next-line no-console
    console.error('[donate-checkout]', stripeRes.status, errText.slice(0, 300));
    return new Response(
      JSON.stringify({ error: 'Checkout session failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const session = (await stripeRes.json()) as { id: string; url: string };

  // Pre-record a pending donation row. The webhook flips status to
  // 'succeeded' on payment_intent.succeeded.
  if (SUPABASE_URL && SERVICE_ROLE) {
    await fetch(`${SUPABASE_URL}/rest/v1/donations`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        donor_user_id: donorUserId,
        stripe_checkout_id: session.id,
        amount_cents: amount,
        beneficiary: BENEFICIARY_NAME,
        status: 'pending',
      }),
    });
  }

  return new Response(
    JSON.stringify({ id: session.id, url: session.url }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = { path: '/api/donate-checkout' };
