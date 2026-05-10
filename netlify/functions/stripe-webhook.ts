/**
 * /api/stripe-webhook — Stripe → HereToo subscription state sync.
 *
 * Source of Truth, Milestone 12. Stripe POSTs every relevant event
 * to this endpoint with a signed `stripe-signature` header. We verify
 * the signature, dispatch on the event type, and write to the
 * subscriptions + billing_events tables.
 *
 * Handled events:
 *   - checkout.session.completed: subscription created
 *   - customer.subscription.updated: status / period_end change
 *   - customer.subscription.deleted: canceled
 *   - invoice.payment_succeeded: payment_succeeded billing_event
 *   - invoice.payment_failed: payment_failed; if final, start grace
 *
 * Idempotency: the `stripe_event_id` on billing_events is unique, so
 * Stripe's standard "we may resend the same event" behavior is
 * automatically deduped.
 *
 * Failed-payment behavior matches the spec — 30-day grace, then
 * read-only. We don't implement read-only enforcement here (that's an
 * RLS / app-side concern); we just stamp grace_started_at.
 *
 * Fail-soft: if STRIPE_WEBHOOK_SECRET isn't set, returns 503. Until
 * Stripe is configured the function is dormant.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

// ── Stripe signature verification ───────────────────────────────────
// Stripe signs each request with HMAC-SHA256 over `${timestamp}.${body}`,
// using the webhook secret. We verify by recomputing.

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Format: "t=<timestamp>,v1=<sig>,v0=<sig>"
  const parts = signatureHeader.split(',').map((p) => p.trim());
  const tsPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tsPart || !v1Part) return false;
  const timestamp = tsPart.slice(2);
  const claimedSig = v1Part.slice(3);

  // Reject events older than 5 minutes (replay protection).
  const tsMs = parseInt(timestamp, 10) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return false;
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return constantTimeEqual(computed, claimedSig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Helpers ─────────────────────────────────────────────────────────

async function logEvent(
  subscriptionId: string | null,
  familyId: string | null,
  kind: string,
  amountCents: number | null,
  stripeEventId: string,
) {
  await fetch(`${SUPABASE_URL}/rest/v1/billing_events`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      subscription_id: subscriptionId,
      family_id: familyId,
      kind,
      amount_cents: amountCents,
      stripe_event_id: stripeEventId,
    }),
  });
}

async function upsertSubscription(input: {
  family_id: string | null;
  payer_user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
}) {
  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?on_conflict=stripe_subscription_id`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(input),
  });
}

async function getSubscriptionId(stripeSubscriptionId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?select=id,family_id&stripe_subscription_id=eq.${stripeSubscriptionId}`,
    { headers: HEADERS },
  );
  const rows = (await res.json()) as Array<{ id: string; family_id: string | null }>;
  return rows?.[0]?.id ?? null;
}

// ── Main ────────────────────────────────────────────────────────────

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Billing webhook not yet configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const ok = await verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  if (!ok) {
    return new Response('Bad signature', { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch {
    return new Response('Bad payload', { status: 400 });
  }

  // eslint-disable-next-line no-console
  console.log('[stripe-webhook]', event.type, event.id);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const stripeSubId = s.subscription;

        if (stripeSubId) {
          // Family subscription path.
          const familyId = s.metadata?.family_id ?? null;
          const payerId = s.metadata?.payer_user_id ?? null;
          const plan = (s.metadata?.plan ?? 'monthly') as string;
          const stripeCust = s.customer;

          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubId}`, {
            headers: { Authorization: `Bearer ${STRIPE_KEY}` },
          });
          const sub = (await subRes.json()) as any;

          await upsertSubscription({
            family_id: familyId,
            payer_user_id: payerId,
            stripe_customer_id: stripeCust,
            stripe_subscription_id: stripeSubId,
            plan,
            status: sub.status ?? 'active',
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          });

          const subId = await getSubscriptionId(stripeSubId);
          await logEvent(subId, familyId, 'created', null, event.id);
        } else if (s.payment_intent && s.metadata?.beneficiary) {
          // One-time donation path. Update the pre-recorded pending row.
          await fetch(
            `${SUPABASE_URL}/rest/v1/donations?stripe_checkout_id=eq.${s.id}`,
            {
              method: 'PATCH',
              headers: { ...HEADERS, Prefer: 'return=minimal' },
              body: JSON.stringify({
                stripe_payment_intent_id: s.payment_intent,
                status: 'succeeded',
              }),
            },
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const stripeSubId = sub.id;
        await fetch(
          `${SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubId}`,
          {
            method: 'PATCH',
            headers: { ...HEADERS, Prefer: 'return=minimal' },
            body: JSON.stringify({
              status: sub.status,
              current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
            }),
          },
        );
        const subId = await getSubscriptionId(stripeSubId);
        await logEvent(subId, null, 'renewed', null, event.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const stripeSubId = sub.id;
        await fetch(
          `${SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubId}`,
          {
            method: 'PATCH',
            headers: { ...HEADERS, Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'canceled' }),
          },
        );
        const subId = await getSubscriptionId(stripeSubId);
        await logEvent(subId, null, 'canceled', null, event.id);
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        const stripeSubId = inv.subscription;
        if (stripeSubId) {
          // Clear grace if it was set.
          await fetch(
            `${SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubId}`,
            {
              method: 'PATCH',
              headers: { ...HEADERS, Prefer: 'return=minimal' },
              body: JSON.stringify({ grace_started_at: null }),
            },
          );
          const subId = await getSubscriptionId(stripeSubId);
          await logEvent(subId, null, 'payment_succeeded', inv.amount_paid, event.id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const stripeSubId = inv.subscription;
        if (stripeSubId) {
          // Stamp grace start (idempotent — only sets if currently null).
          await fetch(
            `${SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubId}&grace_started_at=is.null`,
            {
              method: 'PATCH',
              headers: { ...HEADERS, Prefer: 'return=minimal' },
              body: JSON.stringify({ grace_started_at: new Date().toISOString() }),
            },
          );
          const subId = await getSubscriptionId(stripeSubId);
          await logEvent(subId, null, 'payment_failed', inv.amount_due, event.id);
        }
        break;
      }
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] handler error', e?.message ?? e);
    // Still return 200 so Stripe doesn't retry forever; we log the error.
  }

  return new Response('ok', { status: 200 });
};

export const config: Config = { path: '/api/stripe-webhook' };
