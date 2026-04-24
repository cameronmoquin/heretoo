// Netlify serverless function: /.netlify/functions/candon-inbound-email
// Configure Resend to POST webhook events here.
// Event type: email.received (fires on any incoming mail to your verified domain).
//
// Env vars required:
//   RESEND_WEBHOOK_SECRET           - shared secret, verify signature (optional for now)
//   SUPABASE_URL                    - already set
//   SUPABASE_SERVICE_ROLE_KEY       - already set
//
// This function is defensive: it accepts any payload, attempts to match a
// family post via the "reply-to" address pattern, and writes the row.
// If parsing fails, it still stores the raw payload so nothing is lost.

import type { Handler } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * Extract the opaque reply token from a "Reply-To" address.
 * Convention: candon-reply+<postId>@family.heretoo.social
 */
function extractPostId(toAddresses: string[]): string | null {
  for (const addr of toAddresses) {
    const m = addr.match(/candon-reply\+([a-f0-9-]{8,})@/i);
    if (m) return m[1];
  }
  return null;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return { statusCode: 500, body: 'Supabase credentials not configured' };
  }

  let payload: any = {};
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    // Keep going — record the raw body at least.
  }

  // Resend structure (per their email.received event):
  //   payload.type === 'email.received'
  //   payload.data.email_id
  //   payload.data.from
  //   payload.data.to[]
  //   payload.data.subject
  //   payload.data.text
  //   payload.data.html
  //   payload.data.headers
  const data = payload?.data ?? {};
  const resendId = data.email_id ?? null;
  const fromAddress = typeof data.from === 'string' ? data.from : data.from?.address ?? null;
  const toAddresses: string[] = Array.isArray(data.to) ? data.to : (data.to ? [data.to] : []);
  const subject = data.subject ?? null;
  const bodyText = data.text ?? null;
  const bodyHtml = data.html ?? null;
  const headers = data.headers ?? null;

  // Try to resolve which post this is a reply to
  const postIdGuess = extractPostId(toAddresses);

  let family_post_id: string | null = null;
  let family_group_id: string | null = null;

  if (postIdGuess) {
    // Look up the post to grab its group id
    const lookup = await fetch(
      `${SUPABASE_URL}/rest/v1/candon_family_posts?id=eq.${postIdGuess}&select=id,family_group_id`,
      {
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      },
    );
    if (lookup.ok) {
      const rows = (await lookup.json()) as any[];
      if (rows[0]) {
        family_post_id = rows[0].id;
        family_group_id = rows[0].family_group_id;
      }
    }
  }

  // Insert the inbound email row
  const row = {
    resend_email_id: resendId,
    from_address: fromAddress,
    to_addresses: toAddresses,
    subject,
    headers,
    body_text: bodyText,
    body_html: bodyHtml,
    raw_metadata: { event_type: payload?.type ?? 'unknown', received_payload: payload },
    family_group_id,
    family_post_id,
    processed_at: new Date().toISOString(),
  };

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/candon_inbound_emails`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!insertRes.ok) {
    const errText = await insertRes.text();
    return { statusCode: 500, body: `Supabase insert failed: ${errText}` };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
